export const CURRENCIES = ["NGN", "XOF"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Price of 1 BTC in each local currency. */
export type BtcRates = Record<Currency, number>;

const SATS_PER_BTC = 100_000_000;

export function satsToFiat(sats: number, btcRate: number): number {
  return (sats * btcRate) / SATS_PER_BTC;
}

export function fiatToSats(amount: number, btcRate: number): number {
  return Math.round((amount * SATS_PER_BTC) / btcRate);
}

export function formatFiat(amount: number, currency: Currency): string {
  const rounded = Math.round(amount);
  if (currency === "NGN") return `₦${rounded.toLocaleString("en-NG")}`;
  return `${rounded.toLocaleString("fr-SN")} CFA`;
}

/** Shows fractions of a sat when there are any (invoices are priced in msats). */
export function formatSats(sats: number): string {
  return `${sats.toLocaleString("en-US", { maximumFractionDigits: 3 })} sats`;
}

/**
 * Parses an amount typed by a person. Accepts "5000", "5,000", "5 000", "5.000"
 * (thousands) and "2.5", "2,5", "2500.50" (decimals: 1–2 digits after the mark).
 * Returns undefined for anything ambiguous instead of guessing.
 */
export function parseAmountInput(text: string, { decimals }: { decimals: boolean }): number | undefined {
  const t = text.trim().replace(/\u00a0|\u202f/g, " ");
  if (!t) return undefined;
  if (/^\d{1,3}([,. ]\d{3})+$/.test(t)) return Number(t.replace(/[,. ]/g, ""));
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return undefined;
  if (m[2] !== undefined && !decimals) return undefined;
  return Number(`${m[1]}.${m[2] ?? "0"}`);
}
