import { GarminInvalidResponseError } from "../../http/errors.ts";
import { parseLocalDate } from "../../local-date.ts";
import type {
  ExecutableWorkoutStep,
  Workout,
  WorkoutSchedule,
  WorkoutStep,
  WorkoutSummary,
  WorkoutTarget,
} from "./model.ts";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string): never {
  throw new GarminInvalidResponseError(
    `Garmin workout response has invalid or missing ${field}`,
  );
}

function record(value: unknown, field: string): RecordValue {
  if (!isRecord(value)) {
    invalid(field);
  }
  return value;
}

function string(record: RecordValue, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    invalid(key);
  }
  return value;
}

function id(record: RecordValue, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
      return value;
    }
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      return String(value);
    }
  }
  return invalid(keys[0] ?? "id");
}

function optionalString(record: RecordValue, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return typeof value === "string" ? value : invalid(key);
}

function optionalNumber(record: RecordValue, key: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : invalid(key);
}

function summary(input: unknown): WorkoutSummary {
  const value = record(input, "workout");
  const sport = record(value.sportType, "sportType");
  const description = optionalString(value, "description");
  const estimatedDurationSeconds = optionalNumber(
    value,
    "estimatedDurationInSecs",
  );
  const estimatedDistanceMeters = optionalNumber(
    value,
    "estimatedDistanceInMeters",
  );
  return {
    id: id(value, "workoutId"),
    name: string(value, "workoutName"),
    sport: string(sport, "sportTypeKey"),
    ...(description === undefined ? {} : { description }),
    ...(estimatedDurationSeconds === undefined
      ? {}
      : { estimatedDurationSeconds }),
    ...(estimatedDistanceMeters === undefined
      ? {}
      : { estimatedDistanceMeters }),
  };
}

function target(input: unknown): WorkoutTarget | undefined {
  const step = record(input, "workout step");
  if (step.targetType === undefined) {
    return undefined;
  }
  const value = record(step.targetType, "targetType");
  const kind = string(value, "workoutTargetTypeKey");
  if (kind === "no.target") {
    return undefined;
  }
  const zone = optionalNumber(step, "zoneNumber");
  if (kind === "heart.rate.zone" && zone !== undefined) {
    return { kind: "heartRateZone", zone };
  }
  const first = requiredNumber(step, "targetValueOne");
  const second = optionalNumber(step, "targetValueTwo");
  if (kind === "heart.rate.zone" && second === undefined) {
    return { kind: "heartRateZone", zone: first };
  }
  const upper = second ?? invalid("targetValueTwo");
  switch (kind) {
    case "heart.rate.zone":
      return { kind: "heartRate", minBpm: first, maxBpm: upper };
    case "power.zone":
      return { kind: "power", minWatts: first, maxWatts: upper };
    case "cadence.zone":
      return { kind: "cadence", minRpm: first, maxRpm: upper };
    case "speed.zone":
      return {
        kind: "speed",
        minMetersPerSecond: first,
        maxMetersPerSecond: upper,
      };
    case "pace.zone":
      return {
        kind: "pace",
        minMetersPerSecond: upper,
        maxMetersPerSecond: first,
      };
    default:
      return invalid("workoutTargetTypeKey");
  }
}

function requiredNumber(value: RecordValue, key: string): number {
  return optionalNumber(value, key) ?? invalid(key);
}

function positiveInteger(value: RecordValue, key: string): number {
  const result = requiredNumber(value, key);
  return Number.isInteger(result) && result > 0 ? result : invalid(key);
}

function executable(
  value: RecordValue,
  kind: ExecutableWorkoutStep["kind"],
): ExecutableWorkoutStep {
  const condition = record(value.endCondition, "endCondition");
  const conditionKind = string(condition, "conditionTypeKey");
  const amount = requiredNumber(value, "endConditionValue");
  const end: ExecutableWorkoutStep["end"] =
    conditionKind === "time"
      ? { kind: "time", seconds: amount }
      : conditionKind === "distance"
        ? { kind: "distance", meters: amount }
        : invalid("conditionTypeKey");
  const stepTarget = target(value);
  const description = optionalString(value, "description");
  return {
    kind,
    end,
    ...(description === undefined ? {} : { description }),
    ...(stepTarget === undefined ? {} : { target: stepTarget }),
  };
}

function step(input: unknown): WorkoutStep {
  const value = record(input, "workout step");
  const stepType = record(value.stepType, "stepType");
  const kind = string(stepType, "stepTypeKey");
  if (kind === "repeat") {
    if (!Array.isArray(value.workoutSteps) || value.workoutSteps.length === 0) {
      invalid("workoutSteps");
    }
    const description = optionalString(value, "description");
    return {
      kind: "repeat",
      repetitions: positiveInteger(value, "numberOfIterations"),
      steps: value.workoutSteps.map((child) => {
        const mapped = step(child);
        return mapped.kind === "repeat" ? invalid("nested repeat") : mapped;
      }),
      ...(description === undefined ? {} : { description }),
    };
  }
  if (!isStepKind(kind)) {
    invalid("stepTypeKey");
  }
  return executable(value, kind);
}

function isStepKind(value: string): value is ExecutableWorkoutStep["kind"] {
  return (
    value === "warmup" ||
    value === "interval" ||
    value === "recovery" ||
    value === "cooldown" ||
    value === "rest"
  );
}

export function mapWorkoutId(input: unknown): string {
  return id(record(input, "workout"), "workoutId");
}

export function mapWorkoutScheduleId(input: unknown): string {
  return id(
    record(input, "workout schedule"),
    "workoutScheduleId",
    "scheduleId",
    "id",
  );
}

export function mapWorkoutSummaries(input: unknown): WorkoutSummary[] {
  if (!Array.isArray(input)) {
    invalid("workout list");
  }
  return input.map(summary);
}

export function mapWorkout(input: unknown): Workout {
  const value = record(input, "workout");
  if (
    !Array.isArray(value.workoutSegments) ||
    value.workoutSegments.length === 0
  ) {
    invalid("workoutSegments");
  }
  const steps = value.workoutSegments.flatMap((segment) => {
    const segmentRecord = record(segment, "workout segment");
    if (!Array.isArray(segmentRecord.workoutSteps)) {
      invalid("workoutSteps");
    }
    return segmentRecord.workoutSteps.map(step);
  });
  return { ...summary(value), steps };
}

export function mapWorkoutSchedule(input: unknown): WorkoutSchedule {
  const value = record(input, "workout schedule");
  return {
    id: id(value, "workoutScheduleId", "scheduleId", "id"),
    workoutId: id(record(value.workout, "workout"), "workoutId"),
    date: parseLocalDate(
      optionalString(value, "calendarDate") ?? string(value, "date"),
    ),
  };
}
