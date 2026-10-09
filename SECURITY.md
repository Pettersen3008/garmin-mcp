# Security policy

## Supported versions

Only the latest version on `main` receives security fixes.

## Reporting a vulnerability

Do not open a public issue for a credential leak, token exposure, or a way to access another Garmin account. Use a private GitHub security advisory for this repository, or contact the repository owner directly through GitHub.

Never include Garmin service tickets, OAuth tokens, or personal activity data in a report.

We will acknowledge reports within seven days and coordinate a fix before any public disclosure.

## Exposed tokens

If a token leaks, remove the stored session from your system credential store and run `bun run auth` again. The README lists the command that removes the session on each operating system.
