import { assertGarminId } from "../../garmin-id.ts";
import type { RequestJson } from "../../http/request.ts";
import { getActivity } from "./get.ts";
import type { Activity, EditActivityInput } from "./model.ts";

export async function editActivity({
  requestJson,
  input,
}: {
  requestJson: RequestJson;
  input: EditActivityInput;
}): Promise<Activity> {
  assertGarminId(input.id, "Activity id");
  if (input.name === undefined && input.description === undefined) {
    throw new RangeError("Activity name or description is required");
  }
  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new RangeError("Activity name must not be empty");
  }

  await requestJson({
    body: {
      activityId: input.id,
      ...(input.name === undefined ? {} : { activityName: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
    },
    method: "PUT",
    path: `/activity-service/activity/${input.id}`,
  });
  return getActivity({ getJson: requestJson, id: input.id });
}

export async function deleteActivity({
  requestJson,
  id,
}: {
  requestJson: RequestJson;
  id: string;
}): Promise<Activity> {
  assertGarminId(id, "Activity id");
  const activity = await getActivity({ getJson: requestJson, id });
  await requestJson({
    method: "DELETE",
    path: `/activity-service/activity/${id}`,
  });
  return activity;
}
