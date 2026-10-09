import type { GetJson } from "../../http/request.ts";
import { parseLocalDate } from "../../local-date.ts";
import { mapActivities } from "./map.ts";
import type { Activity, ListActivitiesInput } from "./model.ts";

export async function listActivities({
  getJson,
  input,
}: {
  getJson: GetJson;
  input: ListActivitiesInput;
}): Promise<Activity[]> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("Activity limit must be an integer from 1 to 100");
  }
  const start = input.start ?? 0;
  if (!Number.isInteger(start) || start < 0) {
    throw new RangeError("Activity start must be a non-negative integer");
  }
  if (input.from !== undefined) {
    parseLocalDate(input.from);
  }
  if (input.to !== undefined) {
    parseLocalDate(input.to);
  }
  if (
    input.from !== undefined &&
    input.to !== undefined &&
    input.to < input.from
  ) {
    throw new RangeError("Activity end date must not precede its start date");
  }

  const query: Record<string, string> = {
    start: String(start),
    limit: String(input.limit),
  };
  if (input.from !== undefined) {
    query.startDate = input.from;
    if (input.to !== undefined) {
      query.endDate = input.to;
    }
  }

  return mapActivities(
    await getJson({
      path: "/activitylist-service/activities/search/activities",
      query,
    }),
  );
}
