import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type GarminClient, parseLocalDate } from "@pettersen/garmin-connect";
import { z } from "zod";
import { runTool } from "../mcp-result.ts";

const readOnly = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
};
const inputSchema = z.object({
  date: z.string().describe("Calendar date in YYYY-MM-DD format"),
});

export function registerHealthHistoryTools(
  server: McpServer,
  garmin: GarminClient,
): void {
  server.registerTool(
    "get_hrv",
    {
      annotations: readOnly,
      description: "Get Garmin's nightly HRV summary and samples for a date.",
      inputSchema,
    },
    ({ date }) =>
      runTool(async () => ({
        hrv: await garmin.health.getHrv({ date: parseLocalDate(date) }),
      })),
  );
  server.registerTool(
    "get_stress",
    {
      annotations: readOnly,
      description: "Get Garmin's daily stress summary and samples for a date.",
      inputSchema,
    },
    ({ date }) =>
      runTool(async () => ({
        stress: await garmin.health.getStress({ date: parseLocalDate(date) }),
      })),
  );
  server.registerTool(
    "get_body_battery",
    {
      annotations: readOnly,
      description: "Get Garmin's daily Body Battery summary and samples.",
      inputSchema,
    },
    ({ date }) =>
      runTool(async () => ({
        bodyBattery: await garmin.health.getBodyBattery({
          date: parseLocalDate(date),
        }),
      })),
  );
  server.registerTool(
    "get_respiration",
    {
      annotations: readOnly,
      description: "Get Garmin's daily respiration summary and samples.",
      inputSchema,
    },
    ({ date }) =>
      runTool(async () => ({
        respiration: await garmin.health.getRespiration({
          date: parseLocalDate(date),
        }),
      })),
  );
  server.registerTool(
    "get_blood_oxygen",
    {
      annotations: readOnly,
      description: "Get Garmin's daily blood-oxygen summary and samples.",
      inputSchema,
    },
    ({ date }) =>
      runTool(async () => ({
        bloodOxygen: await garmin.health.getBloodOxygen({
          date: parseLocalDate(date),
        }),
      })),
  );
  server.registerTool(
    "get_body_composition",
    {
      annotations: readOnly,
      description: "Get Garmin's body-composition measurements for a date.",
      inputSchema,
    },
    ({ date }) =>
      runTool(async () => ({
        bodyComposition: await garmin.health.getBodyComposition({
          date: parseLocalDate(date),
        }),
      })),
  );
}
