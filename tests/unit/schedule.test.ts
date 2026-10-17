import { describe, expect, it } from "vitest";
import { addDays, planTrial, quickPlan, verdictMargin } from "@/lib/schedule";

const base = { start: "2026-10-12", purchaseDate: "2026-10-12" };

describe("deadline and margin", () => {
  it("Oct 12 plus 30 days: deadline Nov 11, verdict Nov 7 (mockup case)", () => {
    const p = planTrial({ ...base, returnDays: 30, claimTimeframes: [28] });
    expect(p.deadline).toBe("2026-11-11");
    expect(p.verdictDate).toBe("2026-11-07");
    expect(p.trialDays).toBe(26);
    expect(p.marginDays).toBe(4);
  });

  it("uses a 2 day margin for windows up to 14 days and 4 beyond", () => {
    expect(verdictMargin(14)).toBe(2);
    expect(verdictMargin(15)).toBe(4);
  });

  it("verdict always lands before the deadline with the margin, for every window", () => {
    for (const returnDays of [14, 30, 60, 90]) {
      for (const tf of [7, 14, 28, 56, null]) {
        const p = planTrial({ ...base, returnDays, claimTimeframes: [tf] });
        const gap = (Date.parse(p.deadline) - Date.parse(p.verdictDate)) / 86_400_000;
        expect(gap).toBeGreaterThanOrEqual(p.marginDays);
      }
    }
  });
});

describe("trial length (FR-008)", () => {
  it("14 day promise gives a 14 day trial when the window allows", () => {
    expect(planTrial({ ...base, returnDays: 30, claimTimeframes: [14] }).trialDays).toBe(14);
  });

  it("no stated timeframe gives 28 days", () => {
    expect(planTrial({ ...base, returnDays: 60, claimTimeframes: [null] }).trialDays).toBe(28);
  });

  it("an 8 week promise gives 56 days with a 90 day window", () => {
    const p = planTrial({ ...base, returnDays: 90, claimTimeframes: [56] });
    expect(p.trialDays).toBe(56);
    expect(p.timeframeWarning).toBe(false);
  });

  it("uses the shortest promised timeframe", () => {
    expect(planTrial({ ...base, returnDays: 90, claimTimeframes: [56, 14, null] }).trialDays).toBe(14);
  });

  it("an 8 week promise with a 30 day window is shortened and warned (FR-010)", () => {
    const p = planTrial({ ...base, returnDays: 30, claimTimeframes: [56] });
    expect(p.trialDays).toBe(26);
    expect(p.timeframeWarning).toBe(true);
  });

  it("counts from the trial start, not the purchase date", () => {
    const p = planTrial({ start: "2026-10-20", purchaseDate: "2026-10-12", returnDays: 30, claimTimeframes: [28] });
    expect(p.deadline).toBe("2026-11-11");
    expect(p.trialDays).toBe(18);
    expect(p.verdictDate).toBe("2026-11-07");
  });
});

describe("check-in days (FR-009)", () => {
  const days = (p: ReturnType<typeof planTrial>) => p.schedule.map((s) => s.day);

  it("14 day trial: 0, 7, 14", () => {
    expect(days(planTrial({ ...base, returnDays: 30, claimTimeframes: [14] }))).toEqual([0, 7, 14]);
  });

  it("28 day trial: 0, 7, 14, 21, 28", () => {
    expect(days(planTrial({ ...base, returnDays: 60, claimTimeframes: [28] }))).toEqual([0, 7, 14, 21, 28]);
  });

  it("56 day trial: 0, 14, 28, 42, 56", () => {
    expect(days(planTrial({ ...base, returnDays: 90, claimTimeframes: [56] }))).toEqual([0, 14, 28, 42, 56]);
  });

  it("shortened trial keeps earlier check-ins and moves the last one to the verdict date", () => {
    const p = planTrial({ ...base, returnDays: 30, claimTimeframes: [28] });
    expect(days(p)).toEqual([0, 7, 14, 21, 26]);
    expect(p.schedule[0].kind).toBe("day0");
    expect(p.schedule.at(-1)).toEqual({ day: 26, date: "2026-11-07", kind: "verdict" });
    expect(p.schedule.slice(1, -1).every((s) => s.kind === "checkin")).toBe(true);
  });
});

describe("user cap on the trial length", () => {
  it("a 14 day cap on a 4 week promise gives check-ins 0, 7, 14 and a warning", () => {
    const p = planTrial({ start: "2026-10-18", purchaseDate: "2026-10-17", returnDays: 30, claimTimeframes: [28], maxDays: 14 });
    expect(p.schedule.map((s) => s.day)).toEqual([0, 7, 14]);
    expect(p.verdictDate).toBe("2026-11-01");
    expect(p.timeframeWarning).toBe(true);
  });

  it("a cap longer than the plan changes nothing", () => {
    const a = planTrial({ ...base, returnDays: 60, claimTimeframes: [28] });
    expect(planTrial({ ...base, returnDays: 60, claimTimeframes: [28], maxDays: 40 })).toEqual(a);
  });
});

describe("window too short (edge case)", () => {
  it("flags a trial that cannot finish before the deadline", () => {
    const p = planTrial({ start: "2026-11-06", purchaseDate: "2026-10-12", returnDays: 30, claimTimeframes: [28] });
    expect(p.tooLate).toBe(true);
    expect(p.trialDays).toBe(14);
  });

  it("flags a deadline already passed", () => {
    expect(planTrial({ start: "2026-11-20", purchaseDate: "2026-10-12", returnDays: 30, claimTimeframes: [14] }).tooLate).toBe(true);
  });
});

describe("quick run", () => {
  it("day 0 and the verdict on the same day", () => {
    const p = quickPlan({ start: "2026-11-05", purchaseDate: "2026-11-01", returnDays: 30 });
    expect(p.schedule.map((s) => [s.day, s.kind])).toEqual([
      [0, "day0"],
      [0, "verdict"],
    ]);
    expect(p.verdictDate).toBe("2026-11-05");
  });
});

describe("dates", () => {
  it("adds days across month ends without time zone drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });
});
