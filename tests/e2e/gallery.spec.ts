import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mockBudget } from "./mocks";
import { seedTrial } from "./seed";
import { kit, mockCameraKit } from "./ymk-double";

/*
  Devpost gallery screenshots (T090). Runs only with GALLERY_DIR set, on the phone viewport,
  against a deployment of the live build. Every number comes from the author's real SVR trial
  (public/demo/demo-trial.verdict.json); no face photo appears on any screen.
  The verdict and review card shots need a measured check-in, so they are taken after Oct 31.
*/

const OUT = process.env.GALLERY_DIR;
const demo = JSON.parse(readFileSync(join(__dirname, "..", "..", "public", "demo", "demo-trial.verdict.json"), "utf8"));

// Contest rule for the video, applied to the gallery too: no third party trademark on screen.
const BRAND = demo.trial.product.name as string;

test.beforeEach(async ({ page }, info) => {
  test.skip(!OUT || info.project.name !== "mobile", "Gallery shots only, phone viewport");
  mkdirSync(OUT!, { recursive: true });
  await page.addInitScript((brand: string) => {
    const swap = () => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue?.includes(brand)) n.nodeValue = n.nodeValue.split(brand).join("Soothing cream");
    };
    new MutationObserver(() => document.body && swap()).observe(document, { childList: true, subtree: true, characterData: true });
  }, BRAND);
});

// Entrance animations are skipped so every shot shows the settled screen.
test.use({ reducedMotion: "reduce" });

const shot = (page: Page, name: string) => page.screenshot({ path: join(OUT!, `${name}.png`) });

test("1 landing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Same day test, 10 minutes" })).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, "1-landing");
});

test("2 claims read from the real SVR label", async ({ page }) => {
  // Replays the reading Claude returned on the author's phone for this label (the two claims it
  // read, kept in the demo trial with their reasons), so no paid call is made for a screenshot.
  const read = demo.claims
    .filter((c: { editedByUser: boolean }) => !c.editedByUser)
    .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
    .map(({ text, timeframeDays, targets, measurable, unmeasurableReason, healthTerms, fastPromise }: Record<string, unknown>) => ({
      text, timeframeDays, targets, measurable, unmeasurableReason, healthTerms, fastPromise,
    }));
  await page.route("**/api/claims", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ product: { name: demo.trial.product.name, size: null }, claims: read }) }),
  );
  await page.goto("/trial/new");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload" }).click();
  // A plain grey image stands in for the label photo; the screen after reading does not show it.
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#d3d7d2";
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  });
  const grey = Buffer.from(dataUrl.split(",")[1], "base64");
  await (await chooser).setFiles({ name: "label.png", mimeType: "image/png", buffer: grey });
  await expect(page.getByRole("heading", { name: "What it promises, and how we check" })).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "2-claims");
});

test("3 guided capture, before the photo", async ({ page }) => {
  await mockCameraKit(page);
  await mockBudget(page);
  await page.goto("/");
  // The real SVR trial as it stood before day 0.
  await seedTrial(page, {
    trial: { ...demo.trial, id: "gallery", kind: "real", status: "setup", mode: null },
    claims: demo.claims.map((c: object) => ({ ...c, trialId: "gallery" })),
    sessions: [],
    measurements: [],
  });
  await page.goto("/trial/gallery/capture");
  await expect(page.getByText("Day 0, photo 1 of 2")).toBeVisible();
  await expect.poll(() => kit.calls(page).then((c) => c.length).catch(() => 0)).toBeGreaterThan(0);
  await kit.quality(page, { hasFace: true, position: "good", frontal: "good", lighting: "ok" });
  await page.waitForTimeout(400);
  await shot(page, "3-capture");
});

test("4 the author's real trial", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForURL(/\/trial\/demo/);
  await expect(page.getByText(/Real trial by the author/).first()).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "4-demo-timeline");
});

test("5 privacy", async ({ page }) => {
  await page.goto("/privacy");
  await page.waitForTimeout(400);
  await shot(page, "5-privacy");
});
