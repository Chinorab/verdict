import type { Measurement, Session } from "../schemas";
import type { Baseline } from "./baseline";
import type { MeasureConfig } from "./config";

/*
  Health guardrail (FR-027, constitution V). Redness and acne are measured at every analysis.
  Level 1: the latest check-in moved toward MORE redness or acne beyond the day 0 threshold.
  Level 2: the check-in before it did too (two in a row). A check-in back inside the threshold
  clears it. Never a diagnosis: only readings and thresholds.
*/

export const GUARDED = ["redness", "acne"] as const;
export type Guarded = (typeof GUARDED)[number];

export type GuardReading = { day: number; takenAt: string; raw: number; worse: boolean };

export type Guard = {
  level: 0 | 1 | 2;
  concern?: Guarded;
  baseline?: Baseline;
  /** Check-in readings for the concern, oldest first. */
  readings: GuardReading[];
};

export function guardrail(
  checkins: Session[], // done check-ins, oldest first
  measurementsBySession: Map<string, Measurement[]>,
  baselines: Partial<Record<Guarded, Baseline>>,
  cfg: MeasureConfig,
): Guard {
  let best: Guard = { level: 0, readings: [] };
  for (const concern of GUARDED) {
    const base = baselines[concern];
    if (!base) continue;
    const sign = cfg.rawHigherMeansMore[concern] ? 1 : -1; // positive = more of the concern
    const readings: GuardReading[] = [];
    for (const s of checkins) {
      const m = (measurementsBySession.get(s.id) ?? []).find((x) => x.concern === concern);
      if (!m || !Number.isFinite(m.raw)) continue;
      readings.push({ day: s.scheduledDay, takenAt: s.takenAt, raw: m.raw, worse: (m.raw - base.mean) * sign > base.threshold });
    }
    const last = readings.at(-1);
    const prev = readings.at(-2);
    const level: 0 | 1 | 2 = last?.worse ? (prev?.worse ? 2 : 1) : 0;
    if (level > best.level) best = { level, concern, baseline: base, readings };
  }
  return best;
}
