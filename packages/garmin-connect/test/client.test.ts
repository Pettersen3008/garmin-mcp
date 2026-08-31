import { expect, it } from "bun:test";
import type { GarminSession } from "../src/auth/session.ts";
import { createGarminClient } from "../src/client.ts";
import type { Fetch } from "../src/http/request.ts";
import { parseLocalDate } from "../src/local-date.ts";

const fixture = (name: string): Promise<unknown> =>
  Bun.file(new URL(`fixtures/garmin/${name}.json`, import.meta.url)).json();

it("given a stored session and Garmin fixtures, when using the public client, then all six operations cross the authenticated request boundary", async () => {
  const activityResponses = await fixture("activity-responses");
  if (
    typeof activityResponses !== "object" ||
    activityResponses === null ||
    !("list" in activityResponses) ||
    !("detail" in activityResponses)
  ) {
    throw new TypeError("Invalid activity fixture");
  }
  const responses = new Map<string, unknown>([
    ["/userprofile-service/socialProfile", { displayName: "anonymous" }],
    [
      "/activitylist-service/activities/search/activities",
      activityResponses.list,
    ],
    ["/activity-service/activity/42", activityResponses.detail],
    [
      "/usersummary-service/usersummary/daily/anonymous",
      await fixture("daily-summary"),
    ],
    [
      "/wellness-service/wellness/dailySleepData/anonymous",
      await fixture("sleep"),
    ],
    [
      "/metrics-service/metrics/trainingstatus/aggregated/2026-08-30",
      await fixture("training-status"),
    ],
    [
      "/metrics-service/metrics/trainingreadiness/2026-08-30",
      await fixture("training-readiness"),
    ],
  ]);
  const fetchFixture: Fetch = async (input) => {
    if (!(input instanceof URL)) {
      throw new TypeError("Expected a URL request");
    }
    const response = responses.get(input.pathname);
    if (response === undefined) {
      return new Response(null, { status: 404 });
    }
    return Response.json(response);
  };
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
  const client = await createGarminClient({
    fetch: fetchFixture,
    now: () => 1_900_000_000_000,
    sessionStore: {
      async load() {
        return session;
      },
      async save() {},
    },
  });
  const date = parseLocalDate("2026-08-30");

  const results = await Promise.all([
    client.activities.list({ limit: 1 }),
    client.activities.get({ id: "42" }),
    client.dailySummary.get({ date }),
    client.sleep.get({ date }),
    client.training.getStatus({ date }),
    client.training.getReadiness({ date }),
  ]);

  expect(results).toHaveLength(6);
  expect(results.every((result) => result !== null)).toBe(true);
});

it("given a service ticket, when creating the client, then exchanges and stores a session", async () => {
  let savedSession: GarminSession | undefined;
  const requestedUrls: string[] = [];
  const fetchTicket: Fetch = async (input) => {
    if (!(input instanceof URL)) {
      throw new TypeError("Expected a URL request");
    }
    requestedUrls.push(input.toString());
    if (input.pathname.endsWith("/preauthorized")) {
      return new Response(
        "oauth_token=oauth-one&oauth_token_secret=secret-one",
      );
    }
    if (input.pathname.endsWith("/exchange/user/2.0")) {
      return Response.json({
        access_token: "access-two",
        expires_in: 3600,
        refresh_token: "refresh-two",
        refresh_token_expires_in: 86400,
        scope: "CONNECT_READ",
        token_type: "bearer",
      });
    }
    if (input.pathname.endsWith("/socialProfile")) {
      return Response.json({ displayName: "anonymous" });
    }
    return new Response(null, { status: 404 });
  };

  await createGarminClient({
    fetch: fetchTicket,
    now: () => 1_800_000_000_000,
    serviceTicket: "ST-fixture",
    sessionStore: {
      async load() {
        throw new Error("A supplied ticket must replace the stored session");
      },
      async save(session) {
        savedSession = session;
      },
    },
  });

  expect(savedSession?.oauth2.accessToken).toBe("access-two");
  expect(requestedUrls).toHaveLength(3);
  expect(requestedUrls[0]).toContain("ticket=ST-fixture");
});
