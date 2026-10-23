# Test fixtures

Recorded from real API responses during calibration; never written by hand.

- `youcam/task-success-hd.json`: `GET /api/analysis/task/{id}` body for a successful HD analysis. Recorded 2026-10-22 from a real YouCam v2.1 HD response on a SYNTHETIC test face (`scripts/photos/synthetic/a.png`, a fictional person), whole face entries only, mask URLs removed.
- `youcam/task-error-face-too-small.json`: the same route answering `{ "status": "error", "code": "error_src_face_too_small" }` as returned for a real rejected photo.
- `claims/serum.json`: `POST /api/claims` body for a real label photo.
- `labels/`: label photos for the claim reading evaluation (no faces).

Face photos are never stored here.
