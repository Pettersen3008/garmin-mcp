import type { LocalDate } from "../../local-date.ts";

export type HrvSample = {
  recordedAt: string;
  milliseconds: number;
};

export type DailyHrv = {
  date: LocalDate;
  weeklyAverageMilliseconds?: number;
  lastNightAverageMilliseconds?: number;
  lastNightFiveMinuteHighMilliseconds?: number;
  status?: string;
  baseline?: {
    lowUpperMilliseconds?: number;
    balancedLowMilliseconds?: number;
    balancedUpperMilliseconds?: number;
  };
  samples: HrvSample[];
};

export type StressSample = {
  recordedAt: string;
  level: number;
};

export type DailyStress = {
  date: LocalDate;
  averageLevel?: number;
  maximumLevel?: number;
  samples: StressSample[];
};

export type BodyBatterySample = {
  recordedAt: string;
  level: number;
};

export type DailyBodyBattery = {
  date: LocalDate;
  charged?: number;
  drained?: number;
  samples: BodyBatterySample[];
};

export type RespirationSample = {
  recordedAt: string;
  breathsPerMinute: number;
};

export type DailyRespiration = {
  date: LocalDate;
  lowestBreathsPerMinute?: number;
  highestBreathsPerMinute?: number;
  averageAwakeBreathsPerMinute?: number;
  averageSleepBreathsPerMinute?: number;
  samples: RespirationSample[];
};

export type BloodOxygenSample = {
  recordedAt: string;
  percent: number;
};

export type DailyBloodOxygen = {
  date: LocalDate;
  averagePercent?: number;
  lowestPercent?: number;
  latestPercent?: number;
  latestRecordedAt?: string;
  sevenDayAveragePercent?: number;
  averageSleepPercent?: number;
  samples: BloodOxygenSample[];
};

export type BodyCompositionMeasurement = {
  recordedAt: string;
  weightGrams?: number;
  bmi?: number;
  bodyFatPercent?: number;
  bodyWaterPercent?: number;
  boneMassGrams?: number;
  muscleMassGrams?: number;
  physiqueRating?: number;
  visceralFatRating?: number;
  metabolicAgeYears?: number;
};

export type DailyBodyComposition = {
  date: LocalDate;
  measurements: BodyCompositionMeasurement[];
};
