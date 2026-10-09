import { z } from "zod";
import { GarminInvalidResponseError } from "../../http/errors.ts";
import { parseLocalDate } from "../../local-date.ts";
import type {
  DailyBloodOxygen,
  DailyBodyBattery,
  DailyBodyComposition,
  DailyHrv,
  DailyRespiration,
  DailyStress,
} from "./model.ts";

const epochMilliseconds = z
  .number()
  .int()
  .nonnegative()
  .max(8_640_000_000_000_000);
const measurement = z.number().nullable().optional();

function invalid(name: string): GarminInvalidResponseError {
  return new GarminInvalidResponseError(`Garmin returned invalid ${name} data`);
}

const hrvSchema = z.object({
  hrvSummary: z.object({
    calendarDate: z.string(),
    weeklyAvg: measurement,
    lastNightAvg: measurement,
    lastNight5MinHigh: measurement,
    status: z.string().nullable().optional(),
    baseline: z
      .object({
        lowUpper: measurement,
        balancedLow: measurement,
        balancedUpper: measurement,
      })
      .nullable()
      .optional(),
  }),
  hrvReadings: z
    .array(
      z.object({
        hrvValue: z.number().nonnegative(),
        readingTimeGMT: z.string(),
      }),
    )
    .nullable()
    .optional(),
});

export function mapDailyHrv(value: unknown): DailyHrv | null {
  if (value == null) return null;
  const result = hrvSchema.safeParse(value);
  if (!result.success) throw invalid("HRV");
  const { hrvSummary: summary, hrvReadings } = result.data;
  const baseline = summary.baseline;
  return {
    date: parseLocalDate(summary.calendarDate),
    ...(summary.weeklyAvg == null
      ? {}
      : { weeklyAverageMilliseconds: summary.weeklyAvg }),
    ...(summary.lastNightAvg == null
      ? {}
      : { lastNightAverageMilliseconds: summary.lastNightAvg }),
    ...(summary.lastNight5MinHigh == null
      ? {}
      : { lastNightFiveMinuteHighMilliseconds: summary.lastNight5MinHigh }),
    ...(summary.status == null ? {} : { status: summary.status }),
    ...(baseline == null
      ? {}
      : {
          baseline: {
            ...(baseline.lowUpper == null
              ? {}
              : { lowUpperMilliseconds: baseline.lowUpper }),
            ...(baseline.balancedLow == null
              ? {}
              : { balancedLowMilliseconds: baseline.balancedLow }),
            ...(baseline.balancedUpper == null
              ? {}
              : { balancedUpperMilliseconds: baseline.balancedUpper }),
          },
        }),
    samples: (hrvReadings ?? []).map(({ hrvValue, readingTimeGMT }) => ({
      recordedAt: readingTimeGMT,
      milliseconds: hrvValue,
    })),
  };
}

const stressSchema = z.object({
  calendarDate: z.string(),
  avgStressLevel: measurement,
  maxStressLevel: measurement,
  stressValuesArray: z
    .array(z.tuple([epochMilliseconds, z.number().int()]))
    .nullish(),
});

export function mapDailyStress(value: unknown): DailyStress {
  const result = stressSchema.safeParse(value);
  if (!result.success) throw invalid("stress");
  const raw = result.data;
  return {
    date: parseLocalDate(raw.calendarDate),
    ...(raw.avgStressLevel == null ? {} : { averageLevel: raw.avgStressLevel }),
    ...(raw.maxStressLevel == null ? {} : { maximumLevel: raw.maxStressLevel }),
    samples: (raw.stressValuesArray ?? []).flatMap(([timestamp, level]) =>
      level < 0
        ? []
        : [{ recordedAt: new Date(timestamp).toISOString(), level }],
    ),
  };
}

const bodyBatterySchema = z.array(
  z.object({
    date: z.string(),
    charged: measurement,
    drained: measurement,
    bodyBatteryValuesArray: z
      .array(z.tuple([epochMilliseconds, z.number().int().min(0).max(100)]))
      .nullable()
      .optional(),
  }),
);

export function mapDailyBodyBattery(value: unknown): DailyBodyBattery | null {
  const result = bodyBatterySchema.safeParse(value);
  if (!result.success) throw invalid("Body Battery");
  const raw = result.data[0];
  if (!raw) return null;
  return {
    date: parseLocalDate(raw.date),
    ...(raw.charged == null ? {} : { charged: raw.charged }),
    ...(raw.drained == null ? {} : { drained: raw.drained }),
    samples: (raw.bodyBatteryValuesArray ?? []).map(([timestamp, level]) => ({
      recordedAt: new Date(timestamp).toISOString(),
      level,
    })),
  };
}

const respirationSchema = z.object({
  calendarDate: z.string(),
  lowestRespirationValue: measurement,
  highestRespirationValue: measurement,
  avgWakingRespirationValue: measurement,
  avgSleepRespirationValue: measurement,
  respirationValuesArray: z
    .array(z.tuple([epochMilliseconds, z.number()]))
    .nullish(),
});

export function mapDailyRespiration(value: unknown): DailyRespiration {
  const result = respirationSchema.safeParse(value);
  if (!result.success) throw invalid("respiration");
  const raw = result.data;
  return {
    date: parseLocalDate(raw.calendarDate),
    ...(raw.lowestRespirationValue == null
      ? {}
      : { lowestBreathsPerMinute: raw.lowestRespirationValue }),
    ...(raw.highestRespirationValue == null
      ? {}
      : { highestBreathsPerMinute: raw.highestRespirationValue }),
    ...(raw.avgWakingRespirationValue == null
      ? {}
      : { averageAwakeBreathsPerMinute: raw.avgWakingRespirationValue }),
    ...(raw.avgSleepRespirationValue == null
      ? {}
      : { averageSleepBreathsPerMinute: raw.avgSleepRespirationValue }),
    samples: (raw.respirationValuesArray ?? []).flatMap(
      ([timestamp, breathsPerMinute]) =>
        breathsPerMinute < 0
          ? []
          : [
              {
                recordedAt: new Date(timestamp).toISOString(),
                breathsPerMinute,
              },
            ],
    ),
  };
}

const numericString = z
  .string()
  .regex(/^\d+(?:\.\d+)?$/)
  .transform(Number);
const bloodOxygenSchema = z.object({
  calendarDate: z.string(),
  averageSpO2: measurement,
  lowestSpO2: measurement,
  latestSpO2: measurement,
  latestSpO2TimestampGMT: z.string().nullable().optional(),
  lastSevenDaysAvgSpO2: z
    .union([z.number(), numericString])
    .nullable()
    .optional(),
  avgSleepSpO2: measurement,
  spO2HourlyAverages: z
    .array(z.tuple([epochMilliseconds, z.number().nullable()]))
    .nullable()
    .optional(),
});

export function mapDailyBloodOxygen(value: unknown): DailyBloodOxygen {
  const result = bloodOxygenSchema.safeParse(value);
  if (!result.success) throw invalid("blood-oxygen");
  const raw = result.data;
  return {
    date: parseLocalDate(raw.calendarDate),
    ...(raw.averageSpO2 == null ? {} : { averagePercent: raw.averageSpO2 }),
    ...(raw.lowestSpO2 == null ? {} : { lowestPercent: raw.lowestSpO2 }),
    ...(raw.latestSpO2 == null ? {} : { latestPercent: raw.latestSpO2 }),
    ...(raw.latestSpO2TimestampGMT == null
      ? {}
      : { latestRecordedAt: raw.latestSpO2TimestampGMT }),
    ...(raw.lastSevenDaysAvgSpO2 == null
      ? {}
      : { sevenDayAveragePercent: raw.lastSevenDaysAvgSpO2 }),
    ...(raw.avgSleepSpO2 == null
      ? {}
      : { averageSleepPercent: raw.avgSleepSpO2 }),
    samples: (raw.spO2HourlyAverages ?? []).flatMap(([timestamp, percent]) =>
      percent == null
        ? []
        : [{ recordedAt: new Date(timestamp).toISOString(), percent }],
    ),
  };
}

const bodyCompositionSchema = z.object({
  dateWeightList: z.array(
    z.object({
      timestampGMT: z.string(),
      weight: measurement,
      bmi: measurement,
      bodyFat: measurement,
      bodyWater: measurement,
      boneMass: measurement,
      muscleMass: measurement,
      physiqueRating: measurement,
      visceralFat: measurement,
      metabolicAge: measurement,
    }),
  ),
});

export function mapDailyBodyComposition(
  date: string,
  value: unknown,
): DailyBodyComposition {
  const result = bodyCompositionSchema.safeParse(value);
  if (!result.success) throw invalid("body-composition");
  return {
    date: parseLocalDate(date),
    measurements: result.data.dateWeightList.map((raw) => ({
      recordedAt: raw.timestampGMT,
      ...(raw.weight == null ? {} : { weightGrams: raw.weight }),
      ...(raw.bmi == null ? {} : { bmi: raw.bmi }),
      ...(raw.bodyFat == null ? {} : { bodyFatPercent: raw.bodyFat }),
      ...(raw.bodyWater == null ? {} : { bodyWaterPercent: raw.bodyWater }),
      ...(raw.boneMass == null ? {} : { boneMassGrams: raw.boneMass }),
      ...(raw.muscleMass == null ? {} : { muscleMassGrams: raw.muscleMass }),
      ...(raw.physiqueRating == null
        ? {}
        : { physiqueRating: raw.physiqueRating }),
      ...(raw.visceralFat == null
        ? {}
        : { visceralFatRating: raw.visceralFat }),
      ...(raw.metabolicAge == null
        ? {}
        : { metabolicAgeYears: raw.metabolicAge }),
    })),
  };
}
