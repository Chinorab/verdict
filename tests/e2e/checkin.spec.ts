import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedTrial, verdictSeed } from "./seed";

/*
  US3 journey (quickstart 14): the timeline shows what is due, late and done; reminders come
  from a calendar file built on the device. Taking the check-in photo itself waits for the
  capture screen (tasks T044, T046).
*/

// verdictSeed: day 0 on Oct 12 (both photos done), check-in on Nov 7 for day 26, deadline Nov 11.
// Here only day 0 is kept and a weekly schedule is used.
function timelineSeed() {
  const seed = verdictSeed({});
  seed.sessions = seed.sessions.filter((s) => s.kind !== "checkin");
  seed.trial.schedule = [
    { day: 0, date: "2026-10-12", kind: "day0" },
    { day: 7, date: "2026-10-19", kind: "checkin" },
    { day: 14, date: "2026-10-26", kind: "checkin" },
    { day: 21, date: "2026-11-02", kind: "checkin" },
    { day: 26, date: "2026-11-07", kind: "verdict" },
  ];
  return seed;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-26T12:00:00"));
  await page.goto("/");
  await seedTrial(page, timelineSeed());
  await page.goto("/trial/seed-trial");
});

test("shows the countdown, the done baseline, a missed week, today's check-in and the deadline", async ({ page }) => {
  await expect(page.getByText("16", { exact: true })).toBeVisible();
  await expect(page.getByText(/Return by\s*Wed, Nov 11/)).toBeVisible();
  await expect(page.getByText("Noise floor set")).toBeVisible();
  // Oct 19 was missed and stays missed; today's check-in (Oct 26) is the one to take.
  await expect(page.getByText("Check-in, missed", { exact: true })).toBeVisible();
  await expect(page.getByText("Check-in, due today")).toBeVisible();
  const cta = page.getByRole("link", { name: "Take today’s photo" });
  await expect(cta).toHaveAttribute("href", "/trial/seed-trial/capture?day=14");
  await expect(page.getByText("Return window closes")).toBeVisible();
  await expect(page.getByText("Indicative results, not medical advice.")).toBeVisible();
});

test("calendar file holds the remaining check-ins at the reminder hour and the deadline", async ({ page }) => {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("verdict-test-serum.ics");
  const ics = readFileSync(await file.path(), "utf8");
  expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(ics).toContain("DTSTART:20261026T200000");
  expect(ics).toContain("DTSTART:20261102T200000");
  expect(ics).toContain("DTSTART:20261107T200000");
  expect(ics).not.toContain("DTSTART:20261019T200000"); // before today
  expect(ics).toContain("DTSTART;VALUE=DATE:20261111");
  expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(4);
});

test("changing the reminder hour is saved and used by the calendar file", async ({ page }) => {
  await page.getByLabel("Hour").selectOption("8");
  await page.reload();
  await expect(page.getByLabel("Hour")).toHaveValue("8");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const ics = readFileSync(await (await download).path(), "utf8");
  expect(ics).toContain("DTSTART:20261102T080000");
});
