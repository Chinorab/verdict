import type { ScheduleItem } from "./schemas";

/*
  Calendar file for check-in reminders (FR-011, research R10). Built on the device; nothing is
  sent anywhere. Times are floating local times, so the alert rings at the chosen hour wherever
  the phone is. RFC 5545: CRLF line endings, lines folded at 75 octets, text escaped.
*/

export const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a content line into chunks of at most 75 octets, continuation lines start with a space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let limit = 75;
  for (const ch of line) {
    if (enc.encode(current + ch).length > limit) {
      out.push(current);
      current = " " + ch;
      limit = 75;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n");
}

const compactDate = (iso: string) => iso.replace(/-/g, "");
const pad = (n: number) => String(n).padStart(2, "0");
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function buildIcs(input: {
  trialId: string;
  product: string;
  reminderHour: number;
  schedule: ScheduleItem[];
  deadline: string;
  url: string;
  now: Date;
  /** Only events on or after this date are included (YYYY-MM-DD). */
  from: string;
}): string {
  const stamp = utcStamp(input.now);
  const hour = pad(input.reminderHour);
  const events: string[][] = [];

  for (const item of input.schedule) {
    if (item.kind === "day0" || item.date < input.from) continue;
    const verdict = item.kind === "verdict";
    events.push([
      "BEGIN:VEVENT",
      `UID:${input.trialId}-day${item.day}-${item.kind}@verdict`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${compactDate(item.date)}T${hour}0000`,
      "DURATION:PT15M",
      `SUMMARY:${escapeText(verdict ? `Verdict: last photo and results, ${input.product}` : `Verdict check-in, ${input.product}`)}`,
      `DESCRIPTION:${escapeText("Take today's photo in Verdict: same room, same light, no makeup. " + input.url)}`,
      `URL:${input.url}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:PT0M",
      `DESCRIPTION:${escapeText("Time for your Verdict photo")}`,
      "END:VALARM",
      "END:VEVENT",
    ]);
  }

  events.push([
    "BEGIN:VEVENT",
    `UID:${input.trialId}-deadline@verdict`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(input.deadline)}`,
    `SUMMARY:${escapeText(`Return window closes, ${input.product}`)}`,
    `DESCRIPTION:${escapeText("Last day to return the product. Check the retailer's policy. " + input.url)}`,
    `URL:${input.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT9H", // 9 AM on the deadline day
    `DESCRIPTION:${escapeText("Return window closes today")}`,
    "END:VALARM",
    "END:VEVENT",
  ]);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Verdict//Skincare trial//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flat(),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Saves the file on the device (no server involved). */
export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
