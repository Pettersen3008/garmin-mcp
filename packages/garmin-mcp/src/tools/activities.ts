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
const readOnly = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
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
}
