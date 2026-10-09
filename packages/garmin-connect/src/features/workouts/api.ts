import { assertGarminId } from "../../garmin-id.ts";
import type { GetJson, RequestJson } from "../../http/request.ts";
import { type LocalDate, parseLocalDate } from "../../local-date.ts";
import {
  mapWorkout,
  mapWorkoutId,
  mapWorkoutSchedule,
  mapWorkoutScheduleId,
  mapWorkoutSummaries,
} from "./map.ts";
import type { Workout, WorkoutDraft, WorkoutSchedule, WorkoutSummary } from "./model.ts";
import { buildWorkoutPayload } from "./payload.ts";

export async function listWorkouts({
  getJson,
  limit,
}: {
  getJson: GetJson;
  limit: number;
}): Promise<WorkoutSummary[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("Workout limit must be an integer from 1 to 100");
  }
  return mapWorkoutSummaries(
    await getJson({
      path: "/workout-service/workouts",
      query: { start: "0", limit: String(limit), myWorkoutsOnly: "true" },
    }),
  );
}

export async function getWorkout({
  getJson,
  id,
}: {
  getJson: GetJson;
  id: string;
}): Promise<Workout> {
  assertGarminId(id, "Workout id");
  return mapWorkout(await getJson({ path: `/workout-service/workout/${id}` }));
}

export async function createWorkout({
  requestJson,
  workout,
}: {
  requestJson: RequestJson;
  workout: WorkoutDraft;
}): Promise<Workout> {
  const id = mapWorkoutId(
    await requestJson({
      body: buildWorkoutPayload(workout),
      method: "POST",
      path: "/workout-service/workout",
    }),
  );
  return getWorkout({ getJson: requestJson, id });
}

export async function editWorkout({
  requestJson,
  id,
  workout,
}: {
  requestJson: RequestJson;
  id: string;
  workout: WorkoutDraft;
}): Promise<Workout> {
  assertGarminId(id, "Workout id");
  await requestJson({
    body: buildWorkoutPayload(workout, id),
    method: "PUT",
    path: `/workout-service/workout/${id}`,
  });
  return getWorkout({ getJson: requestJson, id });
}

export async function deleteWorkout({
  requestJson,
  id,
}: {
  requestJson: RequestJson;
  id: string;
}): Promise<Workout> {
  const workout = await getWorkout({ getJson: requestJson, id });
  await requestJson({
    method: "DELETE",
    path: `/workout-service/workout/${id}`,
  });
  return workout;
}

export async function scheduleWorkout({
  requestJson,
  workoutId,
  date,
}: {
  requestJson: RequestJson;
  workoutId: string;
  date: LocalDate;
}): Promise<WorkoutSchedule> {
  assertGarminId(workoutId, "Workout id");
  parseLocalDate(date);
  const id = mapWorkoutScheduleId(
    await requestJson({
      body: { date },
      method: "POST",
      path: `/workout-service/schedule/${workoutId}`,
    }),
  );
  try {
    return mapWorkoutSchedule(await requestJson({ path: `/workout-service/schedule/${id}` }));
  } catch (error) {
    try {
      await requestJson({
        method: "DELETE",
        path: `/workout-service/schedule/${id}`,
      });
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        `Could not read or remove the new workout schedule ${id}`,
        { cause: rollbackError },
      );
    }
    throw error;
  }
}

export async function unscheduleWorkout({
  requestJson,
  id,
}: {
  requestJson: RequestJson;
  id: string;
}): Promise<WorkoutSchedule> {
  assertGarminId(id, "Workout schedule id");
  const schedule = mapWorkoutSchedule(
    await requestJson({ path: `/workout-service/schedule/${id}` }),
  );
  await requestJson({
    method: "DELETE",
    path: `/workout-service/schedule/${id}`,
  });
  return schedule;
}
