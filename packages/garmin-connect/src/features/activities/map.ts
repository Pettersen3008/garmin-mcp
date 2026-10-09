import { GarminInvalidResponseError } from "../../http/errors.ts";
import type { Activity } from "./model.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string): never {
  throw new GarminInvalidResponseError(
    `Garmin activity response has invalid or missing ${field}`,
  );
}

function requiredRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    invalid(field);
  }
  return value;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    invalid(key);
  }
  return value;
}

function requiredId(record: Record<string, unknown>): string {
  const value = record.activityId;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  return invalid("activityId");
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  fallbackKey?: string,
): number | undefined {
  const value = record[key] ?? (fallbackKey ? record[fallbackKey] : undefined);
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalid(key);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    invalid(key);
  }
  return value;
}

export function mapActivity(input: unknown): Activity {
  const record = requiredRecord(input, "activity");
  const summary =
    record.summaryDTO === undefined
      ? record
      : requiredRecord(record.summaryDTO, "summaryDTO");
  const activityType = requiredRecord(
    record.activityType ?? record.activityTypeDTO,
    "activityType",
  );
  const activity: Activity = {
    id: requiredId(record),
    name: requiredString(record, "activityName"),
    type: requiredString(activityType, "typeKey"),
    startedAtLocal: requiredString(summary, "startTimeLocal"),
  };

  const fields = {
    description: optionalString(record, "description"),
    distanceMeters: optionalNumber(summary, "distance"),
    durationSeconds: optionalNumber(summary, "duration"),
    movingDurationSeconds: optionalNumber(summary, "movingDuration"),
    caloriesKilocalories: optionalNumber(summary, "calories"),
    averageHeartRateBpm: optionalNumber(summary, "averageHR"),
    maxHeartRateBpm: optionalNumber(summary, "maxHR"),
    elevationGainMeters: optionalNumber(summary, "elevationGain"),
    averagePowerWatts: optionalNumber(summary, "avgPower", "averagePower"),
    aerobicTrainingEffect: optionalNumber(summary, "aerobicTrainingEffect"),
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      Object.assign(activity, { [key]: value });
    }
  }

  return activity;
}

export function mapActivities(input: unknown): Activity[] {
  if (!Array.isArray(input)) {
    invalid("activity list");
  }
  return input.map(mapActivity);
}
