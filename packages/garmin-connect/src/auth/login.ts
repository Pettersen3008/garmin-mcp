import { createInterface } from "node:readline/promises";
import { GarminAuthError } from "../http/errors.ts";
import { createRequestJson } from "../http/request.ts";
import { exchangeTicket } from "./oauth.ts";
import { getProfileDisplayName } from "./profile.ts";
import type { GarminSession } from "./session.ts";
import { createSessionStore } from "./token-store.ts";

export function createGarminSignInUrl(): URL {
  const base = "https://sso.garmin.com/sso";
  const url = new URL(`${base}/signin`);
  const embed = `${base}/embed`;
  url.search = new URLSearchParams({
    embedWidget: "true",
    gauthHost: base,
    id: "gauth-widget",
    redirectAfterAccountCreationUrl: embed,
    redirectAfterAccountLoginUrl: embed,
    service: embed,
    source: embed,
  }).toString();
  return url;
}

export function parseGarminTicket(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new GarminAuthError("Paste the complete Garmin redirect URL");
  }
  const ticket = url.searchParams.get("ticket");
  if (
    url.origin !== "https://sso.garmin.com" ||
    url.pathname !== "/sso/embed" ||
    !ticket?.startsWith("ST-")
  ) {
    throw new GarminAuthError(
      "The Garmin redirect URL does not contain a valid ticket",
    );
  }
  return ticket;
}

export async function runInteractiveLogin(): Promise<void> {
  const signInUrl = createGarminSignInUrl();
  const openerCommand =
    process.platform === "darwin"
      ? ["/usr/bin/open", signInUrl.toString()]
      : process.platform === "win32"
        ? [
            "powershell.exe",
            "-NoProfile",
            "-Command",
            "Start-Process",
            signInUrl.toString(),
          ]
        : ["xdg-open", signInUrl.toString()];
  const opener = Bun.spawn(openerCommand, {
    stderr: "ignore",
    stdout: "ignore",
  });
  if ((await opener.exited) !== 0) {
    console.error(`Open this URL in a browser:\n${signInUrl}`);
  }

  console.error(
    "Sign in to Garmin, then copy the final sso.garmin.com/sso/embed URL.",
  );
  const terminal = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  const redirectUrl = await terminal.question("Redirect URL: ");
  terminal.close();

  const sessionStore = createSessionStore();
  let session = await exchangeTicket({
    fetch,
    now: Date.now,
    ticket: parseGarminTicket(redirectUrl),
  });
  const memoryStore = {
    async load() {
      return session;
    },
    async save(nextSession: GarminSession) {
      session = nextSession;
    },
  };
  const getJson = createRequestJson({
    fetch,
    now: Date.now,
    session,
    sessionStore: memoryStore,
  });
  await getProfileDisplayName(getJson);
  await sessionStore.save(session);
  console.error("Garmin session stored in the system credential store.");
}

if (import.meta.main) {
  await runInteractiveLogin();
}
