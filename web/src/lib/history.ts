import type { PaymentRecord } from "@sye/core";

// Past payments, kept on this device only (THREAT_MODEL: "Payment history").
// The payee is stored as a SHA-256 hash, never the raw node key.

const KEY = "sye.history";
const MAX = 200;

export async function hashPayee(payee: string | undefined): Promise<string | undefined> {
  if (!payee) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payee));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function loadHistory(): PaymentRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is PaymentRecord =>
        typeof r === "object" &&
        r !== null &&
        typeof r.sats === "number" &&
        typeof r.at === "number" &&
        (typeof r.payeeHash === "string" || r.payeeHash === undefined || r.payeeHash === null),
    );
  } catch {
    return [];
  }
}

export function recordPayment(record: PaymentRecord) {
  try {
    const next = [...loadHistory(), record].slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
