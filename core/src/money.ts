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

export function formatSats(sats: number): string {
  return `${Math.floor(sats).toLocaleString("en-US")} sats`;
}
