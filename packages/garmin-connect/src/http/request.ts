import { createNativeHeaders, refreshOAuth2 } from "../auth/oauth.ts";
import type { GarminSession, SessionStore } from "../auth/session.ts";
import {
  GarminAuthError,
  GarminError,
  GarminHttpError,
  GarminInvalidResponseError,
  GarminNetworkError,
  GarminRateLimitError,
} from "./errors.ts";

type GetRequest = {
  path: string;
  query?: Record<string, string>;
  method?: "GET";
  body?: never;
};

type WriteRequest = {
  path: string;
  query?: Record<string, string>;
} & ({ method: "POST" | "PUT"; body: unknown } | { method: "DELETE"; body?: never });

export type GetJson = (input: GetRequest) => Promise<unknown>;
export type RequestJson = (input: GetRequest | WriteRequest) => Promise<unknown>;

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type DiagnosticEvent = {
  kind: "request" | "retry";
  path: string;
  status?: number;
};

function validatePath(path: string): void {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch (error) {
    throw new TypeError("Invalid Garmin API path", { cause: error });
  }
  if (
    !path.startsWith("/") ||
    decoded.includes("?") ||
    decoded.includes("#") ||
    decoded.includes("\\") ||
    decoded.split("/").some((segment) => segment.split(";", 1)[0] === "..")
  ) {
    throw new TypeError("Invalid Garmin API path");
  }
}

export function createRequestJson(input: {
  diagnostics?: (event: DiagnosticEvent) => void;
  fetch: Fetch;
  now: () => number;
  session: GarminSession;
  sessionStore: Pick<SessionStore, "save">;
}): RequestJson {
  let session = input.session;
  let refreshing: Promise<GarminSession> | undefined;

  async function refresh(): Promise<GarminSession> {
    session = {
      ...session,
      oauth2: await refreshOAuth2({
        clientId: session.clientId,
        fetch: input.fetch,
        now: input.now,
        refreshToken: session.oauth2.refreshToken,
      }),
    };
    await input.sessionStore.save(session);
    return session;
  }

  async function accessToken(forceRefresh: boolean): Promise<string> {
    const nowSeconds = Math.floor(input.now() / 1000);
    if (!forceRefresh && session.oauth2.expiresAtEpochSeconds > nowSeconds + 60) {
      return session.oauth2.accessToken;
    }
    if (session.oauth2.refreshTokenExpiresAtEpochSeconds <= nowSeconds) {
      throw new GarminAuthError("Garmin session expired. Run bun run auth again");
    }
    refreshing ??= refresh().finally(() => {
      refreshing = undefined;
    });
    return (await refreshing).oauth2.accessToken;
  }

  return async (request) => {
    const { path, query } = request;
    const method = request.method ?? "GET";
    const body = "body" in request ? request.body : undefined;
    validatePath(path);
    const url = new URL(path, "https://connectapi.garmin.com");
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    let forceRefresh = false;
    let retryStatus: number | undefined;
    // A 401 never reached Garmin's handler, so writes may retry it; 5xx and network retries stay GET-only.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const canRetry = attempt === 0;
      input.diagnostics?.(
        canRetry
          ? { kind: "request", path }
          : {
              kind: "retry",
              path,
              ...(retryStatus === undefined ? {} : { status: retryStatus }),
            },
      );
      let response: Response;
      try {
        const headers = createNativeHeaders({
          Accept: "application/json",
          Authorization: `Bearer ${await accessToken(forceRefresh)}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        });
        response = await input.fetch(url, {
          body: body === undefined ? undefined : JSON.stringify(body),
          headers,
          method,
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        if (error instanceof GarminError) {
          throw error;
        }
        if (canRetry && method === "GET") {
          await Bun.sleep(250);
          continue;
        }
        throw new GarminNetworkError("Garmin request failed", { cause: error });
      }

      if (response.status === 401) {
        if (canRetry) {
          forceRefresh = true;
          retryStatus = 401;
          continue;
        }
        throw new GarminAuthError("Garmin rejected the stored session");
      }
      if (response.status === 429) {
        throw new GarminRateLimitError("Garmin rate limit reached");
      }
      if (response.status >= 500 && canRetry && method === "GET") {
        retryStatus = response.status;
        await Bun.sleep(250);
        continue;
      }
      if (!response.ok) {
        throw new GarminHttpError(response.status);
      }
      try {
        const text = await response.text();
        return text.length === 0 ? undefined : JSON.parse(text);
      } catch (error) {
        throw new GarminInvalidResponseError("Garmin returned invalid JSON", {
          cause: error,
        });
      }
    }

    throw new GarminNetworkError("Garmin request failed");
  };
}
