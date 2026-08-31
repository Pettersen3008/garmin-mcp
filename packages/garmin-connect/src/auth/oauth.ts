import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  GarminAuthError,
  GarminInvalidResponseError,
  GarminNetworkError,
} from "../http/errors.ts";
import type { Fetch } from "../http/request.ts";
import type { GarminSession, OAuth1Token, OAuth2Token } from "./session.ts";

const consumerKey = "REMOVED";
const consumerSecret = "REMOVED";
const userAgent = "com.garmin.android.apps.connectmobile";

const oauth2ResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
  refresh_token_expires_in: z.number().int().positive(),
  scope: z.string(),
  token_type: z.string().min(1),
});

function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function createOAuthHeader(input: {
  body?: URLSearchParams;
  method: "GET" | "POST";
  oauthToken?: OAuth1Token;
  url: URL;
}): string {
  const oauth = new URLSearchParams({
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  });
  if (input.oauthToken) {
    oauth.set("oauth_token", input.oauthToken.oauthToken);
  }

  const parameters = [
    ...input.url.searchParams,
    ...oauth,
    ...(input.body ? [...input.body] : []),
  ]
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const baseUrl = `${input.url.protocol}//${input.url.host}${input.url.pathname}`;
  const signatureBase = [
    input.method,
    encode(baseUrl),
    encode(parameters),
  ].join("&");
  const signingKey = `${encode(consumerSecret)}&${encode(input.oauthToken?.oauthTokenSecret ?? "")}`;
  const signature = createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");
  oauth.set("oauth_signature", signature);

  return `OAuth ${[...oauth]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encode(key)}="${encode(value)}"`)
    .join(", ")}`;
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

export async function exchangeTicket(input: {
  fetch: Fetch;
  now: () => number;
  ticket: string;
}): Promise<GarminSession> {
  const ticket = input.ticket.trim();
  if (!ticket.startsWith("ST-") || /\s/.test(ticket)) {
    throw new GarminAuthError("Invalid Garmin service ticket");
  }
  const url = new URL(
    "https://connectapi.garmin.com/oauth-service/oauth/preauthorized",
  );
  url.searchParams.set("ticket", ticket);
  url.searchParams.set(
    "login-url",
    "https://mobile.integration.garmin.com/gcm/android",
  );
  url.searchParams.set("accepts-mfa-tokens", "true");
  const response = await fetchOrThrow(input.fetch, url, {
    headers: {
      Authorization: createOAuthHeader({ method: "GET", url }),
      "User-Agent": userAgent,
    },
  });
  const values = new URLSearchParams(await response.text());
  const oauthToken = values.get("oauth_token");
  const oauthTokenSecret = values.get("oauth_token_secret");
  if (!oauthToken || !oauthTokenSecret) {
    throw new GarminInvalidResponseError(
      "Garmin returned an invalid OAuth 1 token",
    );
  }
  const mfaToken = values.get("mfa_token") ?? undefined;
  const oauth1: OAuth1Token = {
    oauthToken,
    oauthTokenSecret,
    ...(mfaToken ? { mfaToken } : {}),
  };
  const oauth2 = await exchangeOAuth2({
    fetch: input.fetch,
    now: input.now,
    oauth1,
  });
  return { oauth1, oauth2 };
}

export async function exchangeOAuth2(input: {
  fetch: Fetch;
  now: () => number;
  oauth1: OAuth1Token;
}): Promise<OAuth2Token> {
  const url = new URL(
    "https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0",
  );
  const body = new URLSearchParams();
  if (input.oauth1.mfaToken) {
    body.set("mfa_token", input.oauth1.mfaToken);
  }
  const response = await fetchOrThrow(input.fetch, url, {
    body,
    headers: {
      Authorization: createOAuthHeader({
        body,
        method: "POST",
        oauthToken: input.oauth1,
        url,
      }),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    method: "POST",
  });
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
  const nowSeconds = Math.floor(input.now() / 1000);
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
