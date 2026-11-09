import type { PaymentRecord } from "@sye/core";

// Past payments, kept on this device only (THREAT_MODEL: "Payment history").
// The payee is stored as a SHA-256 hash, never the raw node key. History belongs
// to one wallet: connecting a different wallet starts a fresh history, and
// disconnecting deletes it.

const KEY = "sye.history";
const MAX = 200;

type Stored = { walletId: string; records: PaymentRecord[] };

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPayee(payee: string | undefined): Promise<string | undefined> {
  return payee ? sha256Hex(payee) : undefined;
}

function read(): Stored | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Stored> | null;
    if (!parsed || typeof parsed.walletId !== "string" || !Array.isArray(parsed.records)) return undefined;
    const records = parsed.records.filter(
      (r): r is PaymentRecord =>
        typeof r === "object" &&
        r !== null &&
        typeof r.sats === "number" &&
        typeof r.at === "number" &&
        (typeof r.payeeHash === "string" || r.payeeHash === undefined || r.payeeHash === null),
    );
    return { walletId: parsed.walletId, records };
  } catch {
    return undefined;
  }
}

function write(stored: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {}
}

/** Called when a wallet is opened: keeps its history, or starts empty for a different wallet. */
export function bindHistory(walletId: string) {
  if (read()?.walletId !== walletId) write({ walletId, records: [] });
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function loadHistory(walletId: string): PaymentRecord[] {
  const stored = read();
  return stored?.walletId === walletId ? stored.records : [];
}

export function recordPayment(walletId: string, record: PaymentRecord) {
  const records = loadHistory(walletId);
  write({ walletId, records: [...records, record].slice(-MAX) });
}
