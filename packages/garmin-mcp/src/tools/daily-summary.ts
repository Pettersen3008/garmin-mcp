import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";

export function registerDailySummaryTool(
  server: McpServer,
  garmin: GarminClient,
): void {
  server.registerTool(
    "get_daily_summary",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description:
        "Get Garmin's daily health and movement summary for a calendar date.",
      inputSchema: z.object({
        date: z.string().describe("Calendar date in YYYY-MM-DD format"),
      }),
    },
    ({ date }) =>
      runTool(async () => ({
        dailySummary: await garmin.dailySummary.get({
          date: parseLocalDate(date),
        }),
      })),
  );
}
