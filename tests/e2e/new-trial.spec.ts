import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mockClaims } from "./mocks";

/*
  US1 journey (quickstart 1, 2, 8). The typed path needs no paid call. The scanned path uses a
  recorded label reading and is skipped until that fixture exists (tasks T028).
*/

test.beforeEach(async ({ page }) => {
  // Day 0 is Oct 12, 2026, as in the Claims mockup.
  await page.clock.setFixedTime(new Date("2026-10-12T10:00:00"));
});

async function readTrial(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const q = indexedDB.open("verdict");
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const all = (s: string) =>
      new Promise<unknown[]>((r) => {
        const q = db.transaction(s).objectStore(s).getAll();
        q.onsuccess = () => r(q.result);
      });
    const [trials, claims] = await Promise.all([all("trials"), all("claims")]);
    db.close();
    return { trials, claims } as { trials: Record<string, unknown>[]; claims: Record<string, unknown>[] };
  });
}

test("typed claims, 30 day window: deadline Nov 11, verdict Nov 7, trial saved", async ({ page }) => {
  await page.goto("/trial/new");
  await expect(page.getByRole("heading", { name: "Photograph the claims" })).toBeVisible();
  await page.getByRole("button", { name: "Type them" }).click();

  await page.getByLabel("Product name").fill("Test Serum");
  await page.getByLabel("Claim, as printed").fill("Fades dark spots in 4 weeks");
  await page.getByLabel(/Promised in how many weeks/).fill("4");
  await page.getByRole("button", { name: "Dark spots" }).click();
  await page.getByRole("button", { name: "Save claim" }).click();

  // An unmeasurable claim stays listed but is left out.
  await page.getByRole("button", { name: "Add a claim" }).click();
  await page.getByLabel("Claim, as printed").fill("72 hour hydration");
  await page.getByRole("button", { name: "Save claim" }).click();
  await expect(page.getByText("Left out of the verdict.")).toBeVisible();

  await page.getByLabel("Price paid, $").fill("38");
  await page.getByLabel("Bought on", { exact: true }).fill("2026-10-12");
  await page.getByRole("button", { name: "30", exact: true }).click();

  await expect(page.getByText(/Return by\s*Nov 11\.\s*Your verdict is scheduled for\s*Nov 7, 4 days before\./)).toBeVisible();
  await expect(page.getByText(/longer time than your return window allows/)).toBeVisible();

  await page.getByRole("button", { name: "Start day 0 photos" }).click();
  await page.waitForURL(/\/trial\/[0-9a-f-]+\/capture$/);

  const { trials, claims } = await readTrial(page);
  expect(trials).toHaveLength(1);
  expect(trials[0]).toMatchObject({ deadline: "2026-11-11", verdictDate: "2026-11-07", trialDays: 26, status: "setup" });
  expect((trials[0].schedule as { day: number }[]).map((s) => s.day)).toEqual([0, 7, 14, 21, 26]);
  expect(claims).toHaveLength(2);
  expect(claims.find((c) => c.text === "Fades dark spots in 4 weeks")).toMatchObject({ main: true, measurable: true });
  expect(claims.find((c) => c.text === "72 hour hydration")).toMatchObject({ main: false, measurable: false });
});

test("online purchase with a fast dark spot promise shows the sourced study note", async ({ page }) => {
  await page.goto("/trial/new");
  await page.getByRole("button", { name: "Type them" }).click();
  await page.getByLabel("Product name").fill("Test Cream");
  await page.getByLabel("Claim, as printed").fill("Fades dark spots in 2 weeks");
  await page.getByLabel(/Promised in how many weeks/).fill("2");
  await page.getByRole("button", { name: "Dark spots" }).click();
  await page.getByRole("button", { name: "Save claim" }).click();

  await expect(page.getByText(/Researchers bought 18 skin products/)).toHaveCount(0);
  await page.getByLabel("Bought online").check();
  await expect(page.getByText(/Researchers bought 18 skin products/)).toBeVisible();
  await expect(page.getByRole("link", { name: /JAMA Network Open/ })).toHaveAttribute("href", /dermatologytimes\.com/);
});

test("the form refuses to start without a measurable claim and a price", async ({ page }) => {
  await page.goto("/trial/new");
  await page.getByRole("button", { name: "Type them" }).click();
  await page.getByLabel("Product name").fill("Test Toner");
  await page.getByLabel("Claim, as printed").fill("Feels refreshing");
  await page.getByRole("button", { name: "Save claim" }).click();
  await page.getByRole("button", { name: "Start day 0 photos" }).click();
  await expect(page.getByText("Add at least one claim a photo can measure.")).toBeVisible();
  await expect(page.getByText("Enter what you paid.")).toBeVisible();
  await expect(page).toHaveURL(/\/trial\/new$/);
});

const READING = join(__dirname, "..", "fixtures", "claims", "serum.json");

test("scanned label: claims from a recorded reading", async ({ page }) => {
  test.skip(!existsSync(READING), "Needs tests/fixtures/claims/serum.json recorded from a real label reading");
  await mockClaims(page);
  await page.goto("/trial/new");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload" }).click();
  await (await chooser).setFiles(join(__dirname, "..", "fixtures", "labels", "serum.jpg"));
  await expect(page.getByText(/claims? read, \d+ can be measured/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "What it promises, and how we check" })).toBeVisible();
});
