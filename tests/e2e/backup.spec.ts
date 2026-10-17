import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { seedTrial, verdictSeed } from "./seed";

/* FR-033b and US8: backup round trip on the device, and the demo entry. */

test("export a trial, erase nothing, import it as a second trial", async ({ page }, info) => {
  await page.clock.setFixedTime(new Date("2026-10-26T12:00:00"));
  await page.goto("/");
  await seedTrial(page, verdictSeed({ age_spot: 41 }));
  await page.goto("/settings");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("verdict-test-serum-2026-10-26.verdict.json");
  const text = readFileSync(await file.path(), "utf8");
  const json = JSON.parse(text);
  expect(json).toMatchObject({ format: "verdict-backup", version: 1, includesPhotos: false });
  expect(json.photos).toBeUndefined();

  mkdirSync(info.outputDir, { recursive: true });
  const copy = join(info.outputDir, "backup.verdict.json");
  writeFileSync(copy, text);
  await page.locator("input[type=file]").setInputFiles(copy);
  await page.waitForURL(/\/trial\/(?!seed-trial)[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Test Serum" }).or(page.getByText("Test Serum").first())).toBeVisible();

  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const q = indexedDB.open("verdict");
        q.onsuccess = () => {
          const c = q.result.transaction("trials").objectStore("trials").count();
          c.onsuccess = () => {
            resolve(c.result);
            q.result.close();
          };
        };
      }),
  );
  expect(count).toBe(2);
});

test("a file that is not a backup is refused with a clear message", async ({ page }, info) => {
  mkdirSync(info.outputDir, { recursive: true });
  const bad = join(info.outputDir, "bad.json");
  writeFileSync(bad, JSON.stringify({ hello: "world" }));
  await page.goto("/settings");
  await page.locator("input[type=file]").setInputFiles(bad);
  await expect(page.getByText("This file is not a Verdict backup.")).toBeVisible();
});

test("the demo entry says when the author's trial is not published yet", async ({ page }) => {
  await page.route("**/demo/demo-trial.verdict.json", (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto("/demo");
  await expect(page.getByText(/still running/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Try a same day test instead" })).toBeVisible();
});
