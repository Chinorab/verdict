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

// A published demo is a backup file without photos (scripts/publish-demo.mjs). Seeded test inputs.
function demoFile(withCheckin: boolean) {
  const seed = verdictSeed({ age_spot: 41 });
  if (!withCheckin) {
    seed.sessions = seed.sessions.filter((s) => s.kind !== "checkin");
    seed.measurements = seed.measurements.filter((m) => m.sessionId !== "s-c");
  }
  return JSON.stringify({
    format: "verdict-backup",
    version: 1,
    exportedAt: "2026-10-12T21:00:00.000Z",
    includesPhotos: false,
    trial: { ...seed.trial, kind: "demo" },
    claims: seed.claims,
    sessions: seed.sessions,
    measurements: seed.measurements,
  });
}

test("a demo still running opens on its timeline, drawn at its last measured photo", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-03T12:00:00"));
  await page.route("**/demo/demo-trial.verdict.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: demoFile(false) }));
  await page.goto("/demo");
  await page.waitForURL(/\/trial\/demo$/);
  await expect(page.getByText(/Real trial by the author, running since Oct 12, 2026, last measured Oct 12/)).toBeVisible();
  await expect(page.getByText("Noise floor set")).toBeVisible();
  // Nov 3 is after the published data: nothing reads as missed, and no photo can be taken.
  await expect(page.getByText(/missed/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Take/ })).toHaveCount(0);
});

test("a demo with a check-in opens on its verdict", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00"));
  await page.route("**/demo/demo-trial.verdict.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: demoFile(true) }));
  await page.goto("/demo");
  await page.waitForURL(/\/trial\/demo\/verdict$/);
  await expect(page.getByText(/Real trial by the author/).first()).toBeVisible();
});
