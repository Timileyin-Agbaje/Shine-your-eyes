import { strings } from "../strings.ts";

const STALE_MS = 15 * 60_000;

export function formatAge(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}

/** Says local amounts are approximate, and how old the rate is when it's stale. */
export function RateNote({ rate, rateAgeMs }: { rate: number | undefined; rateAgeMs: number | undefined }) {
  const s = strings.home;
  const text =
    rate === undefined
      ? s.noRate
      : rateAgeMs !== undefined && rateAgeMs > STALE_MS
        ? s.rateAge(formatAge(rateAgeMs))
        : s.approx;
  const stale = rate !== undefined && rateAgeMs !== undefined && rateAgeMs > STALE_MS;
  return <p class={`muted small${stale ? " stale" : ""}`}>{text}</p>;
}
