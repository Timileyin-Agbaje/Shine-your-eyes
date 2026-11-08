import { expect, test } from "@playwright/test";

test("the app loads on a 360px-wide phone", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ ok: true });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Shine Your Eye" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
