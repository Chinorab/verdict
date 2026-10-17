# Backup File Contract

Used for user export and import (FR-033b), for the author's demo trial, and as the output of
`scripts/to-backup.mjs` that converts calibration runs into a trial.

- File name: `verdict-<product-slug>-<YYYY-MM-DD>.verdict.json`
- Media type: `application/json`, UTF-8.

```json
{
  "format": "verdict-backup",
  "version": 1,
  "exportedAt": "2026-11-01T20:30:00Z",
  "includesPhotos": false,
  "trial": { "...": "Trial record, see data-model.md, without photo blobs" },
  "claims": [ { "...": "Claim records" } ],
  "sessions": [ { "...": "Session records; photoId kept only when includesPhotos is true" } ],
  "measurements": [ { "sessionId": "...", "concern": "redness", "raw": 41.2, "ui": 78, "maskIds": [] } ],
  "photos": [ { "id": "...", "kind": "face", "type": "image/jpeg", "data": "<base64>" } ]
}
```

Rules:

- `photos` is present only when `includesPhotos` is true; masks and face photos are both
  photos.
- Import validates with the same Zod schemas, refuses a mix of modes across sessions,
  refuses unknown concerns, and creates a new trial id so an import never overwrites.
- Demo files set `trial.kind` to `demo`; the app opens them read only.
- No server ever receives this file.
