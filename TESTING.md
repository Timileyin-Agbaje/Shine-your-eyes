# Testing

We test what a user does, end to end. Unit tests are not the default.

## The suite

- Playwright against the running app (web + server) at a phone viewport, 360×740.
- Lightning uses real sandbox wallets from faucet.nwc.dev.
- AI uses a stub model server by default, so runs are fast, free and repeatable. The stub can play scripted roles, including hostile ones.
- Scenarios in `core/fixtures/scenarios.json` drive most of the suite. One data-driven test runs every scenario: paste the invoice and message, then check the warnings on the pause screen. To cover a new case, add a scenario before writing a new test.

## What every run must prove

1. A normal payment goes through in two taps.
2. Every fixture scenario shows its expected warnings.
3. A hostile AI (says "safe", returns junk, times out, returns nothing) never removes a rule warning, and junk or a timeout shows "Couldn't check this message".
4. The model never receives a phone number, account number or email from any fixture (assert on what the stub received).
5. Server logs from the whole run contain no message text, invoice or NWC string.
6. A guardian ping arrives and the reply shows on the pause screen.

## Keep it lean

- One test per user journey, plus the data-driven scenario test.
- No snapshot tests, no tests of internal functions, no mocking our own modules.
- Only write a unit test to pin down a bug the e2e suite can't reach cheaply, and delete it once it stops earning its place.
- The whole suite should run in a few minutes.

## The real model

`pnpm eval` runs every scenario against the real Claude API and writes the catch rate and false-alarm rate to docs/EVAL.md. It is not part of CI, because it costs money and isn't deterministic.
