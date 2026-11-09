import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { FAUCET_NODE_PUBKEY, fiatToSats, Scenarios } from "../core/src/index.ts";
import { connectTestWallet, invoiceMaker, RATES, sha256, timezoneForHour } from "./support.ts";

// The data-driven test from docs/TESTING.md: every fixture scenario, pasted as a
// real sandbox invoice plus its message, must show exactly its expected rule
// warnings on the pause screen. (AI warnings are added in TIM-88.)

const scenarios = Scenarios.parse(
  JSON.parse(readFileSync(new URL("../core/fixtures/scenarios.json", import.meta.url), "utf8")),
);
const hours = [...new Set(scenarios.map((s) => s.context.localHour))];

for (const hour of hours) {
  test.describe(`at ${hour}:00 local time`, () => {
    test.use({ timezoneId: timezoneForHour(hour) });

    test(`every scenario shows its expected warnings (${hour}:00)`, async ({ page }) => {
      const group = scenarios.filter((s) => s.context.localHour === hour);
      test.setTimeout(60_000 + group.length * 20_000);
      const maker = await invoiceMaker();
      try {
        await connectTestWallet(page);
        for (const sc of group) {
          await test.step(sc.id, async () => {
            const history = sc.context.history.map((h, i) => ({
              payeeHash: h.payee === "this" ? sha256(FAUCET_NODE_PUBKEY) : sha256("someone else"),
              sats: fiatToSats(h.amount, RATES[h.currency]),
              at: Date.now() - (i + 1) * 86_400_000,
            }));
            await page.evaluate((h) => localStorage.setItem("sye.history", JSON.stringify(h)), history);

            const sats = fiatToSats(sc.invoice.amount, RATES[sc.invoice.currency]);
            const invoice = await maker.invoice(sats, sc.invoice.expiryMinutes * 60, sc.title.slice(0, 60));

            await page.getByRole("button", { name: "Send" }).click();
            await page.getByLabel("Payment request (invoice)").fill(invoice);
            await page.getByRole("button", { name: /Got a message with this request/ }).click();
            await page.getByLabel(/The message that came with it/).fill(sc.message);

            await expect
              .poll(async () =>
                (await page.locator("[data-warning-id]").evaluateAll((els) => els.map((e) => e.dataset.warningId))).sort(),
              )
              .toEqual([...sc.expected.rules].sort());
            if (sc.expected.rules.length === 0) await expect(page.getByTestId("no-warnings")).toBeVisible();
            // The guard's own verdict never calls a payment "safe" (the pasted
            // message and invoice description may say anything; they're untrusted).
            await expect(
              page.locator("[data-warning-id], [data-testid=no-warnings]").filter({ hasText: /\bsafe\b/i }),
            ).toHaveCount(0);

            await page.getByRole("button", { name: "Back" }).click();
          });
        }
      } finally {
        maker.close();
      }
    });
  });
}
