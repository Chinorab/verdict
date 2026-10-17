import "server-only";
import type { Concern, Mode } from "./schemas";

/*
  YouCam S2S client (research R1, R6). Server only: the key never reaches the browser.
  Endpoints verified against the docs and the official skin-analysis-expert skill (2026-10-17).
*/

const BASE = "https://yce-api-01.makeupar.com";
const UPLOAD_PATH = "/s2s/v2.0/file";
const TASK_PATH = "/s2s/v2.1/task/skin-analysis";
const CREDIT_PATH = "/s2s/v1.0/client/credit";
const CREDIT_HISTORY_PATH = "/s2s/v1.0/client/credit/history";

export class YouCamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

function key(): string {
  const k = process.env.YOUCAM_API_KEY;
  if (!k) throw new YouCamError("YOUCAM_API_KEY is not configured", 500, "config");
  return k;
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, attempt = 0): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 429 && attempt < 3) {
    // 250 requests per 300 s per IP and per token: back off and retry (R6).
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return call<T>(method, path, body, attempt + 1);
  }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    const code = typeof json.error_code === "string" ? json.error_code : typeof json.error === "string" ? json.error : undefined;
    throw new YouCamError(`YouCam ${method} ${path} failed with ${res.status}`, res.status, code);
  }
  return json as T;
}

/** YouCam action name for a concern in a mode. SD and HD never mix in one task. */
export function actionFor(concern: Concern, mode: Mode): string {
  if (mode === "hd") return `hd_${concern}`;
  return concern === "dark_circle" ? "dark_circle_v2" : concern;
}

/** Inverse of actionFor, used to read task output types. */
export function concernFromAction(type: string): Concern | null {
  const bare = type.replace(/^hd_/, "").replace(/_v2$/, "");
  const known: Concern[] = [
    "age_spot", "wrinkle", "texture", "dark_circle", "redness", "pore",
    "acne", "oiliness", "moisture", "firmness", "radiance", "eye_bag",
  ];
  return (known as string[]).includes(bare) ? (bare as Concern) : null;
}

export async function spendableUnits(): Promise<number> {
  const json = await call<{ results?: { type?: string; amount?: number }[] }>("GET", CREDIT_PATH);
  return (json.results ?? [])
    .filter((b) => String(b.type ?? "").startsWith("Api"))
    .reduce((sum, b) => sum + (b.amount ?? 0), 0);
}

/**
  Units debited since `since`. The history entry shape is read defensively: entries carry an
  amount and a timestamp; debits are negative amounts or entries typed as usage.
  To verify against a real response during calibration (tasks T001).
*/
export async function unitsSpentSince(since: Date): Promise<number> {
  const json = await call<{ results?: Record<string, unknown>[]; result?: { histories?: Record<string, unknown>[] } }>(
    "GET",
    CREDIT_HISTORY_PATH,
  );
  const rows = json.results ?? json.result?.histories ?? [];
  let spent = 0;
  for (const r of rows) {
    const t = Number(r.created_time ?? r.timestamp ?? r.time ?? 0);
    const when = t > 1e12 ? t : t * 1000;
    if (!when || when < since.getTime()) continue;
    const amount = Number(r.amount ?? r.units ?? 0);
    const kind = String(r.type ?? r.action ?? "").toLowerCase();
    if (amount < 0) spent += -amount;
    else if (/consum|use|deduct|task/.test(kind)) spent += amount;
  }
  return spent;
}

export type UploadTicket = { fileId: string; url: string; method: string; headers: Record<string, string> };

export async function createUpload(contentType: string, size: number): Promise<UploadTicket> {
  const json = await call<{
    data: { files: { file_id: string; requests: { url: string; method?: string; headers?: Record<string, string> }[] }[] };
  }>("POST", UPLOAD_PATH, {
    files: [{ content_type: contentType, file_name: contentType === "image/png" ? "face.png" : "face.jpg", file_size: size }],
  });
  const file = json.data.files[0];
  const req = file.requests[0];
  return { fileId: file.file_id, url: req.url, method: req.method ?? "PUT", headers: req.headers ?? { "Content-Type": contentType } };
}

export async function createTask(fileId: string, mode: Mode, concerns: Concern[]): Promise<string> {
  const json = await call<{ data: { task_id: string } }>("POST", TASK_PATH, {
    src_file_id: fileId,
    dst_actions: concerns.map((c) => actionFor(c, mode)),
    format: "json",
    // Mask PNGs (not blended overlays) so the app draws them over its own stored photo (R1).
    miniserver_args: { enable_mask_overlay: false },
  });
  return json.data.task_id;
}

export type TaskResult =
  | { status: "running" }
  | { status: "success"; results: { concern: Concern; raw: number; ui: number; maskUrls: string[] }[] }
  | { status: "error"; code: string };

export async function getTask(taskId: string): Promise<TaskResult> {
  const json = await call<{
    data?: {
      task_status?: string;
      error?: string;
      error_message?: string;
      results?: { output?: { type: string; raw_score: number; ui_score: number; mask_urls?: string[] }[] };
    };
  }>("GET", `${TASK_PATH}/${encodeURIComponent(taskId)}`);
  const data = json.data ?? {};
  if (data.task_status === "success") {
    const results = (data.results?.output ?? []).flatMap((o) => {
      const concern = concernFromAction(o.type);
      return concern ? [{ concern, raw: o.raw_score, ui: o.ui_score, maskUrls: o.mask_urls ?? [] }] : [];
    });
    return { status: "success", results };
  }
  if (data.task_status === "error") return { status: "error", code: data.error ?? data.error_message ?? "unknown_error" };
  return { status: "running" };
}
