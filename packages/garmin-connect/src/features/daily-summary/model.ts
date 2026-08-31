import type { LocalDate } from "../../local-date.ts";

export type DailySummary = {
  date: LocalDate;
  activeKilocalories?: number;
  averageStressLevel?: number;
  bodyBatteryHighest?: number;
  bodyBatteryLowest?: number;
  distanceMeters?: number;
  floorsAscended?: number;
  intensityMinutes?: number;
  restingHeartRateBpm?: number;
  stepGoal?: number;
  steps?: number;
  totalKilocalories?: number;
};
