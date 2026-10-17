"use client";

import { importBackupText } from "./backup";
import { byTrial, get } from "./db";
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

/** "Real trial by the author, Oct 18 to Nov 1, 2026": dates come from the data itself. */
export async function demoLabel(trial: Trial): Promise<string> {
  const sessions = (await byTrial("sessions", trial.id)).filter((s) => s.state === "done").sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const fmt = (iso: string, year: boolean) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
  if (sessions.length === 0) return "Real trial by the author";
  return `Real trial by the author, ${fmt(sessions[0].takenAt, false)} to ${fmt(sessions.at(-1)!.takenAt, true)}`;
}

export const isDemo = async (id: string) => (await get("trials", id))?.kind === "demo";
