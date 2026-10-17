import { describe, expect, it } from "vitest";
import { baselineFor } from "@/lib/measure/baseline";
import type { MeasureConfig } from "@/lib/measure/config";
import { judgeClaims, judgeTarget, suggest, towardSign } from "@/lib/measure/verdict";
import { CONCERNS, type Claim, type Concern, type Measurement } from "@/lib/schemas";

// Test settings only. Real values come from calibration.
const all = <T,>(v: T) => Object.fromEntries(CONCERNS.map((c) => [c, v])) as Record<Concern, T>;
const cfg: MeasureConfig = { k: 1.5, floor: all(1), rawHigherMeansMore: all(true), source: "unit test" };
const cfgInverted: MeasureConfig = { ...cfg, rawHigherMeansMore: all(false) };

const claim = (id: string, targets: Claim["targets"], main = false): Claim => ({
  id,
  trialId: "t",
  text: id,
  timeframeDays: 28,
  targets,
  measurable: targets.length > 0,
  unmeasurableReason: targets.length ? null : "A photo cannot measure this.",
  main,
  healthTerms: [],
  fastPromise: false,
  editedByUser: false,
});
const latest = (pairs: [Concern, number][]): Measurement[] =>
  pairs.map(([concern, raw]) => ({ sessionId: "s", concern, raw, ui: 50, maskIds: [] }));

describe("towardSign", () => {
  it("decrease of a concern whose raw rises with it: falling raw is toward", () => {
    expect(towardSign("decrease", true)).toBe(-1);
  });
  it("increase of a concern whose raw rises with it: rising raw is toward", () => {
    expect(towardSign("increase", true)).toBe(1);
  });
  it("flips when the raw score runs the other way", () => {
    expect(towardSign("decrease", false)).toBe(1);
    expect(towardSign("increase", false)).toBe(-1);
  });
});

describe("judgeTarget", () => {
  const b = baselineFor("age_spot", 40, 44, cfg); // mean 42, noise 4, threshold 6

  it("inside the threshold is no measurable change, in both directions", () => {
    expect(judgeTarget("age_spot", "decrease", b, 37, cfg).status).toBe("no_change"); // -5
    expect(judgeTarget("age_spot", "decrease", b, 47, cfg).status).toBe("no_change"); // +5
  });

  it("exactly at the threshold still counts as no change", () => {
    expect(judgeTarget("age_spot", "decrease", b, 36, cfg).status).toBe("no_change"); // -6
  });

  it("beyond the threshold toward the claim is holding up", () => {
    const r = judgeTarget("age_spot", "decrease", b, 35, cfg); // -7
    expect(r.status).toBe("holding_up");
    expect(r.delta).toBe(-7);
    expect(r.toward).toBe(7);
    expect(r.ratio).toBeCloseTo(7 / 6);
  });

  it("beyond the threshold away from the claim is getting worse", () => {
    expect(judgeTarget("age_spot", "decrease", b, 49, cfg).status).toBe("getting_worse");
  });

  it("uses the configured raw direction", () => {
    expect(judgeTarget("age_spot", "decrease", b, 49, cfgInverted).status).toBe("holding_up");
  });

  it("is missing when the latest reading or the baseline is absent", () => {
    expect(judgeTarget("age_spot", "decrease", undefined, 30, cfg).status).toBe("missing");
    expect(judgeTarget("age_spot", "decrease", b, undefined, cfg).status).toBe("missing");
  });
});

describe("judgeClaims and suggest", () => {
  const baselines = {
    age_spot: baselineFor("age_spot", 40, 44, cfg),
    radiance: baselineFor("radiance", 60, 61, cfg), // threshold 1.5
    texture: baselineFor("texture", 30, 32, cfg), // threshold 3
  };
  const claims = [
    claim("spots", [{ concern: "age_spot", direction: "decrease" }], true),
    claim("glow", [{ concern: "radiance", direction: "increase" }]),
    claim("smooth", [{ concern: "texture", direction: "decrease" }]),
    claim("hydration 72h", []),
  ];

  it("mockup case: main claim flat, glow up, texture worse: Return", () => {
    const r = judgeClaims(claims, baselines, latest([["age_spot", 41], ["radiance", 64], ["texture", 36]]), cfg);
    expect(r.map((x) => x.status)).toEqual(["no_change", "holding_up", "getting_worse", "not_measured"]);
    expect(suggest(r, { deadline: "2026-11-11" }, "2026-11-07")).toBe("return");
  });

  it("Keep only when the main claim holds and nothing got worse", () => {
    const r = judgeClaims(claims, baselines, latest([["age_spot", 34], ["radiance", 61], ["texture", 31]]), cfg);
    expect(suggest(r, { deadline: "2026-11-11" }, "2026-11-07")).toBe("keep");
  });

  it("Return when the main claim holds but another claim got worse", () => {
    const r = judgeClaims(claims, baselines, latest([["age_spot", 34], ["radiance", 61], ["texture", 40]]), cfg);
    expect(suggest(r, { deadline: "2026-11-11" }, "2026-11-07")).toBe("return");
  });

  it("no suggestion after the deadline", () => {
    const r = judgeClaims(claims, baselines, latest([["age_spot", 34]]), cfg);
    expect(suggest(r, { deadline: "2026-11-11" }, "2026-11-12")).toBe("none");
  });

  it("a claim with two concerns reports each and takes the worst status", () => {
    const two = [claim("both", [{ concern: "age_spot", direction: "decrease" }, { concern: "radiance", direction: "increase" }], true)];
    const r = judgeClaims(two, baselines, latest([["age_spot", 34], ["radiance", 58]]), cfg);
    expect(r[0].targets.map((t) => t.status)).toEqual(["holding_up", "getting_worse"]);
    expect(r[0].status).toBe("getting_worse");
    expect(suggest(r, { deadline: "2026-11-11" }, "2026-11-07")).toBe("return");
  });
});

describe("SC-004: no change inside the threshold is ever reported as a change", () => {
  // Deterministic pseudo random generator so failures are reproducible.
  let seed = 20261017;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

  it("holds over 5,000 random trials", () => {
    for (let i = 0; i < 5000; i++) {
      const concern = CONCERNS[Math.floor(rand() * CONCERNS.length)];
      const a = 1 + rand() * 99;
      const b = 1 + rand() * 99;
      const c: MeasureConfig = { ...cfg, k: 0.5 + rand() * 2.5, rawHigherMeansMore: all(rand() > 0.5), floor: all(rand() * 5) };
      const base = baselineFor(concern, a, b, c);
      const dir = rand() > 0.5 ? "increase" : "decrease";
      const latestRaw = 1 + rand() * 99;
      const r = judgeTarget(concern, dir, base, latestRaw, c);
      const inside = Math.abs(latestRaw - base.mean) <= base.threshold;
      if (inside) expect(r.status).toBe("no_change");
      else expect(r.status).not.toBe("no_change");
      expect(Math.abs(r.toward)).toBeCloseTo(Math.abs(latestRaw - base.mean));
    }
  });
});
