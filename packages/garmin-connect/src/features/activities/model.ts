import type { LocalDate } from "../../local-date.ts";

export type Activity = {
  id: string;
  name: string;
  description?: string;
  type: string;
  startedAtLocal: string;
  distanceMeters?: number;
  durationSeconds?: number;
  movingDurationSeconds?: number;
  caloriesKilocalories?: number;
  averageHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  elevationGainMeters?: number;
  averagePowerWatts?: number;
  aerobicTrainingEffect?: number;
};

export type EditActivityInput =
  | { id: string; name: string; description?: string }
  | { id: string; name?: never; description: string };

export type ListActivitiesInput =
  | { limit: number; from?: never; to?: never }
  | { limit: number; from: LocalDate; to?: LocalDate };
