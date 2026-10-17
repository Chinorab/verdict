"use client";

import { byTrial, get, measurementsFor, put, putMany } from "./db";
import { CONCERNS, type Claim, type Concern, type Measurement, type Mode, type Session } from "./schemas";

/*
  Device side analysis flow (T045, contracts/api.md):
  upload ticket -> PUT straight to YouCam -> create task -> poll -> store scores and masks at once.
  YouCam keeps results for a limited time, so everything needed later is stored on the device
  the moment it arrives (FR-017). A session that already has results is never re-analyzed (FR-018).
*/

export class AnalysisError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfter?: string,
  ) {
    super(code);
  }
}

export type AnalysisStatus = "uploading" | "analyzing" | "saving";

/** Concerns to request: every concern the claims map to, plus redness and acne for the health guardrail (FR-027). */
export function concernsForTrial(claims: Claim[]): Concern[] {
  const wanted = new Set<Concern>(["redness", "acne"]);
  for (const c of claims) for (const t of c.targets) wanted.add(t.concern);
  return CONCERNS.filter((c) => wanted.has(c));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new AnalysisError("network");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new AnalysisError(json?.error?.code ?? "unknown", json?.error?.retryAfter);
  return json as T;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type PollResult =
  | { status: "running" }
  | { status: "success"; results: { concern: Concern; raw: number; ui: number; maskUrls: string[] }[] }
  | { status: "error"; code: string };

async function poll(token: string, signal?: AbortSignal): Promise<Extract<PollResult, { status: "success" }>> {
  for (let i = 0; i < 30; i++) {
    if (signal?.aborted) throw new AnalysisError("aborted");
    let res: Response;
    try {
      res = await fetch(`/api/analysis/task/${encodeURIComponent(token)}`, { cache: "no-store", signal });
    } catch {
      throw new AnalysisError(signal?.aborted ? "aborted" : "network");
    }
    const json = (await res.json().catch(() => null)) as PollResult | { error?: { code?: string } } | null;
    if (!res.ok) throw new AnalysisError((json as { error?: { code?: string } })?.error?.code ?? "unknown");
    const r = json as PollResult;
    if (r.status === "success") return r;
    if (r.status === "error") throw new AnalysisError(r.code);
    await wait(4000);
  }
  throw new AnalysisError("timeout");
}

/** Downloads mask images now (they expire at YouCam). A failed download keeps the scores. */
async function saveMasks(trialId: string, sessionId: string, concern: Concern, urls: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, url] of urls.entries()) {
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
      if (!res.ok) continue;
      const blob = await res.blob();
      const id = `${sessionId}:${concern}:${i}`;
      await put("photos", { id, trialId, kind: "mask", blob, type: blob.type || "image/png" });
      ids.push(id);
    } catch {
      // Cross origin blocked or offline: tasks T006/T043 decide whether a mask proxy is needed.
    }
  }
  return ids;
}

/** Results already stored for a session, if any (FR-018). */
export async function storedResults(sessionId: string): Promise<Measurement[]> {
  return measurementsFor([sessionId]);
}

/**
  Runs one analysis for a stored session whose photo is on the device.
  Resumes polling when the session already has a task, instead of paying for a new one.
*/
export async function analyzeSession(opts: {
  session: Session;
  mode: Mode;
  concerns: Concern[];
  onStatus?: (s: AnalysisStatus) => void;
  signal?: AbortSignal;
}): Promise<Measurement[]> {
  const { session, mode, concerns, onStatus, signal } = opts;

  const cached = await storedResults(session.id);
  if (cached.length > 0) return cached;

  let token = session.taskId;
  let current: Session = { ...session, state: "analyzing", error: null };

  if (!token) {
    if (!session.photoId) throw new AnalysisError("unknown");
    const photo = await get("photos", session.photoId);
    if (!photo) throw new AnalysisError("unknown");

    onStatus?.("uploading");
    const contentType = photo.type === "image/png" ? "image/png" : "image/jpeg";
    const ticket = await postJson<{ fileId: string; upload: { url: string; method: string; headers: Record<string, string> } }>(
      "/api/analysis/upload",
      { contentType, size: photo.blob.size, width: session.width, height: session.height, mode },
    );
    try {
      const uploaded = await fetch(ticket.upload.url, {
        method: ticket.upload.method || "PUT",
        headers: ticket.upload.headers,
        body: photo.blob,
        signal,
      });
      if (!uploaded.ok) throw new AnalysisError("upload_failed");
    } catch (e) {
      if (e instanceof AnalysisError) throw e;
      throw new AnalysisError(signal?.aborted ? "aborted" : "upload_blocked");
    }

    onStatus?.("analyzing");
    const created = await postJson<{ taskId: string }>("/api/analysis/task", { fileId: ticket.fileId, mode, concerns });
    token = created.taskId;
    current = { ...current, taskId: token };
    await put("sessions", current); // keep the task so a reload resumes polling instead of paying again
  } else {
    onStatus?.("analyzing");
  }

  let result;
  try {
    result = await poll(token, signal);
  } catch (e) {
    const code = e instanceof AnalysisError ? e.code : "unknown";
    if (code !== "aborted" && code !== "network" && code !== "timeout") {
      // The task itself failed (capture rejected): a retake needs a new task.
      await put("sessions", { ...current, taskId: null, state: "failed", error: code });
    }
    throw e;
  }

  onStatus?.("saving");
  const measurements: Measurement[] = [];
  for (const r of result.results) {
    const maskIds = await saveMasks(session.trialId, session.id, r.concern, r.maskUrls);
    measurements.push({ sessionId: session.id, concern: r.concern, raw: r.raw, ui: r.ui, maskIds });
  }
  await putMany("measurements", measurements);
  await put("sessions", { ...current, state: "done", error: null });
  return measurements;
}

/** Sessions of a trial, oldest first. */
export async function sessionsOf(trialId: string): Promise<Session[]> {
  const list = await byTrial("sessions", trialId);
  return list.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}
