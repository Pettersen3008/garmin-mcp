import { z } from "zod";
import { garminIdSchema } from "../../garmin-id.ts";
import { GarminInvalidResponseError } from "../../http/errors.ts";
import type { Activity } from "./model.ts";

const measurement = z.number().nullish();
const summarySchema = z.object({
  aerobicTrainingEffect: measurement,
  averageHR: measurement,
  averagePower: measurement,
  avgPower: measurement,
  calories: measurement,
  distance: measurement,
  duration: measurement,
  elevationGain: measurement,
  maxHR: measurement,
  movingDuration: measurement,
  startTimeLocal: z.string().min(1).optional(),
});
const typeSchema = z.object({ typeKey: z.string().min(1) }).nullish();
const activitySchema = summarySchema.extend({
  activityId: garminIdSchema,
  activityName: z.string().min(1),
  activityType: typeSchema,
  activityTypeDTO: typeSchema,
  description: z.string().nullish(),
  summaryDTO: summarySchema.nullish(),
});

export function mapActivity(input: unknown): Activity {
  const raw = activitySchema.safeParse(input).data;
  const summary = raw?.summaryDTO ?? raw;
  const type = raw?.activityType ?? raw?.activityTypeDTO;
  if (!raw || !summary?.startTimeLocal || !type) {
    throw new GarminInvalidResponseError("Garmin returned an invalid activity");
  }
  const activity: Activity = {
    id: raw.activityId,
    name: raw.activityName,
    type: type.typeKey,
    startedAtLocal: summary.startTimeLocal,
  };

  const fields = {
    description: raw.description,
    distanceMeters: summary.distance,
    durationSeconds: summary.duration,
    movingDurationSeconds: summary.movingDuration,
    caloriesKilocalories: summary.calories,
    averageHeartRateBpm: summary.averageHR,
    maxHeartRateBpm: summary.maxHR,
    elevationGainMeters: summary.elevationGain,
    averagePowerWatts: summary.avgPower ?? summary.averagePower,
    aerobicTrainingEffect: summary.aerobicTrainingEffect,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value != null) {
      Object.assign(activity, { [key]: value });
    }
  }

  return activity;
}

export function mapActivities(input: unknown): Activity[] {
  if (!Array.isArray(input)) {
    throw new GarminInvalidResponseError(
      "Garmin returned an invalid activity list",
    );
  }
  return input.map(mapActivity);
}
