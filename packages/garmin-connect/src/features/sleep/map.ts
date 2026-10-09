import { z } from "zod";
import { GarminInvalidResponseError } from "../../http/errors.ts";
import { parseLocalDate } from "../../local-date.ts";
import type { SleepSummary } from "./model.ts";

const rawSleepSchema = z.object({
  dailySleepDTO: z.object({
    awakeSleepSeconds: z.number().nullable().optional(),
    avgSleepHRV: z.number().nullable().optional(),
    avgSpO2: z.number().nullable().optional(),
    avgRespirationValue: z.number().nullable().optional(),
    calendarDate: z.string(),
    deepSleepSeconds: z.number().nullable().optional(),
    lightSleepSeconds: z.number().nullable().optional(),
    remSleepSeconds: z.number().nullable().optional(),
    sleepEndTimestampGMT: z.number().nullable().optional(),
    sleepScores: z
      .object({
        overall: z.object({ value: z.number().nullable().optional() }).nullable().optional(),
      })
      .nullable()
      .optional(),
    sleepStartTimestampGMT: z.number().nullable().optional(),
    sleepTimeSeconds: z.number().nullable().optional(),
  }),
});

export function mapSleep(value: unknown): SleepSummary {
  const result = rawSleepSchema.safeParse(value);
  if (!result.success) {
    throw new GarminInvalidResponseError("Garmin returned an invalid sleep summary");
  }
  const raw = result.data.dailySleepDTO;
  const sleepScore = raw.sleepScores?.overall?.value;
  return {
    date: parseLocalDate(raw.calendarDate),
    ...(raw.awakeSleepSeconds == null ? {} : { awakeDurationSeconds: raw.awakeSleepSeconds }),
    ...(raw.avgSleepHRV == null ? {} : { averageHeartRateVariabilityMs: raw.avgSleepHRV }),
    ...(raw.avgRespirationValue == null
      ? {}
      : { averageRespirationBreathsPerMinute: raw.avgRespirationValue }),
    ...(raw.avgSpO2 == null ? {} : { averageSpo2Percent: raw.avgSpO2 }),
    ...(raw.deepSleepSeconds == null ? {} : { deepSleepDurationSeconds: raw.deepSleepSeconds }),
    ...(raw.lightSleepSeconds == null ? {} : { lightSleepDurationSeconds: raw.lightSleepSeconds }),
    ...(raw.remSleepSeconds == null ? {} : { remSleepDurationSeconds: raw.remSleepSeconds }),
    ...(raw.sleepTimeSeconds == null ? {} : { sleepDurationSeconds: raw.sleepTimeSeconds }),
    ...(raw.sleepEndTimestampGMT == null
      ? {}
      : { sleepEndEpochMilliseconds: raw.sleepEndTimestampGMT }),
    ...(sleepScore == null ? {} : { sleepScore }),
    ...(raw.sleepStartTimestampGMT == null
      ? {}
      : { sleepStartEpochMilliseconds: raw.sleepStartTimestampGMT }),
  };
}
