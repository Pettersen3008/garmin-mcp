import { GarminAuthError } from "../http/errors.ts";
import { type GarminSession, parseGarminSession, type SessionStore } from "./session.ts";

const service = "@pettersen/garmin-connect";
const account = "default";
const windowsSessionPath =
  "Add-Type -AssemblyName System.Security;$p=Join-Path $env:LOCALAPPDATA 'garmin-mcp\\session';";

type Command = {
  args: string[];
  command: string;
  stdin?: Uint8Array;
};

function spawn(input: Command) {
  try {
    return Bun.spawn([input.command, ...input.args], {
      stderr: "pipe",
      stdin: input.stdin ?? "ignore",
      stdout: "pipe",
    });
  } catch (error) {
    throw new GarminAuthError(
      `Could not run ${input.command}. Install it to use the system credential store${input.command === "secret-tool" ? " (package libsecret-tools)" : ""}`,
      { cause: error },
    );
  }
}

async function runCommand(input: Command): Promise<{ code: number; output: string }> {
  const processHandle = spawn(input);
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
  const secret = session && JSON.stringify(session);
  if (platform === "darwin") {
    if (secret === undefined) {
      return {
        args: ["find-generic-password", "-a", account, "-s", service, "-w"],
        command: "/usr/bin/security",
      };
    }
    // security -i reads the command from stdin, keeping the token out of argv.
    const line = `add-generic-password -a ${account} -s ${service} -U -w "${secret.replace(/[\\"]/g, "\\$&")}"\n`;
    if (line.length > 4000) {
      // security -i truncates lines near 4 KB, which would store a corrupt session.
      throw new GarminAuthError("The Garmin session is too large for the macOS keychain command");
    }
    return {
      args: ["-i"],
      command: "/usr/bin/security",
      stdin: new TextEncoder().encode(line),
    };
  }
  if (platform === "linux") {
    return secret
      ? {
          args: ["store", "--label=Garmin MCP session", "service", service, "account", account],
          command: "secret-tool",
          stdin: new TextEncoder().encode(secret),
        }
      : {
          args: ["lookup", "service", service, "account", account],
          command: "secret-tool",
        };
  }
  if (platform === "win32") {
    return {
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        secret
          ? `${windowsSessionPath}[IO.Directory]::CreateDirectory((Split-Path $p))|Out-Null;$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());[IO.File]::WriteAllBytes($p,[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`
          : `${windowsSessionPath}if(!(Test-Path $p)){exit 3};$b=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($p),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($b))`,
      ],
      command: "powershell.exe",
      ...(secret ? { stdin: new TextEncoder().encode(secret) } : {}),
    };
  }
  throw new GarminAuthError(`Session storage is unsupported on ${platform}`);
}

export function createSessionStore(): SessionStore {
  return {
    async load() {
      const result = await runCommand(credentialStoreCommand(process.platform));

      if (result.code !== 0) {
        if (
          (process.platform === "darwin" && result.output.includes("could not be found")) ||
          (process.platform === "linux" && result.code === 1 && result.output.trim() === "") ||
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
        throw new GarminAuthError(
          "Could not parse the Garmin session from the system credential store",
          { cause: error },
        );
      }
    },
    async save(session: GarminSession) {
      if ((await runCommand(credentialStoreCommand(process.platform, session))).code !== 0) {
        throw new GarminAuthError(
          "Could not save the Garmin session to the system credential store",
        );
      }
    },
  };
}
