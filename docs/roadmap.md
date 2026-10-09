# Roadmap

The server covers activities, workouts, daily health, health history, sleep, and training data. The next endpoint families, in order:

1. Gear: list, create, edit, retire, and assign gear to an activity.
2. Courses and routes: list, detail, create, edit, delete, and send to a device where Garmin supports it.
3. Goals and the remaining Garmin Connect calendar data used for training planning.

Health Snapshot stays out of scope. Garmin exposes it only as a FIT archive download, and the project does not parse FIT files.

## Every endpoint

Each endpoint needs a stable model, an anonymized fixture, mapper tests, request-contract tests, MCP input validation, and a live check. Every write tool requires `confirm: true`. A payload or contract change in a private endpoint must fail visibly, with redacted diagnostics.
