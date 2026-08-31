# Private Garmin adapter architecture

Garmin's supported Connect Developer Program is for approved business integrations. This project instead uses undocumented consumer endpoints for personal use. It does not call itself an official Garmin SDK and does not promise endpoint compatibility.

See [ADR 001](decisions/001-private-garmin-adapter.md) for the decision record.

## Package boundary

`@pettersen/garmin-connect` owns Garmin authentication, token refresh, endpoint paths, raw JSON validation, and stable models. `@pettersen/garmin-mcp` owns MCP schemas, tool registration, and result conversion.

```text
MCP tool -> public GarminClient -> feature mapper -> authenticated request -> Garmin Connect
```

The MCP package never imports an SDK internal file. Feature mappers have no I/O and receive `unknown`. Feature request functions receive only `GetJson` and their input.

## Authentication

The setup command opens Garmin SSO in the user's browser. The user gives the command the one-time CAS ticket URL after login. As an alternative bootstrap, the MCP process accepts the ticket through `GARMIN_SERVICE_TICKET`. The SDK exchanges that ticket for private OAuth 1 and OAuth 2 tokens, verifies the account profile, and stores the session in the macOS Keychain.

The server never accepts a Garmin email address or password. Remove `GARMIN_SERVICE_TICKET` from the MCP configuration after the first successful start. The server refreshes an expired OAuth 2 access token with the stored OAuth 1 token. An expired refresh token requires a new ticket or another interactive setup.

The browser-ticket exchange follows the flow documented in [Garth's SSO implementation](https://github.com/matin/garth/blob/main/src/garth/sso.py). Garmin does not document or support this flow.

## Private endpoints

The first release uses these endpoint families:

- `activitylist-service` and `activity-service`
- `usersummary-service`
- `wellness-service`
- `metrics-service`
- `userprofile-service`

The endpoint contracts follow current [python-garminconnect source](https://github.com/cyberjunky/python-garminconnect/blob/master/garminconnect/__init__.py) and anonymized fixtures. A required-field change fails in the matching mapper.

## Security boundary

The SDK accepts only internal endpoint paths. It rejects query strings, fragments, backslashes, and parent traversal in a path. Callers pass query values separately.

Diagnostics contain an event kind, an endpoint path, and an optional HTTP status. They never contain headers, query values, response bodies, profile names, or tokens. The stdio server reserves `stdout` for MCP frames.

The Keychain implementation supports macOS only. Add another operating-system credential store before claiming support for that system.

## Official access

Garmin states that the [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/program-faq/) is for business use and that its APIs use OAuth 2.0. If Garmin approves this project, add an official client behind the same `GarminClient` interface. Do not mix official and private endpoints inside a feature.
