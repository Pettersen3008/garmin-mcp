import { GarminAuthError } from "../http/errors.ts";
import {
  type GarminSession,
  parseGarminSession,
  type SessionStore,
} from "./session.ts";

const service = "@pettersen/garmin-connect";
const account = "default";

type Command = {
  args: string[];
  command: string;
  stdin?: Uint8Array;
};

async function runCommand(input: {
  args: string[];
  command: string;
  stdin?: Uint8Array;
}): Promise<{ code: number; output: string }> {
  const processHandle = Bun.spawn([input.command, ...input.args], {
    stderr: "pipe",
    stdin: input.stdin ?? "ignore",
    stdout: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);

  return { code, output: code === 0 ? stdout : stderr };
}

export function credentialStoreCommand(
  platform: NodeJS.Platform,
  session?: GarminSession,
): Command {
  if (platform === "darwin") {
    return session
      ? {
          args: [
            "add-generic-password",
            "-a",
            account,
            "-s",
            service,
            "-U",
            "-w",
            JSON.stringify(session),
          ],
          command: "/usr/bin/security",
        }
      : {
          args: ["find-generic-password", "-a", account, "-s", service, "-w"],
          command: "/usr/bin/security",
        };
  }
  if (platform === "linux") {
    return session
      ? {
          args: [
            "store",
            "--label=Garmin MCP session",
            "service",
            service,
            "account",
            account,
          ],
          command: "secret-tool",
          stdin: new TextEncoder().encode(JSON.stringify(session)),
        }
      : {
          args: ["lookup", "service", service, "account", account],
          command: "secret-tool",
        };
  }
  if (platform === "win32") {
    const script = session
      ? "$p=Join-Path $env:LOCALAPPDATA 'garmin-mcp\\session';[IO.Directory]::CreateDirectory((Split-Path $p))|Out-Null;$b=[Text.Encoding]::UTF8.GetBytes([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($args[0])));[IO.File]::WriteAllBytes($p,[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))"
      : "$p=Join-Path $env:LOCALAPPDATA 'garmin-mcp\\session';if(!(Test-Path $p)){exit 3};$b=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($p),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($b))";
    return {
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        script,
        ...(session
          ? [Buffer.from(JSON.stringify(session)).toString("base64")]
          : []),
      ],
      command: "powershell.exe",
    };
  }
  throw new GarminAuthError(`Session storage is unsupported on ${platform}`);
}

export function createSessionStore(): SessionStore {
  async function load() {
    const result = await runCommand(credentialStoreCommand(process.platform));

    if (result.code !== 0) {
      if (
        (process.platform === "darwin" &&
          result.output.includes("could not be found")) ||
        (process.platform === "linux" && result.code === 1) ||
        (process.platform === "win32" && result.code === 3)
      ) {
        return null;
      }
      throw new GarminAuthError(
        "Could not read the Garmin session from the system credential store",
      );
    }

    try {
      return parseGarminSession(JSON.parse(result.output));
    } catch (error) {
      if (error instanceof GarminAuthError) {
        throw error;
      }
      throw new GarminAuthError(
        "Could not parse the Garmin session from the system credential store",
      );
    }
  }

  return {
    load,
    async save(session: GarminSession) {
      if (
        (await runCommand(credentialStoreCommand(process.platform, session)))
          .code !== 0
      ) {
        throw new GarminAuthError(
          "Could not save the Garmin session to the system credential store",
        );
      }
      await load();
    },
  };
}
