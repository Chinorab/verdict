# Verdict

**Find out if a skincare product works on your skin before the return window closes.**

Verdict turns the promises printed on a skincare label into a personal, measured trial. It
reads the claims, photographs your skin on a schedule with the YouCam camera kit, measures each
photo with YouCam AI Skin Analysis, and gives a result for each claim, shown next to how much a
reading moves on its own, in time to return the product.

Built for the YouCam API Skin AI & eCommerce VTO Hackathon (2026).

> Status: live at https://verdict-skin.vercel.app. The author's demo trial is published as it
> runs (day 0 measured Oct 24, 2026; verdict due Nov 19). Nothing in this repository is sample
> data presented as real.

## The problem

- 47% of 633 skincare brands had no independently verifiable evidence behind any of their
  high impact claims (M11 report, [Dermatology Times, Oct 13, 2026](https://www.dermatologytimes.com/view/ai-era-skincare-report-finds-widespread-gaps-in-verifiable-product-claims)).
  The report is careful: unverifiable does not mean false. It means a shopper cannot check.
- 6 of 18 skin products sold online for eczema, psoriasis, dermatitis or hyperpigmentation
  contained clobetasol, a superpotent prescription steroid, that was not on the label
  (Abilov et al., JAMA Network Open, summarized in [Dermatology Times, Oct 14, 2026](https://dermatologytimes.com/view/journal-digest-october-14-2026)).
- 18% of the claims in nearly 300 magazine beauty ads were judged acceptable by researchers
  ([Journal of Global Fashion Marketing, via UNL News, 2015](https://news.unl.edu/article/research-most-beauty-ad-claims-don-t-hold-up)).
- In the US, cosmetics can be marketed without FDA approval, color additives aside
  ([FDA, Cosmetics Safety Q&A](https://www.fda.gov/cosmetics/resources-consumers-cosmetics/cosmetics-safety-qa-prohibited-ingredients)).

Shoppers find out whether a product works after the return window has closed. Verdict moves
that answer before the deadline, and makes it a measurement instead of an impression.

## Live demo

- Live app: **https://verdict-skin.vercel.app** (works on a phone, no account).
- Demo video (1 min 52 s): https://youtu.be/BytZCRZm_bE (synthetic test faces, labelled; brand name hidden).
- The author's real trial, recorded on their own skin with a real product (a soothing cream
  bought for $30 with a 30 day return window; brand name hidden), read only, numbers only, no face
  photos: [/demo](https://verdict-skin.vercel.app/demo). It is updated after each check-in
  (Oct 31, Nov 7, Nov 14) and reaches its verdict on Nov 19, before the Nov 23 return deadline.
  The claim the author typed by accident ("Vvb") was replaced with the label wording, marked as
  edited (`scripts/demo-overrides.json`).
- Same day test for judges: [/trial/new?quick=1](https://verdict-skin.vercel.app/trial/new?quick=1),
  about 10 minutes, no account.
- The first visit can show Vercel's browser check for a second; it passes on its own.

## How it works

1. **Scan the label.** Claude (claude-sonnet-5-5, vision, structured output) reads the printed
   claims and their timeframes and maps each one to a concern YouCam measures, or marks it as not
   measurable. Only the label photo is sent, never a face.
2. **Purchase and plan.** Price, purchase date and return window. Check-ins are scheduled so the
   verdict lands before the deadline (2 days early for windows up to 14 days, 4 days otherwise).
3. **Day 0, two photos.** Two captures one after the other. Their difference is your noise floor.
4. **Check-ins** at the reminder hour (calendar file with alerts, built on the device).
5. **Verdict per claim**: Holding up, Getting worse, or No measurable change, always with the
   change and the threshold. Then Keep or Return, with the refund at stake and the days left.
6. **Compare** day 0 and any check-in with YouCam's detection masks over your photos.
7. **Share** a measured review card: numbers only, face photos off by default.
8. **Health guardrail**: if redness or blemishes rise beyond your threshold, a calm notice;
   twice in a row, a suggestion to pause and see a dermatologist. Never a diagnosis.

## YouCam APIs used, and why

| API | Where | Why |
|---|---|---|
| **AI Skin Analysis** (`/s2s/v2.1/task/skin-analysis`, JSON output) | every photo | Twelve concerns map directly to what skincare labels promise (dark spots, wrinkles, texture, redness, pores, blemishes, oiliness, hydration, firmness, radiance, dark circles, eye bags). Redness and acne are always requested for the health guardrail. |
| **File API** (`/s2s/v2.0/file`, pre signed upload) | every photo | The browser uploads the photo straight to YouCam's URL. Verdict's server only asks for the link with the server held key, so the face photo never reaches our server. |
| **JS Camera Kit v2.5** (`skincare` mode, `strict` quality) | capture | Live face quality checks (light, framing, angle) before a photo is taken, so readings are comparable from week to week and failed analyses stay rare. |
| **Credit endpoints** (balance, history, feature cost; free) | server | Budget caps without a database: a pace line to the end of judging plus a daily ceiling. |

SD and HD are never mixed: a trial locks to HD when its day 0 photos are large enough, SD
otherwise, and every later photo must match.

## Why raw_score and not ui_score

YouCam returns two numbers per concern. Its documentation describes `ui_score` as adjusted to be
more favorable for display. A verdict built on a number shifted toward "good" would flatter the
product. Verdict judges only on `raw_score`; `ui_score` is stored for reference and never shown
as evidence.

## The noise threshold method

- Day 0: photos A and B, taken one after the other. Noise per concern = |A − B|.
- Threshold = max(k × noise, floor for that concern). The floor stops an identical pair from
  making every wobble look significant.
- Baseline = mean(A, B). Change = latest check-in − baseline, signed so positive means toward
  what the claim promised (the direction of each raw score is fixed from calibration).
- A claim is Holding up only when the change is strictly beyond the threshold toward the claim,
  Getting worse when strictly beyond it the other way, and No measurable change otherwise.
- Raw score directions are measured (below). k = 1.5 and a 1 point floor per concern are design
  defaults, not yet calibrated on real camera photos; they live in `src/lib/measure/config.ts`
  with that label. Each person's threshold still comes from their own two day 0 photos.

## What we learned from the API

Measured on 2026-10-22 with `scripts/` against the live API (v2.1, HD, 12 concerns), on three
**synthetic test faces of a fictional person** (`scripts/photos/synthetic/`): A, B (an edit of A
"taken one second later") and C (an edit of A "after standing up"). No real person's face was used.

- **Cost**: 20 units per HD analysis with 9 to 12 concerns (12 for 1 to 4, 16 for 5 to 8, 22 for
  13 to 16; SD is 9, 12, 14, 16). Confirmed on the account: 1040 to 980 units for three analyses.
  Units are only debited on success. Verdict asks only for the concerns a label promises plus
  redness and acne, usually 12 units.
- **`raw_score` is a "higher is better" score, like `ui_score`**: across the three faces the two moved
  in the same direction in 28 of 28 comparisons. So for problem concerns (spots, redness, pores,
  blemishes, wrinkles, texture, oiliness, dark circles, eye bags) a higher raw score means less of
  the problem; for hydration, radiance and firmness it means more.
- **`ui_score` sits well above `raw_score`**, most visibly for pores (raw 12.5 to 19.9, ui 51 to 54)
  and blemishes (raw 75 to 79, ui 85 to 87), consistent with YouCam describing it as adjusted to be
  more favorable. Judging on it would flatter the product.
- **Pores and wrinkles come once per face region** (`region`: forehead, nose, cheek, glabellar,
  crowfeet, periocular, nasolabial, marionette, and `whole`); Verdict uses `whole`. The output also
  holds `all` and `skin_age` (a `score`, no `raw_score`) and the resized photo.
- **Variation between the edited images** ranged from 0.3 points (oiliness) to 9.5 (firmness) and
  7.3 (pores). This comes from the image generator re rendering skin details, **not** from a camera,
  so it is not a noise floor; it shows why Verdict measures noise per person instead of assuming one.
- **Uploads**: the pre signed PUT is required (as documented); the file id then feeds the task.
- **Credit history** (`/s2s/v1.0/client/credit/history`) answers 415 without a JSON content type even
  on GET; each analysis appears as `api_skin_analysis_hd_v2` with a negative amount (-20), which is
  how Verdict caps daily spend without a database.
- The task endpoint the official skill uses is v2.1, while the brief referenced v2.0.
- Uploaded files and task ids are kept 30 days (File Retention Period page), while the Skin
  Analysis page describes results as kept 24 hours. The privacy page quotes both, with links.

## Run it locally

```
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
npm test        # unit tests
npm run e2e     # Playwright, mobile and desktop
```

Calibration scripts (Node 20+, no dependencies) are documented in `scripts/README.md`.

## Environment variables

| Name | What |
|---|---|
| `YOUCAM_API_KEY` | YouCam API key (server only) |
| `ANTHROPIC_API_KEY` | Anthropic API key for label reading (server only) |
| `VERDICT_COOKIE_SECRET` | 32+ random characters, signs the per device quota cookie |
| `BUDGET_UNIT_COST` | units per analysis, measured in calibration |
| `BUDGET_LAUNCH_BALANCE`, `BUDGET_RESERVE`, `BUDGET_DAILY_MAX` | pace line and daily ceiling |
| `BUDGET_START`, `BUDGET_END` | start and end of the pace line (end of judging) |

## Privacy

Face photos are stored in the browser (IndexedDB), sent only to YouCam for analysis, and never
stored by Verdict. Label photos go to Anthropic. No account. One action deletes everything.
Details: `/privacy`.

## License

MIT, see [LICENSE](LICENSE).
