import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";

const id = z.string().regex(/^[1-9]\d*$/);
const target = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("heartRateZone"),
    zone: z.number().int().min(1).max(5),
  }),
  z.object({
    kind: z.literal("heartRate"),
    minBpm: z.number().positive(),
    maxBpm: z.number().positive(),
  }),
  z.object({
    kind: z.literal("power"),
    minWatts: z.number().positive(),
    maxWatts: z.number().positive(),
  }),
  z.object({
    kind: z.literal("cadence"),
    minRpm: z.number().positive(),
    maxRpm: z.number().positive(),
  }),
  z.object({
    kind: z.enum(["speed", "pace"]),
    minMetersPerSecond: z.number().positive(),
    maxMetersPerSecond: z.number().positive(),
  }),
]);
const executableStep = z.object({
  kind: z.enum(["warmup", "interval", "recovery", "cooldown", "rest"]),
  description: z.string().optional(),
  end: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("time"), seconds: z.number().positive() }),
    z.object({ kind: z.literal("distance"), meters: z.number().positive() }),
  ]),
  target: target.optional(),
});
const workout = z.object({
  name: z.string().trim().min(1),
  sport: z.enum(["running", "cycling", "swimming"]),
  description: z.string().optional(),
  steps: z
    .union([
      executableStep,
      z.object({
        kind: z.literal("repeat"),
        description: z.string().optional(),
        repetitions: z.number().int().positive(),
        steps: executableStep.array().min(1),
      }),
    ])
    .array()
    .min(1),
});
const readOnly = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
};
const write = { ...readOnly, readOnlyHint: false };

export function registerWorkoutTools(
  server: McpServer,
  garmin: GarminClient,
): void {
  server.registerTool(
    "list_workouts",
    {
      annotations: readOnly,
      description: "List saved Garmin workouts.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    ({ limit }) =>
      runTool(async () => ({
        workouts: await garmin.workouts.list({ limit }),
      })),
  );
  server.registerTool(
    "get_workout",
    {
      annotations: readOnly,
      description:
        "Get one Garmin workout and its structured steps by workout ID.",
      inputSchema: z.object({ id }),
    },
    ({ id }) =>
      runTool(async () => ({ workout: await garmin.workouts.get({ id }) })),
  );
  server.registerTool(
    "create_workout",
    {
      annotations: { ...write, idempotentHint: false },
      description:
        "Create a Garmin workout with the supplied name, sport, description, and complete step list, then return Garmin's stored workout. Requires confirm=true. A retry can create a duplicate.",
      inputSchema: z.object({ confirm: z.literal(true), workout }),
    },
    ({ workout }) =>
      runTool(async () => ({ workout: await garmin.workouts.create(workout) })),
  );
  server.registerTool(
    "edit_workout",
    {
      annotations: write,
      description:
        "Replace the named Garmin workout's name, sport, description, and complete step list, then return Garmin's stored workout. Requires confirm=true.",
      inputSchema: z.object({ confirm: z.literal(true), id, workout }),
    },
    ({ id, workout }) =>
      runTool(async () => ({
        workout: await garmin.workouts.edit({ id, workout }),
      })),
  );
  server.registerTool(
    "delete_workout",
    {
      annotations: { ...write, destructiveHint: true },
      description:
        "Permanently delete the Garmin workout identified by id. Returns the workout captured before deletion. Requires confirm=true.",
      inputSchema: z.object({ confirm: z.literal(true), id }),
    },
    ({ id }) =>
      runTool(async () => ({
        deletedWorkout: await garmin.workouts.delete({ id }),
      })),
  );
  server.registerTool(
    "schedule_workout",
    {
      annotations: { ...write, idempotentHint: false },
      description:
        "Schedule the Garmin workout identified by workoutId on date, then return Garmin's stored schedule. Requires confirm=true. A retry can create a duplicate schedule.",
      inputSchema: z.object({
        confirm: z.literal(true),
        date: z.string(),
        workoutId: id,
      }),
    },
    ({ date, workoutId }) =>
      runTool(async () => ({
        schedule: await garmin.workouts.schedule({
          date: parseLocalDate(date),
          workoutId,
        }),
      })),
  );
  server.registerTool(
    "unschedule_workout",
    {
      annotations: { ...write, destructiveHint: true },
      description:
        "Remove the Garmin workout schedule identified by id without deleting its workout. Returns the schedule captured before removal. Requires confirm=true.",
      inputSchema: z.object({ confirm: z.literal(true), id }),
    },
    ({ id }) =>
      runTool(async () => ({
        removedSchedule: await garmin.workouts.unschedule({ id }),
      })),
  );
}
