import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";

export function registerSleepTool(
  server: McpServer,
  garmin: GarminClient,
): void {
  server.registerTool(
    "get_sleep",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Get Garmin's sleep summary for a calendar date.",
      inputSchema: z.object({
        date: z.string().describe("Calendar date in YYYY-MM-DD format"),
      }),
    },
    ({ date }) =>
      runTool(async () => ({
        sleep: await garmin.sleep.get({ date: parseLocalDate(date) }),
      })),
  );
}
