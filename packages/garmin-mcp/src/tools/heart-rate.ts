import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";

export function registerHeartRateTool(
  server: McpServer,
  garmin: GarminClient,
): void {
  server.registerTool(
    "get_heart_rate",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description:
        "Get Garmin's daily heart-rate summary and timestamped samples for a calendar date.",
      inputSchema: z.object({
        date: z.string().describe("Calendar date in YYYY-MM-DD format"),
      }),
    },
    ({ date }) =>
      runTool(async () => ({
        heartRate: await garmin.heartRate.get({ date: parseLocalDate(date) }),
      })),
  );
}
