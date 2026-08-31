# Roadmap

This roadmap starts from the current repository state on 2026-08-31. Each phase needs evidence before the next phase starts.

## Phase 0: prove the private account path

Current state: offline complete, live check still open.

- Run `bun run auth` on the target Mac.
- Run `GARMIN_E2E=1 bun run live-check <date>` against a date that has sleep and training data.
- Replace synthetic fixture values with anonymized account-shaped payloads only if the live payload differs.
- Use the MCP server in regular personal use for at least four weeks.

Exit condition: the private flow survives regular use, and a Garmin payload change fails in a mapper with a redacted error instead of silently changing tool output.

## Phase 1: add one read feature family

Add the first feature that repeated use justifies. The current order is body data, workouts, then gear.

Each new feature needs:

- one stable SDK model
- one fixture-backed mapper test
- one request-contract test
- one read-only MCP tool
- one live-check call

Do not add more than one feature family in the same phase.

## Phase 2: add coaching summaries

Add coaching only after the base read models stay stable in personal use. Coaching composes public SDK calls. Coaching does not import feature internals or raw Garmin JSON.

## Later

- Add an official adapter only after Garmin approves Developer Program access.
- Add write tools only with explicit confirmation, idempotency rules, and dedicated tests.
- Add caching only after measured latency or rate limits justify it.
- Publish `@pettersen/garmin-connect` only after another application uses the public API.
- Add Linux or Windows credential storage before claiming support for those systems.

## Still out of scope

Do not add FIT parsing, GPS tracks, a database, an HTTP server, trend calculations, or a third package until a real consumer needs one.
