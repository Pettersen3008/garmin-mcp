import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGarminClient, createSessionStore } from "@pettersen/garmin-connect";
import { createServer } from "./create-server.ts";

const serviceTicket = process.env.GARMIN_SERVICE_TICKET;
delete process.env.GARMIN_SERVICE_TICKET;
const sessionStore = createSessionStore();
const useTicket = serviceTicket !== undefined && (await sessionStore.load()) === null;
if (serviceTicket !== undefined && !useTicket) {
  console.error("Ignoring GARMIN_SERVICE_TICKET because a stored Garmin session exists");
}
const garmin = await createGarminClient({
  diagnostics: (event) => console.error(JSON.stringify(event)),
  sessionStore,
  ...(useTicket ? { serviceTicket } : {}),
});
const server = createServer(garmin);
await server.connect(new StdioServerTransport());
