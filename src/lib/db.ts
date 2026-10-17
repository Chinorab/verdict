"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Claim, Measurement, PhotoRecord, Session, Trial } from "./schemas";

/*
  On device storage (constitution II). IndexedDB when available; otherwise an in memory store
  that keeps the app usable for the current visit and flags storageAvailable = false so the UI
  can warn that nothing will be kept. Every access is wrapped so a blocked or full database
  never crashes a screen.
*/

export type Settings = { id: "settings"; storageAvailable: boolean; lastBackupAt?: string };

interface VerdictDB extends DBSchema {
  trials: { key: string; value: Trial };
  claims: { key: string; value: Claim; indexes: { trialId: string } };
  sessions: { key: string; value: Session; indexes: { trialId: string } };
  measurements: { key: [string, string]; value: Measurement; indexes: { sessionId: string } };
  photos: { key: string; value: PhotoRecord; indexes: { trialId: string } };
  settings: { key: string; value: Settings };
}

export const DB_NAME = "verdict";
const VERSION = 1;

type StoreName = "trials" | "claims" | "sessions" | "measurements" | "photos" | "settings";

let dbPromise: Promise<IDBPDatabase<VerdictDB> | null> | null = null;
const memory: Record<StoreName, Map<string, unknown>> = {
  trials: new Map(),
  claims: new Map(),
  sessions: new Map(),
  measurements: new Map(),
  photos: new Map(),
  settings: new Map(),
};
let available = true;

function open(): Promise<IDBPDatabase<VerdictDB> | null> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    try {
      if (typeof indexedDB === "undefined") throw new Error("no indexedDB");
      return await openDB<VerdictDB>(DB_NAME, VERSION, {
        upgrade(db) {
          db.createObjectStore("trials", { keyPath: "id" });
          db.createObjectStore("claims", { keyPath: "id" }).createIndex("trialId", "trialId");
          db.createObjectStore("sessions", { keyPath: "id" }).createIndex("trialId", "trialId");
          db.createObjectStore("measurements", { keyPath: ["sessionId", "concern"] }).createIndex(
            "sessionId",
            "sessionId",
          );
          db.createObjectStore("photos", { keyPath: "id" }).createIndex("trialId", "trialId");
          db.createObjectStore("settings", { keyPath: "id" });
        },
        blocked() {
          available = false;
        },
      });
    } catch {
      available = false;
      return null;
    }
  })();
  return dbPromise;
}

const memKey = (store: StoreName, value: Record<string, unknown>) =>
  store === "measurements" ? `${value.sessionId}|${value.concern}` : String(value.id);

export function storageAvailable() {
  return available;
}

/** Opens the database once and reports whether trials will be kept on this device (T060). */
export async function probeStorage(): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  try {
    // Writing proves more than opening: some private modes open but refuse writes.
    await db.put("settings", { id: "settings", storageAvailable: true });
    return available;
  } catch {
    available = false;
    return false;
  }
}

export async function put<S extends StoreName>(store: S, value: VerdictDB[S]["value"]): Promise<void> {
  const db = await open();
  if (db) {
    try {
      await db.put(store, value as never);
      return;
    } catch {
      available = false;
    }
  }
  memory[store].set(memKey(store, value as Record<string, unknown>), value);
}

export async function putMany<S extends StoreName>(store: S, values: VerdictDB[S]["value"][]): Promise<void> {
  const db = await open();
  if (db) {
    try {
      const tx = db.transaction(store, "readwrite");
      await Promise.all([...values.map((v) => tx.store.put(v as never)), tx.done]);
      return;
    } catch {
      available = false;
    }
  }
  for (const v of values) memory[store].set(memKey(store, v as Record<string, unknown>), v);
}

export async function get<S extends Exclude<StoreName, "measurements">>(
  store: S,
  id: string,
): Promise<VerdictDB[S]["value"] | undefined> {
  const db = await open();
  if (db) {
    try {
      return (await db.get(store, id as never)) as VerdictDB[S]["value"] | undefined;
    } catch {
      available = false;
    }
  }
  return memory[store].get(id) as VerdictDB[S]["value"] | undefined;
}

export async function all<S extends StoreName>(store: S): Promise<VerdictDB[S]["value"][]> {
  const db = await open();
  if (db) {
    try {
      return (await db.getAll(store)) as VerdictDB[S]["value"][];
    } catch {
      available = false;
    }
  }
  return [...memory[store].values()] as VerdictDB[S]["value"][];
}

export async function byTrial<S extends "claims" | "sessions" | "photos">(
  store: S,
  trialId: string,
): Promise<VerdictDB[S]["value"][]> {
  const db = await open();
  if (db) {
    try {
      return (await db.getAllFromIndex(store, "trialId", trialId as never)) as VerdictDB[S]["value"][];
    } catch {
      available = false;
    }
  }
  return ([...memory[store].values()] as VerdictDB[S]["value"][]).filter(
    (v) => (v as { trialId: string }).trialId === trialId,
  );
}

export async function measurementsFor(sessionIds: string[]): Promise<Measurement[]> {
  const wanted = new Set(sessionIds);
  const db = await open();
  if (db) {
    try {
      const out: Measurement[] = [];
      for (const id of wanted) out.push(...(await db.getAllFromIndex("measurements", "sessionId", id)));
      return out;
    } catch {
      available = false;
    }
  }
  return ([...memory.measurements.values()] as Measurement[]).filter((m) => wanted.has(m.sessionId));
}

export async function remove(store: Exclude<StoreName, "measurements">, id: string): Promise<void> {
  const db = await open();
  if (db) {
    try {
      await db.delete(store, id as never);
      return;
    } catch {
      available = false;
    }
  }
  memory[store].delete(id);
}

/** Erase everything (FR-032): closes and deletes the database, clears the memory fallback. */
export async function eraseDatabase(): Promise<void> {
  const db = await open();
  try {
    db?.close();
  } catch {
    // ignore
  }
  dbPromise = null;
  for (const m of Object.values(memory)) m.clear();
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
