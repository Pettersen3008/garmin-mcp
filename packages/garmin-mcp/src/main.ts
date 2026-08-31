#!/usr/bin/env bun

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGarminClient } from "@pettersen/garmin-connect";
import { createServer } from "./create-server.ts";

const serviceTicket = process.env.GARMIN_SERVICE_TICKET;
delete process.env.GARMIN_SERVICE_TICKET;
const garmin = await createGarminClient({
  diagnostics: (event) => console.error(JSON.stringify(event)),
  ...(serviceTicket !== undefined ? { serviceTicket } : {}),
});
const server = createServer(garmin);
await server.connect(new StdioServerTransport());
