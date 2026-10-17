import "server-only";
import { cookies } from "next/headers";
import {
  DEVICE_ANALYSES_PER_DAY,
  DEVICE_LABELS_PER_DAY,
  globalCheck,
  nextUtcMidnight,
  readTaskToken,
  refundOnce,
  signState,
  stateForToday,
  taskToken,
  verifyState,
  type BudgetConfig,
  type DeviceState,
} from "./budget-core";
import { spendableUnits, unitsSpentSince } from "./youcam";

const COOKIE = "vd";

function secret(): string {
  const s = process.env.VERDICT_COOKIE_SECRET;
  if (!s || s.length < 32) throw new Error("VERDICT_COOKIE_SECRET must be set (32+ chars)");
  return s;
}

function num(name: string, fallback?: number): number {
  const v = Number(process.env[name]);
  if (Number.isFinite(v) && process.env[name] !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is not configured`);
}

export function budgetConfig(): BudgetConfig {
  return {
    launchBalance: num("BUDGET_LAUNCH_BALANCE"),
    reserve: num("BUDGET_RESERVE"),
    dailyMax: num("BUDGET_DAILY_MAX"),
    start: new Date(process.env.BUDGET_START ?? "2026-10-25T00:00:00Z"),
    end: new Date(process.env.BUDGET_END ?? "2026-11-20T16:45:00Z"),
  };
}

/** Units one analysis costs, measured during calibration (scripts/out/ledger.jsonl). */
export const unitCost = () => num("BUDGET_UNIT_COST");

export async function readDevice(now = new Date()): Promise<DeviceState> {
  const store = await cookies();
  return stateForToday(verifyState(store.get(COOKIE)?.value, secret()), now);
}

export async function writeDevice(state: DeviceState): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, signState(state, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// Balance and today's spend are read from free endpoints, cached for 60 s per instance.
let cache: { at: number; balance: number; spentToday: number; day: string } | null = null;

async function accountSnapshot(now: Date) {
  const day = now.toISOString().slice(0, 10);
  if (cache && now.getTime() - cache.at < 60_000 && cache.day === day) return cache;
  const midnight = new Date(`${day}T00:00:00Z`);
  const [balance, spentToday] = await Promise.all([spendableUnits(), unitsSpentSince(midnight).catch(() => 0)]);
  cache = { at: now.getTime(), balance, spentToday, day };
  return cache;
}

export type CapResult =
  | { ok: true; device: DeviceState }
  | { ok: false; code: "cap_device" | "cap_global" | "cap_labels"; resumesAt: Date; device: DeviceState };

export async function checkAnalysis(now = new Date()): Promise<CapResult> {
  const device = await readDevice(now);
  if (device.analyses >= DEVICE_ANALYSES_PER_DAY) {
    return { ok: false, code: "cap_device", resumesAt: nextUtcMidnight(now), device };
  }
  const snap = await accountSnapshot(now);
  const g = globalCheck(budgetConfig(), now, snap.balance, snap.spentToday, unitCost());
  if (!g.open) return { ok: false, code: "cap_global", resumesAt: g.resumesAt, device };
  return { ok: true, device };
}

export async function checkLabel(now = new Date()): Promise<CapResult> {
  const device = await readDevice(now);
  if (device.labels >= DEVICE_LABELS_PER_DAY) {
    return { ok: false, code: "cap_labels", resumesAt: nextUtcMidnight(now), device };
  }
  return { ok: true, device };
}

/** Counts a created task against today's device cap and returns its device bound token. */
export async function countAnalysis(taskId: string, now = new Date()): Promise<string> {
  const device = await readDevice(now);
  await writeDevice({ ...device, analyses: device.analyses + 1 });
  if (cache) cache.spentToday += unitCost();
  return taskToken(taskId, device.id, secret());
}

/** Task id behind a token, only for the device that created it. */
export async function taskFromToken(token: string, now = new Date()): Promise<string | null> {
  const device = await readDevice(now);
  return readTaskToken(token, device.id, secret());
}

/** A task that ended in error gives its slot back, once (FR-034). */
export async function refundTask(taskId: string, now = new Date()): Promise<void> {
  const device = await readDevice(now);
  const next = refundOnce(device, taskId);
  if (next !== device) await writeDevice(next);
}

export async function countLabel(now = new Date()): Promise<DeviceState> {
  const device = await readDevice(now);
  const next = { ...device, labels: device.labels + 1 };
  await writeDevice(next);
  return next;
}

export async function budgetStatus(now = new Date()) {
  const device = await readDevice(now);
  let globalOpen = true;
  let resumesAt: Date | undefined;
  try {
    const snap = await accountSnapshot(now);
    const g = globalCheck(budgetConfig(), now, snap.balance, snap.spentToday, unitCost());
    globalOpen = g.open;
    if (!g.open) resumesAt = g.resumesAt;
  } catch {
    globalOpen = false;
  }
  const deviceRemaining = Math.max(0, DEVICE_ANALYSES_PER_DAY - device.analyses);
  if (deviceRemaining === 0) resumesAt = nextUtcMidnight(now);
  return { deviceRemaining, globalOpen, resumesAt: resumesAt?.toISOString(), device };
}
