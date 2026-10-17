import type { ScheduleItem, Session, Trial } from "./schemas";

/* Timeline rows (US3): what is done, what is due today, what is late, what comes next. */

export type RowState = "done" | "partial" | "due" | "late" | "upcoming";

export type TimelineRow = ScheduleItem & {
  state: RowState;
  /** Session that fulfilled this row, when done. */
  takenAt?: string;
};

/**
  The schedule item a new check-in belongs to (never day 0): the most recent one that is due
  or late, so a user who missed a week takes one photo today, not two; otherwise the next
  upcoming one. Earlier missed check-ins stay missed.
*/
export function nextCheckin(rows: TimelineRow[]): TimelineRow | undefined {
  const open = rows.filter((r) => r.kind !== "day0" && (r.state === "due" || r.state === "late"));
  return open.at(-1) ?? rows.find((r) => r.kind !== "day0" && r.state === "upcoming");
}

export function timelineRows(trial: Pick<Trial, "schedule" | "kind">, sessions: Session[], today: string): TimelineRow[] {
  const done = sessions.filter((s) => s.state === "done");
  const day0 = ["day0_a", "day0_b"].map((k) => done.find((s) => s.kind === k));
  const checkins = done.filter((s) => s.kind === "checkin");

  // A quick run has day 0 and its verdict on the same day: the verdict row waits for day 0.
  return trial.schedule.map((item) => {
    if (item.kind === "day0") {
      const count = day0.filter(Boolean).length;
      if (count === 2) return { ...item, state: "done", takenAt: day0[1]!.takenAt };
      if (count === 1) return { ...item, state: "partial" };
      return { ...item, state: item.date < today ? "late" : "due" };
    }
    const match = checkins.find((s) => s.scheduledDay === item.day);
    if (match) return { ...item, state: "done", takenAt: match.takenAt };
    const day0Done = day0.every(Boolean);
    if (!day0Done) return { ...item, state: "upcoming" };
    if (item.date === today || (trial.kind === "quick" && item.date <= today)) return { ...item, state: "due" };
    if (item.date < today) return { ...item, state: "late" };
    return { ...item, state: "upcoming" };
  });
}
