# Product plan

Garmin MCP is an unofficial MCP server for managing one person's Garmin Connect account. It reads and writes the Garmin Connect data needed for normal personal use. Garmin does not support the consumer endpoints that the project uses, so the project does not promise endpoint compatibility.

## What feature complete means

Feature complete means that the MCP covers these Garmin Connect families when the account and the current private endpoints support them:

- activities, including list, detail, edit, delete, and upload
- health and body data, including daily summaries, sleep, stress, Body Battery, heart-rate data, HRV, body composition, and structured Health Snapshot data when Garmin exposes it without FIT parsing
- training, including training status, readiness, recovery, workouts, training plans, calendar scheduling, and goals
- gear, including list, create, edit, assign, and retire
- courses and routes, including list, create, edit, delete, and send to a device when Garmin supports it

The project does not need FIT parsing, a database, or an HTTP server. Add a domain only when it is visible in Garmin Connect and supports a real personal workflow.

## Current state

The authentication path and 15 read operations work against a personal account:

- activity list and detail
- daily summary
- daily heart rate
- HRV
- stress
- Body Battery
- respiration
- blood oxygen
- body composition
- sleep summary
- training status
- training readiness
- workout list
- workout detail

`GARMIN_E2E=1 bun run live-check 2026-08-30` passed all 15 read operations on 2026-08-31. The session lives in the system credential store and refreshes through Garmin's DI OAuth2 flow.

The account owner completed the activity and workout live write check on 2026-08-31. Phase 2 health and body-history reads pass offline and live checks.

## Write safety

Every write tool must describe its target and changed fields. The tool input must include `confirm: true`. Delete and retire tools must also require the target identifier. The tool reads the resource after a successful write and returns the stored result.

If Garmin supports an idempotency key or version precondition, the SDK uses it. If it does not, the tool states that retrying can repeat the action. The MCP never stores a Garmin password or exposes tokens in tool results or diagnostics.

## Delivery rules

Each feature adds one stable SDK model, fixture-backed mapper tests, request-contract tests, MCP schemas, and a live check. A feature is done only after the live check proves both its intended read and write behaviour. The MCP exposes stable fields, not raw Garmin JSON.

## Build order

1. Add activity editing and deletion, plus workout list, detail, create, edit, delete, and calendar scheduling. These are the highest-value write workflows.
2. Add health and body-history reads. Use this data to support recovery and sleep questions without inventing a coaching layer first.
3. Add gear management and activity-to-gear assignment.
4. Add courses and routes, including supported device delivery.
5. Add goals and the remaining Garmin Connect calendar data.
6. Run the full live check after Garmin changes its web or mobile clients. Repair only the affected feature mapper or request contract.
