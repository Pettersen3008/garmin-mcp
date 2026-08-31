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
  if (!/^[1-9]\d*$/.test(id)) {
    throw new RangeError("Activity id must be a positive decimal string");
  }

  return mapActivity(
    await getJson({ path: `/activity-service/activity/${id}` }),
  );
}
