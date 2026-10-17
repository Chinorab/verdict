# Server Route Contracts

All routes are Next.js route handlers under `src/app/api/`. They hold `YOUCAM_API_KEY` and
`ANTHROPIC_API_KEY`; responses never echo keys. Every route reads and refreshes the signed
`vd` cookie (device id, day, `analyses`, `labels` counters). Errors use one shape:

```json
{ "error": { "code": "cap_device", "message": "You have used today's 5 analyses. Analyses resume tomorrow.", "retryAfter": "2026-10-18T00:00:00Z" } }
```

Codes: `bad_request`, `cap_device`, `cap_global`, `cap_labels`, `upstream`, `rate_limited`,
plus YouCam capture codes passed through (`error_src_face_too_small`, `error_lighting_dark`,
`error_src_face_out_of_bound`, `error_below_min_image_size`, `error_exceed_max_image_size`).

## POST /api/claims

Reads a label photo. Never accepts face photos (the client sends only the label step's image).

- Request: `multipart/form-data` with `image` (JPEG, at most 1568 px long side, under 4 MB).
- 200: `{ product: { name, size? }, claims: Claim[] }` where `Claim` is
  `{ text, timeframeDays, targets: {concern, direction}[], measurable, unmeasurableReason,
  healthTerms, fastPromise }`.
- 422 `no_claims` when the label has no readable claims. 429 `cap_labels` after 10 per day.

## POST /api/analysis/upload

Starts an upload; the face photo itself goes from the browser to YouCam's pre signed URL.

- Request: `{ contentType: "image/jpeg" | "image/png", size: number, width: number, height: number, mode: "sd" | "hd" }`.
- Checks: size under 10 MB; short side >= 1080 for `hd`, >= 480 for `sd`; device cap; global
  pace line and per day ceiling (today's debits from the free credit history endpoint).
- 200: `{ fileId, upload: { url, method: "PUT", headers } }`.
- 429 `cap_device` or `cap_global`.

## POST /api/analysis/upload-proxy (fallback only)

Used only if the browser cannot PUT to the pre signed URL (CORS). The server requests the
upload URL itself, streams the body to it and keeps nothing (no logging of bodies).

- Request: raw JPEG body (under 4 MB, Vercel's function body limit is 4.5 MB) with headers
  `x-width`, `x-height`, `x-mode`. Same checks and caps as `/upload`.
- 200: `{ fileId }`.

## POST /api/analysis/task

- Request: `{ fileId, mode: "sd" | "hd", concerns: Concern[] }`.
- Server maps concerns to actions for the mode (`dark_circle` -> `dark_circle_v2` in SD,
  `hd_` prefix in HD), creates the task, counts it against the device cap.
- 200: `{ taskId }` where `taskId` is a device bound token (HMAC of the device id and the YouCam task id), so only the creating device can poll it.

## GET /api/analysis/task/{taskId}

Polls YouCam once per call (client polls every 4 s, up to 30 times). `taskId` is the token from the POST; a token from another device answers 404 `not_found`.

- 200 running: `{ status: "running" }`.
- 200 success: `{ status: "success", results: { concern, raw, ui, maskUrls }[] }`.
- 200 error: `{ status: "error", code }` and the device slot is returned, once per task.

## GET /api/mask?url=...

Only if YouCam mask URLs block browser downloads (CORS). Accepts URLs on YouCam's hosts only,
streams the PNG, keeps nothing.

## GET /api/budget

- 200: `{ deviceRemaining: number, globalOpen: boolean, resumesAt?: string }`, so the UI can
  warn before a judge starts a quick run.
