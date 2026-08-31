# First-release plan

The first release is a personal, read-only MCP server over private Garmin Connect endpoints. The code can ship for personal use after the live account check. It should not be published as a stable Garmin integration.

## Release checks

These checks define the release:

- `bun install --frozen-lockfile` installs the workspace.
- `bun run check` passes without network access.
- `bun run auth` or a one-time `GARMIN_SERVICE_TICKET` stores a Garmin session in the macOS Keychain without reading the Garmin password.
- The MCP server loads the stored session without Garmin credentials in its configuration.
- Six read-only tools return structured content.
- SDK mappers fail on required-field drift with redacted errors.
- `GARMIN_E2E=1 bun run live-check <date>` reaches all six private operations on a real account.

## Shipped now

### Foundation

Status: complete.

- The root pins Bun 1.4.0.
- The workspace contains only `@pettersen/garmin-connect` and `@pettersen/garmin-mcp`.
- `bun run check` runs Biome, strict TypeScript, and offline tests.
- GitHub Actions runs the same check after `bun install --frozen-lockfile`.

### SDK read path

Status: complete against offline fixtures.

- `bun run auth` opens Garmin SSO, accepts the browser redirect URL, exchanges the one-time ticket, verifies the profile, and saves the session in the macOS Keychain.
- The MCP can perform the same exchange once from `GARMIN_SERVICE_TICKET`, then start from the stored session without that variable.
- The request layer handles bearer auth, refresh, one safe retry, timeout, and redacted errors.
- The public client exposes activity list, activity detail, daily summary, sleep, training status, and training readiness.
- Feature mappers accept `unknown` and return stable, unit-named models.

### MCP tools

Status: complete against a fixture SDK.

- The server registers `list_activities`, `get_activity`, `get_daily_summary`, `get_sleep`, `get_training_status`, and `get_training_readiness`.
- Zod validates every tool input.
- Tool code depends only on the public SDK.
- Tool failures map to stable result codes.

## Open check

### Live Garmin validation

Status: pending a real account.

Run these commands on the target Mac:

```sh
bun run auth
GARMIN_E2E=1 bun run live-check 2026-08-30
```

If Garmin changed a payload, update only the matching feature mapper and its anonymized fixture. Do not widen the MCP tool shape to absorb raw Garmin fields.
