# Gallery screenshots

Taken on 2026-10-24 from a production build of the live code, phone
viewport (390 x 844 at 3x), by `tests/e2e/gallery.spec.ts`:

```
GALLERY_DIR=docs/screenshots E2E_BASE_URL=<deployment url> E2E_VERCEL_BYPASS=<secret> npx playwright test tests/e2e/gallery.spec.ts --project=mobile
```

No face photo appears in any image. The product's brand name is replaced by "Soothing cream"
(contest rule for the video, applied to the gallery too).

| File | Screen | Data shown |
|---|---|---|
| `1-landing.png` | Landing | Static copy. |
| `2-claims.png` | Claims after a label scan | The two claims Claude read from the real label of the author's product on the author's phone, with its reasons for leaving them out. The reading is replayed from the demo trial, so no paid call is made; a grey image stands in for the label photo, which this screen does not show. |
| `3-capture.png` | Guided capture, day 0 | Live quality indicators driven by a test double of the camera kit (light "ok", framing and angle good), so the camera area is empty: no face. |
| `4-demo-timeline.png` | The author's real trial | `public/demo/demo-trial.verdict.json`, day 0 measured on Oct 24, 2026. |
| `5-privacy.png` | Privacy | Static copy. |

The verdict and review card screens need a measured check-in. They are added after the
author's Oct 31 check-in, from the same script.

## Devpost gallery

`docs/gallery/` holds the extra images used on Devpost, all frames of the demo video (synthetic test
faces, labelled; brand hidden): `6-capture-synthetic.jpg`, `7-verdict-synthetic.jpg`,
`8-compare-synthetic.jpg`, and `thumbnail.jpg` (the verdict frame padded to 3:2). Gallery order on
Devpost: verdict, landing, claims, capture, compare, author's trial, privacy.
