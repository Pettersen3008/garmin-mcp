import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { runTool } from "../mcp-result.ts";
import { dateInput, readOnly } from "../tool-schemas.ts";

export function registerHeartRateTool(server: McpServer, garmin: GarminClient): void {
  server.registerTool(
    "get_heart_rate",
    {
      annotations: readOnly,
      description:
        "Get Garmin's daily heart-rate summary and timestamped samples for a calendar date.",
      inputSchema: dateInput,
    },
    ({ date }) =>
      runTool(async () => ({
        heartRate: await garmin.heartRate.get({ date: parseLocalDate(date) }),
      })),
  );
}
