import { expect, it } from "bun:test";
import type { GarminSession } from "../src/auth/session.ts";
import { createGarminClient } from "../src/client.ts";
import type { Fetch } from "../src/http/request.ts";
import { parseLocalDate } from "../src/local-date.ts";

const fixture = (name: string): Promise<unknown> =>
  Bun.file(new URL(`fixtures/garmin/${name}.json`, import.meta.url)).json();

it("given a stored session and Garmin fixtures, when using the public client, then all reads cross the authenticated request boundary", async () => {
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
      "/wellness-service/wellness/dailyHeartRate/anonymous",
      await fixture("heart-rate"),
    ],
    ["/hrv-service/hrv/2026-08-30", await fixture("hrv")],
    [
      "/wellness-service/wellness/dailyStress/2026-08-30",
      await fixture("stress"),
    ],
    [
      "/wellness-service/wellness/bodyBattery/reports/daily",
      await fixture("body-battery"),
    ],
    [
      "/wellness-service/wellness/daily/respiration/2026-08-30",
      await fixture("respiration"),
    ],
    [
      "/wellness-service/wellness/daily/spo2/2026-08-30",
      await fixture("blood-oxygen"),
    ],
    ["/weight-service/weight/dateRange", await fixture("body-composition")],
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
    clientId: "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2",
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
    client.heartRate.get({ date }),
    client.health.getHrv({ date }),
    client.health.getStress({ date }),
    client.health.getBodyBattery({ date }),
    client.health.getRespiration({ date }),
    client.health.getBloodOxygen({ date }),
    client.health.getBodyComposition({ date }),
    client.sleep.get({ date }),
    client.training.getStatus({ date }),
    client.training.getReadiness({ date }),
  ]);

  expect(results).toHaveLength(13);
  expect(results.every((result) => result !== null)).toBe(true);
});

it("given a service ticket, when creating the client and later refreshing, then stores each session", async () => {
  let savedSession: GarminSession | undefined;
  let now = 1_800_000_000_000;
  let tokens = 0;
  const requests: Request[] = [];
  const fetchTicket: Fetch = async (input, init) => {
    if (!(input instanceof URL)) {
      throw new TypeError("Expected a URL request");
    }
    requests.push(new Request(input.toString(), init));
    if (input.pathname.endsWith("/di-oauth2-service/oauth/token")) {
      tokens += 1;
      return Response.json({
        access_token: `access-${tokens}`,
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
    return Response.json(null);
  };

  const client = await createGarminClient({
    fetch: fetchTicket,
    now: () => now,
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

  expect(savedSession?.oauth2.accessToken).toBe("access-1");
  expect(requests).toHaveLength(2);
  expect(await requests[0]?.text()).toContain("service_ticket=ST-fixture");

  now += 7_200_000;
  await client.health.getHrv({ date: parseLocalDate("2026-08-30") });
  expect(savedSession?.oauth2.accessToken).toBe("access-2");
});
