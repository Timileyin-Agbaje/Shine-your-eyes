import { FAUCET_URL } from "@sye/core";

// Sandbox helpers. The faucet hands out dummy wallets whose sats aren't real.
// The browser talks to it directly, so test NWC strings never touch our server.

async function post(path: string): Promise<Response> {
  const res = await fetch(`${FAUCET_URL}${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`faucet ${res.status}`);
  return res;
}

export async function createTestWallet(balanceSats = 10_000): Promise<string> {
  return (await (await post(`/?balance=${balanceSats}`)).text()).trim();
}

/** The faucet pays an invoice, e.g. to test receiving. */
export async function faucetPay(invoice: string): Promise<void> {
  await post(`/pay-invoice?invoice=${encodeURIComponent(invoice)}`);
}

/** The faucet makes an invoice, e.g. to test sending. */
export async function faucetInvoice(sats: number, description: string): Promise<string> {
  const res = await post(`/make-invoice?amount=${sats}&description=${encodeURIComponent(description)}`);
  const body = (await res.json()) as { invoice?: unknown };
  if (typeof body.invoice !== "string") throw new Error("faucet returned no invoice");
  return body.invoice;
}
