# Demo video (1 min 52 s; contest limit 3 min, own target 2 min 30 s)

Built from the real app, end to end, by three scripts in `video/`:

```
D:/claude/beneficia/.venv/Scripts/python.exe video/voice.py   # narration, Piper en_US-ryan-high, local
npx next build && npx next start -p 3770                       # production build, local
node video/record.mjs                                          # one continuous take, 1920 x 1080
node video/build.mjs                                           # -> video/out/verdict-demo.mp4
```

Rules applied (contest rules and the project constitution):

- No third party trademark: the product's brand name is replaced on screen by "Soothing cream".
- No copyrighted music: narration only.
- No real face: the faces are the three **synthetic test faces** of a fictional person
  (`scripts/photos/synthetic`), labelled on screen every time they appear.
- No invented number: every YouCam reply is the real response recorded for those faces on
  2026-10-22 (`scripts/out/synthetic`, masks included); the label reading is the real one Claude
  returned for the author's product (kept in `public/demo/demo-trial.verdict.json`); the author's
  trial is that same demo file.

| Scene | Picture | Data |
|---|---|---|
| title | Title card | |
| problem | 47% of 633 brands | M11 report, Dermatology Times, Oct 13, 2026 (README sources) |
| scan | Label scan, two claims left out with reasons | Real reading of the author's label, replayed; a grey image stands in for the label photo |
| claim | "Sa texture fraîche hydrate" added, Hydration picked | The author's claim, as corrected for the demo |
| purchase | $30, Oct 24, 30 day window, verdict Nov 19 | The author's real purchase |
| capture | Camera kit with live Light, Framing, Angle; photo A | Synthetic face A |
| baseline | Measuring, photo B, "Baseline set" | Real YouCam results for faces A and B (HD) |
| demo | The author's real trial, read only | public/demo, day 0 Oct 24, 2026 |
| verdict | Verdict photo C on Nov 19, "Return it.", hydration +0.2 inside ±3.4 | Real YouCam result for face C against A and B |
| rawscore | Claim rows with threshold bars | raw_score vs ui_score gap from README "What we learned" (pores raw 12.5 to 19.9, ui 51 to 54) |
| compare | Slider with YouCam detection masks | Real masks for faces A and C |
| privacy | Privacy page | Static copy |
| closing | verdict-skin.vercel.app | |

Narration text lives in `video/voice.py`; captions in `video/record.mjs`. Upload to YouTube is done
by the author (public or unlisted link on the Devpost form).
