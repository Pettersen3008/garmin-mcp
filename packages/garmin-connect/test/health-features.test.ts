import { describe, expect, it } from "bun:test";
import { getDailySummary } from "../src/features/daily-summary/get.ts";
import { mapDailySummary } from "../src/features/daily-summary/map.ts";
import { getSleep } from "../src/features/sleep/get.ts";
import { mapSleep } from "../src/features/sleep/map.ts";
import { getTrainingReadiness } from "../src/features/training/get-readiness.ts";
import { getTrainingStatus } from "../src/features/training/get-status.ts";
import {
  mapTrainingReadiness,
  mapTrainingStatus,
} from "../src/features/training/map.ts";
import type { GetJson } from "../src/http/request.ts";
import { parseLocalDate } from "../src/local-date.ts";

const fixture = (name: string): Promise<unknown> =>
  Bun.file(new URL(`fixtures/garmin/${name}.json`, import.meta.url)).json();

describe("health feature mappers", () => {
  it("given anonymized Garmin fixtures, when mapping, then returns stable unit-named models", async () => {
    expect(mapDailySummary(await fixture("daily-summary"))).toMatchObject({
      date: "2026-08-30",
      distanceMeters: 6240,
      intensityMinutes: 28,
      restingHeartRateBpm: 48,
    });
    expect(mapSleep(await fixture("sleep"))).toMatchObject({
      date: "2026-08-30",
      sleepDurationSeconds: 27300,
      sleepScore: 87,
    });
    expect(mapTrainingStatus(await fixture("training-status"))).toMatchObject({
      acuteLoad: 410,
      date: "2026-08-30",
      loadRatio: 1.2,
    });
    expect(
      mapTrainingReadiness(await fixture("training-readiness")),
    ).toMatchObject({
      date: "2026-08-30",
      score: 82,
    });
  });
});

describe("health feature requests", () => {
  it("given a date, when requesting each feature, then uses its private endpoint contract", async () => {
    const calls: Parameters<GetJson>[0][] = [];
    const responses: unknown[] = [
      await fixture("daily-summary"),
      await fixture("sleep"),
      await fixture("training-status"),
      await fixture("training-readiness"),
    ];
    const getJson: GetJson = async (input) => {
      calls.push(input);
      return responses.shift();
    };
    const date = parseLocalDate("2026-08-30");

    await getDailySummary(getJson, "anonymous", { date });
    await getSleep(getJson, "anonymous", { date });
    await getTrainingStatus(getJson, { date });
    await getTrainingReadiness(getJson, { date });

    expect(calls).toEqual([
      {
        path: "/usersummary-service/usersummary/daily/anonymous",
        query: { calendarDate: "2026-08-30" },
      },
      {
        path: "/wellness-service/wellness/dailySleepData/anonymous",
        query: { date: "2026-08-30", nonSleepBufferMinutes: "60" },
      },
      { path: "/metrics-service/metrics/trainingstatus/aggregated/2026-08-30" },
      { path: "/metrics-service/metrics/trainingreadiness/2026-08-30" },
    ]);
  });
});
