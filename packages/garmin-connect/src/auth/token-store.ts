import { GarminAuthError } from "../http/errors.ts";
import {
  type GarminSession,
  parseGarminSession,
  type SessionStore,
} from "./session.ts";

const service = "@pettersen/garmin-connect";
const account = "default";

async function runSecurity(
  args: string[],
  secret?: string,
): Promise<{ code: number; output: string }> {
  if (process.platform !== "darwin") {
    throw new GarminAuthError("Session storage requires the macOS Keychain");
  }

  const processHandle = Bun.spawn(["/usr/bin/security", ...args], {
    stderr: "pipe",
    stdin: secret === undefined ? "ignore" : "pipe",
    stdout: "pipe",
  });
  if (secret !== undefined && processHandle.stdin !== undefined) {
    processHandle.stdin.write(`${secret}\n${secret}\n`);
    processHandle.stdin.end();
  }
  const [code, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);

  return { code, output: code === 0 ? stdout : stderr };
}

export function createKeychainSessionStore(): SessionStore {
  return {
    async load() {
      const result = await runSecurity([
        "find-generic-password",
        "-a",
        account,
        "-s",
        service,
        "-w",
      ]);

      if (result.code !== 0) {
        if (result.output.includes("could not be found")) {
          return null;
        }
        throw new GarminAuthError(
          "Could not read the Garmin session from Keychain",
        );
      }

      try {
        return parseGarminSession(JSON.parse(result.output));
      } catch (error) {
        if (error instanceof GarminAuthError) {
          throw error;
        }
        throw new GarminAuthError(
          "Could not parse the Garmin session from Keychain",
        );
      }
    },

    async save(session: GarminSession) {
      const result = await runSecurity(
        ["add-generic-password", "-a", account, "-s", service, "-U", "-w"],
        JSON.stringify(session),
      );

      if (result.code !== 0) {
        throw new GarminAuthError(
          "Could not save the Garmin session to Keychain",
        );
      }
    },
  };
}
