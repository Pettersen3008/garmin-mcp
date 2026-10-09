import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";
import {
  approval,
  confirm,
  date,
  destructive,
  garminId,
  readOnly,
} from "../tool-schemas.ts";

const listInput = z
  .object({
    from: date.optional().describe("First local calendar date, YYYY-MM-DD"),
    limit: z.number().int().min(1).max(100).default(20),
    start: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Number of newest activities to skip, for paging"),
    to: date.optional().describe("Last local calendar date, YYYY-MM-DD"),
  })
  .refine((input) => input.to === undefined || input.from !== undefined, {
    message: "from is required when to is present",
  });
const editInput = z
  .object({
    confirm,
    description: z.string().optional(),
    id: garminId,
    name: z.string().trim().min(1).optional(),
  })
  .refine(
    ({ description, name }) => description !== undefined || name !== undefined,
    { message: "name or description is required" },
  );

export function registerActivityTools(
  server: McpServer,
  garmin: GarminClient,
): void {
  server.registerTool(
    "list_activities",
    {
      annotations: readOnly,
      description:
        "List Garmin activities, newest first, optionally within a calendar date range.",
      inputSchema: listInput,
    },
    ({ from, limit, start, to }) =>
      runTool(async () => ({
        activities: await garmin.activities.list(
          from === undefined
            ? { limit, start }
            : {
                limit,
                start,
                from: parseLocalDate(from),
                ...(to === undefined ? {} : { to: parseLocalDate(to) }),
              },
        ),
      })),
  );
  server.registerTool(
    "get_activity",
    {
      annotations: readOnly,
      description:
        "Get one Garmin activity summary identified by id; get ids from list_activities.",
      inputSchema: z.object({ id: garminId }),
    },
    ({ id }) =>
      runTool(async () => ({ activity: await garmin.activities.get({ id }) })),
  );
  server.registerTool(
    "edit_activity",
    {
      annotations: destructive,
      description: `Overwrite the name or description of the Garmin activity identified by id; get ids from list_activities. Returns Garmin's stored activity. ${approval}`,
      inputSchema: editInput,
    },
    ({ confirm: _confirm, ...input }) =>
      runTool(async () => ({
        activity: await garmin.activities.edit(input),
      })),
  );
  server.registerTool(
    "delete_activity",
    {
      annotations: destructive,
      description: `Permanently delete the Garmin activity identified by id; get ids from list_activities. Returns the activity captured before deletion. ${approval}`,
      inputSchema: z.object({ confirm, id: garminId }),
    },
    ({ id }) =>
      runTool(async () => ({
        deletedActivity: await garmin.activities.delete({ id }),
      })),
  );
}
