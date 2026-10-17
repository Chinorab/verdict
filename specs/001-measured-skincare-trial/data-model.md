# Data Model: Measured Skincare Trial

All records live on the device (IndexedDB database `verdict`, version 1). Nothing below is
stored on a server. Types are TypeScript shaped; validation uses the same Zod schemas on the
device and in server routes.

## Enums

- `Concern`: `age_spot | wrinkle | texture | dark_circle | redness | pore | acne | oiliness |
  moisture | firmness | radiance | eye_bag`
- `Mode`: `sd | hd` (fixed per trial)
- `Direction`: `decrease | increase` (what the claim promises for the concern; "fades dark
  spots" is `decrease` of `age_spot`, "boosts radiance" is `increase` of `radiance`)
- `TrialKind`: `real | quick | demo`
- `TrialStatus`: `setup | baseline | active | paused | complete`
- `SessionKind`: `day0_a | day0_b | checkin`
- `ResultStatus`: `holding_up | getting_worse | no_change | not_measured`
- `Suggestion`: `keep | return | none` (`none` when the deadline has passed)

## Store `trials` (key `id`)

| Field | Type | Rules |
|---|---|---|
| id | string (uuid) | |
| kind | TrialKind | `demo` is read only and loaded from `public/demo/` |
| status | TrialStatus | transitions below |
| createdAt | ISO datetime | |
| product | `{ name: string; size?: string }` | name 1 to 80 chars |
| purchase | `{ price: number; currency: "USD"; date: ISO date; retailer: string; online: boolean; returnDays: number }` | price >= 0; returnDays 1 to 365 |
| deadline | ISO date | `purchase.date + returnDays` |
| trialDays | 14 or 28 or 56, or shorter when the window forces it | FR-008 |
| verdictDate | ISO date | before deadline by margin (2 days if returnDays <= 14, else 4) |
| mode | Mode or null | set when day 0 completes, never changes |
| reminderHour | 0 to 23 | default: hour of day 0 photo A |
| schedule | `{ day: number; date: ISO date; kind: "day0" or "checkin" or "verdict" }[]` | FR-009: days 0, 7, 14 (14 d); 0, 7, 14, 21, 28 (28 d); 0, 14, 28, 42, 56 (56 d); last moves to verdictDate when shortened |
| decision | `keep | return | undecided` | user's own choice |
| guardrail | `{ level: 0 or 1 or 2; concern?: "redness" or "acne"; at?: ISO datetime }` | FR-027 |
| notes | `{ jamaNoteShown: boolean; timeframeWarning: boolean }` | FR-010, FR-028 |

State transitions: `setup` (claims and purchase entered) -> `baseline` (day 0 photo A done)
-> `active` (photo B done, baseline computed) -> `complete` (verdict computed on or after the
final check-in). `active` <-> `paused` by user action. A quick run goes `active` -> `complete`
after one immediate check-in. Demo trials are always `complete`.

## Store `claims` (key `id`, index `trialId`)

| Field | Type | Rules |
|---|---|---|
| id, trialId | string | |
| text | string | verbatim label text, 1 to 200 chars |
| timeframeDays | number or null | parsed from "in 4 weeks" (28) |
| targets | `{ concern: Concern; direction: Direction }[]` | empty means not measurable |
| measurable | boolean | `targets.length > 0` |
| unmeasurableReason | string or null | shown to the user |
| main | boolean | exactly one measurable claim per trial is main |
| healthTerms | `("eczema" or "psoriasis" or "dark_spots")[]` | FR-028 |
| fastPromise | boolean | timeframe <= 28 days or words like instant, fast, rapid |
| editedByUser | boolean | |

## Store `sessions` (key `id`, index `trialId`)

| Field | Type | Rules |
|---|---|---|
| id, trialId | string | |
| kind | SessionKind | exactly one `day0_a` and one `day0_b` per trial |
| scheduledDay | number | day index in the schedule |
| takenAt | ISO datetime | |
| photoId | string or null | key in `photos`; null after "delete photos only" or in demos without photos |
| width, height | number | of the analyzed image |
| quality | `{ position: string; frontal: string; lighting: string }` | last Camera Kit reading |
| taskId | string | YouCam task id, also the cache key |
| state | `pending | analyzing | done | failed` | |
| error | string or null | YouCam error code when failed |

## Store `measurements` (key `[sessionId, concern]`)

| Field | Type | Rules |
|---|---|---|
| sessionId | string | |
| concern | Concern | |
| raw | number | the only value used for verdicts |
| ui | number | stored for reference, never displayed as evidence |
| maskIds | string[] | keys in `photos` (mask PNGs) |

## Store `photos` (key `id`)

`{ id: string; trialId: string; kind: "face" | "mask" | "label"; blob: Blob; type: string }`.
Label photos are deleted once claims are confirmed.

## Derived (computed, not stored)

- **Baseline** per concern: `a`, `b`, `mean = (a + b) / 2`, `noise = |a - b|`,
  `threshold = max(k * noise, floor[concern])` with `k` and `floor` from
  `src/lib/measure/config.ts`.
- **Change** per concern for a session: `delta = raw - mean`; `toward = delta * sign` where
  `sign` combines the claim direction and the concern's raw score direction (config).
- **Result** per claim target: `holding_up` if `toward > threshold`, `getting_worse` if
  `toward < -threshold`, else `no_change`. Unmeasurable claims are `not_measured`.
- **Suggestion**: `keep` only if every target of the main claim is `holding_up` and no target
  of any measurable claim is `getting_worse`; else `return`; `none` after the deadline.
- **Guardrail**: for `redness` and `acne`, level 1 at the first check-in where the concern
  moved away from healthy beyond threshold, level 2 when the next check-in confirms.

## Settings (store `settings`, single record)

`{ deviceNotice: boolean; storageAvailable: boolean; lastBackupAt?: ISO datetime }`.

## Erase all

Deletes the `verdict` database, clears the app's Cache Storage entries and local storage keys,
then reloads to the first run state (FR-032).
