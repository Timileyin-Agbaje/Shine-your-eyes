import { expect, test } from "@playwright/test";

// Uses real sandbox wallets from faucet.nwc.dev (see docs/TESTING.md).
// Rates are pinned in playwright.config.ts: 1 BTC = ₦102,000,000.

test("a new user connects a test wallet, receives and sends", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/");
  await page.getByRole("button", { name: "Try with a test wallet" }).click();
  await expect(page.getByText("10,000 sats")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("≈ ₦10,200")).toBeVisible();
  await expect(page.getByText("Test wallet")).toBeVisible();

  // The wallet is remembered on this phone.
  await page.reload();
  await expect(page.getByText("10,000 sats")).toBeVisible({ timeout: 30_000 });

  // Receive ₦1,000 and get paid by the faucet.
  await page.getByRole("button", { name: "Receive" }).click();
  await page.getByLabel("How much?").fill("1000");
  await expect(page.getByText("= 980 sats")).toBeVisible();
  await page.getByRole("button", { name: "Make payment request" }).click();
  await expect(page.getByText("Waiting for payment…")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Pay it from the test faucet" }).click();
  await expect(page.getByText("✓ Paid")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("10,980 sats")).toBeVisible({ timeout: 30_000 });

  // A broken request is refused in plain words.
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByLabel("Payment request (invoice)").fill("lnbc1notarealinvoice");
  await expect(page.getByRole("alert")).toHaveText(/isn't a valid payment request/);

  // Pay a real sandbox request.
  await page.getByRole("button", { name: "Get a test request (1,000 sats)" }).click();
  await expect(page.getByText("You're paying")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("≈ ₦1,020")).toBeVisible();
  await expect(page.getByText("Test payment")).toBeVisible();
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await expect(page.getByText("✓ Sent")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("9,980 sats")).toBeVisible({ timeout: 30_000 });
});

test("a wrong wallet code gets a clear message", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Wallet connection code").fill("hello");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(/should start with nostr\+walletconnect/);
});
