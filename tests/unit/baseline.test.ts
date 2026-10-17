import { describe, expect, it } from "vitest";
import { baselineFor, buildBaselines, captureMode, imageFitsMode, modeForDay0 } from "@/lib/measure/baseline";
import type { MeasureConfig } from "@/lib/measure/config";
import { CONCERNS, type Concern, type Measurement } from "@/lib/schemas";

// Test settings only. Real values come from calibration (src/lib/measure/config.ts).
const floor = Object.fromEntries(CONCERNS.map((c) => [c, 1])) as Record<Concern, number>;
const cfg: MeasureConfig = {
  k: 1.5,
  floor: { ...floor, redness: 2 },
  rawHigherMeansMore: Object.fromEntries(CONCERNS.map((c) => [c, true])) as Record<Concern, boolean>,
  source: "unit test",
};

const m = (sessionId: string, concern: Concern, raw: number): Measurement => ({
  sessionId,
  concern,
  raw,
  ui: 50,
  maskIds: [],
});

describe("baselineFor", () => {
  it("mean of the two day 0 readings and their absolute difference as noise", () => {
    const b = baselineFor("age_spot", 40, 44, cfg);
    expect(b.mean).toBe(42);
    expect(b.noise).toBe(4);
    expect(b.threshold).toBe(6); // 1.5 x 4
  });

  it("uses the floor when the day 0 pair is nearly identical", () => {
    expect(baselineFor("age_spot", 40, 40, cfg).threshold).toBe(1);
    expect(baselineFor("redness", 30, 30.5, cfg).threshold).toBe(2);
  });

  it("is symmetric in the order of the two photos", () => {
    const { mean, noise, threshold } = baselineFor("texture", 10, 30, cfg);
    expect(baselineFor("texture", 30, 10, cfg)).toMatchObject({ mean, noise, threshold });
  });
});

describe("buildBaselines", () => {
  it("builds one baseline per concern measured in both day 0 sessions", () => {
    const a = [m("a", "age_spot", 40), m("a", "redness", 20), m("a", "pore", 50)];
    const b = [m("b", "age_spot", 44), m("b", "redness", 21)];
    const out = buildBaselines(a, b, cfg);
    expect(Object.keys(out).sort()).toEqual(["age_spot", "redness"]);
    expect(out.redness).toMatchObject({ a: 20, b: 21, mean: 20.5, noise: 1, threshold: 2 });
  });

  it("ignores non finite readings", () => {
    const out = buildBaselines([m("a", "wrinkle", Number.NaN)], [m("b", "wrinkle", 3)], cfg);
    expect(out.wrinkle).toBeUndefined();
  });
});

describe("detail mode (FR-015)", () => {
  it("HD when both day 0 images have a short side of 1080 or more", () => {
    expect(modeForDay0({ width: 1920, height: 1080 }, { width: 1080, height: 1920 })).toBe("hd");
  });

  it("SD when either image is below 1080 on its short side", () => {
    expect(modeForDay0({ width: 1920, height: 1080 }, { width: 1280, height: 720 })).toBe("sd");
  });

  it("refuses an image below the locked mode's minimum", () => {
    expect(imageFitsMode({ width: 1280, height: 720 }, "hd")).toBe(false);
    expect(imageFitsMode({ width: 1280, height: 720 }, "sd")).toBe(true);
    expect(imageFitsMode({ width: 640, height: 400 }, "sd")).toBe(false);
  });
});


describe("captureMode (T047)", () => {
  it("photo A locks HD when it is large enough", () => {
    expect(captureMode(null, "day0_a", { width: 1080, height: 1920 })).toEqual({ ok: true, mode: "hd" });
  });

  it("photo A locks SD when it is smaller", () => {
    expect(captureMode(null, "day0_a", { width: 720, height: 1280 })).toEqual({ ok: true, mode: "sd" });
  });

  it("refuses a photo too small for any analysis", () => {
    expect(captureMode(null, "day0_a", { width: 400, height: 600 })).toEqual({ ok: false, code: "error_below_min_image_size" });
  });

  it("keeps the locked mode for later photos and refuses one below it", () => {
    expect(captureMode("hd", "day0_b", { width: 1080, height: 1920 })).toEqual({ ok: true, mode: "hd" });
    expect(captureMode("hd", "checkin", { width: 720, height: 1280 })).toEqual({ ok: false, code: "error_mode_mismatch" });
    expect(captureMode("sd", "checkin", { width: 1080, height: 1920 })).toEqual({ ok: true, mode: "sd" });
  });
});
