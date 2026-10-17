import { imageFitsMode } from "./measure/baseline";
import { BackupFile, type Claim, type Measurement, type Session, type Trial } from "./schemas";

/*
  Backup file format (contracts/backup-file.md, FR-033b). Pure functions so they run in tests;
  src/lib/backup.ts adds the device side (IndexedDB, blobs, file download).
*/

export type BackupPhoto = { id: string; kind: "face" | "mask" | "label"; type: string; data: string };

export function buildBackup(input: {
  trial: Trial;
  claims: Claim[];
  sessions: Session[];
  measurements: Measurement[];
  photos: BackupPhoto[] | null; // null = without photos
  now: Date;
}): BackupFile {
  const withPhotos = input.photos !== null;
  return {
    format: "verdict-backup",
    version: 1,
    exportedAt: input.now.toISOString(),
    includesPhotos: withPhotos,
    trial: input.trial,
    claims: input.claims,
    sessions: input.sessions.map((s) => (withPhotos ? s : { ...s, photoId: null })),
    measurements: input.measurements.map((m) => (withPhotos ? m : { ...m, maskIds: [] })),
    ...(withPhotos ? { photos: input.photos! } : {}),
  };
}

export class BackupError extends Error {
  constructor(readonly code: "not_verdict" | "invalid" | "mixed_mode") {
    super(code);
  }
}

export const BACKUP_ERROR_COPY: Record<BackupError["code"], string> = {
  not_verdict: "This file is not a Verdict backup.",
  invalid: "This backup file is damaged or incomplete.",
  mixed_mode: "This backup mixes photos measured in different ways, so its results cannot be compared.",
};

/**
  Validates a backup and gives every record a new id, so an import never overwrites a trial
  already on the device. Returns records ready to store.
*/
export function parseBackup(text: string, newId: () => string, opts: { kind?: Trial["kind"] } = {}) {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError("not_verdict");
  }
  if (!json || typeof json !== "object" || (json as { format?: unknown }).format !== "verdict-backup") {
    throw new BackupError("not_verdict");
  }
  const parsed = BackupFile.safeParse(json);
  if (!parsed.success) throw new BackupError("invalid");
  const b = parsed.data;

  // Every analyzed photo must fit the trial's single mode (SD and HD never mix, FR-015).
  const analyzed = b.sessions.filter((s) => s.state === "done");
  if (analyzed.length > 0) {
    if (!b.trial.mode) throw new BackupError("mixed_mode");
    if (!analyzed.every((s) => imageFitsMode(s, b.trial.mode!))) throw new BackupError("mixed_mode");
  }
  const sessionIds = new Set(b.sessions.map((s) => s.id));
  if (b.measurements.some((m) => !sessionIds.has(m.sessionId))) throw new BackupError("invalid");

  const trialId = newId();
  const sessionMap = new Map(b.sessions.map((s) => [s.id, newId()]));
  const photoMap = new Map((b.photos ?? []).map((p) => [p.id, newId()]));
  const mapPhoto = (id: string | null) => (id && photoMap.has(id) ? photoMap.get(id)! : null);

  const trial: Trial = { ...b.trial, id: trialId, kind: opts.kind ?? (b.trial.kind === "demo" ? "real" : b.trial.kind) };
  const claims: Claim[] = b.claims.map((c) => ({ ...c, id: newId(), trialId }));
  const sessions: Session[] = b.sessions.map((s) => ({ ...s, id: sessionMap.get(s.id)!, trialId, photoId: mapPhoto(s.photoId) }));
  const measurements: Measurement[] = b.measurements.map((m) => ({
    ...m,
    sessionId: sessionMap.get(m.sessionId)!,
    maskIds: m.maskIds.map((id) => mapPhoto(id)).filter((x): x is string => x !== null),
  }));
  const photos = (b.photos ?? []).map((p) => ({ ...p, id: photoMap.get(p.id)! }));
  return { trial, claims, sessions, measurements, photos, includesPhotos: b.includesPhotos };
}

export function backupFileName(trial: Pick<Trial, "product">, date: string) {
  const slug = trial.product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trial";
  return `verdict-${slug}-${date}.verdict.json`;
}
