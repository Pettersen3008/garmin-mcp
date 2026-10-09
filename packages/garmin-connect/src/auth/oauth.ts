import { Buffer } from "node:buffer";
import { z } from "zod";
import {
  GarminAuthError,
  GarminInvalidResponseError,
  GarminNetworkError,
} from "../http/errors.ts";
import type { Fetch } from "../http/request.ts";
import type { GarminSession, OAuth2Token } from "./session.ts";

const clientId = "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2";
const tokenUrl = new URL(
  "https://diauth.garmin.com/di-oauth2-service/oauth/token",
);

const oauth2ResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
  refresh_token_expires_in: z.number().int().positive(),
  scope: z.string(),
  token_type: z.string().min(1),
});

export function createNativeHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "User-Agent": "GCM-Android-5.23",
    "X-Garmin-User-Agent":
      "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
    "X-Garmin-Paired-App-Version": "10861",
    "X-Garmin-Client-Platform": "Android",
    "X-App-Ver": "10861",
    "X-Lang": "en",
    "X-GCExperience": "GC5",
    ...extra,
  };
}

function basicAuth(value: string): string {
  return `Basic ${Buffer.from(`${value}:`).toString("base64")}`;
}

async function fetchOrThrow(
  fetchFn: Fetch,
  url: URL,
  init: RequestInit,
): Promise<Response> {
  try {
    const response = await fetchFn(url, init);
    if (!response.ok) {
      throw new GarminAuthError(
        `Garmin authentication failed with HTTP ${response.status}`,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof GarminAuthError) {
      throw error;
    }
    throw new GarminNetworkError("Could not reach Garmin authentication");
  }
}

async function parseOAuth2(
  response: Response,
  now: () => number,
): Promise<OAuth2Token> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new GarminInvalidResponseError(
      "Garmin returned invalid OAuth 2 JSON",
    );
  }
  const parsed = oauth2ResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new GarminInvalidResponseError(
      "Garmin returned an invalid OAuth 2 token",
    );
  }
  const nowSeconds = Math.floor(now() / 1000);
  return {
    accessToken: parsed.data.access_token,
    expiresAtEpochSeconds: nowSeconds + parsed.data.expires_in,
    refreshToken: parsed.data.refresh_token,
    refreshTokenExpiresAtEpochSeconds:
      nowSeconds + parsed.data.refresh_token_expires_in,
    scope: parsed.data.scope,
    tokenType: parsed.data.token_type,
  };
}

async function requestOAuth2(input: {
  body: URLSearchParams;
  clientId: string;
  fetch: Fetch;
  now: () => number;
}): Promise<OAuth2Token> {
  const response = await fetchOrThrow(input.fetch, tokenUrl, {
    body: input.body,
    headers: createNativeHeaders({
      Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      Authorization: basicAuth(input.clientId),
      "Cache-Control": "no-cache",
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    method: "POST",
  });
  return parseOAuth2(response, input.now);
}

export async function exchangeTicket(input: {
  fetch: Fetch;
  now: () => number;
  ticket: string;
}): Promise<GarminSession> {
  const ticket = input.ticket.trim();
  if (!ticket.startsWith("ST-") || /\s/.test(ticket)) {
    throw new GarminAuthError("Invalid Garmin service ticket");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    service_ticket: ticket,
    grant_type:
      "https://connectapi.garmin.com/di-oauth2-service/oauth/grant/service_ticket",
    service_url: "https://sso.garmin.com/sso/embed",
  });
  return {
    clientId,
    oauth2: await requestOAuth2({
      body,
      clientId,
      fetch: input.fetch,
      now: input.now,
    }),
  };
}

export function refreshOAuth2(input: {
  clientId: string;
  fetch: Fetch;
  now: () => number;
  refreshToken: string;
}): Promise<OAuth2Token> {
  return requestOAuth2({
    body: new URLSearchParams({
      client_id: input.clientId,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
    clientId: input.clientId,
    fetch: input.fetch,
    now: input.now,
  });
}
