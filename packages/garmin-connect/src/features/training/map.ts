import { z } from "zod";
import { GarminInvalidResponseError } from "../../http/errors.ts";
import { parseLocalDate } from "../../local-date.ts";
import type { TrainingReadiness, TrainingStatus } from "./model.ts";

const statusValueSchema = z.object({
  acuteTrainingLoadDTO: z
    .object({
      dailyAcuteChronicWorkloadRatio: z.number().nullable().optional(),
      dailyTrainingLoadAcute: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  calendarDate: z.string(),
  primaryTrainingDevice: z.boolean().nullable().optional(),
  sinceDate: z.string().nullable().optional(),
  trainingStatus: z.number().nullable().optional(),
  trainingStatusFeedbackPhrase: z.string().nullable().optional(),
});

const statusSchema = z.object({
  mostRecentTrainingStatus: z
    .object({
      latestTrainingStatusData: z
        .record(z.string(), statusValueSchema)
        .nullish(),
    })
    .nullish(),
});

const readinessValueSchema = z.object({
  calendarDate: z.string(),
  feedbackShort: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  recoveryTime: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
  sleepScore: z.number().nullable().optional(),
  timestamp: z.string(),
});

export function mapTrainingStatus(value: unknown): TrainingStatus | null {
  const result = statusSchema.safeParse(value);
  if (!result.success) {
    throw new GarminInvalidResponseError(
      "Garmin returned an invalid training status",
    );
  }
  const statuses = Object.values(
    result.data.mostRecentTrainingStatus?.latestTrainingStatusData ?? {},
  );
  const raw =
    statuses.find(({ primaryTrainingDevice }) => primaryTrainingDevice) ??
    statuses[0];
  if (!raw) {
    return null;
  }
  return {
    date: parseLocalDate(raw.calendarDate),
    ...(raw.acuteTrainingLoadDTO?.dailyTrainingLoadAcute == null
      ? {}
      : { acuteLoad: raw.acuteTrainingLoadDTO.dailyTrainingLoadAcute }),
    ...(raw.trainingStatusFeedbackPhrase == null
      ? {}
      : { feedback: raw.trainingStatusFeedbackPhrase }),
    ...(raw.acuteTrainingLoadDTO?.dailyAcuteChronicWorkloadRatio == null
      ? {}
      : { loadRatio: raw.acuteTrainingLoadDTO.dailyAcuteChronicWorkloadRatio }),
    ...(raw.trainingStatus == null ? {} : { statusCode: raw.trainingStatus }),
    ...(raw.sinceDate == null
      ? {}
      : { statusSince: parseLocalDate(raw.sinceDate) }),
  };
}

export function mapTrainingReadiness(value: unknown): TrainingReadiness | null {
  const result = z.array(readinessValueSchema).safeParse(value);
  if (!result.success) {
    throw new GarminInvalidResponseError(
      "Garmin returned invalid training readiness",
    );
  }
  const raw = result.data.toSorted((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  )[0];
  if (!raw) {
    return null;
  }
  return {
    date: parseLocalDate(raw.calendarDate),
    timestamp: raw.timestamp,
    ...(raw.feedbackShort == null ? {} : { feedback: raw.feedbackShort }),
    ...(raw.level == null ? {} : { level: raw.level }),
    ...(raw.recoveryTime == null
      ? {}
      : { recoveryTimeMinutes: raw.recoveryTime }),
    ...(raw.score == null ? {} : { score: raw.score }),
    ...(raw.sleepScore == null ? {} : { sleepScore: raw.sleepScore }),
  };
}
