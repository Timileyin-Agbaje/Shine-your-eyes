# Shine Your Eye

A Lightning wallet PWA that pauses every payment and checks it for scam signs (rules first, then AI), with an optional trusted person pinged over Nostr. Built for the Dakar Bitcoin Hack 2026; work is tracked in Linear project P-TIM-4.

This is a pnpm workspace: `web/` is the PWA, `server/` is the API, `core/` is logic shared by both.

- Dev: `pnpm dev`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test:e2e`

## The rule that doesn't bend

AI can only add warnings. It never removes or downgrades a warning, moves money, or approves a payment. Money never passes through our server.

Before changing anything that touches payments, warnings, the AI check, the guardian or logging, read docs/THREAT_MODEL.md.

## Testing

We test what a user does, end to end. See docs/TESTING.md before adding any test.

## Working from a Linear issue

Use the issue's git branch name. You're done when every "Done when" item is met and the e2e suite passes. Open a PR, then comment on the issue with what changed and what to try on a phone.
