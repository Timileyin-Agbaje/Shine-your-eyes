import { type Currency, formatFiat, formatSats, satsToFiat } from "@sye/core";

type Props = { sats: number; currency: Currency; rate: number | undefined; size?: "big" | "normal" };

/** Local money first (approximate), sats underneath. */
export function Money({ sats, currency, rate, size = "normal" }: Props) {
  return (
    <div class={`money money--${size}`}>
      {rate !== undefined && <div class="money__fiat">≈ {formatFiat(satsToFiat(sats, rate), currency)}</div>}
      <div class="money__sats">{formatSats(sats)}</div>
    </div>
  );
}
