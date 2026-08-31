import { expect, it } from "bun:test";
import type { GarminSession } from "../src/auth/session.ts";
import { createGetJson } from "../src/http/request.ts";

const session: GarminSession = {
  oauth1: { oauthToken: "one", oauthTokenSecret: "secret" },
  oauth2: {
    accessToken: "two",
    expiresAtEpochSeconds: 2_000_000_000,
    refreshToken: "refresh",
    refreshTokenExpiresAtEpochSeconds: 2_100_000_000,
    scope: "CONNECT_READ",
    tokenType: "bearer",
  },
};

it("given a stored session, when requesting JSON, then sends a bearer token without logging it", async () => {
  const diagnostics: unknown[] = [];
  let request: Request | undefined;
  const getJson = createGetJson({
    diagnostics: (event) => diagnostics.push(event),
    fetch: async (input, init) => {
      if (!(input instanceof URL)) {
        throw new TypeError("Expected a URL request");
      }
      request = new Request(input.toString(), init);
      return Response.json({ ok: true });
    },
    now: () => 1_900_000_000_000,
    session,
    sessionStore: {
      async load() {
        return session;
      },
      async save() {},
    },
  });

  await expect(
    getJson({ path: "/example", query: { date: "2026-08-30" } }),
  ).resolves.toEqual({
    ok: true,
  });
  expect(request?.headers.get("authorization")).toBe("Bearer two");
  expect(JSON.stringify(diagnostics)).not.toContain("two");
});
