import type {
  ExecutableWorkoutStep,
  WorkoutDraft,
  WorkoutStep,
  WorkoutTarget,
} from "./model.ts";

const sports = {
  running: { sportTypeId: 1, sportTypeKey: "running", displayOrder: 1 },
  cycling: { sportTypeId: 2, sportTypeKey: "cycling", displayOrder: 2 },
  swimming: { sportTypeId: 4, sportTypeKey: "swimming", displayOrder: 3 },
};

const stepTypes = {
  warmup: { stepTypeId: 1, stepTypeKey: "warmup", displayOrder: 1 },
  cooldown: { stepTypeId: 2, stepTypeKey: "cooldown", displayOrder: 2 },
  interval: { stepTypeId: 3, stepTypeKey: "interval", displayOrder: 3 },
  recovery: { stepTypeId: 4, stepTypeKey: "recovery", displayOrder: 4 },
  rest: { stepTypeId: 5, stepTypeKey: "rest", displayOrder: 5 },
};

const targets = {
  none: { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target" },
  power: { workoutTargetTypeId: 2, workoutTargetTypeKey: "power.zone" },
  cadence: { workoutTargetTypeId: 3, workoutTargetTypeKey: "cadence.zone" },
  heartRate: {
    workoutTargetTypeId: 4,
    workoutTargetTypeKey: "heart.rate.zone",
  },
  speed: { workoutTargetTypeId: 5, workoutTargetTypeKey: "speed.zone" },
  pace: { workoutTargetTypeId: 6, workoutTargetTypeKey: "pace.zone" },
};

const conditions = {
  open: { conditionTypeId: 1, conditionTypeKey: "lap.button" },
  time: { conditionTypeId: 2, conditionTypeKey: "time" },
  distance: { conditionTypeId: 3, conditionTypeKey: "distance" },
  iterations: { conditionTypeId: 7, conditionTypeKey: "iterations" },
};

function positive(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${field} must be positive`);
  }
  return value;
}

function range(min: number, max: number, field: string): void {
  positive(min, `${field} minimum`);
  positive(max, `${field} maximum`);
  if (min > max) {
    throw new RangeError(`${field} minimum must not exceed its maximum`);
  }
}

function target(value: WorkoutTarget | undefined): Record<string, unknown> {
  if (value === undefined) {
    return { targetType: targets.none };
  }
  switch (value.kind) {
    case "heartRateZone":
      if (!Number.isInteger(value.zone) || value.zone < 1 || value.zone > 5) {
        throw new RangeError("Heart-rate zone must be an integer from 1 to 5");
      }
      return { targetType: targets.heartRate, zoneNumber: value.zone };
    case "heartRate":
      range(value.minBpm, value.maxBpm, "Heart-rate target");
      return {
        targetType: targets.heartRate,
        targetValueOne: value.minBpm,
        targetValueTwo: value.maxBpm,
      };
    case "power":
      range(value.minWatts, value.maxWatts, "Power target");
      return {
        targetType: targets.power,
        targetValueOne: value.minWatts,
        targetValueTwo: value.maxWatts,
      };
    case "cadence":
      range(value.minRpm, value.maxRpm, "Cadence target");
      return {
        targetType: targets.cadence,
        targetValueOne: value.minRpm,
        targetValueTwo: value.maxRpm,
      };
    case "speed":
      range(value.minMetersPerSecond, value.maxMetersPerSecond, "Speed target");
      return {
        targetType: targets.speed,
        targetValueOne: value.minMetersPerSecond,
        targetValueTwo: value.maxMetersPerSecond,
      };
    case "pace":
      range(value.minMetersPerSecond, value.maxMetersPerSecond, "Pace target");
      return {
        targetType: targets.pace,
        targetValueOne: value.maxMetersPerSecond,
        targetValueTwo: value.minMetersPerSecond,
      };
  }
}

function executable(
  step: ExecutableWorkoutStep,
  order: number,
): Record<string, unknown> {
  const end =
    step.end.kind === "open"
      ? { endCondition: conditions.open }
      : step.end.kind === "time"
        ? {
            endCondition: conditions.time,
            endConditionValue: positive(step.end.seconds, "Step duration"),
          }
        : {
            endCondition: conditions.distance,
            endConditionValue: positive(step.end.meters, "Step distance"),
          };
  return {
    stepId: order,
    stepOrder: order,
    stepType: stepTypes[step.kind],
    type: "ExecutableStepDTO",
    description: step.description ?? "",
    ...end,
    ...target(step.target),
  };
}

function steps(input: WorkoutStep[]): Record<string, unknown>[] {
  let order = 1;
  return input.map((step) => {
    const currentOrder = order;
    order += 1;
    if (step.kind !== "repeat") {
      return executable(step, currentOrder);
    }
    if (!Number.isInteger(step.repetitions) || step.repetitions < 1) {
      throw new RangeError("Workout repetitions must be a positive integer");
    }
    if (step.steps.length === 0) {
      throw new RangeError("A repeat must contain at least one step");
    }
    const children = step.steps.map((child) => {
      const childOrder = order;
      order += 1;
      return executable(child, childOrder);
    });
    return {
      stepId: currentOrder,
      stepOrder: currentOrder,
      stepType: {
        stepTypeId: 6,
        stepTypeKey: "repeat",
        displayOrder: 6,
      },
      type: "RepeatGroupDTO",
      description: step.description ?? "",
      numberOfIterations: step.repetitions,
      endCondition: conditions.iterations,
      endConditionValue: step.repetitions,
      workoutSteps: children,
    };
  });
}

function total(input: WorkoutStep[], kind: "time" | "distance"): number | null {
  let result = 0;
  for (const step of input) {
    if (step.kind === "repeat") {
      const childTotal = total(step.steps, kind);
      if (childTotal === null) {
        return null;
      }
      result += childTotal * step.repetitions;
    } else if (step.end.kind !== kind) {
      return null;
    } else if (step.end.kind === "time") {
      result += step.end.seconds;
    } else if (step.end.kind === "distance") {
      result += step.end.meters;
    }
  }
  return result;
}

export function buildWorkoutPayload(
  input: WorkoutDraft,
  id?: string,
): Record<string, unknown> {
  if (input.name.trim().length === 0) {
    throw new RangeError("Workout name must not be empty");
  }
  if (input.steps.length === 0) {
    throw new RangeError("Workout must contain at least one step");
  }
  const sportType = sports[input.sport];
  return {
    ...(id === undefined ? {} : { workoutId: id }),
    workoutName: input.name,
    sportType,
    description: input.description ?? null,
    estimatedDurationInSecs: total(input.steps, "time"),
    estimatedDistanceInMeters: total(input.steps, "distance"),
    workoutSegments: [
      {
        segmentOrder: 1,
        sportType,
        workoutSteps: steps(input.steps),
      },
    ],
  };
}
