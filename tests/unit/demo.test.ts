import { describe, expect, it } from "vitest";
import { demoLabelText, demoProgress, demoToday } from "@/lib/demo-core";
import type { Session, Trial } from "@/lib/schemas";

// Test inputs only: a 30 day window with check-ins every week and the verdict on day 26.
const trial: Pick<Trial, "schedule"> = {
  schedule: [
    { day: 0, date: "2026-10-24", kind: "day0" },
    { day: 7, date: "2026-10-31", kind: "checkin" },
    { day: 26, date: "2026-11-19", kind: "verdict" },
  ],
};

const s = (id: string, kind: Session["kind"], day: number, takenAt: string, state: Session["state"] = "done"): Session => ({
  id,
  trialId: "demo",
  kind,
  scheduledDay: day,
  takenAt,
  photoId: null,
  width: 1080,
  height: 1080,
  quality: null,
  taskId: null,
  state,
  error: null,
});

const day0 = [s("a", "day0_a", 0, "2026-10-24T13:55:00"), s("b", "day0_b", 0, "2026-10-24T13:56:00")];

describe("demo progress", () => {
  it("reads a day 0 only demo as running, drawn at day 0", () => {
    const p = demoProgress(trial, day0);
    expect(p).toEqual({ start: "2026-10-24", last: "2026-10-24", complete: false, hasCheckin: false });
    expect(demoToday(trial, day0, "2026-11-03")).toBe("2026-10-24");
    expect(demoLabelText(p)).toBe("Real trial by the author, running since Oct 24, 2026, last measured Oct 24");
  });

  it("ignores a photo that was not measured", () => {
    const p = demoProgress(trial, [...day0, s("c", "checkin", 7, "2026-10-31T15:00:00", "failed")]);
    expect(p.last).toBe("2026-10-24");
    expect(p.hasCheckin).toBe(false);
  });

  it("is complete once the verdict photo is in", () => {
    const all = [...day0, s("c", "checkin", 7, "2026-10-31T15:00:00"), s("d", "checkin", 26, "2026-11-19T15:00:00")];
    const p = demoProgress(trial, all);
    expect(p.complete).toBe(true);
    expect(demoLabelText(p)).toBe("Real trial by the author, Oct 24 to Nov 19, 2026");
  });

  it("falls back to today without any measured photo", () => {
    expect(demoToday(trial, [], "2026-11-03")).toBe("2026-11-03");
    expect(demoLabelText(demoProgress(trial, []))).toBe("Real trial by the author");
  });
});
