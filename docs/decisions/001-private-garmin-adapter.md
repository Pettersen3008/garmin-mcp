# ADR 001: Use a private Garmin Connect adapter

## Status

Accepted.

## Context

Garmin offers no self-service public API that lets a person read or change their own Garmin Connect account from a Bun or TypeScript service. Garmin's Connect Developer Program requires approval and targets business integrations. This project needs a personal path for local MCP use, covering both reads and confirmed writes.

The repository is a Bun monorepo with two packages:

- `@pettersen/garmin-connect` for Garmin authentication, private HTTP calls, response parsing, and stable models.
- `@pettersen/garmin-mcp` for MCP tool schemas and result conversion.

## Decision

The project uses a private Garmin Connect adapter behind `@pettersen/garmin-connect`.

The adapter owns:

- browser-ticket authentication
- token refresh
- Garmin endpoint paths
- raw Garmin payload parsing
- redacted request diagnostics

`@pettersen/garmin-mcp` stays above that boundary. It calls only the public SDK surface and never imports SDK internals.

## Consequences

This choice keeps the unsupported parts in one package and keeps MCP tool code stable if Garmin changes a payload.

This choice also sets hard limits:

- The project cannot promise endpoint stability.
- The project cannot claim Garmin support or official compatibility.
- The live account check must stay manual and opt-in.
- New features land one endpoint family at a time, with anonymized fixtures first.

## Follow-up

If Garmin approves official Developer Program access, add an official adapter behind the same public `GarminClient` interface. Do not mix official and private endpoints inside one feature module.
