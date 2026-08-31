import type { GetJson } from "../../http/request.ts";
import type { LocalDate } from "../../local-date.ts";
import { mapDailySummary } from "./map.ts";
import type { DailySummary } from "./model.ts";

export async function getDailySummary(
  getJson: GetJson,
  displayName: string,
  input: { date: LocalDate },
): Promise<DailySummary> {
  return mapDailySummary(
    await getJson({
      path: `/usersummary-service/usersummary/daily/${encodeURIComponent(displayName)}`,
      query: { calendarDate: input.date },
    }),
  );
}
