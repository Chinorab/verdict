# Quickstart and Validation: Measured Skincare Trial

## Prerequisites

- Node 20 or later, npm.
- `.env.local` at the repo root (never committed):
  - `YOUCAM_API_KEY`, `ANTHROPIC_API_KEY`
  - `VERDICT_COOKIE_SECRET` (32 random bytes, hex)
  - `BUDGET_LAUNCH_BALANCE`, `BUDGET_RESERVE`, `BUDGET_DAILY_MAX`, `BUDGET_END=2026-11-20T16:45:00Z`
- A phone on the same network for camera tests (camera needs HTTPS outside localhost; use the
  Vercel preview URL for phone tests).

## Run

```
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests (measurement, schedule, budget, backup)
npm run e2e          # Playwright journeys, mobile and desktop, upstream APIs mocked
```

## Validation scenarios

| # | Scenario | Expected | Spec |
|---|---|---|---|
| 1 | Scan a real label (or `tests/fixtures/label-serum.jpg`) | Claims listed, unmeasurable claim marked, main claim preselected | US1, FR-002 to FR-004 |
| 2 | Purchase Oct 12, 30 day window | Deadline Nov 11, verdict date Nov 7 | FR-007, FR-012 |
| 3 | Day 0 on a phone | Two analyses stored, noise and threshold per concern, mode locked | US2, FR-014, FR-015 |
| 4 | Upload a photo with a small face (fixture) | Message "Move closer..." and retake, no unit spent | FR-016 |
| 5 | Quick run from landing | Verdict reached in one sitting, "Same day test" on every screen, 3 analyses used | FR-035b, SC-006 |
| 6 | Recorded data where every change is inside the threshold | Every claim "No measurable change"; suggestion Return | FR-022, FR-024, SC-004 |
| 7 | Recorded data with redness worse twice | Notice at first check-in, "Consider pausing" at the second | FR-027 |
| 8 | Online purchase with "clears eczema in 7 days" | JAMA note with link during setup | FR-028 |
| 9 | Compare screen | Slider works by touch and keyboard, overlay per concern, numbers match verdict | FR-025 |
| 10 | Review card | No face by default; toggle adds it; saved PNG matches the card | FR-026 |
| 11 | Export with and without photos, import on another browser | Same verdict after import; mixed mode file refused | FR-033b |
| 12 | Delete all trial data | Database and caches empty, first run screen | FR-032, SC-008 |
| 13 | Sixth analysis in a day | `cap_device` message with resume time | FR-034 |
| 14 | Calendar file | Opens in a phone calendar with alerts at the chosen hour and the deadline | FR-011 |
| 15 | Demo trial | Read only, labelled with real dates, no budget used | FR-035 |

## Before every deployment

1. `npm test` and `npm run e2e` green on both viewports.
2. `node scripts/cost.mjs` to confirm the balance is above the budget line.
3. Search the build for secrets: no key values in `.next/static`.
4. Copy check: no emoji, no dashes used as punctuation, no AI mentions in user facing text
   (scripted grep in `npm run lint:copy`).
