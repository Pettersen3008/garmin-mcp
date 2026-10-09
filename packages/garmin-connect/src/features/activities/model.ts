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

export type EditActivityInput = {
  id: string;
  name?: string | undefined;
  description?: string | undefined;
};

export type ListActivitiesInput = {
  limit: number;
  start?: number | undefined;
} & ({ from?: never; to?: never } | { from: LocalDate; to?: LocalDate });
