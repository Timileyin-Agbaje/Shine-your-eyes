import { createHash } from "node:crypto";
import { NWCClient } from "@getalby/sdk/nwc";
import { expect, type Page } from "@playwright/test";

/** BTC rates pinned for the whole suite (passed to the server as RATES_FIXED). */
export const RATES = { NGN: 102_000_000, XOF: 44_600_000 } as const;

export const FAUCET = "https://faucet.nwc.dev";

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** A second sandbox wallet, used to make invoices with a chosen amount and expiry. */
export async function invoiceMaker() {
  const res = await fetch(`${FAUCET}?balance=0`, { method: "POST" });
  if (!res.ok) throw new Error(`faucet ${res.status}`);
  const client = new NWCClient({ nostrWalletConnectUrl: (await res.text()).trim() });
  return {
    async invoice(sats: number, expirySeconds: number, description = "") {
      return (await client.makeInvoice({ amount: sats * 1000, expiry: expirySeconds, description })).invoice;
    },
    close: () => client.close(),
  };
}

/** Taps "Try with a test wallet" and waits for the balance and local rate to show. */
export async function connectTestWallet(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try with a test wallet" }).click();
  await expect(page.getByText("10,000 sats")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("≈ ₦10,200")).toBeVisible();
}

/** An Etc/GMT zone in which the local hour is `hour` right now. */
export function timezoneForHour(hour: number): string {
  let offset = hour - new Date().getUTCHours();
  if (offset > 14) offset -= 24;
  if (offset < -12) offset += 24;
  // Etc/GMT signs are inverted: Etc/GMT-1 is UTC+1.
  return offset === 0 ? "Etc/GMT" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;
}
