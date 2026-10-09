import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { runTool } from "../mcp-result.ts";
import { dateInput, readOnly } from "../tool-schemas.ts";

export function registerDailySummaryTool(server: McpServer, garmin: GarminClient): void {
  server.registerTool(
    "get_daily_summary",
    {
      annotations: readOnly,
      description: "Get Garmin's daily health and movement summary for a calendar date.",
      inputSchema: dateInput,
    },
    ({ date }) =>
      runTool(async () => ({
        dailySummary: await garmin.dailySummary.get({
          date: parseLocalDate(date),
        }),
      })),
  );
}
