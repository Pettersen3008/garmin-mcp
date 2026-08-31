import type { LocalDate } from "../../local-date.ts";

export type SleepSummary = {
  date: LocalDate;
  awakeDurationSeconds?: number;
  averageHeartRateVariabilityMs?: number;
  averageRespirationBreathsPerMinute?: number;
  averageSpo2Percent?: number;
  deepSleepDurationSeconds?: number;
  lightSleepDurationSeconds?: number;
  remSleepDurationSeconds?: number;
  sleepDurationSeconds?: number;
  sleepEndEpochMilliseconds?: number;
  sleepScore?: number;
  sleepStartEpochMilliseconds?: number;
};
