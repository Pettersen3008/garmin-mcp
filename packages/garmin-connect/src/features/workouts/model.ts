import type { LocalDate } from "../../local-date.ts";

export type WorkoutSport = "running" | "cycling" | "swimming";
export type WorkoutStepKind =
  | "warmup"
  | "interval"
  | "recovery"
  | "cooldown"
  | "rest";

export type WorkoutTarget =
  | { kind: "heartRateZone"; zone: number }
  | { kind: "heartRate"; minBpm: number; maxBpm: number }
  | { kind: "power"; minWatts: number; maxWatts: number }
  | { kind: "cadence"; minRpm: number; maxRpm: number }
  | {
      kind: "speed" | "pace";
      minMetersPerSecond: number;
      maxMetersPerSecond: number;
    };

export type ExecutableWorkoutStep = {
  kind: WorkoutStepKind;
  description?: string | undefined;
  end: { kind: "time"; seconds: number } | { kind: "distance"; meters: number };
  target?: WorkoutTarget | undefined;
};

export type WorkoutStep =
  | ExecutableWorkoutStep
  | {
      kind: "repeat";
      description?: string | undefined;
      repetitions: number;
      steps: ExecutableWorkoutStep[];
    };

export type WorkoutDraft = {
  name: string;
  sport: WorkoutSport;
  description?: string | undefined;
  steps: WorkoutStep[];
};

export type WorkoutSummary = {
  id: string;
  name: string;
  sport: string;
  description?: string;
  estimatedDurationSeconds?: number;
  estimatedDistanceMeters?: number;
};

export type Workout = WorkoutSummary & { steps: WorkoutStep[] };

export type WorkoutSchedule = {
  id: string;
  workoutId: string;
  date: LocalDate;
};
