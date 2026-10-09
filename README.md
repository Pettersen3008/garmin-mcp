# Garmin MCP

An MCP server that lets an AI assistant read and change your own Garmin Connect data: activities, workouts, daily health, sleep, and training metrics. The repository is a Bun monorepo with two packages. `packages/garmin-connect` is a TypeScript SDK for the Garmin Connect endpoints, and `packages/garmin-mcp` is the stdio MCP server built on it.

This project is unofficial and not affiliated with Garmin. It calls undocumented consumer endpoints and signs in by impersonating the Garmin Connect mobile app's OAuth client. Garmin can change or block these endpoints at any time, and the server may break without notice. Use it only with your own account, at your own risk, and check Garmin's terms of use first.

## Requirements

- [Bun](https://bun.sh) 1.4.0 or later
- A Garmin Connect account
- A system credential store (see [Token storage](#token-storage))

## Setup

```sh
git clone https://github.com/Pettersen3008/garmin-mcp.git
cd garmin-mcp
bun install --frozen-lockfile
bun run auth
```

`bun run auth` opens Garmin's sign-in page in your browser, or prints the URL if no browser opens. After you sign in, copy the final `https://sso.garmin.com/sso/embed?ticket=...` URL and paste it into the terminal. The SDK exchanges the one-time ticket for an OAuth2 session and stores it in your system credential store. The command never reads or stores your Garmin password, and the SDK refreshes expired access tokens on its own.

As an alternative, set `GARMIN_SERVICE_TICKET=ST-...` for the first `bun run start`. The server ignores it when a stored session already exists. A service ticket is a short-lived credential, so remove it from your environment after the first start and never commit it.

## Configure an MCP client

```json
{
  "mcpServers": {
    "garmin": {
      "command": "bun",
      "args": ["run", "--cwd", "/absolute/path/to/garmin-mcp", "start"]
    }
  }
}
```

For Claude Code:

```sh
claude mcp add garmin -- bun run --cwd /absolute/path/to/garmin-mcp start
```

The server writes MCP frames to `stdout` and redacted diagnostics to `stderr`.

## Tools

| Tool | Access | Destructive |
| --- | --- | --- |
| `list_activities` | read | no |
| `get_activity` | read | no |
| `get_daily_summary` | read | no |
| `get_heart_rate` | read | no |
| `get_hrv` | read | no |
| `get_stress` | read | no |
| `get_body_battery` | read | no |
| `get_respiration` | read | no |
| `get_blood_oxygen` | read | no |
| `get_body_composition` | read | no |
| `get_sleep` | read | no |
| `get_training_status` | read | no |
| `get_training_readiness` | read | no |
| `list_workouts` | read | no |
| `get_workout` | read | no |
| `edit_activity` | write | yes |
| `delete_activity` | write | yes |
| `create_workout` | write | no |
| `edit_workout` | write | yes |
| `delete_workout` | write | yes |
| `schedule_workout` | write | no |
| `unschedule_workout` | write | yes |

`list_activities` takes a `limit`, optional `from` and `to` dates, and a `start` offset.

Every write tool requires `confirm: true`. The tool descriptions tell the model to set it only after you approve the exact change.

Workout steps can end on time, distance, or the lap button (open). `edit_workout` supports single-segment workouts only.

## Token storage

| OS | Store |
| --- | --- |
| macOS | Keychain |
| Linux | Secret Service through `secret-tool` (install `libsecret-tools`) |
| Windows | DPAPI-protected file under `%LOCALAPPDATA%\garmin-mcp` (untested) |

To sign out, remove the stored entry:

```sh
# macOS
security delete-generic-password -s @pettersen/garmin-connect -a default
# Linux
secret-tool clear service @pettersen/garmin-connect account default
```

On Windows, delete `%LOCALAPPDATA%\garmin-mcp\session`.

## Development

```sh
bun run check       # Biome, TypeScript, offline tests
bun run verify      # frozen install, check, bun audit
bun run live-check  # opt-in check against your own account
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the live-check environment variables.

## Credits

[python-garminconnect](https://github.com/cyberjunky/python-garminconnect) and [Garth](https://github.com/matin/garth) documented the auth flow and endpoints this project builds on.

## License

[MIT](LICENSE).

More: [architecture](docs/architecture.md), [roadmap](docs/roadmap.md), [ADR 001](docs/decisions/001-private-garmin-adapter.md), [security policy](SECURITY.md), [contributing](CONTRIBUTING.md).
