# Spikes

## TIM-81: pay an invoice between two NWC sandbox wallets (2026-11-08)

**Result: works.** `pnpm spike:nwc` creates two dummy wallets on [faucet.nwc.dev](https://faucet.nwc.dev), makes an invoice on B, pays it from A with `NWCClient` (`@getalby/sdk`), and checks both balances. It passed on all three runs. No LNbits fallback is needed.

### Timings (from this phone, over mobile data)

| Step | Time |
| --- | --- |
| Create a faucet wallet (HTTP POST) | 0.4–1.7 s |
| `get_info` (first call, opens relay connection) | 1.2–1.4 s |
| `get_balance` | ~0.3 s |
| `make_invoice` | ~0.4 s |
| `pay_invoice` | ~0.4 s |
| `lookup_invoice` | ~0.3 s |
| `payment_received` notification after pay starts | ~0.7 s |

In the app, the whole flow from "Try with a test wallet" to the balance on screen takes 5–8 s, and a reload takes about 2.5 s.

### Faucet API

- `POST https://faucet.nwc.dev?balance=<sats>` returns an NWC connection string as plain text.
- `POST /make-invoice?amount=<sats>&description=` returns JSON with `invoice`. The faucet makes the request, so we can test sending.
- `POST /pay-invoice?invoice=` makes the faucet pay a request, so we can test receiving.
- CORS is open (`access-control-allow-origin: *`), so the browser calls the faucet directly and test NWC strings never touch our server.

### Quirks that affect the design

1. **Sandbox invoices look like mainnet.** `get_info` reports `network: mainnet` and invoices start with `lnbc`. "Reject mainnet invoices in sandbox mode" can't use the network prefix. Instead, every faucet wallet sits on one node, `03b6b08e…b430c`, and its invoices carry that node in the `n` (payee) tag. A test wallet only pays invoices whose payee is that node (`isSandboxInvoice` in `core/src/sandbox.ts`).
2. **Methods:** `get_info, pay_invoice, pay_keysend, multi_pay_invoice, multi_pay_keysend, get_balance, make_invoice, make_hold_invoice, settle_hold_invoice, cancel_hold_invoice, lookup_invoice, list_transactions, get_budget`. **Notifications:** `payment_received, payment_sent, hold_invoice_accepted`. Other wallets differ, so Receive uses notifications when available and also polls `lookup_invoice` every 3 s.
3. **Relay sockets keep Node alive** after `close()`, so the script exits explicitly.
4. Balances are in msats; the faucet charged no fees for internal payments.
