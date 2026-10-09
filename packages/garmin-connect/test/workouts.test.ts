import { describe, expect, it } from "bun:test";
import {
  createWorkout,
  deleteWorkout,
  editWorkout,
  getWorkout,
  listWorkouts,
  scheduleWorkout,
  unscheduleWorkout,
} from "../src/features/workouts/api.ts";
import {
  mapWorkout,
  mapWorkoutSchedule,
  mapWorkoutSummaries,
} from "../src/features/workouts/map.ts";
import type { WorkoutDraft } from "../src/features/workouts/model.ts";
import { buildWorkoutPayload } from "../src/features/workouts/payload.ts";
import type { RequestJson } from "../src/http/request.ts";
import { parseLocalDate } from "../src/local-date.ts";

const fixtureUrl = new URL("./fixtures/garmin/workouts.json", import.meta.url);
const draft: WorkoutDraft = {
  name: "Synthetic intervals",
  sport: "running",
  steps: [
    { kind: "warmup", end: { kind: "time", seconds: 600 } },
    {
      kind: "repeat",
      repetitions: 3,
      steps: [
        {
          kind: "interval",
          end: { kind: "distance", meters: 400 },
          target: { kind: "heartRateZone", zone: 4 },
        },
        { kind: "recovery", end: { kind: "time", seconds: 120 } },
      ],
    },
  ],
};

async function fixture(): Promise<Record<string, unknown>> {
  const value: unknown = await Bun.file(fixtureUrl).json();
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("list" in value)
  ) {
    throw new TypeError("Invalid workout fixture");
  }
  return value;
}

describe("workouts", () => {
  it("given Garmin workout payloads, when mapping, then returns the stable workout model", async () => {
    const data = await fixture();

    expect(mapWorkoutSummaries(data.list)).toEqual([
      {
        id: "7",
        name: "Synthetic intervals",
        sport: "running",
        description: "Anonymized workout",
        estimatedDurationSeconds: 1500,
      },
    ]);
    expect(mapWorkout(data.detail)).toEqual({
      id: "7",
      name: "Synthetic intervals",
      sport: "running",
      description: "Anonymized workout",
      estimatedDurationSeconds: 1500,
      steps: draft.steps,
    });
    expect(mapWorkoutSchedule(data.schedule)).toEqual({
      id: "9",
      workoutId: "7",
      date: parseLocalDate("2026-09-07"),
    });
  });

  it("given a stable workout, when building Garmin JSON, then preserves steps, repeats, and targets", () => {
    expect(buildWorkoutPayload(draft)).toMatchObject({
      workoutName: "Synthetic intervals",
      sportType: { sportTypeId: 1, sportTypeKey: "running" },
      estimatedDurationInSecs: null,
      estimatedDistanceInMeters: null,
      workoutSegments: [
        {
          workoutSteps: [
            {
              stepOrder: 1,
              endConditionValue: 600,
              type: "ExecutableStepDTO",
            },
            {
              stepOrder: 2,
              numberOfIterations: 3,
              type: "RepeatGroupDTO",
              workoutSteps: [
                { stepOrder: 3, endConditionValue: 400 },
                { stepOrder: 4, endConditionValue: 120 },
              ],
            },
          ],
        },
      ],
    });
  });

  it("given workout operations, when called, then uses Garmin's contracts and reads stored writes", async () => {
    const data = await fixture();
    const requests: Parameters<RequestJson>[0][] = [];
    const requestJson: RequestJson = async (request) => {
      requests.push(request);
      if (request.path.includes("/schedule/")) {
        return data.schedule;
      }
      if (
        request.path === "/workout-service/workout" &&
        request.method === "POST"
      ) {
        return Array.isArray(data.list) ? data.list[0] : undefined;
      }
      if (request.method === undefined && request.path.includes("/workout/")) {
        return data.detail;
      }
      if (request.path === "/workout-service/workouts") {
        return data.list;
      }
      return undefined;
    };

    await listWorkouts({ getJson: requestJson, limit: 20 });
    await getWorkout({ getJson: requestJson, id: "7" });
    await createWorkout({ requestJson, workout: draft });
    await editWorkout({ requestJson, id: "7", workout: draft });
    await deleteWorkout({ requestJson, id: "7" });
    await scheduleWorkout({
      requestJson,
      workoutId: "7",
      date: parseLocalDate("2026-09-07"),
    });
    await unscheduleWorkout({ requestJson, id: "9" });

    expect(requests.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: undefined, path: "/workout-service/workouts" },
      { method: undefined, path: "/workout-service/workout/7" },
      { method: "POST", path: "/workout-service/workout" },
      { method: undefined, path: "/workout-service/workout/7" },
      { method: "PUT", path: "/workout-service/workout/7" },
      { method: undefined, path: "/workout-service/workout/7" },
      { method: undefined, path: "/workout-service/workout/7" },
      { method: "DELETE", path: "/workout-service/workout/7" },
      { method: "POST", path: "/workout-service/schedule/7" },
      { method: undefined, path: "/workout-service/schedule/9" },
      { method: undefined, path: "/workout-service/schedule/9" },
      { method: "DELETE", path: "/workout-service/schedule/9" },
    ]);
  });

  it("given schedule readback fails, when scheduling, then removes the created schedule", async () => {
    const requests: Parameters<RequestJson>[0][] = [];
    const requestJson: RequestJson = async (request) => {
      requests.push(request);
      if (request.method === "POST") {
        return { workoutScheduleId: 9 };
      }
      if (request.method === undefined) {
        throw new Error("Invalid schedule response");
      }
      return undefined;
    };

    await expect(
      scheduleWorkout({
        requestJson,
        workoutId: "7",
        date: parseLocalDate("2026-09-07"),
      }),
    ).rejects.toThrow("Invalid schedule response");

    expect(requests.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: "POST", path: "/workout-service/schedule/7" },
      { method: undefined, path: "/workout-service/schedule/9" },
      { method: "DELETE", path: "/workout-service/schedule/9" },
    ]);
  });
});
