import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";

const listInput = z
  .object({
    from: z
      .string()
      .optional()
      .describe("First calendar date in YYYY-MM-DD format"),
    limit: z.number().int().min(1).max(100).default(20),
    to: z
      .string()
      .optional()
      .describe("Last calendar date in YYYY-MM-DD format"),
  })
  .refine((input) => input.to === undefined || input.from !== undefined, {
    message: "from is required when to is present",
  });
const activityIdInput = z.object({ id: z.string().regex(/^[1-9]\d*$/) });
const editInput = z
  .object({
    confirm: z.literal(true),
    description: z.string().optional(),
    id: z.string().regex(/^[1-9]\d*$/),
    name: z.string().trim().min(1).optional(),
  })
  .refine(
    ({ description, name }) => description !== undefined || name !== undefined,
    { message: "name or description is required" },
  );
const deleteInput = activityIdInput.extend({ confirm: z.literal(true) });
const readOnly = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
};
const write = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: false,
};

export function registerActivityTools(
  server: McpServer,
  garmin: GarminClient,
): void {
  server.registerTool(
    "list_activities",
    {
      annotations: readOnly,
      description:
        "List Garmin activities, optionally within a calendar date range.",
      inputSchema: listInput,
    },
    (input) =>
      runTool(async () => {
        const from =
          input.from === undefined ? undefined : parseLocalDate(input.from);
        const to =
          input.to === undefined ? undefined : parseLocalDate(input.to);
        const activities = await garmin.activities.list(
          from === undefined
            ? { limit: input.limit }
            : { limit: input.limit, from, ...(to === undefined ? {} : { to }) },
        );
        return { activities };
      }),
  );
  server.registerTool(
    "get_activity",
    {
      annotations: readOnly,
      description: "Get one Garmin activity summary by activity ID.",
      inputSchema: activityIdInput,
    },
    ({ id }) =>
      runTool(async () => ({ activity: await garmin.activities.get({ id }) })),
  );
  server.registerTool(
    "edit_activity",
    {
      annotations: write,
      description:
        "Edit the named Garmin activity's name or description, then return Garmin's stored activity. Requires confirm=true.",
      inputSchema: editInput,
    },
    (input) =>
      runTool(async () => {
        if (input.name === undefined) {
          if (input.description === undefined) {
            throw new RangeError("Activity name or description is required");
          }
          return {
            activity: await garmin.activities.edit({
              id: input.id,
              description: input.description,
            }),
          };
        }
        return {
          activity: await garmin.activities.edit({
            id: input.id,
            name: input.name,
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
          }),
        };
      }),
  );
  server.registerTool(
    "delete_activity",
    {
      annotations: { ...write, destructiveHint: true },
      description:
        "Permanently delete the Garmin activity identified by id. Returns the activity captured before deletion. Requires confirm=true.",
      inputSchema: deleteInput,
    },
    ({ id }) =>
      runTool(async () => ({
        deletedActivity: await garmin.activities.delete({ id }),
      })),
  );
}
