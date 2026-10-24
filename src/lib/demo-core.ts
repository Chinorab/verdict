import { todayIso } from "./schedule";
import type { Session, Trial } from "./schemas";

/*
  The author's demo trial is published while it runs (decision 2026-10-24): the file shipped with
  the site is updated after each check-in, so it can lag the author's phone by a few hours.
  Pure helpers so the rules are tested.
*/

const done = (sessions: Session[]) =>
  sessions.filter((s) => s.state === "done").sort((a, b) => a.takenAt.localeCompare(b.takenAt));

export type DemoProgress = {
  /** Local date of the first and last measured photos. */
  start: string | null;
  last: string | null;
  /** The verdict photo is in. */
  complete: boolean;
  hasCheckin: boolean;
};

export function demoProgress(trial: Pick<Trial, "schedule">, sessions: Session[]): DemoProgress {
  const list = done(sessions);
  const verdictDay = trial.schedule.find((i) => i.kind === "verdict")?.day;
  const checkins = list.filter((s) => s.kind === "checkin");
  return {
    start: list[0] ? todayIso(new Date(list[0].takenAt)) : null,
    last: list.at(-1) ? todayIso(new Date(list.at(-1)!.takenAt)) : null,
    complete: verdictDay !== undefined && checkins.some((s) => s.scheduledDay >= verdictDay),
    hasCheckin: checkins.length > 0,
  };
}

/**
  The date the demo timeline is drawn at: the last measured photo, so a check-in that is due but
  not published yet reads as upcoming, never as missed.
*/
export function demoToday(trial: Pick<Trial, "schedule">, sessions: Session[], fallback: string): string {
  return demoProgress(trial, sessions).last ?? fallback;
}

const fmt = (iso: string, year: boolean) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });

/** "Real trial by the author, Oct 24 to Nov 19, 2026", or while it runs, with its last measured date. */
export function demoLabelText(p: DemoProgress): string {
  if (!p.start || !p.last) return "Real trial by the author";
  if (p.complete) return `Real trial by the author, ${fmt(p.start, false)} to ${fmt(p.last, true)}`;
  return `Real trial by the author, running since ${fmt(p.start, true)}, last measured ${fmt(p.last, false)}`;
}
