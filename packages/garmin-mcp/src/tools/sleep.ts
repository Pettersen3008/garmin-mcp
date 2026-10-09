import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { runTool } from "../mcp-result.ts";
import { dateInput, readOnly } from "../tool-schemas.ts";

export function registerSleepTool(server: McpServer, garmin: GarminClient): void {
  server.registerTool(
    "get_sleep",
    {
      annotations: readOnly,
      description: "Get Garmin's sleep summary for a calendar date.",
      inputSchema: dateInput,
    },
    ({ date }) =>
      runTool(async () => ({
        sleep: await garmin.sleep.get({ date: parseLocalDate(date) }),
      })),
  );
}
