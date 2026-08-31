import type { LocalDate } from "../../local-date.ts";

export type TrainingStatus = {
  date: LocalDate;
  acuteLoad?: number;
  feedback?: string;
  loadRatio?: number;
  statusCode?: number;
  statusSince?: LocalDate;
};

export type TrainingReadiness = {
  date: LocalDate;
  timestamp: string;
  feedback?: string;
  level?: string;
  recoveryTimeMinutes?: number;
  score?: number;
  sleepScore?: number;
};
