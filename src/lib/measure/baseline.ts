import { MIN_SHORT_SIDE, type Concern, type Measurement, type Mode } from "../schemas";
import type { MeasureConfig } from "./config";

/*
  Day 0 baseline (FR-014, FR-020). Two consecutive photos: their mean is the starting point,
  their difference is how much a reading moves on its own. Only raw scores are used (FR-019).
*/

export type Baseline = { concern: Concern; a: number; b: number; mean: number; noise: number; threshold: number };

export function baselineFor(concern: Concern, a: number, b: number, cfg: MeasureConfig): Baseline {
  const noise = Math.abs(a - b);
  return {
    concern,
    a,
    b,
    mean: (a + b) / 2,
    noise,
    threshold: Math.max(cfg.k * noise, cfg.floor[concern]),
  };
}

/** One baseline per concern present, as a finite raw score, in both day 0 sessions. */
export function buildBaselines(
  day0a: Measurement[],
  day0b: Measurement[],
  cfg: MeasureConfig,
): Partial<Record<Concern, Baseline>> {
  const out: Partial<Record<Concern, Baseline>> = {};
  for (const ma of day0a) {
    const mb = day0b.find((x) => x.concern === ma.concern);
    if (!mb || !Number.isFinite(ma.raw) || !Number.isFinite(mb.raw)) continue;
    out[ma.concern] = baselineFor(ma.concern, ma.raw, mb.raw, cfg);
  }
  return out;
}

type Size = { width: number; height: number };
const shortSide = (s: Size) => Math.min(s.width, s.height);

/** FR-015: HD only when both day 0 images meet the HD minimum. */
export const modeForDay0 = (a: Size, b: Size): Mode =>
  shortSide(a) >= MIN_SHORT_SIDE.hd && shortSide(b) >= MIN_SHORT_SIDE.hd ? "hd" : "sd";

export const imageFitsMode = (s: Size, mode: Mode) => shortSide(s) >= MIN_SHORT_SIDE[mode];

/**
  Mode decision for a new capture (FR-015, T047): photo A locks the trial's mode from its size;
  every later photo must meet that mode's minimum or it is refused before any upload.
*/
export function captureMode(
  locked: Mode | null,
  kind: "day0_a" | "day0_b" | "checkin",
  size: Size,
): { ok: true; mode: Mode } | { ok: false; code: "error_mode_mismatch" | "error_below_min_image_size" } {
  if (kind === "day0_a" || locked === null) {
    if (imageFitsMode(size, "hd")) return { ok: true, mode: "hd" };
    if (imageFitsMode(size, "sd")) return { ok: true, mode: "sd" };
    return { ok: false, code: "error_below_min_image_size" };
  }
  return imageFitsMode(size, locked) ? { ok: true, mode: locked } : { ok: false, code: "error_mode_mismatch" };
}
