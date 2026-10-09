import { describe, expect, it } from "bun:test";
import { getActivity } from "../src/features/activities/get.ts";
import { listActivities } from "../src/features/activities/list.ts";
import { mapActivities, mapActivity } from "../src/features/activities/map.ts";
import {
  deleteActivity,
  editActivity,
} from "../src/features/activities/mutate.ts";
import { GarminInvalidResponseError } from "../src/http/errors.ts";
import type { GetJson, RequestJson } from "../src/http/request.ts";
import { parseLocalDate } from "../src/local-date.ts";

const fixtureUrl = new URL(
  "./fixtures/garmin/activity-responses.json",
  import.meta.url,
);

describe("activities", () => {
  it("Given anonymized Garmin responses, When mapping, Then returns stable activities and omits missing measurements", async () => {
    const fixture: unknown = await Bun.file(fixtureUrl).json();
    if (
      typeof fixture !== "object" ||
      fixture === null ||
      Array.isArray(fixture)
    ) {
      throw new TypeError("Invalid activity test fixture");
    }
    if (!("list" in fixture) || !("detail" in fixture)) {
      throw new TypeError("Incomplete activity test fixture");
    }

    expect(mapActivities(fixture.list)).toEqual([
      {
        id: "42",
        name: "Synthetic morning run",
        type: "running",
        startedAtLocal: "2025-01-02 07:30:00",
        distanceMeters: 5000.5,
        durationSeconds: 1500,
        movingDurationSeconds: 1450,
        caloriesKilocalories: 320,
        averageHeartRateBpm: 140,
        maxHeartRateBpm: 165,
        elevationGainMeters: 75,
        averagePowerWatts: 240,
        aerobicTrainingEffect: 3.2,
      },
    ]);
    expect(mapActivity(fixture.detail)).toEqual({
      id: "43",
      name: "Synthetic evening ride",
      type: "cycling",
      startedAtLocal: "2025-01-03 18:00:00",
      durationSeconds: 1800,
    });
  });

  it("Given a date range, When listing activities, Then requests Garmin's activity list contract", async () => {
    const requests: Parameters<GetJson>[0][] = [];
    const getJson: GetJson = async (request) => {
      requests.push(request);
      return [];
    };

    await listActivities({
      getJson,
      input: {
        from: parseLocalDate("2025-01-01"),
        to: parseLocalDate("2025-01-31"),
        limit: 25,
      },
    });

    expect(requests).toEqual([
      {
        path: "/activitylist-service/activities/search/activities",
        query: {
          start: "0",
          limit: "25",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      },
    ]);
  });

  it("Given an activity id, When getting an activity, Then requests Garmin's activity detail contract", async () => {
    const requests: Parameters<GetJson>[0][] = [];
    const getJson: GetJson = async (request) => {
      requests.push(request);
      return {
        activityId: 42,
        activityName: "Synthetic run",
        activityTypeDTO: { typeKey: "running" },
        summaryDTO: { startTimeLocal: "2025-01-02 07:30:00" },
      };
    };

    await getActivity({ getJson, id: "42" });

    expect(requests).toEqual([{ path: "/activity-service/activity/42" }]);
  });

  it("Given a malformed Garmin activity, When mapping, Then throws a redacted invalid-response error", () => {
    expect(() =>
      mapActivity({
        activityId: 42,
        activityName: "Sensitive activity name",
        startTimeLocal: "2025-01-02 07:30:00",
      }),
    ).toThrow(
      new GarminInvalidResponseError("Garmin returned an invalid activity"),
    );
  });

  it("Given invalid activity inputs, When requesting activities, Then rejects before calling Garmin", async () => {
    let calls = 0;
    const getJson: GetJson = async () => {
      calls += 1;
      return [];
    };

    await expect(
      listActivities({ getJson, input: { limit: 0 } }),
    ).rejects.toThrow(RangeError);
    await expect(
      listActivities({
        getJson,
        input: {
          from: parseLocalDate("2025-02-01"),
          limit: 20,
          to: parseLocalDate("2025-01-01"),
        },
      }),
    ).rejects.toThrow(RangeError);
    await expect(getActivity({ getJson, id: "0" })).rejects.toThrow(RangeError);
    expect(calls).toBe(0);
  });

  it("Given confirmed activity changes, When editing and deleting, Then uses Garmin's contracts and reads the activity", async () => {
    const requests: Parameters<RequestJson>[0][] = [];
    const requestJson: RequestJson = async (request) => {
      requests.push(request);
      return request.method === undefined
        ? {
            activityId: 42,
            activityName: "Morning run",
            activityTypeDTO: { typeKey: "running" },
            summaryDTO: { startTimeLocal: "2025-01-02 07:30:00" },
          }
        : undefined;
    };

    await editActivity({
      requestJson,
      input: { id: "42", name: "Morning run" },
    });
    await deleteActivity({ requestJson, id: "42" });

    expect(requests).toEqual([
      {
        body: { activityId: "42", activityName: "Morning run" },
        method: "PUT",
        path: "/activity-service/activity/42",
      },
      { path: "/activity-service/activity/42" },
      { path: "/activity-service/activity/42" },
      { method: "DELETE", path: "/activity-service/activity/42" },
    ]);
  });
});
