import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/*
  Budget rules without a database (research R7, constitution VI v1.1.0).
  Pure functions so they are unit tested; src/lib/budget.ts wires them to cookies and YouCam.
*/

export const DEVICE_ANALYSES_PER_DAY = 5;
export const DEVICE_LABELS_PER_DAY = 10;

export type DeviceState = {
  id: string;
  day: string;
  analyses: number;
  labels: number;
  /** Short hashes of failed tasks already refunded today, so a refund happens once. */
  refunded?: string[];
};

export const utcDay = (now: Date) => now.toISOString().slice(0, 10);
export const nextUtcMidnight = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function signState(state: DeviceState, secret: string): string {
  const payload = b64url(JSON.stringify(state));
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

/** Returns the state if the signature is valid, else null. */
export function verifyState(cookie: string | undefined, secret: string): DeviceState | null {
  if (!cookie) return null;
  const [payload, mac] = cookie.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DeviceState;
    if (typeof s.id !== "string" || typeof s.day !== "string") return null;
    if (!Number.isInteger(s.analyses) || !Number.isInteger(s.labels)) return null;
    if (s.refunded !== undefined && !(Array.isArray(s.refunded) && s.refunded.every((r) => typeof r === "string"))) return null;
    return s;
  } catch {
    return null;
  }
}

/** Current state for today: a missing, forged or stale cookie starts a fresh day. */
export function stateForToday(prev: DeviceState | null, now: Date): DeviceState {
  const day = utcDay(now);
  if (!prev) return { id: randomUUID(), day, analyses: 0, labels: 0 };
  if (prev.day !== day) return { id: prev.id, day, analyses: 0, labels: 0 };
  return prev;
}

export type BudgetConfig = {
  launchBalance: number;
  reserve: number;
  dailyMax: number;
  start: Date; // when the line starts (deployment)
  end: Date; // 2026-11-20T16:45Z
};

/**
  Lowest balance allowed at `now`: a straight line from the launch balance at `start`
  down to the reserve at `end`. Spending is allowed while the balance stays above it.
*/
export function paceFloor(cfg: BudgetConfig, now: Date): number {
  const total = cfg.end.getTime() - cfg.start.getTime();
  if (total <= 0) return cfg.reserve;
  const left = Math.min(Math.max(cfg.end.getTime() - now.getTime(), 0), total);
  return cfg.reserve + (cfg.launchBalance - cfg.reserve) * (left / total);
}

export type GlobalCheck = { open: true } | { open: false; reason: "pace" | "daily" | "reserve"; resumesAt: Date };

/**
  Global gate for one more analysis costing `unitCost` units.
  - reserve: never dip into the reserve kept for the author's demo check-ins
  - pace: the balance after this analysis must stay above the pace line
  - daily: units spent today plus this analysis must stay under the daily ceiling
*/
export function globalCheck(
  cfg: BudgetConfig,
  now: Date,
  balance: number,
  spentToday: number,
  unitCost: number,
): GlobalCheck {
  const tomorrow = nextUtcMidnight(now);
  if (balance - unitCost < cfg.reserve) return { open: false, reason: "reserve", resumesAt: cfg.end };
  if (spentToday + unitCost > cfg.dailyMax) return { open: false, reason: "daily", resumesAt: tomorrow };
  // The line gets one day's ceiling of head start, so spending can begin on day one instead of
  // waiting for the line to drop below the launch balance (found on the live account, 2026-10-22).
  if (balance - unitCost < paceFloor(cfg, now) - cfg.dailyMax) {
    // When will the line fall far enough? Solve paceFloor(t) - dailyMax = balance - unitCost.
    const total = cfg.end.getTime() - cfg.start.getTime();
    const target = balance - unitCost + cfg.dailyMax;
    const frac = (target - cfg.reserve) / Math.max(cfg.launchBalance - cfg.reserve, 1);
    const at = new Date(cfg.end.getTime() - frac * total);
    return { open: false, reason: "pace", resumesAt: at > now ? at : tomorrow };
  }
  return { open: true };
}

/*
  Task tokens bind a YouCam task to the device that created it, so results (which include
  detection masks of a face) can only be polled from that device.
*/
export function taskToken(taskId: string, deviceId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(`task|${deviceId}|${taskId}`).digest("base64url").slice(0, 22);
  return `${b64url(taskId)}.${mac}`;
}

export function readTaskToken(token: string, deviceId: string, secret: string): string | null {
  const [enc, mac] = token.split(".");
  if (!enc || !mac) return null;
  let taskId: string;
  try {
    taskId = Buffer.from(enc, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = taskToken(taskId, deviceId, secret).split(".")[1];
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? taskId : null;
}

/** Refund a failed task's slot once per task (FR-034: failed analyses do not count). */
export function refundOnce(state: DeviceState, taskId: string): DeviceState {
  const tag = createHmac("sha256", "refund").update(taskId).digest("base64url").slice(0, 10);
  const refunded = state.refunded ?? [];
  if (refunded.includes(tag)) return state;
  return { ...state, analyses: Math.max(0, state.analyses - 1), refunded: [...refunded, tag].slice(-10) };
}
