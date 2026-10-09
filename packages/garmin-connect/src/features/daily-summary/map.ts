import { z } from "zod";
import { GarminInvalidResponseError } from "../../http/errors.ts";
import { parseLocalDate } from "../../local-date.ts";
import type { DailySummary } from "./model.ts";

const rawDailySummarySchema = z.object({
  activeKilocalories: z.number().nullable().optional(),
  averageStressLevel: z.number().nullable().optional(),
  bodyBatteryHighestValue: z.number().nullable().optional(),
  bodyBatteryLowestValue: z.number().nullable().optional(),
  calendarDate: z.string(),
  dailyStepGoal: z.number().nullable().optional(),
  floorsAscended: z.number().nullable().optional(),
  moderateIntensityMinutes: z.number().nullable().optional(),
  restingHeartRate: z.number().nullable().optional(),
  totalDistanceMeters: z.number().nullable().optional(),
  totalKilocalories: z.number().nullable().optional(),
  totalSteps: z.number().nullable().optional(),
  vigorousIntensityMinutes: z.number().nullable().optional(),
});

export function mapDailySummary(value: unknown): DailySummary {
  const result = rawDailySummarySchema.safeParse(value);
  if (!result.success) {
    throw new GarminInvalidResponseError("Garmin returned an invalid daily summary");
  }
  const raw = result.data;
  const moderate = raw.moderateIntensityMinutes ?? 0;
  const vigorous = raw.vigorousIntensityMinutes ?? 0;

  return {
    date: parseLocalDate(raw.calendarDate),
    ...(raw.activeKilocalories == null ? {} : { activeKilocalories: raw.activeKilocalories }),
    ...(raw.averageStressLevel == null ? {} : { averageStressLevel: raw.averageStressLevel }),
    ...(raw.bodyBatteryHighestValue == null
      ? {}
      : { bodyBatteryHighest: raw.bodyBatteryHighestValue }),
    ...(raw.bodyBatteryLowestValue == null
      ? {}
      : { bodyBatteryLowest: raw.bodyBatteryLowestValue }),
    ...(raw.totalDistanceMeters == null ? {} : { distanceMeters: raw.totalDistanceMeters }),
    ...(raw.floorsAscended == null ? {} : { floorsAscended: raw.floorsAscended }),
    ...(raw.moderateIntensityMinutes == null && raw.vigorousIntensityMinutes == null
      ? {}
      : { intensityMinutes: moderate + vigorous * 2 }),
    ...(raw.restingHeartRate == null ? {} : { restingHeartRateBpm: raw.restingHeartRate }),
    ...(raw.dailyStepGoal == null ? {} : { stepGoal: raw.dailyStepGoal }),
    ...(raw.totalSteps == null ? {} : { steps: raw.totalSteps }),
    ...(raw.totalKilocalories == null ? {} : { totalKilocalories: raw.totalKilocalories }),
  };
}
