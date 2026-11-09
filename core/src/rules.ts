import { extractAmounts } from "./amounts.ts";
import type { Invoice } from "./invoice.ts";
import { type BtcRates, type Currency, fiatToSats, formatFiat, satsToFiat } from "./money.ts";
import { makeWarning, sortWarnings, type Warning } from "./warnings.ts";

export type PaymentRecord = Readonly<{
  /** SHA-256 of the payee node pubkey (hex). History never stores the raw payee. */
  payeeHash: string | undefined;
  sats: number;
  /** ms since epoch */
  at: number;
}>;

export type RuleInput = {
  invoice: Invoice;
  /** The message that came with the request, if the user pasted one. */
  message?: string;
  rates: BtcRates | undefined;
  /** The user's display currency. */
  currency: Currency;
  history: readonly PaymentRecord[];
  payeeHash: string | undefined;
  /** ms since epoch */
  now: number;
  /** Local hour 0–23 at `now` (passed in so the rules stay pure). */
  localHour: number;
};

export const RULE_IDS = ["amount_mismatch", "rush", "new_payee", "unusually_large", "odd_hour"] as const;
export type RuleId = (typeof RULE_IDS)[number];

const MISMATCH_TOLERANCE = 0.1;
const RUSH_MINUTES = 10;
const NEW_WALLET_LIMIT_NGN = 20_000;
const LARGE_MULTIPLE = 3;

const rule = (id: RuleId, severity: Warning["severity"], reason: string) =>
  makeWarning({ id, source: "rule", severity, reason });

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The deterministic checks. They run on the device before any AI, and nothing
 * downstream can remove what they return.
 */
export function evaluateRules(input: RuleInput): readonly Warning[] {
  const { invoice, rates } = input;
  const warnings: Warning[] = [];

  // Amount mismatch: what the message claims vs what the invoice actually asks for.
  if (input.message && rates) {
    // Relative gap between each claimed amount and the invoice; the closest claim decides.
    const gaps = extractAmounts(input.message).map((claim) => {
      const real = satsToFiat(invoice.amountSats, rates[claim.currency]);
      return { claim, real, gap: Math.abs(real - claim.amount) / claim.amount };
    });
    const closest = gaps.sort((a, b) => a.gap - b.gap)[0];
    if (closest && closest.gap > MISMATCH_TOLERANCE) {
      const { claim, real } = closest;
      warnings.push(
        rule(
          "amount_mismatch",
          "high",
          `The message says ${formatFiat(claim.amount, claim.currency)}, but this request is for about ${formatFiat(real, claim.currency)}.`,
        ),
      );
    }
  }

  // Rush: a very short expiry stops people from checking.
  const minutesLeft = Math.floor((invoice.expiresAt * 1000 - input.now) / 60_000);
  if (minutesLeft < RUSH_MINUTES) {
    const when = minutesLeft < 1 ? "in less than a minute" : `in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}`;
    warnings.push(rule("rush", "med", `This request expires ${when}. Scammers rush you so you don't stop to check.`));
  }

  // New payee: no earlier payment to this destination.
  if (!input.payeeHash || !input.history.some((p) => p.payeeHash === input.payeeHash)) {
    warnings.push(rule("new_payee", "low", "You haven't paid this person before."));
  }

  // Unusually large: compared with the user's normal sending, or a limit while the wallet is new.
  const past = input.history.map((p) => p.sats);
  if (past.length >= 3) {
    if (invoice.amountSats > LARGE_MULTIPLE * median(past)) {
      warnings.push(rule("unusually_large", "med", "This is much more than you usually send."));
    }
  } else {
    const limitSats = rates ? fiatToSats(NEW_WALLET_LIMIT_NGN, rates.NGN) : NEW_WALLET_LIMIT_NGN;
    if (invoice.amountSats > limitSats) {
      const limit = rates ? formatFiat(satsToFiat(limitSats, rates[input.currency]), input.currency) : undefined;
      warnings.push(
        rule(
          "unusually_large",
          "med",
          limit
            ? `This is a large payment for a new wallet (more than ${limit}).`
            : "This is a large payment for a new wallet.",
        ),
      );
    }
  }

  // Odd hour: late-night sends are a common scam pattern (soft warning).
  if (input.localHour >= 23 || input.localHour < 5) {
    warnings.push(rule("odd_hour", "low", "It's late at night. Scammers often message when people are tired."));
  }

  return Object.freeze(sortWarnings(warnings));
}
