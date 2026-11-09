import type { Currency } from "./money.ts";

export type ClaimedAmount = { amount: number; currency: Currency; text: string };

// Money as people write it in WhatsApp/SMS: ₦50,000 · N50k · 50,000 naira · NGN 50000 ·
// 25 000 FCFA · 25.000 CFA · XOF 25000. "k" means thousand.
const NUM = String.raw`(\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)\s?(k)?`;
const PATTERNS: [RegExp, Currency][] = [
  [new RegExp(String.raw`(?:₦|\bN(?=\s?\d)|\bNGN)\s?${NUM}`, "gi"), "NGN"],
  [new RegExp(String.raw`${NUM}\s?(?:naira|NGN)\b`, "gi"), "NGN"],
  [new RegExp(String.raw`${NUM}\s?(?:F\s?CFA|CFA|XOF|francs?\b)`, "gi"), "XOF"],
  [new RegExp(String.raw`\b(?:F?CFA|XOF)\s?${NUM}`, "gi"), "XOF"],
];

function parseNumber(digits: string, k: string | undefined): number {
  // Thousands separators: "50,000", "25 000", "25.000". A single ".5" style is a decimal.
  const grouped = /^\d{1,3}(?:[,.\s]\d{3})+$/.test(digits);
  const n = grouped ? Number(digits.replace(/[,.\s]/g, "")) : Number(digits);
  return k ? n * 1000 : n;
}

/** Finds amounts of local money claimed in a message, in order of appearance. */
export function extractAmounts(message: string): ClaimedAmount[] {
  const found: (ClaimedAmount & { index: number })[] = [];
  for (const [re, currency] of PATTERNS) {
    for (const m of message.matchAll(re)) {
      const amount = parseNumber(m[1]!, m[2]);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (found.some((f) => Math.abs(f.index - m.index!) < m[0].length && f.currency === currency)) continue;
      found.push({ amount, currency, text: m[0].trim(), index: m.index! });
    }
  }
  return found.sort((a, b) => a.index - b.index).map(({ index: _index, ...rest }) => rest);
}
