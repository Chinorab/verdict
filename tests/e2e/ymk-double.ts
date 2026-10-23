import type { Page } from "@playwright/test";
import { KIT_SRC } from "../../src/lib/camera-kit";

/*
  Test double of the YouCam Camera Kit (window.YMK), served in place of the real SDK.
  It exposes window.__ymk so a test can send quality events, an automatic capture or a failure.
  Captures are a grey 1080 x 1350 JPEG drawn on a canvas: a size, not a face.
*/
const DOUBLE = `(() => {
  const listeners = new Map();
  let next = 0;
  const emit = (event, payload) => {
    for (const l of [...listeners.values()]) if (l.event === event) l.cb(payload);
  };
  const image = () =>
    new Promise((resolve) => {
      const c = document.createElement("canvas");
      c.width = 1080;
      c.height = 1350;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#888";
      ctx.fillRect(0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b), "image/jpeg", 0.8);
    });
  const shoot = async () => emit("faceDetectionCaptured", { images: [{ image: await image(), width: 1080, height: 1350 }] });
  window.__ymk = { emit, shoot, calls: [] };
  window.YMK = {
    init: (args) => window.__ymk.calls.push(["init", args]),
    openCameraKit: () => {
      window.__ymk.calls.push(["open"]);
      setTimeout(() => emit("cameraOpened"), 20);
    },
    close: () => window.__ymk.calls.push(["close"]),
    capture: () => {
      window.__ymk.calls.push(["capture"]);
      void shoot();
      return true;
    },
    addEventListener: (event, cb) => {
      const id = ++next;
      listeners.set(id, { event, cb });
      return id;
    },
    removeEventListener: (id) => listeners.delete(id),
  };
  if (typeof window.YMKAsyncInit === "function") window.YMKAsyncInit();
})();`;

export async function mockCameraKit(page: Page) {
  await page.route(KIT_SRC, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: DOUBLE }));
}

type Quality = { hasFace?: boolean; position?: string; frontal?: string; lighting?: string };

export const kit = {
  quality: (page: Page, q: Quality) => page.evaluate((x) => (window as never as { __ymk: { emit: (e: string, p: unknown) => void } }).__ymk.emit("faceQualityChanged", x), q),
  autoCapture: (page: Page) => page.evaluate(() => (window as never as { __ymk: { shoot: () => Promise<void> } }).__ymk.shoot()),
  fail: (page: Page, payload: unknown) => page.evaluate((p) => (window as never as { __ymk: { emit: (e: string, p: unknown) => void } }).__ymk.emit("cameraFailed", p), payload),
  calls: (page: Page) => page.evaluate(() => (window as never as { __ymk: { calls: unknown[] } }).__ymk.calls),
};
