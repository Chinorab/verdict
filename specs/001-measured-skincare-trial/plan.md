# Implementation Plan: Measured Skincare Trial

**Branch**: `001-measured-skincare-trial` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-measured-skincare-trial/spec.md`

## Summary

Verdict runs a personal trial of one skincare product: Claude reads the label's claims, the
YouCam JS Camera Kit guides each selfie, YouCam AI Skin Analysis measures it, and the app
compares unadjusted scores against a noise floor measured from two day 0 photos, to say per
claim whether the product is holding up before the return window closes. It is a Next.js
installable web app whose data lives in the browser (IndexedDB); thin server routes hold the
API keys, issue YouCam upload URLs, create and poll tasks, read labels, and enforce budget caps
with a signed cookie and the free balance endpoint, so no database is needed.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 20+ runtime on Vercel

**Primary Dependencies**: Next.js 16.4 (App Router), React 19.3, Zod 4.6, idb 8,
@anthropic-ai/sdk 0.135, YouCam JS Camera Kit v2.5 (CDN script), next/font

**Storage**: IndexedDB on the device (`verdict` database); no server storage; demo trial as a
static JSON file in `public/demo/`

**Testing**: Vitest 5 (unit), Playwright 1.64 through the playwright-cli skill (journeys on
390x844 mobile and 1440x900 desktop), upstream APIs mocked from recorded real responses

**Target Platform**: Mobile Safari 16.4+ and Chrome for Android 110+ first; desktop Chrome,
Edge, Firefox, Safari. HTTPS (Vercel)

**Project Type**: Web application (single Next.js project with route handlers), installable PWA

**Performance Goals**: Landing LCP under 2.5 s on a mid range phone over 4G; label reading
under 15 s; one analysis typically under 30 s, with a progress state and a hard stop at 2 min

**Constraints**: Face photos never stored or logged by Verdict; keys only on the server; 5
successful analyses per device per day; global spend under a straight budget line to
2026-11-20; Vercel function body 4.5 MB; YouCam 250 requests per 300 s; works at 360 px wide

**Scale/Scope**: About 15 screens (13 mockups plus quick run and demo states), tens of judges,
one real demo trial, about 1,000 YouCam units total

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Measurement Honesty | Verdicts from `raw` only; `ui` stored, never shown as evidence (data-model Measurements); noise from two day 0 photos; threshold shown on every result, including the review card and the safety notice (FR-026, FR-027); one mode per trial enforced at upload; unmeasurable claims excluded | Pass |
| II. Biometric Privacy (v1.1.0) | Face photos in IndexedDB; browser PUTs straight to YouCam's pre signed URL (R4), allowed explicitly since v1.1.0; proxy fallback streams without storing; only the label goes to Claude (`/api/claims` is the label step only); no account; erase all; privacy page rewritten from the real flows, including the 30 day vendor retention (R5) | Pass |
| III. Secrets on the Server | Keys read in route handlers only; `.env.example` without values; build scanned for keys before each deploy | Pass |
| IV. No Fabrication | Mockup sample numbers replaced by real data; landing stats only with verified links; demo trial is the author's real trial with real dates | Pass |
| V. Health Guardrail | Two level guardrail (FR-027), JAMA note (FR-028), "not medical advice" on every measurement screen, no condition names on the user's skin | Pass |
| VI. Budget Discipline (v1.1.0) | Cost read from the free price endpoint before paid calls; results stored as soon as they return; device cap, global pace line and per day ceiling from the credit history (R7); quality gate before upload | Pass (reserve value pending the measured cost) |
| VII. Design Integrity | Tokens extracted from `design/project` first; mockup privacy copy and revoke line replaced; copy lint for emoji, dashes and AI mentions; favicon from the Favicon artboard | Pass |
| Workflow gates | Calibration scripts before app code; Playwright on both viewports before deploys; paid calls mocked in tests | Pass |

Post design re check (after Phase 1 and the speckit-analyze fixes): passes against constitution v1.1.0. The direct upload deviation was resolved by the v1.1.0 amendment.

## Project Structure

### Documentation (this feature)

```text
specs/001-measured-skincare-trial/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── backup-file.md
├── checklists/requirements.md
└── tasks.md             # next: /speckit-tasks
```

### Source Code (repository root)

```text
design/project/                 # Claude Design mockups (source of truth, read only)
scripts/                        # calibration and demo data tools (Node, no deps)
├── lib/youcam.mjs
├── cost.mjs  analyze.mjs  noise.mjs
└── to-backup.mjs               # converts calibration runs to the backup format
public/
├── manifest.webmanifest  icons/  sw.js
└── demo/demo-trial.verdict.json
src/
├── app/
│   ├── layout.tsx  globals.css  tokens.css
│   ├── page.tsx                      # landing: problem, sources, start, quick run, demo
│   ├── privacy/page.tsx
│   ├── trial/new/page.tsx            # scan label, claims and purchase (steps 1 to 2)
│   ├── trial/[id]/page.tsx           # timeline
│   ├── trial/[id]/capture/page.tsx   # Camera Kit capture (day 0 and check-ins)
│   ├── trial/[id]/compare/page.tsx
│   ├── trial/[id]/verdict/page.tsx
│   ├── trial/[id]/review/page.tsx
│   ├── review/page.tsx               # shared card from URL fragment
│   ├── settings/page.tsx             # export, import, delete all
│   └── api/
│       ├── claims/route.ts
│       ├── analysis/upload/route.ts
│       ├── analysis/upload-proxy/route.ts
│       ├── analysis/task/route.ts
│       ├── analysis/task/[taskId]/route.ts
│       ├── mask/route.ts
│       └── budget/route.ts
├── components/                 # built from the mockups' tokens: Header, Cta, Segmented,
│                               # ClaimRow, Timeline, QualityStrip, CompareSlider, ResultRow,
│                               # NoiseBar, ReviewCard, SafetyNotice, SourceStat, Icon
├── lib/
│   ├── measure/                # config.ts (k, floors, raw directions), baseline.ts,
│   │                           # verdict.ts, guardrail.ts (pure, unit tested)
│   ├── schedule.ts             # trial length, check-ins, verdict date, deadline margin
│   ├── ics.ts                  # calendar file
│   ├── backup.ts               # export and import (contracts/backup-file.md)
│   ├── db.ts                   # idb wrapper with in memory fallback
│   ├── camera-kit.ts           # YMK loader and event mapping
│   ├── youcam.ts               # server only client (upload URL, task, poll, credits)
│   ├── claims.ts               # server only Claude call and Zod schema
│   ├── budget.ts               # signed cookie and budget line (server only)
│   ├── schemas.ts              # shared Zod schemas
│   └── copy.ts                 # error code to message map
tests/
├── unit/                       # vitest
├── e2e/                        # playwright journeys, mobile and desktop projects
└── fixtures/                   # recorded YouCam and Claude responses, label photo, small face photo
```

**Structure Decision**: One Next.js project. Server code lives in route handlers and
`server only` modules under `src/lib`; all trial state is client side. Pure measurement logic
sits in `src/lib/measure` so it is tested without a browser and reused by the calibration
scripts' README numbers.

## Build order (informs /speckit-tasks)

1. Calibration first (already scripted): cost, day 0 A, B, C on the author's face, noise table,
   raw score directions, units per analysis. Fixes `k`, floors, reserve and budget line.
2. Foundation: Next.js scaffold, tokens from the mockups, fonts, icons, favicon, manifest,
   service worker, db wrapper, schemas, copy lint.
3. P1 slice: label to claims (US1), Camera Kit capture and day 0 (US2), check-in (US3),
   verdict (US4), privacy and erase (US9), quick run (US10), budget caps.
4. P2: compare (US5), review card (US6), guardrail and JAMA note (US7), demo trial (US8),
   backup export and import, calendar file.
5. Landing with verified sources, README, DEVPOST.md, video script, screenshots, deploy.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Reminders by calendar alerts instead of push notifications | Scheduled web push needs a stored subscription and a cron, i.e. server side personal data | Push without storage cannot fire at a scheduled time; the brief allows either option |
