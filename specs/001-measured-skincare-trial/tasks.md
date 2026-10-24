---
description: "Task list for the Measured Skincare Trial (Verdict)"
---

# Tasks: Measured Skincare Trial

**Input**: Design documents from `/specs/001-measured-skincare-trial/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md,
contracts/backup-file.md, quickstart.md

**Tests**: Requested. The constitution requires Playwright journeys on mobile and desktop
before every deployment, and SC-004 requires automated tests of the threshold rule. Paid APIs
are always mocked in tests (fixtures recorded from real calibration responses).

**Organization**: Grouped by user story (US1 to US10 from spec.md) so each can be built and
checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to
- Paths are relative to the repository root (`D:/claude/verdict`)

---

## Phase 1: Setup and Calibration

**Purpose**: Real API numbers first, then the project skeleton.

- [X] T001 Run `node scripts/cost.mjs`, record spendable units and the skin analysis price list in PROGRESS.md (free call; requires the author's `.env.local`) (2026-10-22: 1040 units; HD 12/16/20/22, SD 9/12/14/16 per analysis by concern count)
- [X] T002 Dry run then `--confirm` run of `node scripts/analyze.mjs --label day0 --mode hd` on the author's photos A, B, C in scripts/photos/ (day 0 of the demo trial); record units spent from scripts/out/ledger.jsonl PARTIAL 2026-10-22: run on SYNTHETIC test faces only (60 units, balance 980); real day 0 still pending (2026-10-24: superseded by the author's real day 0 in the app on an iPhone, two HD analyses, 24 units; the synthetic run of 2026-10-22 covered the script path)
- [X] T003 Run `node scripts/noise.mjs` for A vs B and A vs B vs C; save the tables to scripts/out/day0/noise.md and draft the "What we learned from the API" notes in docs/api-notes.md (synthetic: noise.mjs fixed for regions; tables in README "What we learned")
- [X] T004 Decide per concern raw score direction, noise factor k and floors from T003 (compare raw vs ui ordering per concern) and write them with a comment per value in src/lib/measure/config.ts (directions measured; k = 1.5 and 1 point floors are labelled design defaults, recalibrate on real photos)
- [X] T005 Compute the budget line inputs (launch balance, reserve for the author's remaining demo check-ins, end 2026-11-20T16:45Z) from T001 and T002 plus a per day ceiling BUDGET_DAILY_MAX (about 1.5 times the line's daily slope) and write them to .env.example names plus PROGRESS.md values (.env.local: unit cost 20, launch 980, reserve 100, daily max 180, start Oct 23; pace line given a day of head start after a live test)
- [X] T006 Check from a browser page on localhost whether the YouCam pre signed upload URL accepts a PUT (CORS) and whether mask URLs can be fetched (CORS); record the outcome in specs/001-measured-skincare-trial/research.md R4 (2026-10-24: no CORS block. The author's real day 0 uploaded straight from the iPhone browser to the pre signed URL, and the six detection masks downloaded to the phone)
- [X] T007 Write scripts/to-backup.mjs converting scripts/out/<label>/*.json into the backup format of contracts/backup-file.md (no face photos, masks optional) (also reads trial-setup.json with an optional maxTrialDays; output validated by the app parser; analyze.mjs now records image size)
- [X] T008 Scaffold Next.js 16.4 App Router with TypeScript strict and npm in the repo root (package.json, tsconfig.json, next.config.ts, src/app), keeping scripts/, design/, specs/, .specify/ untouched
- [X] T009 [P] Add dependencies zod@4, idb@8, @anthropic-ai/sdk and dev dependencies vitest@5, @playwright/test@1.64 in package.json; add scripts `dev`, `build`, `test`, `e2e`, `lint`, `lint:copy`
- [X] T010 [P] Configure ESLint (next config) and a `lint:copy` script in scripts/lint-copy.mjs that fails on emoji, dashes used as punctuation (" - ", en and em dashes) words "AI", "GPT", "Claude" (except the privacy page naming Anthropic), and the terms "checkpoint" and "check in" (use "check-in") in user facing strings under src/app and src/components
- [X] T011 [P] Configure Vitest in vitest.config.ts (node environment for src/lib) and Playwright in playwright.config.ts with projects `mobile` (390x844, touch) and `desktop` (1440x900)
- [X] T012 Build a throwaway probe page src/app/probe/kit/page.tsx loading the Camera Kit (skincare, strict, videoQuality 1080p) that prints images[0].width and height; deploy it to a Vercel preview, open it on the author's phone with the default container and with width and height 1080 x 1920, record the sizes in research.md R2, choose HD or SD for all trials, then delete the page (analyze H1) (2026-10-23: iPhone capture 1080 x 1788 JPEG in the default container, HD for all trials; strict never auto captured with lighting "ok", YMK.capture() works; probe deleted)
- [X] T013 [P] Add LICENSE (MIT, 2026, author) and README.md skeleton with the section headings required by the constitution

---

## Phase 2: Foundational (blocks every story)

**Purpose**: Design tokens, shared types, storage, server clients, budget, app shell.

- [X] T014 Extract design tokens from design/project/*.dc.html into src/app/tokens.css (colors #F3F4F1 paper, #141716 ink, #2B45C4 and #7C93FF blue, #B4460E deadline, #F2A766 warning on dark, greys #4D5450 #5F6662 #6B716D #9DA39F #B9BEB9 #D3D7D2 #E7E9E5, dark capture #111413 #2E3331 #A9AFAB #C9CECA, square corners, 44px targets, spacing, motion curves cubic-bezier(.16,1,.3,1), reduced motion rules)
- [X] T015 Set up fonts Hanken Grotesk (300 to 600) and JetBrains Mono (400, 500) with next/font in src/app/layout.tsx, `.num` tabular style in src/app/globals.css, body background and colors from tokens
- [X] T016 [P] Create src/components/Icon.tsx with the stroke icons used in the mockups (arrow, back, close, check, lock, info, clock, bell, camera, upload, compare, light, framing, angle, no makeup, room, hour, not measurable) as inline SVG, aria-hidden by default (done with Phosphor light icons in src/components/Icon.tsx, per the design-taste rule against hand drawn icons)
- [X] T017 [P] Create favicon and app icons from design/project/Favicon.dc.html (V on a rule, ink on paper and paper on ink) in src/app/icon.svg, public/icons/icon-192.png, public/icons/icon-512.png, public/icons/maskable-512.png (generated by scripts/tools/make-icons.mjs; apple-icon.png added)
- [X] T018 [P] Create public/manifest.webmanifest (name Verdict, standalone, theme #141716, background #F3F4F1) and link it in src/app/layout.tsx (served from src/app/manifest.ts, the Next.js 16 metadata convention, instead of a static file)
- [X] T019 [P] Create shared primitives from the mockups in src/components/: Header.tsx (back, title, step counter), Cta.tsx (square dark 56px button or link with arrow), Segmented.tsx, Field.tsx (label plus input), Disclaimer.tsx ("Indicative results, not medical advice." with info icon), SameDayBadge.tsx (all primitives live in src/components/ui.tsx with ui.module.css; mark in Mark.tsx)
- [X] T020 Define shared Zod schemas and types (Concern, Mode, Direction, Trial, Claim, Session, Measurement, Photo, backup file) in src/lib/schemas.ts per data-model.md
- [X] T021 Implement IndexedDB access in src/lib/db.ts with stores trials, claims, sessions, measurements, photos, settings, every call in try/catch, and an in memory fallback that sets settings.storageAvailable false
- [X] T022 [P] Implement the server only YouCam client in src/lib/youcam.ts (credits, featureCost, createUpload, createTask, getTask with 429 backoff, action mapping per mode) reading YOUCAM_API_KEY from process.env
- [X] T023 [P] Implement src/lib/budget.ts: HMAC signed `vd` cookie (device id, UTC day, analyses, labels) with VERDICT_COOKIE_SECRET, device caps (5 analyses, 10 labels), global pace line from the cached balance (60 s) with BUDGET_LAUNCH_BALANCE, BUDGET_RESERVE, BUDGET_END, and the per day ceiling BUDGET_DAILY_MAX checked against today's debits from /s2s/v1.0/client/credit/history (pure rules in src/lib/budget-core.ts, cookie and YouCam wiring in src/lib/budget.ts; BUDGET_UNIT_COST and BUDGET_START added)
- [X] T024 [P] Write the error code to message map in src/lib/copy.ts (YouCam capture codes, caps with resume time, network, storage unavailable), plain English, no dashes
- [X] T025 Implement GET /api/budget in src/app/api/budget/route.ts per contracts/api.md
- [X] T026 [P] Unit tests for budget line and cookie signing in tests/unit/budget.test.ts
- [X] T027 [P] Write public/sw.js (cache the app shell and fonts, never cache /api or blobs) and register it from src/components/SwRegister.tsx
- [ ] T028 Record mocked upstream fixtures from T002 output into tests/fixtures/youcam/ (task success HD, error_src_face_too_small, running) and a Claude claims response into tests/fixtures/claims/serum.json; add Playwright route mocks in tests/e2e/mocks.ts PARTIAL 2026-10-22: task-success-hd.json recorded (synthetic, numbers only); error fixture still to record from a real rejected photo

**Checkpoint**: tokens, storage, server clients and caps ready.

---

## Phase 3: User Story 1, set up a trial from the label (P1) MVP

**Goal**: Label photo to claims with mapping, purchase details, deadline and verdict date.

**Independent Test**: Scan or type claims, fill purchase, see correct deadline and verdict date (quickstart 1, 2, 8).

- [X] T029 [P] [US1] Unit tests for trial length, check-in schedule, deadline margin and timeframe warning in tests/unit/schedule.test.ts (14, 30, 60, 90 day windows, 8 week claim with 30 day window, window under 7 days)
- [X] T030 [P] [US1] Implement src/lib/schedule.ts (trialDays, schedule, verdictDate, deadline, warnings) per FR-008 to FR-012
- [X] T031 [P] [US1] Write the claim extraction schema and system prompt in src/lib/claims.ts (claude-sonnet-5-5, messages.parse with zodOutputFormat, effort medium, refusal handling and server side fallback, strict mapping rules, health terms, fast promise) (beta parse with betaZodOutputFormat, fallbacks "default" + server-side-fallback-2026-07-01; typechecked, not yet run against the real API)
- [X] T032 [US1] Implement POST /api/claims in src/app/api/claims/route.ts (multipart image, size check, label cap, 422 no_claims) per contracts/api.md
- [ ] T033 [US1] Evaluate claim extraction on at least 10 real label photos in tests/fixtures/labels/ (author supplied or photographed in store, no faces): run /api/claims on each, compare with the printed claims by hand, record per claim accuracy and failure patterns in docs/api-notes.md, adjust the prompt in src/lib/claims.ts until SC-002 (90%) holds WAITING: needs ANTHROPIC_API_KEY and 10 label photos NOT DONE before submission: label reading verified on one real label only (the author's product, two claims read, both correctly left out with reasons)
- [X] T034 [US1] Build the scan step from design/project/Scan.dc.html in src/app/trial/new/ScanStep.tsx (camera input with capture, upload, "Type them" link, on device resize to 1568 px JPEG, reading state, retry)
- [X] T035 [US1] Build the claims and purchase step from design/project/Claims.dc.html in src/app/trial/new/ClaimsStep.tsx (claim list with mapping, edit, add, remove, main claim choice, not measurable rows, price, date, retailer, online toggle, return window segmented 14 30 60 90 plus custom, live deadline and verdict sentence, timeframe warning, policy note)
- [X] T036 [US1] Show the JAMA informational note component src/components/SourcedNote.tsx in ClaimsStep when FR-028 conditions hold (link to the JAMA Network Open digest source) (wording verified 2026-10-17 against the Dermatology Times digest of Abilov et al., JAMA Network Open: 6 of 18 products held undeclared clobetasol; recorded in src/lib/sources.ts)
- [X] T037 [US1] Wire src/app/trial/new/page.tsx to save trial, claims and schedule to IndexedDB and route to capture; delete the label photo after confirmation (flow in src/app/trial/new/NewTrial.tsx; the label photo is never stored, it only lives in memory)
- [ ] T038 [US1] Playwright journey "new trial" in tests/e2e/new-trial.spec.ts (mocked claims, edit a claim, deadline Nov 11 and verdict Nov 7 for Oct 12 plus 30, JAMA note case) PARTIAL 2026-10-17: typed path, JAMA note and validation pass on mobile and desktop (6/6); scanned path skipped until a recorded reading exists

**Checkpoint**: a trial exists with claims and a dated plan.

---

## Phase 4: User Story 2, day 0 baseline (P1)

**Goal**: Two guided captures, analyzed, noise and threshold per concern, mode locked.

**Independent Test**: Day 0 on a phone stores two analyses and shows noise and thresholds (quickstart 3, 4).

- [X] T039 [P] [US2] Unit tests for baseline, noise, threshold floor and mode lock in tests/unit/baseline.test.ts
- [X] T040 [P] [US2] Implement src/lib/measure/baseline.ts (mean, noise, threshold = max(k x noise, floor)) (k, floors and raw score directions live in src/lib/measure/config.ts as null until calibration; code refuses to guess)
- [X] T041 [P] [US2] Implement POST /api/analysis/upload in src/app/api/analysis/upload/route.ts (mode and size checks, caps, YouCam upload URL)
- [X] T042 [P] [US2] Implement POST /api/analysis/task and GET /api/analysis/task/[taskId] in src/app/api/analysis/task/route.ts and src/app/api/analysis/task/[taskId]/route.ts (create, poll once per call, return raw, ui, mask URLs, give back the device slot on error) (returns a device bound task token; one time refund on error; smoke tested without keys: validation 400s and fail closed 503s)
- [X] T043 [US2] If T006 found CORS blocks: implement src/app/api/analysis/upload-proxy/route.ts and src/app/api/mask/route.ts per contracts/api.md (stream only, YouCam hosts only) (2026-10-24: not needed, T006 found no CORS block)
- [X] T044 [US2] Implement the Camera Kit loader in src/lib/camera-kit.ts (YMKAsyncInit, script injection once, init skincare strict 1080p blob, faceQualityChanged mapping to Light, Framing, Angle states, faceDetectionCaptured, cameraFailed and unsupportedResolution fallbacks, close on unmount; manual capture through YMK.capture() offered when face, position and angle are good but lighting stays "ok", per research R2 finding) (2026-10-23: src/lib/camera-kit.ts, 11 unit tests; container sized by the screen, never wider than tall)
- [X] T045 [US2] Implement the analysis client flow in src/lib/analyze-client.ts (upload, PUT or proxy, task, poll every 4 s up to 30, store measurements and mask PNGs in IndexedDB at once, map errors with src/lib/copy.ts, reuse stored result by taskId) (also requests redness and acne on every analysis for the guardrail; masks fetched directly, proxy decided by T006)
- [X] T046 [US2] Build the capture screen from design/project/Capture.dc.html in src/app/trial/[id]/capture/page.tsx and src/components/QualityStrip.tsx (dark layout, three live indicators, #YMK-module mount, condition reminders, day 0 copy about the noise floor, photo counter, upload fallback, analyzing state) (2026-10-23: dark screen per mockup; shutter right under the camera so it stays on a 645 px Safari viewport; analyzing steps, errors with retake, retry or lighter check, budget cap before photos, resume of an unfinished analysis)
- [X] T047 [US2] Lock trial.mode after photo A, refuse a later image below the mode minimum, compute the baseline after photo B and set status active in src/lib/trial-actions.ts (pure captureMode in src/lib/measure/baseline.ts with tests; addCapture and finishDay0 in src/lib/trial-actions.ts)
- [ ] T048 [US2] Playwright journey "day 0" in tests/e2e/day0.spec.ts (Camera Kit stubbed by a test double of window.YMK, mocked analyses, small face error then retake, baseline set) PARTIAL 2026-10-23: tests/e2e/day0.spec.ts with a YMK test double (two photos, manual and automatic capture, HD lock, baseline set, check-in, cap, refused camera) 8/8 on mobile and desktop; the small face retake case waits for a recorded error fixture (T028)

**Checkpoint**: a trial has a measured noise floor.

---

## Phase 5: User Story 3, check-in on schedule (P1)

**Goal**: Timeline with due check-in, late check-ins, calendar file.

**Independent Test**: With a baseline, take a check-in and see it on the timeline (quickstart 14).

- [X] T049 [P] [US3] Unit tests for the calendar file in tests/unit/ics.test.ts (events at reminder hour, VALARM, deadline event, line folding) (8 tests: envelope, CRLF, folding at 75 octets, escaping, stable UIDs, alarms)
- [X] T050 [P] [US3] Implement src/lib/ics.ts
- [X] T051 [US3] Build the timeline from design/project/Timeline.dc.html in src/app/trial/[id]/page.tsx and src/components/Timeline.tsx (days left countdown, amount at stake, progress rule, check-in list with done, due, late, upcoming, verdict and deadline rows, take photo CTA, reminder hour with change and "Add to calendar"; replace the mockup line "Light matched within 3%" with real data only, such as the time gap to the day 0 hour, or drop it) (rules in src/lib/timeline.ts with 9 tests; one photo per day: the CTA targets the most recent due check-in, older missed ones stay missed)
- [X] T052 [US3] Reuse the capture screen for check-ins (one photo, conditions reminder with day 0 hour) in src/app/trial/[id]/capture/page.tsx (2026-10-23: same screen, one photo, scheduledDay from ?day=N, reminder "Near <day 0 hour>", verdict photo leads to the verdict) the timeline already links to /trial/{id}/capture?day=N
- [X] T053 [US3] Playwright journey "check-in" in tests/e2e/checkin.spec.ts (seeded trial, due check-in, late check-in date recorded, calendar download) (timeline states, calendar download contents and reminder hour persistence pass on mobile and desktop; the photo step itself is covered with T048 once capture exists)

---

## Phase 6: User Story 4, verdict per claim and Keep or Return (P1)

**Goal**: Per claim status with change and threshold, main claim suggestion, user decision.

**Independent Test**: Recorded data gives the right statuses, numbers and suggestion (quickstart 6).

- [X] T054 [P] [US4] Unit tests for verdict and suggestion in tests/unit/verdict.test.ts (inside threshold gives no change, both directions, multi concern claims, main claim rule, after deadline gives none; SC-004 property test over random data) (15 tests incl. a 5,000 case property test for SC-004)
- [X] T055 [P] [US4] Implement src/lib/measure/verdict.ts (change, toward sign from config directions, statuses, suggestion)
- [X] T056 [US4] Build the verdict screen from design/project/Verdict.dc.html and DesktopVerdict.dc.html in src/app/trial/[id]/verdict/page.tsx with src/components/ResultRow.tsx and src/components/NoiseBar.tsx (headline Return it or Keep it, main claim sentence, refund at stake, days left, Return and Keep buttons recording decision, method line, not measured claims, disclaimer; the conditions line shows only real values such as the session count and hours, never the mockup's "light matched within 3%, angle within 2°") (loads via src/lib/trial-data.ts; refuses to show results while src/lib/measure/config.ts is uncalibrated; claims now carry a label position)
- [ ] T057 [US4] Playwright journey "verdict" in tests/e2e/verdict.spec.ts (seeded measurements for keep and return cases, numbers visible, decision saved) PARTIAL 2026-10-17: uncalibrated state passes on both viewports; Keep and Return cases pass when a config exists (checked once with a temporary local config, reverted) and are skipped until calibration

---

## Phase 7: User Story 9, privacy and control of data (P1)

**Goal**: Accurate privacy page, no account, delete everything.

**Independent Test**: Delete all leaves no data; privacy text matches flows (quickstart 12).

- [X] T058 [US9] Write the privacy page from design/project/Privacy.dc.html layout in src/app/privacy/page.tsx with rewritten copy: on device storage, direct upload to YouCam, YouCam retention (30 days uploads and task ids, results described as 24 h, both linked), label to Anthropic only, cookie contents, no account, no selling or training, the Camera Kit script loaded from YouCam's CDN that reads the camera feed on the device, contact and operator fields filled by the author (contact: GitHub issues on Chinorab/verdict, author email not published; the "never receives the photo" line assumes direct upload works, recheck after T006)
- [X] T059 [US9] Implement erase all in src/lib/erase.ts (delete database, caches, local storage keys, reload) and the confirmation UI in src/app/settings/page.tsx (src/lib/erase.ts + DeleteAll dialog on /privacy and /settings; full reload then a confirmation on home)
- [X] T060 [US9] Show a storage unavailable warning banner from settings.storageAvailable in src/components/StorageWarning.tsx (probeStorage writes once; banner in the root layout)
- [X] T061 [US9] Playwright journey "erase" in tests/e2e/erase.spec.ts (seed data, delete, IndexedDB empty, first run screen), a privacy page content check, and an assertion that no page or route asks for an account or login (FR-031) (10/10 on mobile and desktop, includes the blocked storage case and the mockup copy that must not return)

---

## Phase 8: User Story 10, judge quick run (P1)

**Goal**: Day 0 then an immediate check-in and a verdict, labelled Same day test.

**Independent Test**: Fresh browser reaches a verdict in one sitting (quickstart 5).

- [X] T062 [US10] Add trial.kind quick to src/lib/trial-actions.ts (schedule day 0 and day 0 check-in, skip waiting, verdict right after) and the SameDayBadge on timeline, capture, verdict and review
- [X] T063 [US10] Add the quick run entry and the budget pre check (GET /api/budget) in src/app/trial/new/page.tsx with a clear message when caps are reached
- [ ] T064 [US10] Playwright journey "quick run" in tests/e2e/quick-run.spec.ts (three mocked analyses, badge on every screen, sixth analysis cap message) PARTIAL 2026-10-17: quick run entry, badge, saved schedule and both cap messages pass (6/6); the photo steps join with T046; 2026-10-24: full photo path proven live (T089 note)

**Checkpoint**: MVP complete (US1, US2, US3, US4, US9, US10). Deploy a preview.

---

## Phase 9: User Story 5, compare with overlays (P2)

**Goal**: Slider between day 0 and any check-in, per concern masks and numbers.

**Independent Test**: quickstart 9.

- [X] T065 [US5] Build src/components/CompareSlider.tsx (two layers clipped by an input range, keyboard and touch, labels with dates) and the mask overlay layer per concern
- [X] T066 [US5] Build the compare screen from design/project/Compare.dc.html in src/app/trial/[id]/compare/page.tsx (concern tabs, overlay toggle, day 0, latest, change, noise; masks on a neutral background when photos are absent, as in the demo; no "light matched" or "angle" claims unless computed)
- [X] T067 [US5] Playwright journey "compare" in tests/e2e/compare.spec.ts (slider by keyboard, overlay toggle, numbers equal the verdict) (synthetic flat color test images, never faces)

---

## Phase 10: User Story 6, share a measured review (P2)

**Goal**: Card from measurements only, face off by default, save and share.

**Independent Test**: quickstart 10.

- [X] T068 [P] [US6] Implement src/lib/review-card.ts (SVG from verdict data with status, change and threshold on every claim row per FR-026, rasterize to PNG, URL fragment encode and decode)
- [X] T069 [US6] Build the review screen from design/project/Review.dc.html in src/app/trial/[id]/review/page.tsx (face photos toggle off by default, price toggle, copy link, save image, Web Share; each row shows status, change and threshold; remove the revoke line)
- [X] T070 [US6] Build the shared card page src/app/review/page.tsx reading the fragment on the client only
- [ ] T071 [US6] Playwright journey "review card" in tests/e2e/review.spec.ts (no face by default, toggle, link round trip) PARTIAL: shared link and damaged link pass; in trial cases pass with a temporary config and are skipped until calibration

---

## Phase 11: User Story 7, health guardrail (P2)

**Goal**: Notice then escalation for redness or acne; JAMA note (done in T036).

**Independent Test**: quickstart 7, 8.

- [X] T072 [P] [US7] Unit tests for guardrail levels in tests/unit/guardrail.test.ts (8 tests incl. the mockup case 3 and 3, then 6, then 9)
- [X] T073 [P] [US7] Implement src/lib/measure/guardrail.ts
- [X] T074 [US7] Build src/components/SafetyNotice.tsx from design/project/Safety.dc.html (level 1 notice, level 2 "Consider pausing this product", the readings involved with the threshold they crossed, pause, find a dermatologist link, keep measuring, deadline unchanged line) and show it first on timeline and verdict (no face region claimed, scores are whole face; Keep measuring collapses it to one line for that reading; pause and resume on the timeline; also first on the verdict screen)
- [ ] T075 [US7] Playwright journey "guardrail" in tests/e2e/guardrail.spec.ts PARTIAL 2026-10-17: 4 cases pass on mobile and desktop with a temporary local config (reverted); skipped until calibration

---

## Phase 12: User Story 8, author's demo trial (P2)

**Goal**: Read only real trial with real dates, no photos, no budget used.

**Independent Test**: quickstart 15.

- [X] T076 [US8] Implement export and import in src/lib/backup.ts per contracts/backup-file.md with unit tests in tests/unit/backup.test.ts (with and without photos, mixed mode refused, new id on import)
- [X] T077 [US8] Add export, import and "include photos" controls to src/app/settings/page.tsx and an export link on the verdict screen
- [X] T078 [US8] Load public/demo/demo-trial.verdict.json read only from src/lib/demo.ts with a "Real trial by the author, Oct 18 to Nov 1, 2026" label (dates from the data) on every demo screen (/demo entry; demo is read only on timeline, verdict and compare)
- [ ] T079 [US8] Take the author's day 7 and day 14 check-ins in the deployed app on the same phone and setup as day 0, export without photos, convert and commit public/demo/demo-trial.verdict.json (real data only). Fallback if day 0 slips past 2026-10-18: ship the demo as a 14 day trial whose last real check-in lands by 2026-11-02, or publish it in progress with its real dates and no verdict, never with invented data PENDING: first check-in due Oct 31 on verdict-skin.vercel.app; the demo file is republished after each one
- [ ] T080 [US8] Playwright journey "demo" in tests/e2e/demo.spec.ts (read only, label shown, no API calls) PARTIAL: "not published yet" state passes; the full demo journey needs public/demo/demo-trial.verdict.json (T079)

---

## Phase 13: Landing, documentation, release

- [X] T081 Verify each landing statistic online (UNL 2015 magazine ad claims, FDA cosmetics approval, Dermatology Times report on 633 brands with its exact article URL, JAMA Network Open undeclared actives) and keep only verified ones with links in src/lib/sources.ts (four figures verified 2026-10-17 and recorded with quotes in src/lib/sources.ts)
- [X] T082 Build the landing from design/project/Main.dc.html and DesktopHome.dc.html in src/app/page.tsx (headline, start trial, quick run, demo trial, sourced stats, how a trial runs, noise explanation, privacy line, disclaimer, footer) (sample result card replaced by a labelled method diagram; noise factor shown only once calibrated)
- [X] T083 [P] Run web-design-guidelines and design-taste-frontend reviews on src/app and src/components; fix contrast, focus, 44px targets, 360 px layout, reduced motion (Web Interface Guidelines pass 2026-10-17: loading ellipses, placeholder, 44 px target, skip link, safe areas, tap behavior, field names, focus first error, dialog overscroll; tests/e2e/layout-360.spec.ts guards 360 px; Title Case not applied, the mockups use sentence case)
- [X] T084 [P] Write README.md: problem with sources, live demo, YouCam APIs used and why (AI Skin Analysis, JS Camera Kit), raw_score vs ui_score, noise threshold method with the calibration numbers, What we learned from the API (docs/api-notes.md), setup, environment variables, license (calibration numbers, live URL and demo marked pending)
- [X] T085 [P] Write DEVPOST.md (Inspiration, What it does, How we built it, YouCam APIs used, Consumer and eCommerce value, Challenges, What's next) plus answers to the three required Devpost questions (three Devpost questions drafted; two wait for calibration and phone tests)
- [X] T086 [P] Write docs/video-script.md, at most 2 min 30 s, scene by scene with voice over, phone footage, YouCam API explained, no third party brands or copyrighted music
- [X] T087 Run `npm test`, `npm run e2e` (mobile and desktop), `npm run lint`, `npm run lint:copy`, and the build secret scan from quickstart.md; fix failures (2026-10-24: 118 unit, e2e 76/4 local and 78/4 against a Vercel preview build, lint and copy lint clean, no key value in .next/static or .next/server)
- [X] T088 Create the public GitHub repo Chinorab/verdict, first commit, push (after the author's go ahead) PARTIAL 2026-10-17: repo created PRIVATE and first commit pushed (4ecdd42); switch to public before submission; 2026-10-24: made PUBLIC (history scanned: no key) at the author's go ahead
- [ ] T089 Deploy to Vercel project verdict with the deploy-to-vercel skill, set env vars, run the e2e suite against the deployment, test on a real phone and time setup (SC-001, under 3 min), day 0 (SC-003, under 4 min, count YouCam rejections after the live check) and a quick run (SC-006, under 10 min); record results in docs/api-notes.md PARTIAL 2026-10-24: live at https://verdict-skin.vercel.app (production env vars, budget from 932 units, auto alias removed); e2e 78/4 on a preview of the same code, 39 passed on the public URL before Vercel's automatic DDoS checkpoint challenged the test IP (real browsers pass it); setup, day 0 and quick run timings on a real phone still to record in docs/api-notes.md; 2026-10-24: live same day test on the production build with scripts/live-quick-run.mjs (synthetic faces through photo upload, real YouCam): setup 2 s, A 10 s, B 18 s, verdict photo 26 s, verdict "Return it." at 28 s, 36 units
- [ ] T090 Capture 5 gallery screenshots (landing, claims, capture, verdict, review card) from the deployment in docs/screenshots/ PARTIAL 2026-10-24: landing, claims (real SVR reading replayed), capture (camera double, no face), demo timeline, privacy, from the production build via tests/e2e/gallery.spec.ts; verdict and review card after the Oct 31 check-in
- [X] T091 Update the "Projets & deadlines" dashboard and PROGRESS.md; submission on Devpost only after the author confirms (2026-10-24: SUBMITTED on Devpost at the author's go ahead, https://devpost.com/software/verdict-sg5zmt)

---

## Dependencies and Execution Order

- Phase 1 T001 to T007 need the author's photos and key; T008 to T011 and T013 can start now; T012 (Camera Kit probe) needs a preview deploy and the author's phone and blocks T044.
- Phase 2 needs T008. T004 (config values) blocks only T040, T055 and T073 results, not their code.
- US1 (Phase 3) needs Phase 2. US2 needs US1's trial records. US3 and US4 need US2's baseline.
  US9 needs only Phase 2. US10 needs US1 to US4.
- P2 stories: US5, US6, US7 need US4; US8 needs US4 plus the backup module (T076) and the real
  check-ins (T079, on 2026-10-25 and 2026-11-01 if day 0 is 2026-10-18).
- Phase 13 last; T081 can run any time.

## Parallel Opportunities

- Setup: T009, T010, T011, T013 together after T008.
- Foundational: T016, T017, T018, T019 (UI) alongside T022, T023, T024 (server) and T026, T027.
- US1: T029, T030, T031 together; US2: T039, T040, T041, T042 together.
- P2: US5, US6 and US7 touch different files and can run side by side once US4 is done.
- Docs T084, T085, T086 together.

## Implementation Strategy

1. Calibrate (T001 to T007) as soon as photos arrive; the demo trial clock starts at T002.
2. Foundation, then the P1 slice up to the MVP checkpoint; deploy a preview and test on a phone.
3. Add P2 stories in the order US7 (safety), US5, US6, US8.
4. Landing, docs, final checks, deploy, screenshots; submit only with the author's go ahead,
   before 2026-11-02 11:45 EST.
