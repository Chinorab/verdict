# Phase 0 Research: Measured Skincare Trial

Sources read on 2026-10-17: YouCam AI Skin Analysis reference (including the JS Camera Kit v2.5
section, rendered in a browser because the fetcher misses it), YouCam Rate Limit and File
Retention Period pages, the `skin-analysis-expert` skill code (`YouCam-API/skills`), the
bundled Claude API skill (TypeScript), npm registry versions.

## R1. YouCam AI Skin Analysis contract

- **Decision**: Server `https://yce-api-01.makeupar.com`. Upload `POST /s2s/v2.0/file`
  (body `{files:[{content_type,file_name,file_size}]}`) returns `data.files[0].file_id` and
  `requests[0]` (`url`, `method` PUT, `headers`). The PUT is mandatory. Task
  `POST /s2s/v2.1/task/skin-analysis` with `src_file_id`, `dst_actions`, `format: "json"`,
  `miniserver_args.enable_mask_overlay: false`. Poll `GET /s2s/v2.1/task/skin-analysis/{id}`
  every 3 to 5 s until `task_status` is `success` or `error`. Result in
  `data.results.output[]` with `type`, `raw_score`, `ui_score`, `mask_urls[]`.
- **Rationale**: v2.1 is what the official skill's contract snapshot (2026-10-01) targets; the
  brief named v2.0, which the docs still list. Mask PNGs (overlay off) let the app draw the
  mask over its own stored photo and toggle it, instead of storing a second blended JPEG.
- **Alternatives**: v2.0 task path (kept as a fallback constant); overlay JPEGs (heavier, no
  toggle).

## R2. SD versus HD

- **Decision**: Lock the trial to HD when both day 0 images have a short side of at least
  1080 px, else SD. Camera Kit runs in `skincare` mode with `videoQuality: "1080p"`
  (1920 x 1080 output, short side 1080) so most phones qualify for HD; `hdskincare` (needs a
  2560 px webcam) is not required. Every later task in the trial reuses the locked mode; a
  check-in image below the HD minimum on an HD trial is refused with a message.
- **Risk (analyze H1)**: the docs' sample capture payload is 500 x 500, so the kit may crop
  captures to its container. The real width and height on a phone are measured before the
  capture screen is built (tasks); if captures are small, set the container width and height
  to the maximum (1920) or fall back to SD for every trial.
- **Measured 2026-10-23 (T012)** on the author's iPhone (iOS 18.7, Safari, screen 390 x 844 at
  3x), protected Vercel preview, default container, `skincare`, `videoQuality: "1080p"`,
  `strict`: the capture is a **1080 x 1788 JPEG** (430 KB), the size reported by the kit equals
  the decoded size. The kit does not crop to a small square: the short side is exactly the HD
  minimum, so **every trial is HD** with the default container; the 1080 x 1920 container was
  not needed. A photo that comes back below 1080 on the short side still falls back to SD
  through `modeForDay0`.
- **Finding for the capture screen (T044, T046)**: under ordinary indoor light the strict check
  reported `{hasFace: true, position: "good", frontal: "good", lighting: "ok"}` and never auto
  captured; strict waits for `lighting: "good"`. `YMK.capture()` (present on the SDK object,
  not in the docs) took the photo on demand. The capture screen therefore shows the Light
  indicator as the thing to fix, and after a wait offers a manual capture once face, position
  and angle are good, so a dim room does not block the user.
- **Rationale**: HD and SD actions cannot be mixed in one task, and mixing across sessions
  would make scores incomparable. The HD minimum is 1080 px on the short side.
- **Alternatives**: always SD (cheaper, less detail); `hdskincare` mode (excludes most phones).

## R3. Camera Kit

- **Decision**: Load `https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js` on the
  capture screen only. Define `window.YMKAsyncInit`, mount `<div id="YMK-module">`, call
  `YMK.init({ faceDetectionMode: "skincare", imageFormat: "blob", language: "enu",
  qualityLevel: "strict", videoQuality: "1080p", hideFlipCameraButton: false })`, then
  `YMK.openCameraKit()`. Map `faceQualityChanged` (`hasFace`, `position`: good, notgood,
  toosmall, outofboundary; `frontal`: good, notgood; `lighting`: good, ok, notgood) to the
  three indicators of the Capture mockup (Light, Framing, Angle). Images arrive through
  `faceDetectionCaptured` (`images[0].image`, `width`, `height`). Handle `cameraFailed`
  (`error_permission_denied`, `error_access_failed`, `error_resolution_unsupported`) and
  `unsupportedResolution` by offering `qualityLevel: "moderate"`, then photo upload.
  `YMK.close()` on unmount.
- **Rationale**: The kit needs no API key in the browser, auto captures when quality passes,
  and its strict preset (face ratio 0.75, yaw within 5 degrees, lighting 0.8 to 0.9) is what
  keeps the noise floor low. It requires HTTPS, which Vercel provides.
- **Alternatives**: custom getUserMedia plus face detection (more work, worse than the vendor's
  own quality gate, and weaker on the judging criterion "integration of the YouCam API").

## R4. Where the face photo travels

- **Decision**: The server route asks YouCam for a pre signed upload URL and returns it to the
  browser; the browser PUTs the image straight to that URL. Task creation and polling go
  through server routes holding the key. If the pre signed URL rejects browser PUTs (CORS),
  the fallback is a server route that streams the image to the URL without storing it
  (limit: Vercel function bodies of 4.5 MB, so images are re encoded to JPEG under 4 MB).
- **Rationale**: The face photo never touches Verdict's servers, which is stronger than the
  constitution's minimum ("through server routes, not persisted"), and the API key never
  leaves the server. CORS is verified on the first real run.
- **Alternatives**: always proxy (simpler, but the face transits our function).

## R5. Retention at YouCam

- **Decision**: The privacy page states the provider's own figures: uploaded files and task
  ids are kept 30 days (File Retention Period page); the Skin Analysis page describes results
  as available 24 hours. No delete endpoint exists. Verdict downloads masks and scores as soon
  as a task succeeds.
- **Rationale**: The two vendor pages differ; quoting both with links is the only accurate
  statement. This updates the brief's "24 h" assumption.

## R6. Rate limits

- **Decision**: 250 requests per 300 s per IP and per token, 429 on excess. Poll every 4 s,
  max 30 polls, exponential backoff on 429. Free endpoints: `/s2s/v1.0/client/credit`
  (balance) and `/s2s/v2.0/credit/feature-cost` (price list).

## R7. Budget caps without a database

- **Decision**: (a) Per device: an HMAC signed, httpOnly cookie holding a random device id,
  the date and a counter of successful analyses (max 5 per day); a task that ends in error
  gives its slot back. (b) Global: before creating a task, read the free balance endpoint
  (cached 60 s) and refuse when the balance is below a straight line that runs from the
  launch balance to a reserve at `BUDGET_END` (2026-11-20T16:45Z). The reserve covers the
  author's remaining demo check-ins. A per day ceiling (`BUDGET_DAILY_MAX`, about 1.5 times
  the line's daily slope) is checked against today's debits read from the free
  `/s2s/v1.0/client/credit/history` endpoint, so a quiet day's allowance cannot all be spent
  the next day.
- **Rationale**: No personal data, no database, works on serverless. Clearing cookies only
  bypasses the per device cap; the global line still protects the account.
- **Alternatives**: Redis counter (adds a store and a vendor), IP based limits (shared IPs).
- **Pending**: the real units per HD analysis (`node scripts/cost.mjs`) sets the reserve and
  confirms that the line leaves room for judges.

## R8. Claim extraction

- **Decision**: `@anthropic-ai/sdk` from a server route, model `claude-sonnet-5-5` (named by
  the author), `client.messages.parse` with `output_config.format: zodOutputFormat(schema)`,
  `output_config.effort: "medium"`, the label as a base64 JPEG image block (re encoded on the
  device to at most 1568 px on the long side). Refusals: check `stop_reason` and opt into the
  server side fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). The
  schema returns product name and size, and per claim: verbatim text, timeframe in days or
  null, mapped concerns from the fixed list with the promised direction, a measurable flag
  with a reason when not, health terms (eczema, psoriasis, dark spots) and a fast promise
  flag. Mapping rules live in the system prompt and forbid loose mappings. Per device cap:
  10 label reads per day, same cookie as R7.
- **Rationale**: Structured outputs remove parsing failures; vision reads curved, glossy
  labels better than OCR.

## R9. Measurement method

- **Decision**: Per concern, baseline = mean of the two day 0 raw scores, noise = absolute
  difference, threshold = max(k x noise, floor_c). Change = latest raw minus baseline,
  signed so that positive means "toward the claim". k and floor_c come from calibration
  (A vs B for camera noise, A vs C for repositioning) and live in one config file with the
  README explanation. Each concern's raw score direction (does a higher raw score mean more
  of the concern?) is fixed in the same file after calibration.
- **Rationale**: `ui_score` is adjusted upward by the vendor; raw scores are the only honest
  basis. A floor prevents a lucky identical pair from making every wobble look significant.

## R10. Reminders

- **Decision**: Generate an `.ics` file on the device (one VEVENT per check-in at the chosen
  hour with a VALARM, plus the deadline). Highlight due check-ins in app.
- **Rationale**: Scheduled web push needs a stored subscription and a server cron; calendar
  alarms work everywhere and keep the no server data promise. The brief allows either.

## R11. Sharing

- **Decision**: The card is drawn from data into an SVG, rasterized to PNG on the device for
  "Save image" and the Web Share API. "Copy link" encodes the card's numbers in the URL
  fragment of `/review#...`, which browsers never send to servers. No revoke, so the mockup's
  revoke line is removed.

## R12. Stack and versions (npm, 2026-10-17)

- Next.js 16.4 (App Router) with React 19.3, TypeScript strict. Zod 4.6 shared by server and
  client. `idb` 8 for IndexedDB with an in memory fallback. `@anthropic-ai/sdk` 0.135.
  Fonts Hanken Grotesk and JetBrains Mono via `next/font` (self hosted at build, so no runtime
  request to Google). Plain CSS with custom property tokens and CSS Modules, no UI kit.
  Hand written service worker for the app shell (never caches API routes or photos).
- Tests: Vitest 5 for the measurement, schedule, budget and backup logic; Playwright 1.64
  (driven with the playwright-cli skill) for every journey on a phone and a desktop viewport,
  with YouCam and Claude routes mocked from recorded real responses.

## R13. Demo trial

- **Decision**: The author's trial is exported with the backup format (contracts/backup-file.md)
  and shipped as a static, read only file under `public/demo/`. Day 0 comes from
  `scripts/analyze.mjs` output, converted by a script to the backup format.
- **Decided (author, 2026-10-17)**: the public demo ships without face photos. Compare shows
  the detection masks on a neutral background with the numbers; the demo file is exported
  without photos (`includesPhotos: false`) plus mask PNGs only.
