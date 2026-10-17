import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "@/lib/ics";

const input = {
  trialId: "t-1",
  product: "Test Serum, 30 ml",
  reminderHour: 20,
  schedule: [
    { day: 0, date: "2026-10-12", kind: "day0" as const },
    { day: 7, date: "2026-10-19", kind: "checkin" as const },
    { day: 14, date: "2026-10-26", kind: "checkin" as const },
    { day: 26, date: "2026-11-07", kind: "verdict" as const },
  ],
  deadline: "2026-11-11",
  url: "https://verdict.example/trial/t-1",
  now: new Date("2026-10-12T21:00:00Z"),
  from: "2026-10-12",
};

describe("buildIcs", () => {
  const ics = buildIcs(input);
  const lines = ics.split("\r\n");

  it("is a valid calendar envelope with CRLF line endings", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("has one event per check-in and verdict at the reminder hour, plus the deadline", () => {
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(4);
    expect(lines).toContain("DTSTART:20261019T200000");
    expect(lines).toContain("DTSTART:20261026T200000");
    expect(lines).toContain("DTSTART:20261107T200000");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261111");
  });

  it("skips day 0 and dates before the export day", () => {
    expect(lines).not.toContain("DTSTART:20261012T200000");
    const later = buildIcs({ ...input, from: "2026-10-20" }).split("\r\n");
    expect(later).not.toContain("DTSTART:20261019T200000");
    expect(later).toContain("DTSTART:20261026T200000");
  });

  it("every event carries an alert and a stable unique id", () => {
    expect(lines.filter((l) => l === "BEGIN:VALARM")).toHaveLength(4);
    const uids = lines.filter((l) => l.startsWith("UID:"));
    expect(new Set(uids).size).toBe(4);
    expect(buildIcs(input).split("\r\n").filter((l) => l.startsWith("UID:"))).toEqual(uids);
  });

  it("escapes commas in text", () => {
    expect(ics).toContain("Test Serum\\, 30 ml");
  });

  it("keeps every physical line within 75 octets", () => {
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});

describe("helpers", () => {
  it("escapes backslash, semicolon, comma and newline", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("folds long lines with a leading space", () => {
    const folded = foldLine("DESCRIPTION:" + "x".repeat(200));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe("DESCRIPTION:" + "x".repeat(200));
  });
});
