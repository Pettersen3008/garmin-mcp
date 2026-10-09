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

The setup command opens Garmin SSO in the browser. You give the command the one-time service-ticket URL after login. As an alternative bootstrap, the MCP process accepts the ticket through `GARMIN_SERVICE_TICKET`. The SDK posts the ticket to Garmin's DI OAuth2 token endpoint with the service-ticket grant and the mobile client identifier. Garmin returns an OAuth2 access token, a refresh token, and their lifetimes. The SDK verifies the account profile, then stores the client identifier and OAuth2 tokens in the system credential store.

The server never accepts a Garmin email address or password. Remove `GARMIN_SERVICE_TICKET` from the MCP configuration after the first successful start. Before an access token expires, or after Garmin rejects one, the SDK posts the stored refresh token to the same DI OAuth2 endpoint with the refresh-token grant. It replaces the stored OAuth2 session with the returned tokens. An expired refresh token requires browser SSO again.

Refresh is single-flight: concurrent requests that need a new token share one refresh call. The SDK persists the refreshed session back to the credential store. Garmin does not document or support this consumer DI OAuth2 flow.

## Private endpoints

The SDK uses these endpoint families:

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

The session store depends on the operating system:

- macOS: Keychain through `/usr/bin/security`. The SDK passes the secret on stdin, never in argv.
- Linux: Secret Service through `secret-tool`, from the `libsecret-tools` package.
- Windows: a DPAPI-protected file at `%LOCALAPPDATA%\garmin-mcp\session`, written through `powershell.exe`. This path is untested.

## Tools and writes

The server registers 22 tools: 15 read and 7 write. Every write tool requires `confirm: true`. After a successful create or edit, the SDK reads the resource back. The project runs from source only. It has no build step, no npm package, and no CI.

## Official access

Garmin states that the [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/program-faq/) is for business use and that its APIs use OAuth 2.0. If Garmin approves this project, add an official client behind the same `GarminClient` interface. Do not mix official and private endpoints inside a feature.
