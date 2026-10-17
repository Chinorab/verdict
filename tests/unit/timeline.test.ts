import { describe, expect, it } from "vitest";
import type { Session, Trial } from "@/lib/schemas";
import { nextCheckin, timelineRows } from "@/lib/timeline";

const schedule: Trial["schedule"] = [
  { day: 0, date: "2026-10-12", kind: "day0" },
  { day: 7, date: "2026-10-19", kind: "checkin" },
  { day: 14, date: "2026-10-26", kind: "checkin" },
  { day: 26, date: "2026-11-07", kind: "verdict" },
];
const trial = { schedule, kind: "real" as const };

const session = (kind: Session["kind"], scheduledDay: number, takenAt: string, state: Session["state"] = "done"): Session => ({
  id: `${kind}-${scheduledDay}-${takenAt}`,
  trialId: "t",
  kind,
  scheduledDay,
  takenAt,
  photoId: null,
  width: 1080,
  height: 1920,
  quality: null,
  taskId: null,
  state,
  error: null,
});
const day0 = [session("day0_a", 0, "2026-10-12T20:30:00Z"), session("day0_b", 0, "2026-10-12T20:32:00Z")];

describe("timelineRows", () => {
  it("day 0 is due before any photo, partial after one, done after two", () => {
    expect(timelineRows(trial, [], "2026-10-12")[0].state).toBe("due");
    expect(timelineRows(trial, [day0[0]], "2026-10-12")[0].state).toBe("partial");
    expect(timelineRows(trial, day0, "2026-10-12")[0].state).toBe("done");
  });

  it("a failed analysis does not count as done", () => {
    const failed = [day0[0], session("day0_b", 0, "2026-10-12T20:32:00Z", "failed")];
    expect(timelineRows(trial, failed, "2026-10-12")[0].state).toBe("partial");
  });

  it("marks today's check-in due, past ones late, future ones upcoming", () => {
    const rows = timelineRows(trial, day0, "2026-10-26");
    expect(rows.map((r) => r.state)).toEqual(["done", "late", "due", "upcoming"]);
  });

  it("a late check-in taken later is done and keeps its real date", () => {
    const late = session("checkin", 7, "2026-10-21T20:00:00Z");
    const rows = timelineRows(trial, [...day0, late], "2026-10-21");
    expect(rows[1]).toMatchObject({ state: "done", takenAt: "2026-10-21T20:00:00Z" });
  });

  it("check-ins wait until day 0 is complete", () => {
    expect(timelineRows(trial, [day0[0]], "2026-10-26").slice(1).every((r) => r.state === "upcoming")).toBe(true);
  });

  it("nextCheckin is today's check-in, not an older missed one", () => {
    const rows = timelineRows(trial, day0, "2026-10-26");
    expect(nextCheckin(rows)?.day).toBe(14);
  });

  it("nextCheckin is the most recent missed one when nothing is due today", () => {
    const rows = timelineRows(trial, day0, "2026-10-28");
    expect(nextCheckin(rows)?.day).toBe(14);
  });

  it("nextCheckin is the next upcoming one when nothing is open", () => {
    const rows = timelineRows(trial, [...day0, session("checkin", 7, "2026-10-19T20:00:00Z")], "2026-10-20");
    expect(nextCheckin(rows)?.day).toBe(14);
  });

  it("quick run: the verdict check-in is due right after day 0", () => {
    const quick = {
      kind: "quick" as const,
      schedule: [
        { day: 0, date: "2026-11-05", kind: "day0" as const },
        { day: 0, date: "2026-11-05", kind: "verdict" as const },
      ],
    };
    expect(timelineRows(quick, [], "2026-11-05").map((r) => r.state)).toEqual(["due", "upcoming"]);
    const d0 = [session("day0_a", 0, "2026-11-05T10:00:00Z"), session("day0_b", 0, "2026-11-05T10:01:00Z")];
    expect(timelineRows(quick, d0, "2026-11-05").map((r) => r.state)).toEqual(["done", "due"]);
  });
});
