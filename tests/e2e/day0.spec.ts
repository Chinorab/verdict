import { expect, test, type Page } from "@playwright/test";
import { mockAnalysis, mockBudget } from "./mocks";
import { seedTrial, verdictSeed, type Seed } from "./seed";
import { kit, mockCameraKit } from "./ymk-double";

/*
  Day 0 and check-in capture (T048, quickstart 3, 4, 14). The Camera Kit is a test double and
  every analysis is answered from the recorded task response. The small face error and retake
  case waits for a recorded error fixture (T028).
*/

const GOOD = { hasFace: true, position: "good", frontal: "good", lighting: "good" };

function day0Seed(): Seed {
  const seed = verdictSeed({});
  seed.trial = { ...seed.trial, status: "setup", mode: null };
  seed.sessions = [];
  seed.measurements = [];
  return seed;
}

function checkinSeed(): Seed {
  const seed = verdictSeed({});
  seed.sessions = seed.sessions.filter((s) => s.kind !== "checkin");
  seed.measurements = seed.measurements.filter((m) => m.sessionId !== "s-c");
  seed.trial.schedule = [
    { day: 0, date: "2026-10-12", kind: "day0" },
    { day: 14, date: "2026-10-26", kind: "checkin" },
    { day: 26, date: "2026-11-07", kind: "verdict" },
  ];
  return seed;
}

async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("verdict", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const all = (store: string) =>
      new Promise<unknown[]>((resolve) => {
        const r = db.transaction(store).objectStore(store).getAll();
        r.onsuccess = () => resolve(r.result);
      });
    const [trials, sessions, photos] = await Promise.all([all("trials"), all("sessions"), all("photos")]);
    db.close();
    return {
      trial: trials[0] as { status: string; mode: string | null },
      sessions: sessions as { kind: string; state: string; scheduledDay: number; width: number }[],
      photos: (photos as { kind: string }[]).map((p) => p.kind),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-26T12:00:00"));
  await mockCameraKit(page);
  await mockAnalysis(page);
  await page.goto("/");
});

test("day 0 takes two photos, measures both and sets the baseline", async ({ page }) => {
  await mockBudget(page);
  await seedTrial(page, day0Seed());
  await page.goto("/trial/seed-trial/capture");

  await expect(page.getByText("Day 0, photo 1 of 2")).toBeVisible();
  await expect(page.getByText("Two photos today show how much a reading moves on its own.")).toBeVisible();
  const shutter = page.getByRole("button", { name: "Take photo" });
  await expect(shutter).toBeDisabled();

  // Strict quality waits for good light; with light "ok" the manual capture is offered (research R2).
  await kit.quality(page, { ...GOOD, lighting: "ok" });
  await expect(page.getByText("Add a little light")).toBeVisible();
  await expect(page.getByText("Centered")).toBeVisible();
  await expect(shutter).toBeEnabled();
  await shutter.click();

  await expect(page.getByText("Day 0, photo 2 of 2")).toBeVisible();
  await expect(page.getByText("Photo 1 is measured. Take the second one now, without moving.")).toBeVisible();
  await expect(page.getByText("1/2 taken")).toBeVisible();

  // Photo B arrives through the kit's own automatic capture.
  await kit.quality(page, GOOD);
  await kit.autoCapture(page);
  await expect(page.getByText("Baseline set")).toBeVisible();

  const db = await stored(page);
  expect(db.trial.status).toBe("active");
  expect(db.trial.mode).toBe("hd");
  expect(db.sessions.map((s) => [s.kind, s.state]).sort()).toEqual([
    ["day0_a", "done"],
    ["day0_b", "done"],
  ]);
  expect(db.photos.filter((k) => k === "face")).toHaveLength(2);

  const init = (await kit.calls(page)).find((c) => (c as unknown[])[0] === "init") as [string, Record<string, unknown>];
  expect(init[1]).toMatchObject({ faceDetectionMode: "skincare", qualityLevel: "strict", videoQuality: "1080p", imageFormat: "blob" });

  await page.getByRole("link", { name: "See your schedule" }).click();
  await expect(page.getByText("Noise floor set")).toBeVisible();
});

test("a check-in takes one photo for the day it was opened for", async ({ page }) => {
  await mockBudget(page);
  await seedTrial(page, checkinSeed());
  await page.goto("/trial/seed-trial/capture?day=14");

  await expect(page.getByText("Check-in, day 14")).toBeVisible();
  await expect(page.getByText(/^Near 8/)).toBeVisible();
  await kit.quality(page, GOOD);
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByText("Photo measured")).toBeVisible();

  const db = await stored(page);
  const checkin = db.sessions.find((s) => s.kind === "checkin");
  expect(checkin).toMatchObject({ state: "done", scheduledDay: 14 });
});

test("no camera opens when today's analyses are used up", async ({ page }) => {
  await mockBudget(page, { deviceRemaining: 0, globalOpen: true });
  await seedTrial(page, day0Seed());
  await page.goto("/trial/seed-trial/capture");
  await expect(page.getByText("You have used today's analyses on this device.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Take photo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to the trial" })).toBeVisible();
});

test("a refused camera offers the photo upload", async ({ page }) => {
  await mockBudget(page);
  await seedTrial(page, day0Seed());
  await page.goto("/trial/seed-trial/capture");
  await expect(page.getByText("Day 0, photo 1 of 2")).toBeVisible();
  await expect.poll(() => kit.calls(page).then((c) => c.length).catch(() => 0)).toBeGreaterThan(0);
  await kit.fail(page, "error_permission_denied");
  await expect(page.getByText("Verdict cannot use the camera.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload a photo instead" })).toBeVisible();
});

test("without analyses the photo is kept and its size and detail are shown", async ({ page }) => {
  await mockBudget(page);
  await page.route("**/api/analysis/upload", (r) =>
    r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable" } }) }),
  );
  await seedTrial(page, day0Seed());
  await page.goto("/trial/seed-trial/capture");
  await expect.poll(() => kit.calls(page).then((c) => c.length).catch(() => 0)).toBeGreaterThan(0);
  await kit.quality(page, GOOD);
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByText("Analyses are not available right now.")).toBeVisible();
  // The photo is kept, so the same photo is sent again rather than retaken.
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Take the photo again" })).toHaveCount(0);
  await expect(page.getByText("Photo 1080 x 1350, HD detail")).toBeVisible();
  const db = await stored(page);
  expect(db.trial.mode).toBe("hd");
  expect(db.photos).toContain("face");
});
