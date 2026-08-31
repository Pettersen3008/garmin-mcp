import type { GetJson } from "../../http/request.ts";
import type { LocalDate } from "../../local-date.ts";
import { mapTrainingStatus } from "./map.ts";
import type { TrainingStatus } from "./model.ts";

export async function getTrainingStatus(
  getJson: GetJson,
  input: { date: LocalDate },
): Promise<TrainingStatus | null> {
  return mapTrainingStatus(
    await getJson({
      path: `/metrics-service/metrics/trainingstatus/aggregated/${input.date}`,
    }),
  );
}
