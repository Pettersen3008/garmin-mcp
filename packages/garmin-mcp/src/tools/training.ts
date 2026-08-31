import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";

const inputSchema = z.object({
  date: z.string().describe("Calendar date in YYYY-MM-DD format"),
});
const annotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
};

export function registerTrainingTools(
  server: McpServer,
  garmin: GarminClient,
): void {
  server.registerTool(
    "get_training_status",
    {
      annotations,
      description: "Get Garmin's current training status for a calendar date.",
      inputSchema,
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
      annotations,
      description:
        "Get Garmin's latest training-readiness reading for a calendar date.",
      inputSchema,
    },
    ({ date }) =>
      runTool(async () => ({
        trainingReadiness: await garmin.training.getReadiness({
          date: parseLocalDate(date),
        }),
      })),
  );
}
