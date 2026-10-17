"use client";

import { byTrial, get, put, putMany } from "./db";
import { captureMode } from "./measure/baseline";
import type { TrialPlan } from "./schedule";
import type { Claim, Session, Trial } from "./schemas";

/* Device side operations on trials: creation, captures (mode lock) and day 0 completion. */

export type NewTrialInput = {
  kind: Trial["kind"];
  product: { name: string; size?: string };
  purchase: Trial["purchase"];
  plan: TrialPlan;
  claims: Omit<Claim, "id" | "trialId">[];
  jamaNoteShown: boolean;
  now?: Date;
};

export async function createTrial(input: NewTrialInput): Promise<string> {
  const now = input.now ?? new Date();
  const id = crypto.randomUUID();
  const trial: Trial = {
    id,
    kind: input.kind,
    status: "setup",
    createdAt: now.toISOString(),
    product: { name: input.product.name.trim(), ...(input.product.size ? { size: input.product.size.trim() } : {}) },
    purchase: input.purchase,
    deadline: input.plan.deadline,
    trialDays: input.plan.trialDays,
    verdictDate: input.plan.verdictDate,
    mode: null,
    reminderHour: now.getHours(),
    schedule: input.plan.schedule,
    decision: "undecided",
    guardrail: { level: 0 },
    notes: { jamaNoteShown: input.jamaNoteShown, timeframeWarning: input.plan.timeframeWarning },
  };
  const claims: Claim[] = input.claims.map((c, position) => ({ ...c, position, id: crypto.randomUUID(), trialId: id }));
  await put("trials", trial);
  await putMany("claims", claims);
  return id;
}

export class CaptureRefused extends Error {
  constructor(readonly code: "error_mode_mismatch" | "error_below_min_image_size" | "not_found" | "wrong_state") {
    super(code);
  }
}

/**
  Stores a new face photo on the device and its pending session (T047).
  Photo A locks the trial's detail mode; a later photo below that mode is refused before upload.
*/
export async function addCapture(input: {
  trialId: string;
  kind: Session["kind"];
  scheduledDay: number;
  blob: Blob;
  width: number;
  height: number;
  quality: Session["quality"];
  now?: Date;
}): Promise<{ session: Session; trial: Trial }> {
  const trial = await get("trials", input.trialId);
  if (!trial) throw new CaptureRefused("not_found");
  if (trial.kind === "demo") throw new CaptureRefused("wrong_state");

  const decision = captureMode(trial.mode, input.kind, { width: input.width, height: input.height });
  if (!decision.ok) throw new CaptureRefused(decision.code);

  const now = input.now ?? new Date();
  const sessionId = crypto.randomUUID();
  const photoId = `face:${sessionId}`;
  await put("photos", { id: photoId, trialId: trial.id, kind: "face", blob: input.blob, type: input.blob.type || "image/jpeg" });

  const session: Session = {
    id: sessionId,
    trialId: trial.id,
    kind: input.kind,
    scheduledDay: input.scheduledDay,
    takenAt: now.toISOString(),
    photoId,
    width: input.width,
    height: input.height,
    quality: input.quality,
    taskId: null,
    state: "pending",
    error: null,
  };
  await put("sessions", session);

  let next = trial;
  if (input.kind === "day0_a") {
    next = {
      ...trial,
      mode: decision.mode,
      status: "baseline",
      // Reminders default to the hour of the first photo (FR-011).
      reminderHour: now.getHours(),
    };
    await put("trials", next);
  }
  return { session, trial: next };
}

/** After photo B is analyzed, the baseline exists and the trial becomes active (T047). */
export async function finishDay0(trialId: string): Promise<Trial> {
  const trial = await get("trials", trialId);
  if (!trial) throw new CaptureRefused("not_found");
  const sessions = await byTrial("sessions", trialId);
  const done = (k: Session["kind"]) => sessions.some((s) => s.kind === k && s.state === "done");
  if (!done("day0_a") || !done("day0_b")) throw new CaptureRefused("wrong_state");
  const next: Trial = { ...trial, status: "active" };
  await put("trials", next);
  return next;
}
