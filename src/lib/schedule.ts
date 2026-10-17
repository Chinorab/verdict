import type { ScheduleItem } from "./schemas";

/*
  Trial planning (FR-007 to FR-012). Pure functions on ISO dates (YYYY-MM-DD) computed in UTC,
  so a plan never shifts with the device's time zone.
*/

const DAY = 86_400_000;

export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export const todayIso = (now = new Date()) =>
  // The user's local calendar day, expressed as YYYY-MM-DD.
  new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** FR-012: at least 2 days before the deadline for windows up to 14 days, 4 days beyond. */
export const verdictMargin = (returnDays: number) => (returnDays <= 14 ? 2 : 4);

/** FR-008: trial length from the shortest promised timeframe of the measurable claims. */
export function desiredLength(timeframes: (number | null)[]): 14 | 28 | 56 {
  const stated = timeframes.filter((t): t is number => typeof t === "number" && t > 0);
  if (stated.length === 0) return 28;
  const shortest = Math.min(...stated);
  if (shortest <= 14) return 14;
  if (shortest <= 28) return 28;
  return 56;
}

/** FR-009 check-in days for each full length. */
const CHECKIN_DAYS: Record<14 | 28 | 56, number[]> = {
  14: [0, 7, 14],
  28: [0, 7, 14, 21, 28],
  56: [0, 14, 28, 42, 56],
};

/** Days shorter than this cannot show a meaningful change, so the plan is flagged too late. */
export const MIN_USEFUL_DAYS = 7;

export type TrialPlan = {
  deadline: string;
  marginDays: number;
  trialDays: number;
  verdictDate: string;
  schedule: ScheduleItem[];
  timeframeWarning: boolean;
  tooLate: boolean;
};

export function planTrial(input: {
  start: string; // day 0
  purchaseDate: string;
  returnDays: number;
  claimTimeframes: (number | null)[]; // measurable claims only
  /** Optional cap chosen by the user (for example a 14 day test). The timeframe warning still applies. */
  maxDays?: number;
}): TrialPlan {
  const deadline = addDays(input.purchaseDate, input.returnDays);
  const marginDays = verdictMargin(input.returnDays);
  const natural = desiredLength(input.claimTimeframes);
  const desired = (input.maxDays && input.maxDays < natural ? ([14, 28, 56] as const).find((d) => d >= input.maxDays!) ?? 14 : natural) as 14 | 28 | 56;
  const cap = input.maxDays && input.maxDays > 0 ? input.maxDays : Infinity;
  const available = daysBetween(input.start, addDays(deadline, -marginDays));

  const tooLate = available < MIN_USEFUL_DAYS;
  // Too late: still offer a trial (spec edge case), at the shortest useful length, with no Keep or Return.
  const trialDays = tooLate ? 14 : Math.min(desired, available, cap);

  const fullDays = CHECKIN_DAYS[tooLate ? 14 : desired];
  const kept = fullDays.filter((d) => d < trialDays);
  const days = [...kept, trialDays];

  const schedule: ScheduleItem[] = days.map((day, i) => ({
    day,
    date: addDays(input.start, day),
    kind: i === 0 ? "day0" : i === days.length - 1 ? "verdict" : "checkin",
  }));

  const stated = input.claimTimeframes.filter((t): t is number => typeof t === "number" && t > 0);
  const timeframeWarning = stated.length > 0 && Math.min(...stated) > trialDays;

  return {
    deadline,
    marginDays,
    trialDays,
    verdictDate: addDays(input.start, trialDays),
    schedule,
    timeframeWarning,
    tooLate,
  };
}

/** Quick run (FR-035b): day 0, then the check-in and verdict straight away. */
export function quickPlan(input: { start: string; purchaseDate: string; returnDays: number }): TrialPlan {
  return {
    deadline: addDays(input.purchaseDate, input.returnDays),
    marginDays: verdictMargin(input.returnDays),
    trialDays: 0,
    verdictDate: input.start,
    schedule: [
      { day: 0, date: input.start, kind: "day0" },
      { day: 0, date: input.start, kind: "verdict" },
    ],
    timeframeWarning: false,
    tooLate: false,
  };
}
