# Contributing

Run `bun run verify` before you open a pull request. It runs a frozen install, oxfmt, type-aware oxlint, the TypeScript check, the offline tests, and `bun audit`.

Never commit Garmin credentials, service tickets, OAuth tokens, or personal data. Fixtures must be anonymized or synthetic.

Each changed endpoint contract needs a fixture and an offline test. The SDK in `packages/garmin-connect` owns endpoint paths and payload shapes. MCP tools in `packages/garmin-mcp` call only the public SDK surface and stay independent of Garmin endpoint details.

## Live checks

The live check runs against your own Garmin account, so it is opt-in:

```sh
GARMIN_E2E=1 bun run live-check [YYYY-MM-DD]
```

This runs every read operation for the given date. Set `GARMIN_E2E_WRITES=1` as well to add a write check that creates and removes a temporary workout and schedule. Set `GARMIN_E2E_DELETE_ACTIVITY_ID` to an activity ID to also delete that activity. Use only an activity you are willing to lose.
