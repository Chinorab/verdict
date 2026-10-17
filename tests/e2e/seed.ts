import type { Page } from "@playwright/test";
import type { Claim, Measurement, Session, Trial } from "../../src/lib/schemas";

/*
  Writes a trial straight into the page's IndexedDB, with the same stores as src/lib/db.ts.
  Seeded numbers are test inputs for the verdict rules, not product data.
*/
export type Seed = { trial: Trial; claims: Claim[]; sessions: Session[]; measurements: Measurement[] };

export async function seedTrial(page: Page, seed: Seed) {
  await page.evaluate(async (data) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("verdict", 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore("trials", { keyPath: "id" });
        d.createObjectStore("claims", { keyPath: "id" }).createIndex("trialId", "trialId");
        d.createObjectStore("sessions", { keyPath: "id" }).createIndex("trialId", "trialId");
        d.createObjectStore("measurements", { keyPath: ["sessionId", "concern"] }).createIndex("sessionId", "sessionId");
        d.createObjectStore("photos", { keyPath: "id" }).createIndex("trialId", "trialId");
        d.createObjectStore("settings", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(["trials", "claims", "sessions", "measurements"], "readwrite");
    tx.objectStore("trials").put(data.trial);
    for (const c of data.claims) tx.objectStore("claims").put(c);
    for (const s of data.sessions) tx.objectStore("sessions").put(s);
    for (const m of data.measurements) tx.objectStore("measurements").put(m);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, seed);
}

/** A 30 day trial bought Oct 12, day 0 Oct 12, last check-in Nov 7 (the Claims mockup dates). */
export function verdictSeed(latest: Record<string, number>): Seed {
  const trialId = "seed-trial";
  const trial: Trial = {
    id: trialId,
    kind: "real",
    status: "active",
    createdAt: "2026-10-12T20:00:00.000Z",
    product: { name: "Test Serum", size: "30 ml" },
    purchase: { price: 38, currency: "USD", date: "2026-10-12", retailer: "", online: false, returnDays: 30 },
    deadline: "2026-11-11",
    trialDays: 26,
    verdictDate: "2026-11-07",
    mode: "hd",
    reminderHour: 20,
    schedule: [
      { day: 0, date: "2026-10-12", kind: "day0" },
      { day: 26, date: "2026-11-07", kind: "verdict" },
    ],
    decision: "undecided",
    guardrail: { level: 0 },
    notes: { jamaNoteShown: false, timeframeWarning: true },
  };
  const claim = (id: string, text: string, concern: Claim["targets"][number]["concern"] | null, main: boolean, position: number): Claim => ({
    id,
    trialId,
    text,
    timeframeDays: 28,
    targets: concern ? [{ concern, direction: concern === "radiance" ? "increase" : "decrease" }] : [],
    measurable: concern !== null,
    unmeasurableReason: concern ? null : "A photo cannot measure this.",
    main,
    healthTerms: [],
    fastPromise: false,
    editedByUser: false,
    position,
  });
  const session = (id: string, kind: Session["kind"], takenAt: string): Session => ({
    id,
    trialId,
    kind,
    scheduledDay: 0,
    takenAt,
    photoId: null,
    width: 1080,
    height: 1920,
    quality: null,
    taskId: null,
    state: "done",
    error: null,
  });
  const day0 = { age_spot: [40, 44], radiance: [60, 61], texture: [30, 32], redness: [20, 21], acne: [5, 5] } as const;
  const measurements: Measurement[] = [];
  for (const [concern, [a, b]] of Object.entries(day0)) {
    measurements.push({ sessionId: "s-a", concern: concern as Measurement["concern"], raw: a, ui: 50, maskIds: [] });
    measurements.push({ sessionId: "s-b", concern: concern as Measurement["concern"], raw: b, ui: 50, maskIds: [] });
  }
  for (const [concern, raw] of Object.entries(latest)) {
    measurements.push({ sessionId: "s-c", concern: concern as Measurement["concern"], raw, ui: 50, maskIds: [] });
  }
  return {
    trial,
    claims: [
      claim("c1", "Fades dark spots in 4 weeks", "age_spot", true, 0),
      claim("c2", "Radiant glow", "radiance", false, 1),
      claim("c3", "Smoother skin texture", "texture", false, 2),
      claim("c4", "72 hour hydration", null, false, 3),
    ],
    sessions: [
      session("s-a", "day0_a", "2026-10-12T20:30:00.000Z"),
      session("s-b", "day0_b", "2026-10-12T20:32:00.000Z"),
      session("s-c", "checkin", "2026-11-07T20:30:00.000Z"),
    ],
    measurements,
  };
}
