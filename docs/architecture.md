# Unofficial Garmin adapter architecture

Garmin's supported Connect Developer Program is for approved business integrations. This project instead uses undocumented consumer endpoints for personal use. It does not call itself an official Garmin SDK and does not promise endpoint compatibility.

See [ADR 001](decisions/001-private-garmin-adapter.md) for the decision record.

## Package boundary

`@pettersen/garmin-connect` owns Garmin authentication, token refresh, endpoint paths, raw JSON validation, and stable models. `@pettersen/garmin-mcp` owns MCP schemas, tool registration, and result conversion.

```text
MCP tool -> public GarminClient -> feature mapper -> authenticated request -> Garmin Connect
```

The MCP package never imports an SDK internal file. Feature mappers have no I/O and receive `unknown`. Read functions receive `GetJson`. Write functions receive `RequestJson`. The request layer retries GET requests once, but it never retries a write after an unknown network or server failure.

## Authentication

The setup command opens Garmin SSO in the user's browser. The user gives the command the one-time service-ticket URL after login. As an alternative bootstrap, the MCP process accepts the ticket through `GARMIN_SERVICE_TICKET`. The SDK posts the ticket to Garmin's DI OAuth2 token endpoint with the service-ticket grant and the mobile client identifier. Garmin returns an OAuth2 access token, a refresh token, and their lifetimes. The SDK verifies the account profile, then stores the client identifier and OAuth2 tokens in the system credential store.

The server never accepts a Garmin email address or password. Remove `GARMIN_SERVICE_TICKET` from the MCP configuration after the first successful start. Before an access token expires, or after Garmin rejects one, the SDK posts the stored refresh token to the same DI OAuth2 endpoint with the refresh-token grant. It replaces the stored OAuth2 session with the returned tokens. An expired refresh token requires browser SSO again.

Garmin does not document or support this consumer DI OAuth2 flow. The 15-operation read check passed on 2026-08-31 using data for 2026-08-30. The account owner also completed the activity and workout live write check.

## Private endpoints

The first release uses these endpoint families:

- `activitylist-service` and `activity-service`
- `workout-service`
- `usersummary-service`
- `wellness-service`
- `hrv-service`
- `weight-service`
- `metrics-service`
- `userprofile-service`

The endpoint contracts follow current [python-garminconnect source](https://github.com/cyberjunky/python-garminconnect/blob/master/garminconnect/__init__.py) and anonymized fixtures. A required-field change fails in the matching mapper.

## Security boundary

The SDK accepts only internal endpoint paths. It rejects query strings, fragments, backslashes, and parent traversal in a path. Callers pass query values separately.

Diagnostics contain an event kind, an endpoint path, and an optional HTTP status. They never contain headers, query values, response bodies, profile names, or tokens. The stdio server reserves `stdout` for MCP frames.

macOS uses Keychain. Linux uses `secret-tool`, which libsecret provides. Windows encrypts a session file with DPAPI for the current user. Linux users must install libsecret before they run `bun run auth`.

## Official access

Garmin states that the [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/program-faq/) is for business use and that its APIs use OAuth 2.0. If Garmin approves this project, add an official client behind the same `GarminClient` interface. Do not mix official and private endpoints inside a feature.
