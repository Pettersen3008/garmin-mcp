import { z } from "zod";
import { GarminInvalidResponseError } from "../../http/errors.ts";
import { parseLocalDate } from "../../local-date.ts";
import type { DailyHeartRate } from "./model.ts";

const heartRateSchema = z.object({
  calendarDate: z.string(),
  heartRateValues: z
    .array(
      z.tuple([
        z.number().int().nonnegative().max(8_640_000_000_000_000),
        z.number().int().positive().nullable(),
      ]),
    )
    .nullish(),
  lastSevenDaysAvgRestingHeartRate: z.number().nullable().optional(),
  maxHeartRate: z.number().nullable().optional(),
  minHeartRate: z.number().nullable().optional(),
  restingHeartRate: z.number().nullable().optional(),
});

export function mapDailyHeartRate(value: unknown): DailyHeartRate {
  const result = heartRateSchema.safeParse(value);
  if (!result.success) {
    throw new GarminInvalidResponseError(
      "Garmin returned invalid daily heart-rate data",
    );
  }
  const raw = result.data;
  return {
    date: parseLocalDate(raw.calendarDate),
    ...(raw.minHeartRate == null ? {} : { minBpm: raw.minHeartRate }),
    ...(raw.maxHeartRate == null ? {} : { maxBpm: raw.maxHeartRate }),
    ...(raw.restingHeartRate == null
      ? {}
      : { restingBpm: raw.restingHeartRate }),
    ...(raw.lastSevenDaysAvgRestingHeartRate == null
      ? {}
      : {
          sevenDayAverageRestingBpm: raw.lastSevenDaysAvgRestingHeartRate,
        }),
    samples: (raw.heartRateValues ?? []).flatMap(([timestamp, bpm]) =>
      bpm === null
        ? []
        : [{ recordedAt: new Date(timestamp).toISOString(), bpm }],
    ),
  };
}
