import { exchangeOAuth2 } from "../auth/oauth.ts";
import type { GarminSession, SessionStore } from "../auth/session.ts";
import {
  GarminAuthError,
  GarminInvalidResponseError,
  GarminNetworkError,
  GarminRateLimitError,
} from "./errors.ts";

export type GetJson = (input: {
  path: string;
  query?: Record<string, string>;
}) => Promise<unknown>;

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

export function createGetJson(input: {
  diagnostics?: (event: DiagnosticEvent) => void;
  fetch: Fetch;
  now: () => number;
  session: GarminSession;
  sessionStore: SessionStore;
}): GetJson {
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
      oauth2: await exchangeOAuth2({
        fetch: input.fetch,
        now: input.now,
        oauth1: session.oauth1,
      }),
    };
    await input.sessionStore.save(session);
    return session.oauth2.accessToken;
  }

  return async ({ path, query }) => {
    validatePath(path);
    const url = new URL(path, "https://connectapi.garmin.com");
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    let forceRefresh = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      input.diagnostics?.({ kind: attempt === 0 ? "request" : "retry", path });
      let response: Response;
      try {
        response = await input.fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${await accessToken(forceRefresh)}`,
            "User-Agent": "GCM-Android-5.23",
          },
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        if (error instanceof GarminAuthError) {
          throw error;
        }
        if (attempt === 0) {
          await Bun.sleep(250);
          continue;
        }
        throw new GarminNetworkError("Garmin request failed");
      }

      if (response.status === 401) {
        if (attempt === 0) {
          forceRefresh = true;
          continue;
        }
        throw new GarminAuthError("Garmin rejected the stored session");
      }
      if (response.status === 429) {
        throw new GarminRateLimitError("Garmin rate limit reached");
      }
      if (response.status >= 500 && attempt === 0) {
        input.diagnostics?.({ kind: "retry", path, status: response.status });
        await Bun.sleep(250);
        continue;
      }
      if (!response.ok) {
        throw new GarminNetworkError(
          `Garmin request failed with HTTP ${response.status}`,
        );
      }
      if (response.status === 204) {
        return undefined;
      }
      try {
        return await response.json();
      } catch {
        throw new GarminInvalidResponseError("Garmin returned invalid JSON");
      }
    }

    throw new GarminNetworkError("Garmin request failed");
  };
}
