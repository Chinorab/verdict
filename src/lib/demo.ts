"use client";

import { importBackupText } from "./backup";
import { byTrial, get } from "./db";
import { demoLabelText, demoProgress } from "./demo-core";
import type { Trial } from "./schemas";

/*
  The author's real demo trial (FR-035, research R13): a backup file shipped in public/demo/,
  opened read only. It holds no face photos (author's decision, 2026-10-17). Opening it spends no
  analysis budget: nothing is sent anywhere.
*/

export const DEMO_ID = "demo";
const DEMO_URL = "/demo/demo-trial.verdict.json";

/** Loads the demo into this device's storage (overwriting an older copy). Null if not published yet. */
export async function loadDemo(): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(DEMO_URL, { cache: "no-cache" });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const text = await res.text();
  let n = 0;
  // Stable ids so the demo always lives at /trial/demo.
  return importBackupText(text, { kind: "demo", ids: () => (n++ === 0 ? DEMO_ID : `demo-${n}`) });
}

export async function demoAvailable(): Promise<boolean> {
  try {
    const res = await fetch(DEMO_URL, { method: "HEAD", cache: "no-cache" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Banner text with the trial's real dates (src/lib/demo-core.ts). */
export async function demoLabel(trial: Trial): Promise<string> {
  return demoLabelText(demoProgress(trial, await byTrial("sessions", trial.id)));
}

/** Where /demo opens: the verdict once a check-in is measured, the timeline before. */
export async function demoStart(): Promise<string> {
  const trial = await get("trials", DEMO_ID);
  if (!trial) return `/trial/${DEMO_ID}`;
  return demoProgress(trial, await byTrial("sessions", DEMO_ID)).hasCheckin ? `/trial/${DEMO_ID}/verdict` : `/trial/${DEMO_ID}`;
}

export const isDemo = async (id: string) => (await get("trials", id))?.kind === "demo";
