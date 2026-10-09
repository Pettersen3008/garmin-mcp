# Roadmap

This roadmap delivers the full personal Garmin Connect scope in `docs/plan.md`. Each phase must pass offline tests and a real-account live check before the next phase starts.

## Phase 0: existing read foundation

Status: complete.

- Browser SSO stores a DI OAuth2 session in the system credential store.
- The client refreshes expired access tokens and returns redacted errors.
- `GARMIN_E2E=1 bun run live-check 2026-08-30` passed activity list, activity detail, daily summary, sleep, training status, training readiness, workout list, and workout detail on 2026-08-31.

## Phase 1: activities and workouts

Status: complete.

- Add activity edit and delete.
- Add workout list, detail, create, edit, delete, calendar scheduling, and calendar removal.
- Require `confirm: true` for every mutation and read the resource after each successful write.

## Phase 2: health and body history

Status: complete.

- Add historical heart rate, HRV, stress, Body Battery, respiration, and blood-oxygen data where available.
- Add body composition and Health Snapshot data where available.
- Keep the existing daily, sleep, and training models as the summary views.
- Garmin only exposes Health Snapshot as a FIT archive download. The product plan excludes FIT parsing, so Phase 2 does not expose that archive.

## Phase 3: gear

- Add gear list, create, edit, retire, and activity assignment.

## Phase 4: courses and routes

- Add course and route list, detail, create, edit, delete, and supported device delivery.

## Phase 5: goals and calendar

- Add goals and the remaining Garmin Connect calendar data that supports training planning.

## Every phase

Each endpoint needs a stable model, an anonymized fixture, mapper tests, request-contract tests, MCP input validation, and a live check. The SDK uses Garmin's supported endpoint behaviour when it exists. For private endpoints, a payload or contract change must fail visibly and with redacted diagnostics.
