import { assertGarminId } from "../../garmin-id.ts";
import type { GetJson } from "../../http/request.ts";
import { mapActivity } from "./map.ts";
import type { Activity } from "./model.ts";

export async function getActivity({
  getJson,
  id,
}: {
  getJson: GetJson;
  id: string;
}): Promise<Activity> {
  assertGarminId(id, "Activity id");
  return mapActivity(await getJson({ path: `/activity-service/activity/${id}` }));
}
