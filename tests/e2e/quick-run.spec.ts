import { expect, test } from "@playwright/test";
import { mockBudget } from "./mocks";

/*
  US10 journey (quickstart 5): a judge starts a same day test without an account.
  The photo steps join this journey once the capture screen exists (tasks T044, T046).
*/

async function typeTrial(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Type them" }).click();
  await page.getByLabel("Product name").fill("Judge Cream");
  await page.getByLabel("Claim, as printed").fill("Reduces redness in 2 weeks");
  await page.getByLabel(/Promised in how many weeks/).fill("2");
  await page.getByRole("button", { name: "Redness" }).click();
  await page.getByRole("button", { name: "Save claim" }).click();
  await page.getByLabel("Price paid, $").fill("24");
}

test("a same day test is labelled as such and saved with day 0 and an immediate check-in", async ({ page }) => {
  await mockBudget(page, { deviceRemaining: 5, globalOpen: true });
  await page.clock.setFixedTime(new Date("2026-11-05T15:00:00"));
  await page.goto("/trial/new?quick=1");
  await expect(page.getByText("Same day test").first()).toBeVisible();
  await expect(page.getByText(/expect no measurable change/)).toBeVisible();
  await typeTrial(page);
  await expect(page.getByText(/Your verdict is scheduled for/)).toHaveCount(0);
  await page.getByRole("button", { name: "Start day 0 photos" }).click();
  await page.waitForURL(/\/trial\/[0-9a-f-]+\/capture$/);

  const trial = await page.evaluate(
    () =>
      new Promise<Record<string, unknown>>((resolve) => {
        const q = indexedDB.open("verdict");
        q.onsuccess = () => {
          const all = q.result.transaction("trials").objectStore("trials").getAll();
          all.onsuccess = () => {
            resolve(all.result[0]);
            q.result.close();
          };
        };
      }),
  );
  expect(trial.kind).toBe("quick");
  expect(trial.schedule).toEqual([
    { day: 0, date: "2026-11-05", kind: "day0" },
    { day: 0, date: "2026-11-05", kind: "verdict" },
  ]);

  await page.goto(`/trial/${trial.id}`);
  await expect(page.getByText("Same day test")).toBeVisible();
});

test("not enough analyses left today: the judge is told before starting", async ({ page }) => {
  await mockBudget(page, { deviceRemaining: 1, globalOpen: true, resumesAt: "2026-11-06T00:00:00Z" } as never);
  await page.goto("/trial/new?quick=1");
  await expect(page.getByText("You have used today's analyses on this device.")).toBeVisible();
  await typeTrial(page);
  await expect(page.getByRole("button", { name: "Start day 0 photos" })).toBeDisabled();
});

test("analyses paused for everyone: a clear message and a pointer to the demo", async ({ page }) => {
  await mockBudget(page, { deviceRemaining: 5, globalOpen: false, resumesAt: "2026-11-06T00:00:00Z" } as never);
  await page.goto("/trial/new?quick=1");
  await expect(page.getByText(/open the demo trial meanwhile/)).toBeVisible();
});
