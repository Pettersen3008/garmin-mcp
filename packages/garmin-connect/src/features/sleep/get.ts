import type { GetJson } from "../../http/request.ts";
import type { LocalDate } from "../../local-date.ts";
import { mapSleep } from "./map.ts";
import type { SleepSummary } from "./model.ts";

export async function getSleep(
  getJson: GetJson,
  displayName: string,
  input: { date: LocalDate },
): Promise<SleepSummary> {
  return mapSleep(
    await getJson({
      path: `/wellness-service/wellness/dailySleepData/${encodeURIComponent(displayName)}`,
      query: { date: input.date, nonSleepBufferMinutes: "60" },
    }),
  );
}
