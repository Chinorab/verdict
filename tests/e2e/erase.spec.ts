import { expect, test, type Page } from "@playwright/test";
import { seedTrial, verdictSeed } from "./seed";

/* US9 journey (quickstart 12, SC-008, FR-031 to FR-033). */

async function countRecords(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const q = indexedDB.open("verdict");
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const stores = ["trials", "claims", "sessions", "measurements", "photos"].filter((s) => db.objectStoreNames.contains(s));
    const counts: Record<string, number> = {};
    for (const s of stores) {
      counts[s] = await new Promise<number>((r) => {
        const q = db.transaction(s).objectStore(s).count();
        q.onsuccess = () => r(q.result);
      });
    }
    db.close();
    return counts;
  });
}

test("delete all trial data empties the device and returns to the first run screen", async ({ page }) => {
  await page.goto("/");
  await seedTrial(page, verdictSeed({ age_spot: 41 }));
  expect((await countRecords(page)).trials).toBe(1);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete all trial data" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete everything on this phone?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete everything" }).click();

  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText("Everything Verdict kept on this phone was deleted.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a trial" }).first()).toBeVisible();
  const counts = await countRecords(page);
  for (const [store, n] of Object.entries(counts)) expect(n, store).toBe(0);
  // The old trial is gone from every screen.
  await page.goto("/trial/seed-trial");
  await expect(page.getByText("This trial is not on this device.")).toBeVisible();
});

test("cancelling keeps the data", async ({ page }) => {
  await page.goto("/");
  await seedTrial(page, verdictSeed({ age_spot: 41 }));
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Delete all trial data" }).click();
  await page.getByRole("button", { name: "Keep my data" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect((await countRecords(page)).trials).toBe(1);
});

test("the privacy page describes the real data flows", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Your face photos are kept on this phone." })).toBeVisible();
  await expect(page.getByText(/goes straight from this phone to YouCam/)).toBeVisible();
  await expect(page.getByText(/30 days/)).toBeVisible();
  await expect(page.getByText(/24 hours/)).toBeVisible();
  await expect(page.getByText(/sent to Anthropic, which reads the printed claims\. Never a photo of your\s+face/)).toBeVisible();
  await expect(page.getByText(/There\s+is no account/)).toBeVisible();
  await expect(page.getByRole("link", { name: "YouCam file retention period" })).toHaveAttribute(
    "href",
    "https://docs.perfectcorp.com/develop/file_retention_period",
  );
  // The mockup's inaccurate sample copy must not come back.
  await expect(page.getByText(/never sent to our servers|Synced, only with an account|Links can be revoked/)).toHaveCount(0);
});

test("no page asks for an account or a login (FR-031)", async ({ page }) => {
  for (const path of ["/", "/privacy", "/settings", "/trial/new"]) {
    await page.goto(path);
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    await expect(page.getByText(/sign in|log in|sign up|create an account/i)).toHaveCount(0);
  }
});

test("a browser that blocks storage gets a clear warning", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
  });
  await page.goto("/");
  await expect(page.getByText("This browser is not keeping data for Verdict.")).toBeVisible();
});
