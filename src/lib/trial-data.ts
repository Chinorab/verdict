"use client";

import { byTrial, get, measurementsFor } from "./db";
import { buildBaselines, type Baseline } from "./measure/baseline";
import { measureConfig, NotCalibratedError, type MeasureConfig } from "./measure/config";
import { guardrail, type Guard } from "./measure/guardrail";
import { judgeClaims, suggest, type ClaimResult, type Suggestion } from "./measure/verdict";
import type { Claim, Concern, Measurement, Session, Trial } from "./schemas";

/* Loads everything a trial screen needs from the device, and derives the verdict. */

export type TrialBundle = {
  trial: Trial;
  claims: Claim[];
  sessions: Session[]; // oldest first
  measurements: Map<string, Measurement[]>; // by session id
};

export async function loadTrial(id: string): Promise<TrialBundle | null> {
  const trial = await get("trials", id);
  if (!trial) return null;
  const [claims, sessions] = await Promise.all([byTrial("claims", id), byTrial("sessions", id)]);
  sessions.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const ms = await measurementsFor(sessions.map((s) => s.id));
  const measurements = new Map<string, Measurement[]>();
  for (const m of ms) measurements.set(m.sessionId, [...(measurements.get(m.sessionId) ?? []), m]);
  // Label order, measurable claims first (unmeasurable ones close the list, as in the mockup).
  claims.sort((a, b) => Number(b.measurable) - Number(a.measurable) || (a.position ?? 0) - (b.position ?? 0));
  return { trial, claims, sessions, measurements };
}

export type VerdictState =
  | { kind: "not_calibrated" }
  | { kind: "no_baseline" }
  | { kind: "no_checkin"; baselines: Partial<Record<Concern, Baseline>> }
  | {
      kind: "ready";
      cfg: MeasureConfig;
      baselines: Partial<Record<Concern, Baseline>>;
      results: ClaimResult[];
      suggestion: Suggestion;
      day0: Session;
      latest: Session;
      sessionsDone: number;
    };

export function deriveVerdict(b: TrialBundle, today: string): VerdictState {
  let cfg: MeasureConfig;
  try {
    cfg = measureConfig();
  } catch (e) {
    if (e instanceof NotCalibratedError) return { kind: "not_calibrated" };
    throw e;
  }
  const done = b.sessions.filter((s) => s.state === "done");
  const a = done.find((s) => s.kind === "day0_a");
  const bb = done.find((s) => s.kind === "day0_b");
  if (!a || !bb) return { kind: "no_baseline" };
  const baselines = buildBaselines(b.measurements.get(a.id) ?? [], b.measurements.get(bb.id) ?? [], cfg);
  const checkins = done.filter((s) => s.kind === "checkin");
  const latest = checkins.at(-1);
  if (!latest) return { kind: "no_checkin", baselines };
  const results = judgeClaims(b.claims, baselines, b.measurements.get(latest.id) ?? [], cfg);
  return {
    kind: "ready",
    cfg,
    baselines,
    results,
    suggestion: suggest(results, b.trial, today),
    day0: a,
    latest,
    sessionsDone: 1 + checkins.length, // day 0 counts as one session
  };
}

/** Health guardrail for a trial (FR-027). Null when it cannot be judged yet. */
export function deriveGuard(b: TrialBundle): Guard | null {
  let cfg: MeasureConfig;
  try {
    cfg = measureConfig();
  } catch {
    return null;
  }
  const done = b.sessions.filter((s) => s.state === "done");
  const a = done.find((s) => s.kind === "day0_a");
  const bb = done.find((s) => s.kind === "day0_b");
  if (!a || !bb) return null;
  const baselines = buildBaselines(b.measurements.get(a.id) ?? [], b.measurements.get(bb.id) ?? [], cfg);
  return guardrail(done.filter((s) => s.kind === "checkin"), b.measurements, baselines, cfg);
}
