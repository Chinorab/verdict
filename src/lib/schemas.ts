import { z } from "zod";

// Shared by the device and the server routes. See specs/001-measured-skincare-trial/data-model.md.

export const CONCERNS = [
  "age_spot",
  "wrinkle",
  "texture",
  "dark_circle",
  "redness",
  "pore",
  "acne",
  "oiliness",
  "moisture",
  "firmness",
  "radiance",
  "eye_bag",
] as const;
export const Concern = z.enum(CONCERNS);
export type Concern = z.infer<typeof Concern>;

/** Plain names shown to users. */
export const CONCERN_LABEL: Record<Concern, string> = {
  age_spot: "Dark spots",
  wrinkle: "Wrinkles",
  texture: "Texture",
  dark_circle: "Dark circles",
  redness: "Redness",
  pore: "Pores",
  acne: "Blemishes",
  oiliness: "Oiliness",
  moisture: "Hydration",
  firmness: "Firmness",
  radiance: "Radiance",
  eye_bag: "Eye bags",
};

/** What "better" means for each concern when a user types a claim by hand. */
export const DEFAULT_DIRECTION: Record<Concern, "decrease" | "increase"> = {
  age_spot: "decrease",
  wrinkle: "decrease",
  texture: "decrease",
  dark_circle: "decrease",
  redness: "decrease",
  pore: "decrease",
  acne: "decrease",
  oiliness: "decrease",
  moisture: "increase",
  firmness: "increase",
  radiance: "increase",
  eye_bag: "decrease",
};

export const Mode = z.enum(["sd", "hd"]);
export type Mode = z.infer<typeof Mode>;

export const Direction = z.enum(["decrease", "increase"]);
export type Direction = z.infer<typeof Direction>;

export const HealthTerm = z.enum(["eczema", "psoriasis", "dark_spots"]);
export type HealthTerm = z.infer<typeof HealthTerm>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const isoDateTime = z.string().datetime({ offset: true });

export const Target = z.object({ concern: Concern, direction: Direction });
export type Target = z.infer<typeof Target>;

/* What the label reader returns, before the user edits it. */
export const ExtractedClaim = z.object({
  text: z.string().min(1).max(200),
  timeframeDays: z.number().int().positive().max(365).nullable(),
  targets: z.array(Target).max(4),
  measurable: z.boolean(),
  unmeasurableReason: z.string().max(200).nullable(),
  healthTerms: z.array(HealthTerm),
  fastPromise: z.boolean(),
});
export type ExtractedClaim = z.infer<typeof ExtractedClaim>;

export const LabelReading = z.object({
  product: z.object({ name: z.string().max(80), size: z.string().max(40).nullable() }),
  claims: z.array(ExtractedClaim).max(20),
});
export type LabelReading = z.infer<typeof LabelReading>;

export const TrialKind = z.enum(["real", "quick", "demo"]);
export const TrialStatus = z.enum(["setup", "baseline", "active", "paused", "complete"]);
export const SessionKind = z.enum(["day0_a", "day0_b", "checkin"]);
export const ScheduleItem = z.object({
  day: z.number().int().min(0),
  date: isoDate,
  kind: z.enum(["day0", "checkin", "verdict"]),
});
export type ScheduleItem = z.infer<typeof ScheduleItem>;

export const Trial = z.object({
  id: z.string().min(1),
  kind: TrialKind,
  status: TrialStatus,
  createdAt: isoDateTime,
  product: z.object({ name: z.string().min(1).max(80), size: z.string().max(40).optional() }),
  purchase: z.object({
    price: z.number().min(0).max(100000),
    currency: z.literal("USD"),
    date: isoDate,
    retailer: z.string().max(80),
    online: z.boolean(),
    returnDays: z.number().int().min(1).max(365),
  }),
  deadline: isoDate,
  trialDays: z.number().int().min(0).max(56),
  verdictDate: isoDate,
  mode: Mode.nullable(),
  reminderHour: z.number().int().min(0).max(23),
  schedule: z.array(ScheduleItem),
  decision: z.enum(["keep", "return", "undecided"]),
  guardrail: z.object({
    level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    concern: z.enum(["redness", "acne"]).optional(),
    at: isoDateTime.optional(),
  }),
  notes: z.object({ jamaNoteShown: z.boolean(), timeframeWarning: z.boolean() }),
});
export type Trial = z.infer<typeof Trial>;

export const Claim = z.object({
  id: z.string().min(1),
  trialId: z.string().min(1),
  text: z.string().min(1).max(200),
  timeframeDays: z.number().int().positive().max(365).nullable(),
  targets: z.array(Target).max(4),
  measurable: z.boolean(),
  unmeasurableReason: z.string().max(200).nullable(),
  main: z.boolean(),
  healthTerms: z.array(HealthTerm),
  fastPromise: z.boolean(),
  editedByUser: z.boolean(),
  /** Order on the label (IndexedDB returns records by key, not by insertion). */
  position: z.number().int().min(0).optional(),
});
export type Claim = z.infer<typeof Claim>;

export const Session = z.object({
  id: z.string().min(1),
  trialId: z.string().min(1),
  kind: SessionKind,
  scheduledDay: z.number().int().min(0),
  takenAt: isoDateTime,
  photoId: z.string().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  quality: z.object({ position: z.string(), frontal: z.string(), lighting: z.string() }).nullable(),
  taskId: z.string().nullable(),
  state: z.enum(["pending", "analyzing", "done", "failed"]),
  error: z.string().nullable(),
});
export type Session = z.infer<typeof Session>;

export const Measurement = z.object({
  sessionId: z.string().min(1),
  concern: Concern,
  raw: z.number(),
  ui: z.number(),
  maskIds: z.array(z.string()),
});
export type Measurement = z.infer<typeof Measurement>;

export const PhotoKind = z.enum(["face", "mask", "label"]);
export type PhotoRecord = {
  id: string;
  trialId: string;
  kind: z.infer<typeof PhotoKind>;
  blob: Blob;
  type: string;
};

/* Backup file, contracts/backup-file.md */
export const BackupPhoto = z.object({
  id: z.string(),
  kind: PhotoKind,
  type: z.string(),
  data: z.string(), // base64
});
export const BackupFile = z.object({
  format: z.literal("verdict-backup"),
  version: z.literal(1),
  exportedAt: isoDateTime,
  includesPhotos: z.boolean(),
  trial: Trial,
  claims: z.array(Claim),
  sessions: z.array(Session),
  measurements: z.array(Measurement),
  photos: z.array(BackupPhoto).optional(),
});
export type BackupFile = z.infer<typeof BackupFile>;

/* Analysis route payloads, contracts/api.md */
export const UploadRequest = z.object({
  contentType: z.enum(["image/jpeg", "image/png"]),
  size: z.number().int().positive().max(10 * 1024 * 1024 - 1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mode: Mode,
});
export const TaskRequest = z.object({
  fileId: z.string().min(1).max(500),
  mode: Mode,
  concerns: z.array(Concern).min(1).max(CONCERNS.length),
});

export const MIN_SHORT_SIDE: Record<Mode, number> = { sd: 480, hd: 1080 };
