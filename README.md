# Garmin MCP

This Bun monorepo contains a private, read-only Garmin Connect SDK and six MCP tools. Garmin does not support the consumer endpoints this code calls, so they can change without notice.

## Current state

The offline first-release slice is in place:

- `bun install --frozen-lockfile` installs the workspace.
- `bun run check` runs Biome, strict TypeScript, and all offline tests.
- `bun run verify` repeats the frozen install, runs the offline check, and audits dependencies.
- `bun run auth` performs the macOS browser-ticket flow and stores the session in the Keychain.
- `GARMIN_SERVICE_TICKET=ST-... bun run start` can bootstrap that session without the auth command.
- `bun run start` starts the stdio MCP server with six read-only tools.

The remaining release check is the real-account live run:

```sh
GARMIN_E2E=1 bun run live-check 2026-08-30
```

Run that command after `bun run auth` on a Mac that has access to your Garmin account.

## Authenticate

Run the interactive setup on macOS:

```sh
bun run auth
```

The command opens Garmin's sign-in page. Complete the login in the browser, copy the final `https://sso.garmin.com/sso/embed?ticket=...` URL, and paste it into the terminal. The command exchanges the one-time ticket and stores the session in the macOS Keychain. It does not read or store your Garmin password.

If you already have a fresh service ticket, start the MCP once with it:

```sh
GARMIN_SERVICE_TICKET='ST-...' bun run start
```

The SDK exchanges the ticket and stores the resulting session in the macOS Keychain. Remove the environment variable after the first successful start. A service ticket is a short-lived credential, so never commit or share it.

## Configure an MCP client

Use the repository path as the working directory. A normal start needs no Garmin credentials in the MCP configuration because it loads the stored Keychain session.

```json
{
  "command": "bun",
  "args": ["run", "start"],
  "cwd": "/absolute/path/to/garmin-mcp"
}
```

For the first start only, an MCP client may provide `GARMIN_SERVICE_TICKET` in its `env` configuration. Remove it after the session reaches the Keychain. The server does not accept Garmin email or password variables.

```json
{
  "command": "bun",
  "args": ["run", "start"],
  "cwd": "/absolute/path/to/garmin-mcp",
  "env": {
    "GARMIN_SERVICE_TICKET": "ST-..."
  }
}
```

The server writes MCP frames to `stdout`. It writes redacted diagnostics to `stderr`.

## Documentation

See the [delivery plan](docs/plan.md), [roadmap](docs/roadmap.md), [architecture](docs/architecture.md), and [ADR 001](docs/decisions/001-private-garmin-adapter.md).
