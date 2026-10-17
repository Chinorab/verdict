import { expect, test } from "@playwright/test";
import { seedTrial, verdictSeed } from "./seed";

/* Constitution VII: every screen works at 360 px wide, with no horizontal scroll. */

test.use({ viewport: { width: 360, height: 740 } });

const PAGES = [
  "/",
  "/privacy",
  "/settings",
  "/trial/new",
  "/trial/new?quick=1",
  "/demo",
  "/trial/seed-trial",
  "/trial/seed-trial/verdict",
  "/trial/seed-trial/compare",
  "/trial/seed-trial/review",
];

test("no horizontal scroll at 360 px", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/budget", (r) => r.fulfill({ json: { deviceRemaining: 5, globalOpen: true } }));
  await page.clock.setFixedTime(new Date("2026-11-07T21:00:00"));
  await page.goto("/");
  await seedTrial(page, verdictSeed({ age_spot: 41, radiance: 64, texture: 36, redness: 20.5, acne: 5 }));
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForTimeout(700); // client screens load from IndexedDB after hydration
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
