import { expect, test } from "@playwright/test";
import { connectTestWallet, invoiceMaker } from "./support.ts";

test("serious warnings slow the user down, but they can still choose to pay", async ({ page }) => {
  test.setTimeout(150_000);
  const maker = await invoiceMaker();
  try {
    await connectTestWallet(page);
    // The message claims ₦500, the invoice is for ~₦1,530 and expires in 5 minutes.
    const invoice = await maker.invoice(1500, 300, "Urgent");
    const message = "Abeg send ₦500 now now, I'm stranded at the motor park.";

    const openPauseScreen = async () => {
      await page.getByRole("button", { name: "Send" }).click();
      await page.getByLabel("Payment request (invoice)").fill(invoice);
      await page.getByRole("button", { name: /Got a message with this request/ }).click();
      await page.getByLabel(/The message that came with it/).fill(message);
    };

    await openPauseScreen();
    const warnings = page.getByRole("list", { name: "Warning signs" }).getByRole("listitem");
    // Most serious first.
    await expect(warnings.first()).toHaveText(/The message says ₦500, but this request is for about ₦1,530\./);
    await expect(page.locator("[data-warning-id=rush]")).toBeVisible();

    // "Don't pay" is the big button; "Pay anyway" has to wait.
    await expect(page.getByRole("button", { name: "Don't pay" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Pay anyway \(wait \d+ s\)/ })).toBeDisabled();
    await page.getByRole("button", { name: "Don't pay" }).click();
    await expect(page.getByRole("button", { name: "Receive" })).toBeVisible();

    // Self-custody: the user can still pay, after the wait and a second tap.
    await openPauseScreen();
    const payAnyway = page.getByRole("button", { name: "Pay anyway", exact: true });
    await expect(payAnyway).toBeEnabled({ timeout: 15_000 });
    await payAnyway.click();
    await page.getByRole("button", { name: "Tap again to pay anyway" }).click();
    await expect(page.getByText("✓ Sent")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("8,500 sats")).toBeVisible({ timeout: 30_000 });
  } finally {
    maker.close();
  }
});
