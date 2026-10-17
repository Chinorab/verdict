import { expect, test } from "@playwright/test";
import { MEASURE_CONFIG } from "../../src/lib/measure/config";
import { towardSign } from "../../src/lib/measure/verdict";
import { seedTrial, verdictSeed } from "./seed";

/*
  US4 journey (quickstart 6). Verdicts need the calibrated settings (src/lib/measure/config.ts).
  Until calibration has run, the screen must refuse to show results rather than guess.
*/

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-07T21:00:00"));
  await page.goto("/");
});

test("without calibrated settings, no result is shown", async ({ page }) => {
  test.skip(MEASURE_CONFIG !== null, "Calibration has run; the full cases below apply.");
  await seedTrial(page, verdictSeed({ age_spot: 41, radiance: 64, texture: 36, redness: 20, acne: 5 }));
  await page.goto("/trial/seed-trial/verdict");
  await expect(page.getByText(/measurement settings are still being calibrated/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Return" })).toHaveCount(0);
  await expect(page.getByText("Indicative results, not medical advice.")).toBeVisible();
});

test.describe("with calibrated settings", () => {
  test.skip(MEASURE_CONFIG === null, "Needs calibrated settings (tasks T003, T004).");

  // Day 0 means in verdictSeed: age_spot 42, radiance 60.5, texture 31, redness 20.5, acne 5.
  // A latest reading `amount` points toward (positive) or away from (negative) each claim,
  // following the calibrated raw score direction.
  const at = (concern: "age_spot" | "texture", mean: number, amount: number) =>
    mean + amount * towardSign("decrease", MEASURE_CONFIG!.rawHigherMeansMore[concern]);

  test("main claim inside the threshold and texture worse: Return, numbers shown", async ({ page }) => {
    // age_spot moves 0.1 point (inside any threshold); texture moves 25 points away from the claim.
    await seedTrial(page, verdictSeed({ age_spot: at("age_spot", 42, 0.1), radiance: 60.5, texture: at("texture", 31, -25), redness: 20.5, acne: 5 }));
    await page.goto("/trial/seed-trial/verdict");
    await expect(page.getByRole("heading", { name: "Return it." })).toBeVisible();
    await expect(page.getByText(/showed no change bigger than your measurement noise/)).toBeVisible();
    await expect(page.getByText("$38.00")).toBeVisible();
    await expect(page.getByText(/until Nov 11/)).toBeVisible();
    await expect(page.getByText(/points, threshold ±/).first()).toBeVisible();
    await expect(page.getByText("Not measured. A photo cannot check this one.")).toBeVisible();

    await page.getByRole("button", { name: "Keep" }).click();
    await expect(page.getByRole("button", { name: "Keep" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "Keep" })).toHaveAttribute("aria-pressed", "true");
  });

  test("main claim far beyond the threshold and nothing worse: Keep", async ({ page }) => {
    await seedTrial(page, verdictSeed({ age_spot: at("age_spot", 42, 25), radiance: 60.5, texture: 31, redness: 20.5, acne: 5 }));
    await page.goto("/trial/seed-trial/verdict");
    await expect(page.getByRole("heading", { name: "Keep it." })).toBeVisible();
    await expect(page.getByText(/held up beyond your measurement noise/)).toBeVisible();
  });
});
