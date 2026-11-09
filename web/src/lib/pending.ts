import { decodeInvoice, type Invoice } from "@sye/core";

// A payment whose result is still unknown is kept on this device until the wallet
// confirms it either way, so leaving the Send screen or reloading can't hide it.

const KEY = "sye.pendingPayment";

export function loadPending(): Invoice | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    // Decode without the expiry check: an expired one still needs its final answer.
    const result = decodeInvoice(raw, 0);
    return result.ok ? result.invoice : undefined;
  } catch {
    return undefined;
  }
}

export function storePending(invoice: Invoice | undefined) {
  try {
    if (invoice) localStorage.setItem(KEY, invoice.raw);
    else localStorage.removeItem(KEY);
  } catch {}
}
