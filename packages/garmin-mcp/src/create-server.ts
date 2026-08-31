import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GarminClient } from "@pettersen/garmin-connect";
import { registerActivityTools } from "./tools/activities.ts";
import { registerDailySummaryTool } from "./tools/daily-summary.ts";
import { registerSleepTool } from "./tools/sleep.ts";
import { registerTrainingTools } from "./tools/training.ts";

export function createServer(garmin: GarminClient): McpServer {
  const server = new McpServer({
    name: "garmin-mcp",
    version: "0.0.0",
  });
  registerActivityTools(server, garmin);
  registerDailySummaryTool(server, garmin);
  registerSleepTool(server, garmin);
  registerTrainingTools(server, garmin);
  return server;
}
