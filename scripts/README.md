# Calibration scripts

Real YouCam analyses run before the app exists, to learn how much a reading moves between
identical captures. Node 20+, no dependencies. The key goes in `.env.local` at the repo root
(`YOUCAM_API_KEY=...`); it is never printed. Photos in `scripts/photos/` and results in
`scripts/out/` are git ignored because they show a face.

## Capture protocol

- No makeup, same room, same lamp or window, same time of day for every session.
- Face straight to the camera, filling at least 60% of the photo width (YouCam rejects smaller
  faces with `error_src_face_too_small`).
- HD needs the short side of the photo to be at least 1080 px. Below that, use `--mode sd`
  and keep SD for the whole trial.
- Day 0: photo A, then photo B right after without moving. Then step away, come back and take
  photo C. A vs B measures the camera and the model; A vs C adds repositioning, which is what a
  real check in looks like.

## Commands

```
node scripts/cost.mjs
node scripts/analyze.mjs --label day0 --mode hd scripts/photos/a.jpg scripts/photos/b.jpg scripts/photos/c.jpg
node scripts/analyze.mjs --label day0 --mode hd --confirm scripts/photos/a.jpg scripts/photos/b.jpg scripts/photos/c.jpg
node scripts/noise.mjs scripts/out/day0/a.json scripts/out/day0/b.json
node scripts/noise.mjs scripts/out/day0/a.json scripts/out/day0/b.json scripts/out/day0/c.json
```

`cost.mjs` and a run without `--confirm` are free. `--confirm` spends units and records the
balance before and after in `scripts/out/ledger.jsonl`, which gives the real cost per analysis.
