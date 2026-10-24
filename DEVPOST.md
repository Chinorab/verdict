# Verdict

**Find out if a skincare product works on your skin before the return window closes.**

## Inspiration

Skincare labels promise results on a schedule: "fades dark spots in 4 weeks". Shoppers can only
judge by eye, and they usually decide after the return window has closed. Nearly half of 633
skincare brands had no independently verifiable evidence behind any of their high impact claims
(M11 report, Dermatology Times, October 2026), and a JAMA Network Open study found an undeclared
prescription steroid in 6 of 18 skin products sold online for eczema, psoriasis, dermatitis or
dark spots. People need a way to check a promise on their own skin, in time to act on it.

## What it does

Verdict runs a personal, measured trial of one product:

1. **Scan the label.** The printed claims are read and matched to what YouCam AI Skin Analysis
   measures. Claims a photo cannot check are shown and left out, never stretched.
2. **Plan around the return window.** Enter the price and return window; check-ins are placed so
   the verdict lands before the deadline.
3. **Day 0, two photos.** Two guided captures one after the other measure how much a reading moves
   on its own: your personal noise floor.
4. **Check in** with the YouCam camera kit's live quality guide, reminded by a calendar file.
5. **Verdict per claim**: Holding up, Getting worse or No measurable change, always shown with the
   size of the change and the threshold. Then Keep or Return, with the refund at stake.
6. **Compare** photos with YouCam's detection masks, and **share** a review card built only from
   measurements.
7. **Health guardrail**: if redness or blemishes rise beyond the threshold twice in a row, a calm
   suggestion to pause the product and see a dermatologist. Never a diagnosis.

Judges can try it end to end on a phone in about 10 minutes with the same day test, without an
account, at https://verdict-skin.vercel.app, and follow the author's real trial at
https://verdict-skin.vercel.app/demo (numbers only, updated after each check-in, verdict on
Nov 19).

Demo video: https://youtu.be/BytZCRZm_bE (1 min 52 s; the faces are synthetic test faces of a
fictional person, labelled on screen, with the real YouCam results for those images).

## How we built it

- Next.js 16 (App Router) and TypeScript, installable as a web app, deployed on Vercel.
- All trial data lives in the browser (IndexedDB). Face photos go from the phone straight to
  YouCam through a pre signed upload URL; Verdict's server only holds the keys, creates tasks and
  enforces the budget.
- Label reading with Claude (claude-sonnet-5-5) using structured output, so every claim comes
  back with its timeframe, mapped concerns and a reason when it cannot be measured.
- Pure, unit tested measurement code: baseline, threshold, verdict, guardrail, schedule, calendar
  file, backup format. Playwright journeys on phone and desktop for every screen.
- Spec driven: constitution, specification, clarification, plan, tasks and analysis before code.

## YouCam APIs used

- **AI Skin Analysis** (JSON results, HD when the photo allows, never mixed with SD in one trial):
  twelve concerns that map to label promises, plus redness and acne on every analysis for the
  health guardrail. Results use `raw_score` only: YouCam documents `ui_score` as adjusted to be
  more favorable, which would flatter the product.
- **File API** with pre signed upload: the face photo never touches our server.
- **JS Camera Kit** in skincare mode with the strict quality preset: comparable photos week after
  week, fewer failed analyses.
- **Credit endpoints** (free): budget caps without a database, so the demo stays usable through
  judging.

## Consumer and eCommerce value

- **Shoppers** get a yes or no on each promise while a refund is still possible, with the amount
  at stake and the deadline in view.
- **Retailers and marketplaces** get a new kind of review: measured on one person, with numbers
  and thresholds instead of stars, which other shoppers can trust for what it is.
- **Brands with real results** can be told apart from brands with unverifiable claims.

## Challenges

- Making "no change" honest: a single before and after pair is meaningless without knowing how
  much readings move on their own. Two day 0 photos per user solved it.
- Keeping biometric photos off our servers while keeping keys off the client: pre signed uploads.
- Running a free public demo on a fixed unit budget without a database: a pace line plus a daily
  ceiling computed from YouCam's free credit endpoints, and a signed per device cookie.

## What's next

- Retailer integration: start a trial from an order confirmation, with the return deadline filled
  in automatically.
- Aggregated, opt in measured reviews per product.
- Region level results (forehead, cheeks) from the HD subregion scores.

## Devpost questions

**Was there a moment during the hackathon where the API surprised you?** How far `ui_score` sits
from `raw_score`: on the same test face, pores scored 12.5 to 19.9 raw but 51 to 54 on the display
score. Both always moved in the same direction, so the display score is not wrong, just flattering,
which is exactly what a keep or return decision cannot afford. We also found that pores and wrinkles
come back once per face region plus a whole face value, which is useful for a later regional view.

**Are there industries or use cases you think Perfect Corp.'s API could serve that nobody is
talking about yet?** Consumer protection: return windows, warranty claims and product testing
by consumer organizations need a repeatable before and after measurement, not a one time score.

**Where did you hit a wall technically? How did you work around it?** The camera kit on a real
phone. With the strict quality preset, the kit reported face, position and angle as good but
lighting as only "ok" under ordinary indoor light, and never captured by itself. A throwaway probe
page on an iPhone showed it, and also showed that `YMK.capture()`, present on the SDK object but not
in the docs, takes the photo on demand. Verdict now offers a manual capture once face, position and
angle are good, and refuses it in poor light. The same probe showed that the photo is 1080 px wide
and takes the shape of its container, so the capture area is never wider than tall: the short side
stays at 1080 px, the HD minimum. Details in `specs/001-measured-skincare-trial/research.md` (R2).
