import type { LocalDate } from "../../local-date.ts";

export type HeartRateSample = {
  recordedAt: string;
  bpm: number;
};

export type DailyHeartRate = {
  date: LocalDate;
  minBpm?: number;
  maxBpm?: number;
  restingBpm?: number;
  sevenDayAverageRestingBpm?: number;
  samples: HeartRateSample[];
};
