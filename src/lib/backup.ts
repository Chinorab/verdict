"use client";

import { backupFileName, buildBackup, parseBackup, type BackupPhoto } from "./backup-core";
import { all, byTrial, get, measurementsFor, put, putMany } from "./db";
import { todayIso } from "./schedule";
import type { Trial } from "./schemas";

/* Device side of the backup file (FR-033b). Export and import never touch a server. */

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportTrial(trialId: string, includePhotos: boolean): Promise<void> {
  const trial = await get("trials", trialId);
  if (!trial) throw new Error("not_found");
  const [claims, sessions] = await Promise.all([byTrial("claims", trialId), byTrial("sessions", trialId)]);
  const measurements = await measurementsFor(sessions.map((s) => s.id));
  let photos: BackupPhoto[] | null = null;
  if (includePhotos) {
    const stored = (await byTrial("photos", trialId)).filter((p) => p.kind !== "label");
    photos = await Promise.all(stored.map(async (p) => ({ id: p.id, kind: p.kind, type: p.type, data: await blobToBase64(p.blob) })));
  }
  const file = buildBackup({ trial, claims, sessions, measurements, photos, now: new Date() });
  const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName(trial, todayIso());
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Stores a parsed backup on the device and returns the new trial id. */
export async function importBackupText(text: string, opts: { kind?: Trial["kind"]; ids?: () => string } = {}): Promise<string> {
  const r = parseBackup(text, opts.ids ?? (() => crypto.randomUUID()), { kind: opts.kind });
  for (const p of r.photos) await put("photos", { id: p.id, trialId: r.trial.id, kind: p.kind, blob: base64ToBlob(p.data, p.type), type: p.type });
  await put("trials", r.trial);
  await putMany("claims", r.claims);
  await putMany("sessions", r.sessions);
  await putMany("measurements", r.measurements);
  return r.trial.id;
}

export async function importBackupFile(file: File): Promise<string> {
  if (file.size > 60 * 1024 * 1024) throw new Error("too_large");
  return importBackupText(await file.text());
}

export async function trialsOnDevice(): Promise<Trial[]> {
  const list = await all("trials");
  return list.filter((t) => t.kind !== "demo").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
