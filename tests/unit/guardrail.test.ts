import { describe, expect, it } from "vitest";
import { baselineFor } from "@/lib/measure/baseline";
import type { MeasureConfig } from "@/lib/measure/config";
import { guardrail } from "@/lib/measure/guardrail";
import { CONCERNS, type Concern, type Measurement, type Session } from "@/lib/schemas";

// Test settings only. Real values come from calibration.
const all = <T,>(v: T) => Object.fromEntries(CONCERNS.map((c) => [c, v])) as Record<Concern, T>;
const cfg: MeasureConfig = { k: 1.5, floor: all(1), rawHigherMeansMore: all(true), source: "unit test" };

const checkin = (id: string, day: number): Session => ({
  id,
  trialId: "t",
  kind: "checkin",
  scheduledDay: day,
  takenAt: `2026-10-${String(12 + day).padStart(2, "0")}T20:00:00Z`,
  photoId: null,
  width: 1080,
  height: 1920,
  quality: null,
  taskId: null,
  state: "done",
  error: null,
});
const m = (sessionId: string, concern: Concern, raw: number): Measurement => ({ sessionId, concern, raw, ui: 50, maskIds: [] });

// acne day 0: 3 and 3 (threshold = floor 1); redness day 0: 20 and 22 (threshold 3)
const baselines = { acne: baselineFor("acne", 3, 3, cfg), redness: baselineFor("redness", 20, 22, cfg) };
const run = (readings: [number, number][], config = cfg) => {
  const sessions = readings.map((_, i) => checkin(`c${i}`, 7 * (i + 1)));
  const map = new Map(sessions.map((s, i) => [s.id, [m(s.id, "acne", readings[i][0]), m(s.id, "redness", readings[i][1])]]));
  return guardrail(sessions, map, baselines, config);
};

describe("guardrail", () => {
  it("stays quiet inside the threshold", () => {
    expect(run([[3.5, 23]]).level).toBe(0);
  });

  it("level 1 at the first check-in beyond the threshold", () => {
    const g = run([[6, 21]]);
    expect(g).toMatchObject({ level: 1, concern: "acne" });
    expect(g.readings).toEqual([expect.objectContaining({ day: 7, raw: 6, worse: true })]);
  });

  it("level 2 when the next check-in confirms (the mockup case: 3 and 3, then 6, then 9)", () => {
    expect(run([[6, 21], [9, 21]])).toMatchObject({ level: 2, concern: "acne" });
  });

  it("clears when the latest check-in is back inside the threshold", () => {
    expect(run([[6, 21], [9, 21], [3.5, 21]]).level).toBe(0);
  });

  it("a single bad reading after a good one is level 1, not 2", () => {
    expect(run([[6, 21], [3, 21], [7, 21]]).level).toBe(1);
  });

  it("reports the more serious concern when both moved", () => {
    expect(run([[5, 30], [3, 30]])).toMatchObject({ level: 2, concern: "redness" });
  });

  it("an improvement is never a warning", () => {
    expect(run([[0, 10], [0, 10]]).level).toBe(0);
  });

  it("follows the calibrated raw direction", () => {
    const inverted = { ...cfg, rawHigherMeansMore: all(false) };
    expect(run([[0, 21]], inverted)).toMatchObject({ level: 1, concern: "acne" });
  });
});
