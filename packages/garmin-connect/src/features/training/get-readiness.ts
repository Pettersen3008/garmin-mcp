import type { GetJson } from "../../http/request.ts";
import type { LocalDate } from "../../local-date.ts";
import { mapTrainingReadiness } from "./map.ts";
import type { TrainingReadiness } from "./model.ts";

export async function getTrainingReadiness(
  getJson: GetJson,
  input: { date: LocalDate },
): Promise<TrainingReadiness | null> {
  return mapTrainingReadiness(
    await getJson({
      path: `/metrics-service/metrics/trainingreadiness/${input.date}`,
    }),
  );
}
