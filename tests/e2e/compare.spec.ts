import { expect, test } from "@playwright/test";
import { seedTrial, verdictSeed } from "./seed";

/* US5 journey (quickstart 9). Images are flat test colors drawn in the browser, never faces. */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  const seed = verdictSeed({ age_spot: 41, radiance: 64, texture: 36, redness: 20.5, acne: 5 });
  seed.sessions = seed.sessions.map((s) => ({ ...s, photoId: s.kind === "day0_b" ? null : `img-${s.id}` }));
  seed.measurements = seed.measurements.map((m) => (m.concern === "age_spot" && m.sessionId !== "s-b" ? { ...m, maskIds: [`mask-${m.sessionId}`] } : m));
  await seedTrial(page, seed);
  // Store test images: plain colored rectangles standing in for photos and masks.
  await page.evaluate(async () => {
    const png = async (color: string, alpha = 1) => {
      const c = new OffscreenCanvas(300, 400);
      const g = c.getContext("2d")!;
      g.globalAlpha = alpha;
      g.fillStyle = color;
      g.fillRect(0, 0, 300, 400);
      return c.convertToBlob({ type: "image/png" });
    };
    const items = [
      { id: "img-s-a", kind: "face", blob: await png("#c9a28a") },
      { id: "img-s-c", kind: "face", blob: await png("#b88b70") },
      { id: "mask-s-a", kind: "mask", blob: await png("#2b45c4", 0.4) },
      { id: "mask-s-c", kind: "mask", blob: await png("#2b45c4", 0.4) },
    ];
    const db = await new Promise<IDBDatabase>((res) => {
      const q = indexedDB.open("verdict");
      q.onsuccess = () => res(q.result);
    });
    const tx = db.transaction("photos", "readwrite");
    for (const it of items) tx.objectStore("photos").put({ ...it, trialId: "seed-trial", type: "image/png" });
    await new Promise((r) => (tx.oncomplete = r));
    db.close();
  });
  await page.goto("/trial/seed-trial/compare");
});

test("slider works by keyboard, labels carry real dates", async ({ page }) => {
  await expect(page.getByText("Day 0, Oct 12", { exact: true })).toBeVisible();
  await expect(page.getByText("Day 26, Nov 7", { exact: true })).toBeVisible();
  const slider = page.getByRole("slider", { name: /Slide between Day 0, Oct 12 and Day 26, Nov 7/ });
  await expect(slider).toHaveValue("50");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("52");
});

test("overlay toggle shows and hides the detection masks", async ({ page }) => {
  const frame = page.getByRole("img", { name: /on the left of the slider/ });
  await expect(frame.locator("img")).toHaveCount(4); // two photos, two masks
  await page.getByLabel("Detection overlay").uncheck();
  await expect(frame.locator("img")).toHaveCount(2);
});

test("numbers come from the stored raw scores", async ({ page }) => {
  // Dark spots: day 0 photos 40 and 44 (mean 42), check-in 41, change -1.0
  await expect(page.getByText("Day 0 photos: 40.0 and 44.0.")).toBeVisible();
  await expect(page.getByText("42.0", { exact: true })).toBeVisible();
  await expect(page.getByText("41.0", { exact: true })).toBeVisible();
  await expect(page.getByText("−1.0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Texture" }).click();
  await expect(page.getByText("Day 0 photos: 30.0 and 32.0.")).toBeVisible();
  await expect(page.getByText("+5.0", { exact: true })).toBeVisible();
});
