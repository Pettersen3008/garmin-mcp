# Garmin MCP

This Bun monorepo contains an unofficial Garmin Connect SDK and MCP server. It has 22 tools for activity, health, training, and workout data. Every write tool requires `confirm: true`. Garmin does not support the consumer endpoints this code calls, so they can change without notice.

This project is not affiliated with Garmin. It uses undocumented consumer endpoints and an unpublished mobile-client OAuth flow. Use it only with your own account and at your own risk. Garmin can revoke access or change the endpoints at any time.

## Current state

The read foundation is complete. The project now expands toward a full personal Garmin Connect MCP:

- `bun install --frozen-lockfile` installs the workspace.
- `bun run check` runs Biome, strict TypeScript, and all offline tests.
- `bun run verify` repeats the frozen install, runs the offline check, and audits dependencies.
- `bun run auth` performs the browser-ticket flow and stores the session in your system credential store.
- `GARMIN_SERVICE_TICKET=ST-... bun run start` can bootstrap that session without the auth command.
- `bun run start` starts the stdio MCP server with 22 tools.
- `GARMIN_E2E=1 bun run live-check 2026-08-30` passed all 15 read operations on 2026-08-31.

The account owner completed the Phase 1 live write check on 2026-08-31. Phase 2 health-history reads also pass offline and live checks. To test writes against the account, set `GARMIN_E2E_WRITES=1`. The check creates and removes a temporary workout and schedule. It does not delete an activity unless you also set `GARMIN_E2E_DELETE_ACTIVITY_ID` to a sacrificial activity ID.

See [the product plan](docs/plan.md) for the intended data coverage, write safeguards, and build order.

## Install

```sh
git clone https://github.com/pettersen3008/garmin-mcp.git
cd garmin-mcp
bun install --frozen-lockfile
```

## Authenticate

Install [Bun](https://bun.sh), then run the interactive setup on macOS, Linux, or Windows:

```sh
bun run auth
```

The command opens Garmin's sign-in page. Complete the login in the browser, copy the final `https://sso.garmin.com/sso/embed?ticket=...` URL, and paste it into the terminal. The SDK exchanges the one-time ticket through Garmin's DI OAuth2 service-ticket grant. It verifies the profile, then stores the OAuth2 session in your system credential store. The request layer uses the stored refresh token to renew expired access tokens. The command does not read or store your Garmin password.

macOS uses Keychain. Linux requires `secret-tool` from libsecret. Windows encrypts the session with Windows DPAPI for your user account.

If you already have a fresh service ticket, start the MCP once with it:

```sh
GARMIN_SERVICE_TICKET='ST-...' bun run start
```

The SDK exchanges the ticket and stores the resulting session in your system credential store. Remove the environment variable after the first successful start. A service ticket is a short-lived credential, so never commit or share it.

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

See the [delivery plan](docs/plan.md), [roadmap](docs/roadmap.md), [architecture](docs/architecture.md), [ADR 001](docs/decisions/001-private-garmin-adapter.md), [security policy](SECURITY.md), and [MIT license](LICENSE).
