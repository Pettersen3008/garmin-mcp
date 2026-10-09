import { expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  GarminAuthError,
  type GarminClient,
  GarminHttpError,
  parseLocalDate,
  type Workout,
} from "@pettersen/garmin-connect";
import { createServer } from "../src/create-server.ts";
import { failure } from "../src/mcp-result.ts";

const fixtureWorkout: Workout = {
  id: "7",
  name: "Fixture workout",
  sport: "running",
  steps: [{ kind: "warmup", end: { kind: "time", seconds: 600 } }],
};

const garmin: GarminClient = {
  activities: {
    async delete({ id }) {
      return {
        id,
        name: "Fixture activity",
        startedAtLocal: "2026-08-30 08:00:00",
        type: "running",
      };
    },
    async edit({ id, name }) {
      return {
        id,
        name: name ?? "Fixture activity",
        startedAtLocal: "2026-08-30 08:00:00",
        type: "running",
      };
    },
    async get({ id }) {
      return {
        id,
        name: "Fixture activity",
        startedAtLocal: "2026-08-30 08:00:00",
        type: "running",
      };
    },
    async list() {
      return [];
    },
  },
  dailySummary: {
    async get({ date }) {
      return { date, steps: 1000 };
    },
  },
  heartRate: {
    async get({ date }) {
      return { date, restingBpm: 48, samples: [] };
    },
  },
  health: {
    async getBloodOxygen({ date }) {
      return { date, averagePercent: 96, samples: [] };
    },
    async getBodyBattery({ date }) {
      return { date, charged: 70, samples: [] };
    },
    async getBodyComposition({ date }) {
      return { date, measurements: [] };
    },
    async getHrv({ date }) {
      return { date, lastNightAverageMilliseconds: 50, samples: [] };
    },
    async getRespiration({ date }) {
      return { date, averageSleepBreathsPerMinute: 12, samples: [] };
    },
    async getStress({ date }) {
      return { date, averageLevel: 24, samples: [] };
    },
  },
  sleep: {
    async get({ date }) {
      return { date, sleepDurationSeconds: 28000 };
    },
  },
  training: {
    async getReadiness({ date }) {
      return { date, score: 80, timestamp: `${date}T07:00:00.0` };
    },
    async getStatus({ date }) {
      return { date, statusCode: 7 };
    },
  },
  workouts: {
    async create(workout) {
      return {
        id: "7",
        name: workout.name,
        sport: workout.sport,
        steps: workout.steps,
        ...(workout.description === undefined ? {} : { description: workout.description }),
      };
    },
    async delete({ id }) {
      return { ...fixtureWorkout, id };
    },
    async edit({ id, workout }) {
      return {
        id,
        name: workout.name,
        sport: workout.sport,
        steps: workout.steps,
        ...(workout.description === undefined ? {} : { description: workout.description }),
      };
    },
    async get({ id }) {
      return { ...fixtureWorkout, id };
    },
    async list() {
      return [fixtureWorkout];
    },
    async schedule({ workoutId, date }) {
      return { id: "9", workoutId, date };
    },
    async unschedule({ id }) {
      return {
        id,
        workoutId: "7",
        date: parseLocalDate("2026-09-07"),
      };
    },
  },
};

it("given the fixture SDK, when calling the MCP server, then registered tools return structured content", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(garmin);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    expect(tools.tools.map(({ name }) => name).toSorted()).toEqual(
      [
        "get_activity",
        "get_daily_summary",
        "get_heart_rate",
        "get_hrv",
        "get_stress",
        "get_body_battery",
        "get_respiration",
        "get_blood_oxygen",
        "get_body_composition",
        "get_sleep",
        "get_training_readiness",
        "get_training_status",
        "list_activities",
        "delete_activity",
        "edit_activity",
        "create_workout",
        "delete_workout",
        "edit_workout",
        "get_workout",
        "list_workouts",
        "schedule_workout",
        "unschedule_workout",
      ].toSorted(),
    );
    const calls = await Promise.all([
      client.callTool({ name: "list_activities", arguments: { limit: 10 } }),
      client.callTool({ name: "get_activity", arguments: { id: "42" } }),
      client.callTool({
        name: "get_daily_summary",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_heart_rate",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_hrv",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_stress",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_body_battery",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_respiration",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_blood_oxygen",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_body_composition",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_sleep",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_training_status",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_training_readiness",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "edit_activity",
        arguments: { confirm: true, id: "42", name: "Morning run" },
      }),
      client.callTool({
        name: "delete_activity",
        arguments: { confirm: true, id: "42" },
      }),
      client.callTool({ name: "list_workouts", arguments: { limit: 10 } }),
      client.callTool({ name: "get_workout", arguments: { id: "7" } }),
      client.callTool({
        name: "create_workout",
        arguments: {
          confirm: true,
          workout: {
            name: "Fixture workout",
            sport: "running",
            steps: [{ kind: "warmup", end: { kind: "time", seconds: 600 } }],
          },
        },
      }),
      client.callTool({
        name: "edit_workout",
        arguments: {
          confirm: true,
          id: "7",
          workout: {
            name: "Fixture workout",
            sport: "running",
            steps: [{ kind: "warmup", end: { kind: "time", seconds: 600 } }],
          },
        },
      }),
      client.callTool({
        name: "delete_workout",
        arguments: { confirm: true, id: "7" },
      }),
      client.callTool({
        name: "schedule_workout",
        arguments: {
          confirm: true,
          date: "2026-09-07",
          workoutId: "7",
        },
      }),
      client.callTool({
        name: "unschedule_workout",
        arguments: { confirm: true, id: "9" },
      }),
    ]);
    expect(calls.filter(({ isError }) => isError)).toEqual([]);
    expect(calls.every(({ structuredContent }) => structuredContent !== undefined)).toBe(true);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

it("given a write tool call without confirm, when calling it, then rejects before reaching Garmin", async () => {
  let deleted = false;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({
    ...garmin,
    activities: {
      ...garmin.activities,
      async delete(input) {
        deleted = true;
        return garmin.activities.delete(input);
      },
    },
  });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const result = await client.callTool({
      name: "delete_activity",
      arguments: { id: "42" },
    });

    expect(result.isError).toBe(true);
    expect(deleted).toBe(false);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

const code = (error: unknown) => failure(error).structuredContent.error.code;

it("given SDK errors, when converting to a tool result, then maps each class to its code", () => {
  const logged = console.error;
  console.error = () => {};
  try {
    expect([
      code(new GarminAuthError("expired")),
      code(new GarminHttpError(404)),
      code(new GarminHttpError(400)),
      code(new GarminHttpError(503)),
      code(new RangeError("bad date")),
      code(new Error("secret detail")),
    ]).toEqual(["auth", "not_found", "invalid_request", "upstream", "invalid_input", "internal"]);
  } finally {
    console.error = logged;
  }
});
