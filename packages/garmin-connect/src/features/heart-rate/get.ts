import type { GetJson } from "../../http/request.ts";
import type { LocalDate } from "../../local-date.ts";
import { mapDailyHeartRate } from "./map.ts";
import type { DailyHeartRate } from "./model.ts";

export async function getDailyHeartRate(
  getJson: GetJson,
  displayName: string,
  input: { date: LocalDate },
): Promise<DailyHeartRate> {
  return mapDailyHeartRate(
    await getJson({
      path: `/wellness-service/wellness/dailyHeartRate/${encodeURIComponent(displayName)}`,
      query: { date: input.date },
    }),
  );
}
