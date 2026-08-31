import type { GetJson } from "../../http/request.ts";
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
  if (
    input.from !== undefined &&
    input.to !== undefined &&
    input.to < input.from
  ) {
    throw new RangeError("Activity end date must not precede its start date");
  }

  const query: Record<string, string> = {
    start: "0",
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
