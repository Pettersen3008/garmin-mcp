import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GarminClient } from "@pettersen/garmin-connect";
import packageJson from "../package.json" with { type: "json" };
import { registerActivityTools } from "./tools/activities.ts";
import { registerDailySummaryTool } from "./tools/daily-summary.ts";
import { registerHealthHistoryTools } from "./tools/health-history.ts";
import { registerHeartRateTool } from "./tools/heart-rate.ts";
import { registerSleepTool } from "./tools/sleep.ts";
import { registerTrainingTools } from "./tools/training.ts";
import { registerWorkoutTools } from "./tools/workouts.ts";

export function createServer(garmin: GarminClient): McpServer {
  const server = new McpServer({
    name: "garmin-mcp",
    version: packageJson.version,
  });
  registerActivityTools(server, garmin);
  registerDailySummaryTool(server, garmin);
  registerHeartRateTool(server, garmin);
  registerHealthHistoryTools(server, garmin);
  registerSleepTool(server, garmin);
  registerTrainingTools(server, garmin);
  registerWorkoutTools(server, garmin);
  return server;
}
