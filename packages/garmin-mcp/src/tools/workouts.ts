import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";
import {
  approval,
  confirm,
  date,
  destructive,
  garminId as id,
  readOnly,
  write,
} from "../tool-schemas.ts";

const target = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("heartRateZone"),
    zone: z.number().int().min(1).max(5),
  }),
  z
    .object({
      kind: z.literal("heartRate"),
      minBpm: z.number().positive(),
      maxBpm: z.number().positive(),
    })
    .refine((value) => value.minBpm <= value.maxBpm, {
      message: "minBpm must not exceed maxBpm",
    }),
  z
    .object({
      kind: z.literal("power"),
      minWatts: z.number().positive(),
      maxWatts: z.number().positive(),
    })
    .refine((value) => value.minWatts <= value.maxWatts, {
      message: "minWatts must not exceed maxWatts",
    }),
  z
    .object({
      kind: z.literal("cadence"),
      minRpm: z.number().positive(),
      maxRpm: z.number().positive(),
    })
    .refine((value) => value.minRpm <= value.maxRpm, {
      message: "minRpm must not exceed maxRpm",
    }),
  z
    .object({
      kind: z.enum(["speed", "pace"]),
      minMetersPerSecond: z.number().positive(),
      maxMetersPerSecond: z.number().positive(),
    })
    .refine((value) => value.minMetersPerSecond <= value.maxMetersPerSecond, {
      message: "minMetersPerSecond must not exceed maxMetersPerSecond",
    }),
]);
const executableStep = z.object({
  kind: z.enum(["warmup", "interval", "recovery", "cooldown", "rest"]),
  description: z.string().optional(),
  end: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("time"), seconds: z.number().positive() }),
    z.object({ kind: z.literal("distance"), meters: z.number().positive() }),
    z.object({ kind: z.literal("open") }).describe("Ends on lap button press"),
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
        "Get one Garmin workout and its structured steps, identified by id; get ids from list_workouts.",
      inputSchema: z.object({ id }),
    },
    ({ id }) =>
      runTool(async () => ({ workout: await garmin.workouts.get({ id }) })),
  );
  server.registerTool(
    "create_workout",
    {
      annotations: { ...write, idempotentHint: false },
      description: `Create a Garmin workout with the supplied name, sport, description, and complete step list, then return Garmin's stored workout. A retry can create a duplicate. ${approval}`,
      inputSchema: z.object({ confirm, workout }),
    },
    ({ workout }) =>
      runTool(async () => ({ workout: await garmin.workouts.create(workout) })),
  );
  server.registerTool(
    "edit_workout",
    {
      annotations: destructive,
      description: `Replace the name, sport, description, and complete step list of the Garmin workout identified by id; get ids from list_workouts. Returns Garmin's stored workout. ${approval}`,
      inputSchema: z.object({ confirm, id, workout }),
    },
    ({ id, workout }) =>
      runTool(async () => ({
        workout: await garmin.workouts.edit({ id, workout }),
      })),
  );
  server.registerTool(
    "delete_workout",
    {
      annotations: destructive,
      description: `Permanently delete the Garmin workout identified by id; get ids from list_workouts. Returns the workout captured before deletion. ${approval}`,
      inputSchema: z.object({ confirm, id }),
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
      description: `Schedule the Garmin workout identified by workoutId on date; get ids from list_workouts. Returns Garmin's stored schedule, including its id. A retry can create a duplicate schedule. ${approval}`,
      inputSchema: z.object({ confirm, date, workoutId: id }),
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
      annotations: destructive,
      description: `Remove the Garmin workout schedule identified by id (returned by schedule_workout) without deleting its workout. Returns the schedule captured before removal. ${approval}`,
      inputSchema: z.object({ confirm, id }),
    },
    ({ id }) =>
      runTool(async () => ({
        removedSchedule: await garmin.workouts.unschedule({ id }),
      })),
  );
}
