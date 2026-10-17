import { expect, test, type Page } from "@playwright/test";
import { MEASURE_CONFIG } from "../../src/lib/measure/config";
import { seedTrial, verdictSeed, type Seed } from "./seed";

/* US7 journey (quickstart 7): calm notice at the first rise, "Consider pausing" at the second. */

test.skip(MEASURE_CONFIG === null, "Needs calibrated settings (tasks T003, T004).");

// Day 0 acne is 5 and 5 in verdictSeed. `away` points of acne beyond day 0, following the
// calibrated direction (positive = more blemishes).
const acne = (away: number) => 5 + away * (MEASURE_CONFIG?.rawHigherMeansMore.acne ? 1 : -1);

function guardSeed(awayByCheckin: number[]): Seed {
  const seed = verdictSeed({});
  seed.sessions = seed.sessions.filter((s) => s.kind !== "checkin");
  seed.measurements = seed.measurements.filter((m) => m.sessionId !== "s-c");
  seed.trial.schedule = [
    { day: 0, date: "2026-10-12", kind: "day0" },
    { day: 7, date: "2026-10-19", kind: "checkin" },
    { day: 14, date: "2026-10-26", kind: "checkin" },
    { day: 26, date: "2026-11-07", kind: "verdict" },
  ];
  awayByCheckin.forEach((away, i) => {
    const day = 7 * (i + 1);
    const id = `chk-${day}`;
    seed.sessions.push({
      id,
      trialId: seed.trial.id,
      kind: "checkin",
      scheduledDay: day,
      takenAt: `2026-10-${12 + day}T20:30:00.000Z`,
      photoId: null,
      width: 1080,
      height: 1920,
      quality: null,
      taskId: null,
      state: "done",
      error: null,
    });
    seed.measurements.push({ sessionId: id, concern: "acne", raw: acne(away), ui: 50, maskIds: [] });
    seed.measurements.push({ sessionId: id, concern: "redness", raw: 20.5, ui: 50, maskIds: [] });
  });
  return seed;
}

async function open(page: Page, seed: Seed) {
  await page.clock.setFixedTime(new Date("2026-10-26T21:00:00"));
  await page.goto("/");
  await seedTrial(page, seed);
  await page.goto("/trial/seed-trial");
}

test("no notice while readings stay inside the threshold", async ({ page }) => {
  await open(page, guardSeed([0.1]));
  await expect(page.locator("section[role=alert]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /went up|Consider pausing/ })).toHaveCount(0);
});

test("first rise: a calm notice with the readings and the threshold", async ({ page }) => {
  await open(page, guardSeed([40]));
  const notice = page.locator("section[role=alert]");
  await expect(notice.getByRole("heading", { name: "Blemishes went up at your last check-in." })).toBeVisible();
  await expect(notice.getByText(/threshold ±/)).toBeVisible();
  await expect(notice.getByText(/beyond the threshold/)).toBeVisible();
  await expect(notice.getByText("This is not a diagnosis.", { exact: false })).toBeVisible();
  await expect(notice.getByRole("button", { name: "Pause the trial" })).toHaveCount(0);

  await notice.getByRole("button", { name: "Keep measuring" }).click();
  await expect(page.getByText("Blemishes went up beyond your threshold.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Blemishes went up beyond your threshold.")).toBeVisible();
});

test("second rise in a row: consider pausing, pause and resume keep the deadline", async ({ page }) => {
  await open(page, guardSeed([40, 45]));
  const notice = page.locator("section[role=alert]");
  await expect(notice.getByRole("heading", { name: "Consider pausing this product." })).toBeVisible();
  await expect(notice.getByText(/Return deadline stays Nov 11/)).toBeVisible();
  await expect(notice.getByRole("link", { name: "Find a dermatologist" })).toHaveAttribute("href", "https://find-a-derm.aad.org/");

  await notice.getByRole("button", { name: "Pause the trial" }).click();
  await expect(page.getByRole("button", { name: "Resume the trial" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Take today/ })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Resume the trial" }).click();
  await expect(page.getByRole("button", { name: "Pause the trial" })).toBeVisible();
});

test("the notice comes first on the verdict screen too", async ({ page }) => {
  await open(page, guardSeed([40, 45]));
  await page.goto("/trial/seed-trial/verdict");
  await expect(page.getByRole("heading", { name: "Consider pausing this product." })).toBeVisible();
});
