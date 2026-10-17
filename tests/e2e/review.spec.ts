import { expect, test } from "@playwright/test";
import { MEASURE_CONFIG } from "../../src/lib/measure/config";
import { encodeReview, type ReviewData } from "../../src/lib/review-card";
import { seedTrial, verdictSeed } from "./seed";

/* US6 journey (quickstart 10). */

const card: ReviewData = {
  v: 1,
  product: "Test Serum, 30 ml",
  date: "2026-11-07",
  days: 26,
  sessions: 5,
  price: 38,
  quick: false,
  rows: [
    { claim: "Fades dark spots in 4 weeks", concern: "Dark spots", status: "no_change", delta: -1, threshold: 6 },
    { claim: "Smoother skin texture", concern: "Texture", status: "getting_worse", delta: 5, threshold: 3 },
  ],
  notMeasured: 1,
};

test("a shared link shows the card from the link alone, numbers next to thresholds, no photo", async ({ page }) => {
  await page.goto(`/review#${encodeReview(card)}`);
  const article = page.getByRole("article", { name: "My measured review" });
  await expect(article.getByRole("heading", { name: "Test Serum, 30 ml" })).toBeVisible();
  await expect(article.getByText("No measurable change")).toBeVisible();
  await expect(article.getByText(/\+5\.0 points, threshold ±3\.0/)).toBeVisible();
  await expect(article.getByText("0 of 2 measurable claims held up on my skin.")).toBeVisible();
  await expect(article.locator("img")).toHaveCount(0);
  await expect(page.getByText(/not medical advice/i).first()).toBeVisible();
});

test("a damaged link says so", async ({ page }) => {
  await page.goto("/review#garbage");
  await expect(page.getByText("This review link is incomplete or damaged.")).toBeVisible();
});

test.describe("from a finished trial", () => {
  test.skip(MEASURE_CONFIG === null, "Needs calibrated settings (tasks T003, T004).");

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.clock.setFixedTime(new Date("2026-11-07T21:00:00"));
    await page.goto("/");
    await seedTrial(page, verdictSeed({ age_spot: 42.1, radiance: 60.5, texture: 31, redness: 20.5, acne: 5 }));
    await page.goto("/trial/seed-trial/review");
  });

  test("no face photos by default, price toggle, link round trip", async ({ page }) => {
    const article = page.getByRole("article", { name: "My measured review" });
    await expect(article.locator("img")).toHaveCount(0);
    await expect(page.getByRole("switch", { name: /Add face photos/ })).not.toBeChecked();
    await expect(article.getByText("Paid $38.00")).toBeVisible();
    await page.getByRole("switch", { name: "Show price paid" }).uncheck();
    await expect(article.getByText("Paid $38.00")).toHaveCount(0);

    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByText(/Link copied/)).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/review#[A-Za-z0-9_-]+$/);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Test Serum, 30 ml" })).toBeVisible();
    await expect(page.getByText("Paid $38.00")).toHaveCount(0);
  });

  test("save image downloads a PNG", async ({ page }) => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save image" }).click();
    expect((await download).suggestedFilename()).toBe("verdict-measured-review.png");
  });
});
