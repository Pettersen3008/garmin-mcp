import { describe, expect, it } from "bun:test";
import { createGarminSignInUrl, parseGarminTicket } from "../src/auth/login.ts";
import { exchangeTicket } from "../src/auth/oauth.ts";
import type { Fetch } from "../src/http/request.ts";

describe("Garmin authentication", () => {
  it("given a Garmin browser redirect, when authenticating, then exchanges only its ticket", async () => {
    const requests: Request[] = [];
    const fakeFetch: Fetch = async (input, init) => {
      if (!(input instanceof URL)) {
        throw new TypeError("Expected a URL request");
      }
      const request = new Request(input.toString(), init);
      requests.push(request);
      if (requests.length === 1) {
        return new Response(
          "oauth_token=oauth-one&oauth_token_secret=secret-one",
        );
      }
      return Response.json({
        access_token: "access-two",
        expires_in: 3600,
        refresh_token: "refresh-two",
        refresh_token_expires_in: 86400,
        scope: "CONNECT_READ",
        token_type: "bearer",
      });
    };

    const session = await exchangeTicket({
      fetch: fakeFetch,
      now: () => 1_800_000_000_000,
      ticket: parseGarminTicket(
        "https://sso.garmin.com/sso/embed?ticket=ST-example",
      ),
    });

    expect(createGarminSignInUrl().origin).toBe("https://sso.garmin.com");
    expect(requests.map((request) => request.url)).toEqual([
      "https://connectapi.garmin.com/oauth-service/oauth/preauthorized?ticket=ST-example&login-url=https%3A%2F%2Fmobile.integration.garmin.com%2Fgcm%2Fandroid&accepts-mfa-tokens=true",
      "https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0",
    ]);
    expect(session.oauth2).toMatchObject({
      accessToken: "access-two",
      expiresAtEpochSeconds: 1_800_003_600,
    });
  });

  it("given a malformed service ticket, when exchanging it, then rejects before contacting Garmin", async () => {
    let requested = false;

    await expect(
      exchangeTicket({
        fetch: async () => {
          requested = true;
          return new Response();
        },
        now: Date.now,
        ticket: "not-a-ticket",
      }),
    ).rejects.toThrow("Invalid Garmin service ticket");

    expect(requested).toBe(false);
  });
});
