import { expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { GarminClient } from "@pettersen/garmin-connect";
import { createServer } from "../src/create-server.ts";

const garmin: GarminClient = {
  activities: {
    async get({ id }) {
      return {
        id,
        name: "Fixture activity",
        startedAtLocal: "2026-08-30 08:00:00",
        type: "running",
      };
    },
    async list() {
      return [];
    },
  },
  dailySummary: {
    async get({ date }) {
      return { date, steps: 1000 };
    },
  },
  sleep: {
    async get({ date }) {
      return { date, sleepDurationSeconds: 28000 };
    },
  },
  training: {
    async getReadiness({ date }) {
      return { date, score: 80, timestamp: `${date}T07:00:00.0` };
    },
    async getStatus({ date }) {
      return { date, statusCode: 7 };
    },
  },
};

it("given the fixture SDK, when calling the MCP server, then all six read tools return structured content", async () => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createServer(garmin);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  try {
    const tools = await client.listTools();
    expect(tools.tools.map(({ name }) => name).sort()).toEqual([
      "get_activity",
      "get_daily_summary",
      "get_sleep",
      "get_training_readiness",
      "get_training_status",
      "list_activities",
    ]);
    const calls = await Promise.all([
      client.callTool({ name: "list_activities", arguments: { limit: 10 } }),
      client.callTool({ name: "get_activity", arguments: { id: "42" } }),
      client.callTool({
        name: "get_daily_summary",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_sleep",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_training_status",
        arguments: { date: "2026-08-30" },
      }),
      client.callTool({
        name: "get_training_readiness",
        arguments: { date: "2026-08-30" },
      }),
    ]);
    expect(
      calls.every(({ structuredContent }) => structuredContent !== undefined),
    ).toBe(true);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});
