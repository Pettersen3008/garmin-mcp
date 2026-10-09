import { describe, expect, it } from "bun:test";
import { createGarminSignInUrl, parseGarminTicket } from "../src/auth/login.ts";
import { exchangeTicket } from "../src/auth/oauth.ts";
import { credentialStoreCommand } from "../src/auth/token-store.ts";
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
      "https://diauth.garmin.com/di-oauth2-service/oauth/token",
    ]);
    expect(requests[0]?.method).toBe("POST");
    expect(await requests[0]?.text()).toBe(
      "client_id=GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2&service_ticket=ST-example&grant_type=https%3A%2F%2Fconnectapi.garmin.com%2Fdi-oauth2-service%2Foauth%2Fgrant%2Fservice_ticket&service_url=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed",
    );
    expect(requests[0]?.headers.get("authorization")).toBe(
      `Basic ${Buffer.from("GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2:").toString("base64")}`,
    );
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

  it("given each supported platform, when saving a session, then pipes tokens to its credential store instead of argv", () => {
    const session = {
      clientId: "client",
      oauth2: {
        accessToken: "access",
        expiresAtEpochSeconds: 1,
        refreshToken: "refresh",
        refreshTokenExpiresAtEpochSeconds: 2,
        scope: "scope",
        tokenType: "bearer",
      },
    };

    for (const platform of ["darwin", "linux", "win32"] as const) {
      const command = credentialStoreCommand(platform, session);
      expect(command.args.join(" ")).not.toContain("access");
      expect(new TextDecoder().decode(command.stdin)).toContain("access");
    }
  });
});
