import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { runTool } from "../mcp-result.ts";
import { dateInput, readOnly } from "../tool-schemas.ts";

export function registerTrainingTools(server: McpServer, garmin: GarminClient): void {
  server.registerTool(
    "get_training_status",
    {
      annotations: readOnly,
      description: "Get Garmin's current training status for a calendar date.",
      inputSchema: dateInput,
    },
    ({ date }) =>
      runTool(async () => ({
        trainingStatus: await garmin.training.getStatus({
          date: parseLocalDate(date),
        }),
      })),
  );
  server.registerTool(
    "get_training_readiness",
    {
      annotations: readOnly,
      description: "Get Garmin's latest training-readiness reading for a calendar date.",
      inputSchema: dateInput,
    },
    ({ date }) =>
      runTool(async () => ({
        trainingReadiness: await garmin.training.getReadiness({
          date: parseLocalDate(date),
        }),
      })),
  );
}
