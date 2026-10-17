<!--
Sync Impact Report
Version change: 1.0.0 -> 1.1.0 (2026-10-17, after speckit-analyze findings C2, M2, L1)
Modified principles:
  II. Biometric Privacy by Default: face photo bytes may go from the browser straight to a
      YouCam pre signed upload URL issued by a server route (stricter than routing them
      through Verdict's servers); server side relaying stays allowed as a fallback, never stored
  VI. API Budget Discipline: "global daily cap" defined as a pace line plus a per day ceiling
  VII. Design Integrity: scope of the "no AI mentions" rule clarified (app UI and images;
       documentation may name vendor products such as "AI Skin Analysis")
Added sections: none
Removed sections: none
Templates: plan/spec/tasks templates read this file at runtime, no edit required
Deferred TODOs: none
Previous: 1.0.0 ratified 2026-10-16 (initial principles I to VII and two sections)
-->

# Verdict Constitution

Verdict is a personal, measured trial for a skincare product: it reads the claims on the
label, photographs the user's skin on a schedule, analyzes each photo with YouCam AI Skin
Analysis, and returns a verdict per claim before the retailer's return window closes.
Built solo for the YouCam API Skin AI & eCommerce VTO Hackathon (Devpost, submission deadline
2026-11-02 11:45 ET, judging until 2026-11-20 11:45 ET).

## Core Principles

### I. Measurement Honesty (NON-NEGOTIABLE)

- Verdicts MUST be computed from YouCam `raw_score` values only. `ui_score` MUST NOT enter any
  comparison, threshold or verdict, because YouCam documents it as adjusted upward to be more
  favorable. `ui_score` MAY be stored for reference but never displayed as evidence.
- Every trial MUST start with two consecutive day 0 captures. Their per concern difference is
  the trial's measurement noise. A change MUST be reported as "Holding up" or "Getting worse"
  only when it exceeds the noise threshold defined in the spec; otherwise the result MUST be
  "No measurable change".
- Every displayed result MUST show its magnitude next to the threshold it was judged against.
- SD and HD actions MUST NOT be mixed in one task. A trial picks one mode at day 0 (HD when the
  capture meets HD requirements, SD otherwise) and MUST keep it for every check in.
- A claim that no YouCam concern can measure MUST be shown as not measurable and excluded from
  the verdict. Claims MUST NOT be forced onto a loosely related concern.

Rationale: the product's only value is that its answer can be trusted more than the label.

### II. Biometric Privacy by Default (NON-NEGOTIABLE)

- Face photos are sensitive biometric data. They MUST be stored only on the user's device
  (IndexedDB, every access wrapped in try/catch with a working fallback path).
- Face photos MUST be sent to exactly one third party: YouCam, for analysis. The preferred path
  is a direct upload from the browser to a YouCam pre signed URL that a Verdict server route
  requests with the server held key, so the photo never reaches Verdict's servers. When a
  relay through a server route is unavoidable, it MUST stream the bytes without persisting,
  logging or forwarding them anywhere else.
- Product label photos MAY be sent to Anthropic (Claude) for claim extraction. Face photos MUST
  NEVER be sent to Claude or any other service.
- No account is required for any feature. A visible control MUST erase all local data in one
  action after confirmation.
- Shareable output MUST exclude face imagery by default; including it requires an explicit
  user opt in.
- A privacy page MUST describe these flows accurately before any public deployment.

### III. Secrets Stay on the Server

- `YOUCAM_API_KEY` and `ANTHROPIC_API_KEY` MUST be read from environment variables in server
  code only. No secret, token or credential may appear in source, client bundles, logs, tests
  or commits. A `.env.example` lists names without values.
- Every YouCam and Anthropic call MUST go through a Next.js server route.

### IV. No Fabrication

- No invented reviews, testimonials, users, statistics or measurements anywhere: app, landing,
  README, Devpost text, screenshots or video.
- Every statistic MUST link to its source. A figure that cannot be sourced is removed.
- The demo trial MUST be a real trial recorded by the author on their own skin with a real
  product, labelled as such with its real dates. Sample data in mockups is replaced by real
  values or removed.

### V. Health Guardrail, Never Diagnosis

- Verdict MUST NOT diagnose, name conditions on the user's skin or recommend treatments.
- "Not medical advice" MUST be visible on every screen that shows measurements.
- When redness or acne worsens beyond the noise threshold, Verdict MUST show a calm message
  advising to stop the product and consult a professional.
- When a product bought online promises fast results on eczema, psoriasis or dark spots,
  Verdict MUST show a sourced informational note (JAMA Network Open study on undeclared actives).

### VI. API Budget Discipline

- The YouCam account holds a finite unit balance (1,000 units at start). The cost of one
  complete trial MUST be computed from YouCam's own cost endpoint and recorded before paid
  calls are made.
- Analysis results MUST be stored locally as soon as they arrive (YouCam keeps them 24 hours).
  Identical requests MUST be served from cache.
- The server MUST enforce a per device analysis cap and a global cap so judges cannot exhaust
  the balance before 2026-11-20. The global cap is a pace line (the balance may not fall below
  a straight line from the launch balance to a reserve on 2026-11-20) plus a per day ceiling
  on units spent since the day began. When a cap is reached the app MUST explain it clearly.
- Capture quality MUST be checked on device before any upload, so failed or wasted calls stay
  rare. YouCam capture errors MUST map to actionable messages.

### VII. Design Integrity

- The mockups in `/design` are the source of truth. Design tokens are extracted first, then
  components are built from them. Where a mockup contradicts this constitution (for example
  privacy copy), the constitution wins and the deviation is noted in the plan.
- Forbidden: purple gradients, pill shaped buttons, emoji (icons only), dashes used as
  punctuation in copy, any mention or tag of AI in the app's user interface and images,
  generic AI marketing copy. Copy is short and concrete. Documentation (README, DEVPOST.md,
  video script) may name vendor products by their official names, such as YouCam "AI Skin
  Analysis", and the privacy page names Anthropic as the label reading provider.
- Touch targets at least 44px, text contrast at least 4.5:1, works at 360px width with no
  horizontal scroll, respects `prefers-reduced-motion`.
- A favicon and the privacy page MUST exist before the first public deployment.

## Product and Submission Constraints

- Language: all user facing text, code, comments, commits and documentation are in English.
- Stack: Next.js App Router with TypeScript, installable PWA, deployed on Vercel. Capture uses
  the YouCam JS Camera Kit. Claim extraction uses Claude vision (`claude-sonnet-5-5`).
- Repository: public on GitHub under the MIT license.
- Availability: the live URL MUST work without login, from a phone, end to end, until
  2026-11-20 11:45 ET.
- Deliverables: live URL, README (sourced problem, demo, YouCam APIs used and why, raw_score vs
  ui_score, noise threshold method, "What we learned from the API", setup, environment
  variables, license), DEVPOST.md, a demo video script of at most 2 min 30 s with no
  copyrighted music and no third party brands visible, and 5 gallery screenshots.

## Development Workflow and Quality Gates

- Spec driven, in order: speckit constitution, specify, clarify, plan, tasks, analyze,
  implement. No application code before the plan is approved by the author.
- Before the app is built, scripts in `/scripts` run real analyses on 2 or 3 photos and record
  observed variability between identical captures; findings go in the README.
- Every user journey (new trial, capture, check in, compare, verdict, shareable card, erase
  data) MUST pass Playwright tests on mobile and desktop viewports before each deployment.
- Paid API calls in tests MUST be mocked; only the `/scripts` calibration runs and the
  author's real demo trial spend units.
- `PROGRESS.md` at the repo root records the current step so work can resume after any
  interruption.

## Governance

This constitution supersedes other practices for this repository. Every spec, plan and task
list MUST include a constitution check, and any deviation MUST be justified in the plan's
complexity tracking table. Amendments are made through speckit-constitution, with a semantic
version bump (MAJOR for removed or redefined principles, MINOR for added or expanded ones,
PATCH for wording) and an updated Sync Impact Report.

**Version**: 1.1.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-17
