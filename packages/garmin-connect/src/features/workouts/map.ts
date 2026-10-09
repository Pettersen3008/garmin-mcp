import { z } from "zod";
import { garminIdSchema } from "../../garmin-id.ts";
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

const text = z
  .string()
  .nullish()
  .transform((value) => value || undefined);
const measurement = z.number().nullish();

const executableSchema = z.object({
  stepType: z.object({
    stepTypeKey: z.enum(["warmup", "interval", "recovery", "cooldown", "rest"]),
  }),
  description: text,
  endCondition: z.object({
    conditionTypeKey: z.enum(["time", "distance", "lap.button"]),
  }),
  endConditionValue: measurement,
  targetType: z.object({ workoutTargetTypeKey: z.string() }).nullish(),
  zoneNumber: measurement,
  targetValueOne: measurement,
  targetValueTwo: measurement,
});
const repeatSchema = z.object({
  stepType: z.object({ stepTypeKey: z.literal("repeat") }),
  description: text,
  numberOfIterations: z.number().int().positive(),
  workoutSteps: z.array(executableSchema).min(1),
});
const summarySchema = z.object({
  workoutId: garminIdSchema,
  workoutName: z.string().min(1),
  sportType: z.object({ sportTypeKey: z.string().min(1) }),
  description: text,
  estimatedDurationInSecs: measurement,
  estimatedDistanceInMeters: measurement,
});
const workoutSchema = summarySchema.extend({
  workoutSegments: z
    .array(
      z.object({
        workoutSteps: z.array(z.union([repeatSchema, executableSchema])),
      }),
    )
    .min(1),
});
const scheduleIdSchema = z
  .object({
    workoutScheduleId: garminIdSchema.nullish(),
    scheduleId: garminIdSchema.nullish(),
    id: garminIdSchema.nullish(),
  })
  .transform((value) => value.workoutScheduleId ?? value.scheduleId ?? value.id)
  .pipe(z.string());
const scheduleSchema = z.object({
  workout: z.object({ workoutId: garminIdSchema }),
  calendarDate: text,
  date: text,
});

function invalid(field: string): never {
  throw new GarminInvalidResponseError(`Garmin workout response has invalid or missing ${field}`);
}

function parse<T extends z.ZodType>(schema: T, value: unknown, field: string): z.output<T> {
  const result = schema.safeParse(value);
  return result.success ? result.data : invalid(field);
}

function summary(raw: z.output<typeof summarySchema>): WorkoutSummary {
  return {
    id: raw.workoutId,
    name: raw.workoutName,
    sport: raw.sportType.sportTypeKey,
    ...(raw.description === undefined ? {} : { description: raw.description }),
    ...(raw.estimatedDurationInSecs == null
      ? {}
      : { estimatedDurationSeconds: raw.estimatedDurationInSecs }),
    ...(raw.estimatedDistanceInMeters == null
      ? {}
      : { estimatedDistanceMeters: raw.estimatedDistanceInMeters }),
  };
}

function target(raw: z.output<typeof executableSchema>): WorkoutTarget | undefined {
  const kind = raw.targetType?.workoutTargetTypeKey;
  if (kind == null || kind === "no.target") {
    return undefined;
  }
  if (kind === "heart.rate.zone" && raw.zoneNumber != null) {
    return { kind: "heartRateZone", zone: raw.zoneNumber };
  }
  const first = raw.targetValueOne ?? invalid("targetValueOne");
  if (kind === "heart.rate.zone" && raw.targetValueTwo == null) {
    return { kind: "heartRateZone", zone: first };
  }
  const upper = raw.targetValueTwo ?? invalid("targetValueTwo");
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

function executable(raw: z.output<typeof executableSchema>): ExecutableWorkoutStep {
  const condition = raw.endCondition.conditionTypeKey;
  const end: ExecutableWorkoutStep["end"] =
    condition === "lap.button"
      ? { kind: "open" }
      : condition === "time"
        ? {
            kind: "time",
            seconds: raw.endConditionValue ?? invalid("endConditionValue"),
          }
        : {
            kind: "distance",
            meters: raw.endConditionValue ?? invalid("endConditionValue"),
          };
  const stepTarget = target(raw);
  return {
    kind: raw.stepType.stepTypeKey,
    end,
    ...(raw.description === undefined ? {} : { description: raw.description }),
    ...(stepTarget === undefined ? {} : { target: stepTarget }),
  };
}

function step(raw: z.output<typeof repeatSchema> | z.output<typeof executableSchema>): WorkoutStep {
  if (!("numberOfIterations" in raw)) {
    return executable(raw);
  }
  return {
    kind: "repeat",
    repetitions: raw.numberOfIterations,
    steps: raw.workoutSteps.map(executable),
    ...(raw.description === undefined ? {} : { description: raw.description }),
  };
}

export function mapWorkoutId(input: unknown): string {
  return parse(summarySchema.pick({ workoutId: true }), input, "workoutId").workoutId;
}

export function mapWorkoutScheduleId(input: unknown): string {
  return parse(scheduleIdSchema, input, "workoutScheduleId");
}

export function mapWorkoutSummaries(input: unknown): WorkoutSummary[] {
  return parse(z.array(summarySchema), input, "workout list").map(summary);
}

export function mapWorkout(input: unknown): Workout {
  const raw = parse(workoutSchema, input, "workout");
  const [segment, ...rest] = raw.workoutSegments;
  if (!segment || rest.length > 0) {
    // Edits write one segment, so a flattened multi-segment read would be lossy.
    throw new GarminInvalidResponseError(
      "Garmin workouts with more than one segment are not supported",
    );
  }
  return { ...summary(raw), steps: segment.workoutSteps.map(step) };
}

export function mapWorkoutSchedule(input: unknown): WorkoutSchedule {
  const raw = parse(scheduleSchema, input, "workout schedule");
  return {
    id: mapWorkoutScheduleId(input),
    workoutId: raw.workout.workoutId,
    date: parseLocalDate(raw.calendarDate ?? raw.date ?? invalid("date")),
  };
}
