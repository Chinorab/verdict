import { describe, expect, it } from "vitest";
import {
  globalCheck,
  paceFloor,
  readTaskToken,
  refundOnce,
  signState,
  stateForToday,
  taskToken,
  verifyState,
  type BudgetConfig,
} from "@/lib/budget-core";

const SECRET = "x".repeat(40);
const cfg: BudgetConfig = {
  launchBalance: 900,
  reserve: 100,
  dailyMax: 80,
  start: new Date("2026-10-25T00:00:00Z"),
  end: new Date("2026-11-20T16:45:00Z"),
};

describe("device cookie", () => {
  it("round trips a signed state", () => {
    const s = { id: "a", day: "2026-11-05", analyses: 3, labels: 1 };
    expect(verifyState(signState(s, SECRET), SECRET)).toEqual(s);
  });

  it("rejects a tampered payload", () => {
    const signed = signState({ id: "a", day: "2026-11-05", analyses: 3, labels: 1 }, SECRET);
    const [, mac] = signed.split(".");
    const forged = Buffer.from(JSON.stringify({ id: "a", day: "2026-11-05", analyses: 0, labels: 0 })).toString("base64url");
    expect(verifyState(`${forged}.${mac}`, SECRET)).toBeNull();
  });

  it("rejects a state signed with another secret", () => {
    const signed = signState({ id: "a", day: "2026-11-05", analyses: 3, labels: 1 }, SECRET);
    expect(verifyState(signed, "y".repeat(40))).toBeNull();
  });

  it("resets counters on a new UTC day but keeps the device id", () => {
    const prev = { id: "dev", day: "2026-11-04", analyses: 5, labels: 9 };
    expect(stateForToday(prev, new Date("2026-11-05T01:00:00Z"))).toEqual({
      id: "dev",
      day: "2026-11-05",
      analyses: 0,
      labels: 0,
    });
  });

  it("starts a fresh state without a cookie", () => {
    const s = stateForToday(null, new Date("2026-11-05T01:00:00Z"));
    expect(s.analyses).toBe(0);
    expect(s.id).toMatch(/[0-9a-f-]{36}/);
  });
});

describe("pace line", () => {
  it("starts at the launch balance and ends at the reserve", () => {
    expect(paceFloor(cfg, cfg.start)).toBeCloseTo(900);
    expect(paceFloor(cfg, cfg.end)).toBeCloseTo(100);
  });

  it("is halfway at the midpoint", () => {
    const mid = new Date((cfg.start.getTime() + cfg.end.getTime()) / 2);
    expect(paceFloor(cfg, mid)).toBeCloseTo(500);
  });
});

describe("global check", () => {
  const mid = new Date((cfg.start.getTime() + cfg.end.getTime()) / 2);

  it("opens when above the line and under the daily ceiling", () => {
    expect(globalCheck(cfg, mid, 600, 10, 5)).toEqual({ open: true });
  });

  it("allows the first analysis at the very start of the line", () => {
    expect(globalCheck(cfg, cfg.start, cfg.launchBalance, 0, 5)).toEqual({ open: true });
  });

  it("closes when the analysis would cross the pace line (one day of head start included)", () => {
    // mid: line at 500, head start 80, so the balance may go down to 420
    expect(globalCheck(cfg, mid, 426, 10, 5)).toEqual({ open: true });
    const r = globalCheck(cfg, mid, 424, 10, 5);
    expect(r.open).toBe(false);
    if (!r.open) {
      expect(r.reason).toBe("pace");
      expect(r.resumesAt.getTime()).toBeGreaterThan(mid.getTime());
    }
  });

  it("closes when today's spend would pass the daily ceiling", () => {
    const r = globalCheck(cfg, mid, 800, 78, 5);
    expect(r.open).toBe(false);
    if (!r.open) expect(r.reason).toBe("daily");
  });

  it("never dips into the reserve", () => {
    const r = globalCheck(cfg, cfg.end, 104, 0, 5);
    expect(r.open).toBe(false);
    if (!r.open) expect(r.reason).toBe("reserve");
  });
});


describe("task tokens", () => {
  it("round trip on the same device", () => {
    const t = taskToken("task-123/abc", "dev-1", SECRET);
    expect(readTaskToken(t, "dev-1", SECRET)).toBe("task-123/abc");
  });

  it("are refused from another device", () => {
    const t = taskToken("task-123", "dev-1", SECRET);
    expect(readTaskToken(t, "dev-2", SECRET)).toBeNull();
  });

  it("are refused when the task id is swapped", () => {
    const [, mac] = taskToken("task-123", "dev-1", SECRET).split(".");
    const forged = `${Buffer.from("task-999").toString("base64url")}.${mac}`;
    expect(readTaskToken(forged, "dev-1", SECRET)).toBeNull();
  });
});

describe("refunds", () => {
  it("give a failed task's slot back once", () => {
    const s0 = { id: "d", day: "2026-11-05", analyses: 3, labels: 0 };
    const s1 = refundOnce(s0, "task-1");
    expect(s1.analyses).toBe(2);
    expect(refundOnce(s1, "task-1").analyses).toBe(2);
    expect(refundOnce(s1, "task-2").analyses).toBe(1);
  });

  it("forget refunds on a new day", () => {
    const s = stateForToday({ id: "d", day: "2026-11-04", analyses: 2, labels: 0, refunded: ["x"] }, new Date("2026-11-05T01:00:00Z"));
    expect(s.refunded).toBeUndefined();
  });
});
