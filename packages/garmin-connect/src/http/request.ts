import { createNativeHeaders, refreshOAuth2 } from "../auth/oauth.ts";
import type { GarminSession, SessionStore } from "../auth/session.ts";
import {
  GarminAuthError,
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
} & (
  | { method: "POST" | "PUT"; body: unknown }
  | { method: "DELETE"; body?: never }
);

export type GetJson = (input: GetRequest) => Promise<unknown>;
export type RequestJson = (
  input: GetRequest | WriteRequest,
) => Promise<unknown>;

export type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type DiagnosticEvent = {
  kind: "request" | "retry";
  path: string;
  status?: number;
};

function validatePath(path: string): void {
  const decoded = decodeURIComponent(path);
  if (
    !path.startsWith("/") ||
    decoded.includes("?") ||
    decoded.includes("#") ||
    decoded.includes("\\") ||
    decoded.split("/").some((segment) => segment.split(";", 1)[0] === "..")
  ) {
    throw new GarminInvalidResponseError("Invalid Garmin API path");
  }
}

export function createRequestJson(input: {
  diagnostics?: (event: DiagnosticEvent) => void;
  fetch: Fetch;
  now: () => number;
  session: GarminSession;
  sessionStore: SessionStore;
}): RequestJson {
  let session = input.session;

  async function accessToken(forceRefresh: boolean): Promise<string> {
    const nowSeconds = Math.floor(input.now() / 1000);
    if (
      !forceRefresh &&
      session.oauth2.expiresAtEpochSeconds > nowSeconds + 60
    ) {
      return session.oauth2.accessToken;
    }
    if (session.oauth2.refreshTokenExpiresAtEpochSeconds <= nowSeconds) {
      throw new GarminAuthError(
        "Garmin session expired. Run bun run auth again",
      );
    }
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
    return session.oauth2.accessToken;
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
    const attempts = method === "GET" ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      input.diagnostics?.({ kind: attempt === 0 ? "request" : "retry", path });
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
        if (error instanceof GarminAuthError) {
          throw error;
        }
        if (attempt + 1 < attempts) {
          await Bun.sleep(250);
          continue;
        }
        throw new GarminNetworkError("Garmin request failed");
      }

      if (response.status === 401) {
        if (attempt + 1 < attempts) {
          forceRefresh = true;
          continue;
        }
        throw new GarminAuthError("Garmin rejected the stored session");
      }
      if (response.status === 429) {
        throw new GarminRateLimitError("Garmin rate limit reached");
      }
      if (response.status >= 500 && attempt + 1 < attempts) {
        input.diagnostics?.({ kind: "retry", path, status: response.status });
        await Bun.sleep(250);
        continue;
      }
      if (!response.ok) {
        throw new GarminNetworkError(
          `Garmin request failed with HTTP ${response.status}`,
        );
      }
      try {
        const text = await response.text();
        return text.length === 0 ? undefined : JSON.parse(text);
      } catch {
        throw new GarminInvalidResponseError("Garmin returned invalid JSON");
      }
    }

    throw new GarminNetworkError("Garmin request failed");
  };
}
