import { describe, expect, it } from "bun:test";
import { getDailySummary } from "../src/features/daily-summary/get.ts";
import { mapDailySummary } from "../src/features/daily-summary/map.ts";
import {
  getDailyBloodOxygen,
  getDailyBodyBattery,
  getDailyBodyComposition,
  getDailyHrv,
  getDailyRespiration,
  getDailyStress,
} from "../src/features/health-history/get.ts";
import {
  mapDailyBloodOxygen,
  mapDailyBodyBattery,
  mapDailyBodyComposition,
  mapDailyHrv,
  mapDailyRespiration,
  mapDailyStress,
} from "../src/features/health-history/map.ts";
import { getDailyHeartRate } from "../src/features/heart-rate/get.ts";
import { mapDailyHeartRate } from "../src/features/heart-rate/map.ts";
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
      date: parseLocalDate("2026-08-30"),
      distanceMeters: 6240,
      intensityMinutes: 28,
      restingHeartRateBpm: 48,
    });
    expect(mapDailyHeartRate(await fixture("heart-rate"))).toEqual({
      date: parseLocalDate("2026-08-30"),
      maxBpm: 151,
      minBpm: 43,
      restingBpm: 48,
      samples: [
        { bpm: 52, recordedAt: "2026-08-29T22:00:00.000Z" },
        { bpm: 55, recordedAt: "2026-08-29T22:04:00.000Z" },
      ],
      sevenDayAverageRestingBpm: 49,
    });
    const hrv = mapDailyHrv(await fixture("hrv"));
    expect(hrv).toMatchObject({
      date: parseLocalDate("2026-08-30"),
      lastNightAverageMilliseconds: 51,
      status: "BALANCED",
    });
    expect(hrv?.samples.map(({ milliseconds }) => milliseconds)).toEqual([
      47, 54,
    ]);
    const stress = mapDailyStress(await fixture("stress"));
    expect(stress).toMatchObject({
      date: parseLocalDate("2026-08-30"),
      averageLevel: 24,
    });
    expect(stress.samples.map(({ level }) => level)).toEqual([18, 42]);
    const bodyBattery = mapDailyBodyBattery(await fixture("body-battery"));
    expect(bodyBattery).toMatchObject({
      date: parseLocalDate("2026-08-30"),
      charged: 72,
    });
    expect(bodyBattery?.samples.map(({ level }) => level)).toEqual([
      18, 45, 79,
    ]);
    const respiration = mapDailyRespiration(await fixture("respiration"));
    expect(respiration).toMatchObject({
      date: parseLocalDate("2026-08-30"),
      averageSleepBreathsPerMinute: 12,
    });
    expect(
      respiration.samples.map(({ breathsPerMinute }) => breathsPerMinute),
    ).toEqual([12.5, 16]);
    const bloodOxygen = mapDailyBloodOxygen(await fixture("blood-oxygen"));
    expect(bloodOxygen).toMatchObject({
      date: parseLocalDate("2026-08-30"),
      averagePercent: 96,
      sevenDayAveragePercent: 95.5,
    });
    expect(bloodOxygen.samples.map(({ percent }) => percent)).toEqual([95, 96]);
    expect(
      mapDailyBodyComposition("2026-08-30", await fixture("body-composition")),
    ).toMatchObject({
      date: parseLocalDate("2026-08-30"),
      measurements: [
        {
          weightGrams: 73500,
          bodyFatPercent: 16.2,
          muscleMassGrams: 58400,
        },
      ],
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
      await fixture("heart-rate"),
      await fixture("hrv"),
      await fixture("stress"),
      await fixture("body-battery"),
      await fixture("respiration"),
      await fixture("blood-oxygen"),
      await fixture("body-composition"),
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
    await getDailyHeartRate(getJson, "anonymous", { date });
    await getDailyHrv(getJson, { date });
    await getDailyStress(getJson, { date });
    await getDailyBodyBattery(getJson, { date });
    await getDailyRespiration(getJson, { date });
    await getDailyBloodOxygen(getJson, { date });
    await getDailyBodyComposition(getJson, { date });
    await getSleep(getJson, "anonymous", { date });
    await getTrainingStatus(getJson, { date });
    await getTrainingReadiness(getJson, { date });

    expect(calls).toEqual([
      {
        path: "/usersummary-service/usersummary/daily/anonymous",
        query: { calendarDate: "2026-08-30" },
      },
      {
        path: "/wellness-service/wellness/dailyHeartRate/anonymous",
        query: { date: "2026-08-30" },
      },
      { path: "/hrv-service/hrv/2026-08-30" },
      { path: "/wellness-service/wellness/dailyStress/2026-08-30" },
      {
        path: "/wellness-service/wellness/bodyBattery/reports/daily",
        query: { endDate: "2026-08-30", startDate: "2026-08-30" },
      },
      { path: "/wellness-service/wellness/daily/respiration/2026-08-30" },
      { path: "/wellness-service/wellness/daily/spo2/2026-08-30" },
      {
        path: "/weight-service/weight/dateRange",
        query: { endDate: "2026-08-30", startDate: "2026-08-30" },
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
