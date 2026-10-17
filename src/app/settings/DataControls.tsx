"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { SecondaryButton } from "@/components/ui";
import { BACKUP_ERROR_COPY, BackupError } from "@/lib/backup-core";
import { exportTrial, importBackupFile, trialsOnDevice } from "@/lib/backup";
import type { Trial } from "@/lib/schemas";

/* Backup export and import (FR-033b): a file saved on this phone, opened on any device. */
export function DataControls() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [withPhotos, setWithPhotos] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let live = true;
    trialsOnDevice().then((t) => live && setTrials(t));
    return () => {
      live = false;
    };
  }, []);

  async function onImport(file: File | undefined) {
    if (!file) return;
    setStatus("Importing…");
    try {
      const id = await importBackupFile(file);
      router.push(`/trial/${id}`);
    } catch (e) {
      setStatus(e instanceof BackupError ? BACKUP_ERROR_COPY[e.code] : "This file could not be imported.");
    }
  }

  return (
    <section style={{ padding: "28px 0", borderTop: "1px solid var(--line-strong)", display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ fontSize: 18, fontWeight: 500 }}>Backup</h2>
      <p style={{ color: "var(--text-2)", fontSize: 15 }}>
        Save a trial as a file on this phone and open it on another device. Nothing goes through a server.
      </p>
      {trials.length > 0 && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 15, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={withPhotos}
              onChange={(e) => setWithPhotos(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: "var(--accent)" }}
            />
            Include photos (face photos and overlays)
          </label>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--line)" }}>
            {trials.map((t) => (
              <li key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: 15 }}>{t.product.name}</span>
                <SecondaryButton onClick={() => exportTrial(t.id, withPhotos).then(() => setStatus("Backup saved"))}>
                  <Icon name="download" size={18} />
                  Export
                </SecondaryButton>
              </li>
            ))}
          </ul>
        </>
      )}
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      <div>
        <SecondaryButton onClick={() => input.current?.click()}>
          <Icon name="upload" size={18} />
          Import a backup
        </SecondaryButton>
      </div>
      <p aria-live="polite" style={{ minHeight: 20, fontSize: 14 }}>
        {status}
      </p>
    </section>
  );
}
