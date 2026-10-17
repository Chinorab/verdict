import { describe, expect, it } from "vitest";
import { backupFileName, BackupError, buildBackup, parseBackup } from "@/lib/backup-core";
import { verdictSeed } from "../e2e/seed";

const seed = () => {
  const s = verdictSeed({ age_spot: 41, radiance: 64 });
  s.sessions[0].photoId = "face-a";
  s.measurements[0].maskIds = ["mask-a"];
  return s;
};
const photos = [
  { id: "face-a", kind: "face" as const, type: "image/jpeg", data: "AAAA" },
  { id: "mask-a", kind: "mask" as const, type: "image/png", data: "BBBB" },
];
let n = 0;
const newId = () => `new-${++n}`;

describe("buildBackup", () => {
  it("without photos drops photo references", () => {
    const b = buildBackup({ ...seed(), photos: null, now: new Date("2026-11-08T10:00:00Z") });
    expect(b.includesPhotos).toBe(false);
    expect(b.photos).toBeUndefined();
    expect(b.sessions.every((s) => s.photoId === null)).toBe(true);
    expect(b.measurements.every((m) => m.maskIds.length === 0)).toBe(true);
  });

  it("with photos keeps them", () => {
    const b = buildBackup({ ...seed(), photos, now: new Date("2026-11-08T10:00:00Z") });
    expect(b.includesPhotos).toBe(true);
    expect(b.photos).toHaveLength(2);
  });
});

describe("parseBackup", () => {
  it("round trips with new ids everywhere and references kept consistent", () => {
    const s = seed();
    const text = JSON.stringify(buildBackup({ ...s, photos, now: new Date("2026-11-08T10:00:00Z") }));
    const r = parseBackup(text, newId);
    expect(r.trial.id).not.toBe(s.trial.id);
    expect(r.claims.every((c) => c.trialId === r.trial.id && !s.claims.some((o) => o.id === c.id))).toBe(true);
    const sessionIds = new Set(r.sessions.map((x) => x.id));
    expect(r.measurements.every((m) => sessionIds.has(m.sessionId))).toBe(true);
    const photoIds = new Set(r.photos.map((p) => p.id));
    expect(r.sessions.find((x) => x.kind === "day0_a")!.photoId).toSatisfy((id: string) => photoIds.has(id));
    expect(r.measurements.flatMap((m) => m.maskIds).every((id) => photoIds.has(id))).toBe(true);
    expect(r.measurements).toHaveLength(s.measurements.length);
  });

  it("importing twice creates two separate trials", () => {
    const text = JSON.stringify(buildBackup({ ...seed(), photos: null, now: new Date() }));
    expect(parseBackup(text, newId).trial.id).not.toBe(parseBackup(text, newId).trial.id);
  });

  it("refuses a file that is not a Verdict backup", () => {
    expect(() => parseBackup("{}", newId)).toThrow(BackupError);
    expect(() => parseBackup("not json", newId)).toThrow(BackupError);
  });

  it("refuses a damaged file", () => {
    const b = buildBackup({ ...seed(), photos: null, now: new Date() }) as unknown as Record<string, unknown>;
    delete b.trial;
    expect(() => parseBackup(JSON.stringify(b), newId)).toThrowError("invalid");
  });

  it("refuses mixed detail modes", () => {
    const s = seed();
    s.sessions[2] = { ...s.sessions[2], width: 720, height: 1280 }; // below HD in an HD trial
    const text = JSON.stringify(buildBackup({ ...s, photos: null, now: new Date() }));
    expect(() => parseBackup(text, newId)).toThrowError("mixed_mode");
  });

  it("a demo file opened as an import becomes a normal trial unless asked otherwise", () => {
    const s = seed();
    s.trial.kind = "demo";
    const text = JSON.stringify(buildBackup({ ...s, photos: null, now: new Date() }));
    expect(parseBackup(text, newId).trial.kind).toBe("real");
    expect(parseBackup(text, newId, { kind: "demo" }).trial.kind).toBe("demo");
  });
});

it("names the file after the product and date", () => {
  expect(backupFileName({ product: { name: "Brightening Serum!" } }, "2026-11-08")).toBe("verdict-brightening-serum-2026-11-08.verdict.json");
});
