# Feature Specification: Measured Skincare Trial

**Feature Branch**: `001-measured-skincare-trial`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Verdict: a personal, measured trial for one skincare product. The user photographs the product label; claims and their promised timeframe are extracted and mapped to measurable skin concerns; unmeasurable claims are shown as such and excluded. The user enters price, purchase date, retailer and return window; a check-in plan (14, 28 or 56 day trial) is scheduled so the verdict lands before the return deadline. Guided capture with live face quality indicators. Day 0 takes two consecutive captures whose difference is the measurement noise. Same analysis mode for the whole trial. Verdicts use the unadjusted score only. Per claim result: Holding up / Getting worse only beyond the noise threshold, otherwise No measurable change, showing magnitude and threshold; then a Keep / Return suggestion with the amount at stake and the deadline. Before/after comparison with detection overlays and a slider. Shareable measured review without face photo by default. Health guardrail. Reminders. Face photos stay on device, no account, erase all, privacy page. Analysis budget caps. A real demo trial by the author. Judges can run their own trial on a phone without login. Landing page with sourced stats. English only. Design from the mockups."

## Clarifications

### Session 2026-10-17

- Q: How is the Keep / Return suggestion decided? → A: By the main claim: Keep only if the
  main claim is Holding up and no other measurable claim is Getting worse; otherwise Return.
- Q: When does the health guardrail fire? → A: At the first check-in where redness or acne is
  worse beyond threshold (calm notice); a second consecutive one escalates to "Consider pausing
  this product".
- Q: Should trials be exportable and importable as a backup file? → A: Yes, a local backup
  file with measurements, dates and claims; photos and overlays included only when the user
  ticks that option; nothing goes through a server.
- Q: How many analyses may one device run per day? → A: 5 successful analyses per device per
  day; the global daily cap is set from the measured cost per analysis.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set up a trial from the product label (Priority: P1)

A shopper has just bought a serum that promises to "fade dark spots in 4 weeks". They open
Verdict, photograph the label, and see each printed claim listed with what will be measured
for it, or a plain statement that a photo cannot check it. They enter what they paid, when and
where they bought it, and the retailer's return window. Verdict shows the return deadline and
the date their verdict is scheduled for, before that deadline.

**Why this priority**: It turns a vague promise into a concrete, dated test with money at
stake. Without it nothing else has a reference point.

**Independent Test**: Photograph any skincare label (or type its claims), fill the purchase
form, and confirm the claim list, the measurable mapping, the deadline and the scheduled
verdict date are correct.

**Acceptance Scenarios**:

1. **Given** a clear photo of a label with four measurable claims and one unmeasurable claim,
   **When** the user submits it, **Then** all five claims are listed, four show the concern
   they map to, and the fifth reads that a photo cannot measure it and is left out of the verdict.
2. **Given** the label photo is unreadable or contains no claims, **When** the user submits it,
   **Then** Verdict says so and offers to retake the photo or type the claims manually.
3. **Given** the extracted claims, **When** the user edits, removes or adds a claim, or changes
   its mapped concern, **Then** the trial uses the edited list.
4. **Given** a purchase on October 12 with a 30 day return window, **When** the form is
   complete, **Then** the deadline reads November 11 and the verdict date lands before it with
   the safety margin defined in FR-012.
5. **Given** a claim promising results in 8 weeks but a 30 day return window, **When** the plan
   is computed, **Then** Verdict warns that the verdict will come before the claim's own
   timeframe and schedules it inside the return window anyway.

---

### User Story 2 - Day 0 baseline with a measured noise floor (Priority: P1)

The user takes two photos of their bare face, one right after the other, guided by live
indicators for light, framing and angle. Verdict analyzes both and uses the difference
between them as the measurement noise for each concern. The trial timeline then shows the
upcoming check-ins.

**Why this priority**: The noise floor is what separates a real change from the wobble of
light, angle and camera. Every verdict depends on it.

**Independent Test**: Complete day 0 on a phone and confirm two analyses are stored, a noise
value exists for every measured concern, and the timeline shows the scheduled check-ins.

**Acceptance Scenarios**:

1. **Given** poor framing or lighting, **When** the user is about to capture, **Then** the live
   indicators say what to fix and capture is not sent for analysis until quality passes.
2. **Given** a capture rejected by the analysis service (face too small, too dark, face out of
   frame, image too small), **When** the error returns, **Then** the user sees a specific,
   actionable message and can retake without losing the first photo.
3. **Given** the device camera produces images large enough for high detail analysis, **When**
   day 0 starts, **Then** the trial is locked to high detail; otherwise it is locked to
   standard detail, and every later check-in uses the same mode.
4. **Given** both day 0 analyses succeed, **When** the baseline is set, **Then** each measured
   concern has a noise value and a threshold, visible on request.

---

### User Story 3 - Check-in on schedule (Priority: P1)

On each scheduled day the user gets a reminder, takes one guided photo in matched conditions,
and sees their timeline update. Verdict reminds them of the room, light and hour used on day 0.

**Why this priority**: Without check-ins there is no measurement of change.

**Independent Test**: With a baseline in place, take a check-in and confirm it is analyzed,
stored and placed on the timeline with its date.

**Acceptance Scenarios**:

1. **Given** a check-in is due, **When** the user opens the trial, **Then** the due check-in is
   highlighted with a single action to take today's photo.
2. **Given** a check-in was missed, **When** the user opens the trial later, **Then** they can
   take it late; the timeline records the actual date.
3. **Given** the user picks a reminder hour, **When** they add the trial to their calendar,
   **Then** the downloaded calendar file holds every check-in at that hour with an alert, plus
   the return deadline, and the calendar reminds them on each due day.

---

### User Story 4 - Verdict per claim and Keep / Return (Priority: P1)

On verdict day the user sees, for each measurable claim, whether it is Holding up, Getting
worse, or showed No measurable change, with the size of the change shown next to their own
noise threshold. A suggestion to keep or return the product follows, with the refund at stake
and the days left before the deadline. The decision stays theirs.

**Why this priority**: This is the product's promise and the moment of value.

**Independent Test**: With a baseline and a final check-in, open the verdict and confirm each
claim's status follows the threshold rule, numbers are shown, and the suggestion, amount and
deadline are correct.

**Acceptance Scenarios**:

1. **Given** a concern whose change since day 0 is smaller than its threshold, **When** the
   verdict is computed, **Then** the claim reads "No measurable change".
2. **Given** a change beyond the threshold in the direction the claim promised, **Then** the
   claim reads "Holding up"; beyond the threshold in the opposite direction, "Getting worse".
3. **Given** any verdict, **Then** every measurable claim shows its change, its threshold, and
   the dates compared; unmeasurable claims are listed as not measured.
4. **Given** the verdict, **Then** a Keep or Return suggestion is shown with the price paid,
   the return deadline and the days left, and the user can record their own decision.

---

### User Story 5 - Compare photos with detection overlays (Priority: P2)

The user slides between their day 0 photo and any later check-in, optionally showing the
detection overlay for a chosen concern, with that concern's numbers below.

**Why this priority**: It lets people see what was measured, which builds trust in the
numbers, but the verdict works without it.

**Independent Test**: With two analyzed photos, drag the slider and toggle overlays per
concern; confirm the images align and the numbers match the verdict.

**Acceptance Scenarios**:

1. **Given** two analyzed photos, **When** the user drags the slider, **Then** the view reveals
   one photo over the other at the slider position, by touch and by keyboard.
2. **Given** a chosen concern, **When** overlays are on, **Then** that concern's detection
   overlay appears on both photos with day 0 value, latest value, change and noise below.

---

### User Story 6 - Share a measured review (Priority: P2)

The user creates a "My measured review" card listing each claim's result, the trial length,
the number of sessions and optionally the price paid. Face photos are off by default and are
only added if the user turns them on. They can save it as an image or share it.

**Why this priority**: It turns a private result into an honest review other shoppers can
use, which is the consumer and retail value beyond one person.

**Independent Test**: From a completed verdict, generate the card, confirm it contains only
measured results and no face imagery by default, and save or share it.

**Acceptance Scenarios**:

1. **Given** a completed verdict, **When** the user opens the review, **Then** the card shows
   only measured outcomes (status, change and threshold per claim), dates and the "not
   medical advice" line, with no face photo.
2. **Given** the user turns on face photos, **Then** they are added to the card only after
   that explicit choice, and turning it off removes them.
3. **Given** the card, **When** the user saves or shares it, **Then** the shared output
   contains no data beyond what the card shows.

---

### User Story 7 - Health guardrail and informational notes (Priority: P2)

If redness or acne gets worse beyond the user's threshold at a check-in, Verdict shows a calm
message suggesting they pause the product and talk to a dermatologist or pharmacist, without
naming any condition. If the product was bought online and promises fast results on eczema,
psoriasis or dark spots, Verdict shows a short sourced note about a published study that found
undeclared active ingredients in such products sold online.

**Why this priority**: People act on these results with their own skin; the product must not
push them to keep using something that is making things worse.

**Independent Test**: Feed a trial where redness rises beyond threshold and confirm the
message appears; set up an online purchase with a fast eczema claim and confirm the note
appears with its source link.

**Acceptance Scenarios**:

1. **Given** redness or acne worse beyond threshold at a check-in, **Then** a calm notice
   appears before any other result. **Given** the next check-in confirms it, **Then** the
   message escalates to "Consider pausing this product" with options to pause the trial, find
   a professional, or keep measuring, and states that pausing does not move the deadline.
2. **Given** an online purchase with a claim of fast results on eczema, psoriasis or dark
   spots, **Then** an informational note with a link to the study is shown during setup.
3. **Given** any screen with measurements, **Then** "Indicative results, not medical advice"
   is visible.

---

### User Story 8 - Explore the author's real demo trial (Priority: P2)

A visitor, including a judge, can open a real trial the author recorded on their own skin
with a real product, clearly labelled with its real dates, and browse its timeline, comparison,
verdict and review exactly as a user would.

**Why this priority**: A full trial takes weeks; the demo shows the whole journey with real
data while judging lasts days.

**Independent Test**: From the landing page, open the demo trial and confirm every screen
works, the trial is labelled as the author's real trial with its dates, and it cannot be
edited or deleted by visitors.

**Acceptance Scenarios**:

1. **Given** the landing page, **When** a visitor opens the demo, **Then** every screen of a
   completed trial is browsable and labelled as a real trial recorded by the author.
2. **Given** the demo, **Then** no visitor action spends analysis budget or alters it.

---

### User Story 9 - Privacy and control of personal data (Priority: P1)

The user can read a plain privacy page explaining where each kind of data goes, use every
feature without an account, and erase everything on the device in one confirmed action.

**Why this priority**: Face photos are sensitive biometric data; trust is a precondition for
anyone to use the product.

**Independent Test**: Run a trial, erase all data, and confirm nothing remains on the device;
read the privacy page and confirm it matches the real data flows.

**Acceptance Scenarios**:

1. **Given** stored trials and photos, **When** the user confirms "Delete all trial data",
   **Then** all photos, measurements, trials and settings are removed and the app returns to
   its first run state.
2. **Given** the privacy page, **Then** it states that face photos are stored on the device,
   sent only to the skin analysis provider for analysis and not kept by Verdict, how long the
   provider says it keeps uploads and results, that label photos are sent to a text reading
   service, and that no account exists.

---

### User Story 10 - Judge quick run (Priority: P1)

A judge on a phone, without logging in, starts their own trial from a real label, takes the
day 0 photos, and reaches a verdict screen in one sitting, so they can see every step working
end to end with their own data.

**Why this priority**: The judging window is shorter than any real trial; judges must be able
to test the product themselves.

**Independent Test**: On a fresh phone browser, complete a quick run from landing to verdict
in under 10 minutes without an account.

**Acceptance Scenarios**:

1. **Given** a fresh phone browser, **When** a judge follows the quick run, **Then** they reach
   a verdict computed from their own analyses without logging in.
2. **Given** a quick run, **Then** every screen labels it as a same day test, not a real
   trial, so its "No measurable change" results are expected.

3. **Given** the landing page, **Then** it offers both the quick run and the author's demo
   trial (User Story 8) side by side. A quick run costs three analyses: two for day 0 and one
   immediate check-in.

Decision (2026-10-17): both entry points are offered. The quick run lets the check-in be taken
immediately after day 0 and is labelled as a same day test on every screen.

---

### Edge Cases

- The return window has already closed or closes before a minimum useful trial (fewer than
  7 days left): Verdict says a verdict cannot land in time and offers a trial anyway, labelled
  as past the deadline, without a Keep / Return suggestion.
- No measurable claims on the label: setup explains why and does not start a trial.
- Day 0 noise is exactly zero for a concern: a minimum threshold applies (FR-020) so tiny
  changes never count as real.
- A check-in is analyzed in a different detail mode than day 0 (for example, a different
  phone): it is refused and the user is told to use the original device or start a new trial.
- The analysis budget cap is reached: the user sees a clear message, their data is kept, and
  they can continue later; the demo trial stays available.
- Analysis takes longer than expected or the network drops: the photo stays on the device and
  the analysis can be retried without a second charge for the same request.
- Local storage is unavailable (private browsing, blocked site data): the app still works for
  the current visit and warns that the trial will not be kept.
- The user denies camera access: the app explains how to allow it and offers photo upload.
- Detection overlays expire at the provider after 24 hours: they are saved on the device when
  the analysis returns.
- Two claims map to the same concern: both use the same measurement and show consistent
  results.

## Requirements *(mandatory)*

### Functional Requirements

**Label and claims**

- **FR-001**: Users MUST be able to start a trial by photographing or uploading a product
  label, or by typing claims manually.
- **FR-002**: System MUST extract each printed claim and any promised timeframe from the label
  photo and map each claim to zero or more measurable skin concerns from this set: dark spots,
  wrinkles, redness, hydration, pores, acne, radiance, firmness, texture, oiliness, dark
  circles, eye bags.
- **FR-003**: System MUST show claims with no measurable concern as "not measurable" and
  exclude them from the verdict; it MUST NOT map a claim to a loosely related concern.
- **FR-004**: Users MUST be able to edit claim text, remove or add claims, and change the
  mapped concern before the trial starts.
- **FR-005**: System MUST send only the label image, never a face photo, for claim extraction.

**Purchase and schedule**

- **FR-006**: Users MUST enter price paid, purchase date, retailer and return window (14, 30,
  60, 90 days or a custom number) and whether the purchase was online.
- **FR-007**: System MUST compute the return deadline and show it with the amount at stake.
- **FR-008**: System MUST choose a trial length of 14, 28 or 56 days from the shortest
  timeframe promised by the measurable claims (up to 2 weeks: 14; up to 4 weeks or none
  stated: 28; longer: 56), shortened to fit before the return deadline.
- **FR-009**: System MUST schedule check-ins on these trial days: 14 day trial 0, 7, 14;
  28 day trial 0, 7, 14, 21, 28; 56 day trial 0, 14, 28, 42, 56. When the trial is shortened
  to fit the return window, the last check-in moves to the verdict date and any check-in
  falling after it is dropped.
- **FR-010**: System MUST warn when the claim's own timeframe is longer than the available
  trial length.
- **FR-011**: System MUST let users pick a reminder hour (default: the hour of their day 0
  photos) and MUST offer a downloadable calendar file containing every check-in at that hour
  with an alert, and the return deadline.
- **FR-012**: The verdict date MUST fall before the return deadline with a margin of at least
  2 days for windows up to 14 days and 4 days for longer windows.

**Capture and analysis**

- **FR-013**: Camera capture MUST show live indicators for lighting, framing and angle and
  MUST only take the photo once the face quality check passes. Photos uploaded instead (no
  camera or camera denied) skip the live check; they are checked by the analysis provider,
  which does not charge for rejected photos, and a rejection follows FR-016.
- **FR-014**: Day 0 MUST consist of two consecutive captures, both analyzed.
- **FR-015**: System MUST lock the trial to high detail analysis when day 0 images meet the
  high detail size requirement, otherwise to standard detail, and MUST use that mode for every
  analysis in the trial; mixing modes within one analysis is not allowed.
- **FR-016**: System MUST translate each analysis error (face too small, too dark, face out of
  frame, image too small or too large) into a specific instruction for the user.
- **FR-017**: System MUST store every analysis result and detection overlay on the device as
  soon as it returns.
- **FR-018**: System MUST reuse a stored result instead of re-analyzing the same photo.

**Measurement and verdict**

- **FR-019**: All comparisons, thresholds and verdicts MUST use the unadjusted measurement
  score returned by the analysis. The display-adjusted score MUST NOT be used as evidence.
- **FR-020**: For each concern, noise MUST equal the absolute difference between the two day 0
  measurements; the threshold MUST equal noise multiplied by a fixed factor, with a minimum
  threshold per concern. The factor and minimums are set from calibration on real captures and
  documented publicly.
- **FR-021**: Change MUST be measured between the day 0 baseline (mean of the two day 0
  measurements) and the latest check-in.
- **FR-022**: A claim MUST read "Holding up" when the change exceeds the threshold in the
  promised direction, "Getting worse" when it exceeds it in the opposite direction, and "No
  measurable change" otherwise. A claim mapped to several concerns reports each concern.
- **FR-023**: Every result MUST display the change, the threshold and the dates compared.
- **FR-024**: Each trial has one main claim: by default the first measurable claim with a
  promised timeframe, else the first measurable claim; the user can change it during setup.
  System MUST suggest "Keep" only when the main claim is Holding up and no other measurable
  claim is Getting worse; otherwise "Return". The suggestion MUST name the main claim, show
  the price paid, the deadline and the days left, and the user MUST be able to record their
  own choice.

**Compare and share**

- **FR-025**: Users MUST be able to compare day 0 with any later check-in using a slider
  operable by touch and keyboard, with per concern detection overlays and numbers.
- **FR-026**: Users MUST be able to generate a "My measured review" card from measurements
  only, with face photos off by default and price optional, and save it as an image or share
  it through the device's share options. Each claim row on the card MUST show its status, its
  change and its threshold, like the verdict screen.

**Safety and information**

- **FR-027**: At the first check-in where redness or acne is worse beyond threshold, System
  MUST show a calm notice that the reading went up, with advice to stop the product and talk
  to a dermatologist or pharmacist if skin itches, burns or swells. When the next check-in
  confirms it, System MUST escalate to "Consider pausing this product" with options to pause,
  find a professional or keep measuring. Both levels state that pausing does not move the
  return deadline, and show the readings involved with the threshold they crossed.
- **FR-028**: When a purchase is online and a claim promises fast results (4 weeks or less, or
  words such as instant, fast or rapid) on eczema, psoriasis or dark spots, System MUST show an
  informational note linking the JAMA Network Open study on undeclared active ingredients.
- **FR-029**: System MUST NOT diagnose, name conditions on the user's skin, or recommend
  treatments. "Indicative results, not medical advice" MUST be visible on every screen with
  measurements.

**Privacy and data**

- **FR-030**: Face photos MUST be stored only on the user's device and sent only to the skin
  analysis provider for analysis; Verdict's servers MUST NOT store or log them.
- **FR-031**: The app MUST work fully without an account.
- **FR-032**: Users MUST be able to delete all trial data on the device in one action after a
  confirmation.
- **FR-033**: A privacy page MUST describe every data flow accurately, including the
  provider's documented retention (uploaded files and task results up to 30 days, analysis
  results described as kept 24 hours) and the label reading service.
- **FR-033b**: Users MUST be able to export a trial to a backup file saved on their device and
  import it back on any device. The file contains claims, purchase details, schedule and
  measurements; photos and detection overlays are included only when the user ticks "Include
  photos". Export and import happen entirely on the device. An import that mixes detail modes
  or is malformed is rejected with a clear message.

**Budget and availability**

- **FR-034**: System MUST allow at most 5 successful analyses per device per day (failed
  analyses do not count) and MUST enforce a global cap made of a pace line (the balance never
  falls below a straight line from the launch balance to a reserve on 2026-11-20) and a per day
  ceiling on units spent since 00:00 UTC, both derived from the measured cost per analysis, so
  total spend stays within budget until 2026-11-20.
  Reaching a cap MUST show a clear message saying when analyses resume, and keep the user's data.
- **FR-035**: System MUST offer the author's real demo trial, read only, labelled with its real
  dates, available without spending analysis budget.
- **FR-035b**: System MUST offer a quick run from the landing page: day 0 followed by one
  immediate check-in and a verdict, labelled "Same day test" on every screen and never
  presented as a real trial. It uses the same rules and caps as a real trial.

**Landing and language**

- **FR-036**: The landing page MUST explain the problem with statistics that each link to
  their source; unverifiable figures are not shown.
- **FR-037**: All user facing text MUST be in English, without emoji and without dashes used as
  punctuation.
- **FR-038**: The app MUST be installable on a phone home screen and usable at phone width.

### Key Entities

- **Trial**: one product being tested. Product name, size, purchase price, purchase date,
  retailer, online purchase flag, return window, deadline, trial length, detail mode, schedule,
  status (setup, baseline, active, paused, complete), user's final decision, kind (real,
  quick run, demo).
- **Claim**: a promise from the label. Original text, promised timeframe, mapped concerns
  (possibly none), promised direction, main claim flag (exactly one per trial), edited by
  user flag.
- **Session**: one capture event. Scheduled date, actual date and time, kind (day 0 first,
  day 0 second, check-in), photo reference, quality indicators at capture.
- **Measurement**: one concern's result in one session. Concern, unadjusted score, adjusted
  score kept for reference, detection overlay reference.
- **Baseline**: per concern, the two day 0 values, their mean, the noise and the threshold.
- **Verdict**: per claim status, change, threshold, dates compared, overall suggestion, amount
  at stake, days left.
- **Review card**: the shareable summary derived from a verdict, with face photo and price
  toggles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first time user completes setup from label photo to scheduled trial in under
  3 minutes on a phone.
- **SC-002**: At least 90% of label photos of real products yield the correct list of printed
  claims, verified on a set of at least 10 labels.
- **SC-003**: Day 0 (two photos with guidance) completes in under 4 minutes, and fewer than 1
  in 5 captures is rejected by the analysis provider after passing the on device quality check.
- **SC-004**: In 100% of computed verdicts, no claim is reported as Holding up or Getting worse
  when its change is within its threshold (verified with automated tests on recorded data).
- **SC-005**: Every verdict date falls before the return deadline with the required margin, for
  all supported return windows.
- **SC-006**: A judge on a phone completes a run from the landing page to a verdict in under 10
  minutes without an account.
- **SC-007**: Total analysis spend stays within the 1,000 unit budget from launch through
  2026-11-20, including the author's demo trial and calibration.
- **SC-008**: After "Delete all trial data", zero trial records or photos remain on the device.
- **SC-009**: Every statistic on the landing page and in the documentation links to a source.

## Assumptions

- Target users are adult shoppers in the US who buy skincare in store or online and can take
  a selfie with a phone; Verdict is not built for minors or clinical use.
- Skin analysis is provided by YouCam AI Skin Analysis and capture guidance by the YouCam
  camera kit; claim extraction uses an image reading language model. These are dependencies.
- Whether a higher unadjusted score means more or less of a concern is determined per concern
  during calibration and fixed before launch.
- The noise factor and per concern minimum thresholds are decided after calibration on real
  captures (decision recorded 2026-10-17), and published in the README.
- Sharing produces an image or a link that carries the card's numbers itself; nothing is
  stored on a server, so shared links cannot be revoked and the mockup's revoke line is dropped.
- The budget caps hold a random anonymous identifier per device and a daily counter only; no
  personal data is involved.
- Reminders are delivered through calendar alerts in the downloaded calendar file, which work
  on every phone without a server or push subscription; in app, a due check-in is highlighted
  when the user opens Verdict. Browser push notifications are out of scope because scheduling
  them would require storing a subscription and a schedule on a server.
- Retailer return policies vary; Verdict reminds users to check whether opened products can
  be returned and does not verify policies.
- The author's demo trial starts with day 0 recorded through calibration scripts before the
  app exists; the scripts write the same backup file format (FR-033b), so its data is
  imported into the app unchanged.
- Terms: "check-in" (one scheduled photo session after day 0; the mockups' "checkpoint" means
  the same thing and is not used in the app), "overlay" in the interface and "mask" in code
  for the provider's detection image, "unadjusted score" in documents and `raw` in code for
  the provider's `raw_score`.
- The mockups in `design/project` define layout and visual language; their sample numbers are
  replaced by real data, and their privacy text is rewritten to match the real data flows.
