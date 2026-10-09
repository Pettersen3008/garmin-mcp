import { expect, it } from "bun:test";
import type { GarminSession } from "../src/auth/session.ts";
import { createRequestJson } from "../src/http/request.ts";

const expiredSession: GarminSession = {
  clientId: "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2",
  oauth2: {
    accessToken: "two",
    expiresAtEpochSeconds: 1_800_000_000,
    refreshToken: "refresh",
    refreshTokenExpiresAtEpochSeconds: 2_100_000_000,
    scope: "CONNECT_READ",
    tokenType: "bearer",
  },
};

it("given an expired access token, when requesting JSON, then refreshes and saves the session without logging tokens", async () => {
  const diagnostics: unknown[] = [];
  const requests: Request[] = [];
  let savedSession: GarminSession | undefined;
  const getJson = createRequestJson({
    diagnostics: (event) => diagnostics.push(event),
    fetch: async (input, init) => {
      if (!(input instanceof URL)) {
        throw new TypeError("Expected a URL request");
      }
      requests.push(new Request(input.toString(), init));
      if (input.hostname === "diauth.garmin.com") {
        return Response.json({
          access_token: "three",
          expires_in: 3600,
          refresh_token: "refresh-three",
          refresh_token_expires_in: 86400,
          scope: "CONNECT_READ",
          token_type: "bearer",
        });
      }
      return Response.json({ ok: true });
    },
    now: () => 1_900_000_000_000,
    session: expiredSession,
    sessionStore: {
      async save(session) {
        savedSession = session;
      },
    },
  });

  await expect(
    getJson({ path: "/example", query: { date: "2026-08-30" } }),
  ).resolves.toEqual({
    ok: true,
  });
  expect(requests.map((request) => request.url)).toEqual([
    "https://diauth.garmin.com/di-oauth2-service/oauth/token",
    "https://connectapi.garmin.com/example?date=2026-08-30",
  ]);
  expect(await requests[0]?.text()).toBe(
    "client_id=GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2&grant_type=refresh_token&refresh_token=refresh",
  );
  expect(requests[1]?.headers.get("authorization")).toBe("Bearer three");
  expect(savedSession?.oauth2.accessToken).toBe("three");
  expect(JSON.stringify(diagnostics)).not.toMatch(/two|three|refresh/);
});

it("given a mutation, when Garmin fails, then sends its JSON body once", async () => {
  const requests: Request[] = [];
  const requestJson = createRequestJson({
    fetch: async (input, init) => {
      if (input instanceof Request) {
        throw new TypeError("Expected a URL request");
      }
      requests.push(new Request(input.toString(), init));
      return new Response(null, { status: 500 });
    },
    now: () => 1_700_000_000_000,
    session: expiredSession,
    sessionStore: {
      async save() {},
    },
  });

  await expect(
    requestJson({
      body: { activityId: "42", activityName: "Morning run" },
      method: "PUT",
      path: "/activity-service/activity/42",
    }),
  ).rejects.toThrow("Garmin request failed with HTTP 500");
  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe("PUT");
  expect(requests[0]?.headers.get("content-type")).toBe("application/json");
  expect(await requests[0]?.json()).toEqual({
    activityId: "42",
    activityName: "Morning run",
  });
});

it("given an empty successful response, when deleting, then returns no JSON", async () => {
  const requestJson = createRequestJson({
    fetch: async () => new Response(null, { status: 200 }),
    now: () => 1_700_000_000_000,
    session: expiredSession,
    sessionStore: {
      async save() {},
    },
  });

  await expect(
    requestJson({ method: "DELETE", path: "/workout-service/workout/7" }),
  ).resolves.toBeUndefined();
});

it("given an expired token and parallel requests, when they run, then refresh runs once", async () => {
  let refreshes = 0;
  const getJson = createRequestJson({
    fetch: async (input) => {
      if (input instanceof URL && input.hostname === "diauth.garmin.com") {
        refreshes += 1;
        return Response.json({
          access_token: "three",
          expires_in: 3600,
          refresh_token: "refresh-three",
          refresh_token_expires_in: 86400,
          scope: "CONNECT_READ",
          token_type: "bearer",
        });
      }
      return Response.json({ ok: true });
    },
    now: () => 1_900_000_000_000,
    session: expiredSession,
    sessionStore: { async save() {} },
  });

  await Promise.all([getJson({ path: "/a" }), getJson({ path: "/b" })]);

  expect(refreshes).toBe(1);
});
