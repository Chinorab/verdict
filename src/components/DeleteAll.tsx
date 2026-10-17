"use client";

import { useRef, useState } from "react";
import { eraseEverything } from "@/lib/erase";
import { Icon } from "./Icon";
import s from "./DeleteAll.module.css";

/* "Delete all trial data" with a confirmation step (FR-032). */
export function DeleteAll() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    await eraseEverything();
    // A full page load on purpose (not a client navigation), so no trial survives in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${window.location.origin}/?erased=1`);
  }

  return (
    <>
      <button type="button" className={s.danger} onClick={() => dialog.current?.showModal()}>
        <Icon name="trash" size={18} />
        Delete all trial data
      </button>
      <dialog ref={dialog} className={s.dialog} aria-labelledby="erase-title" aria-describedby="erase-desc">
        <h2 id="erase-title" className={s.title}>
          Delete everything on this phone?
        </h2>
        <p id="erase-desc" className={s.body}>
          Every trial, face photo, overlay and measurement kept by Verdict on this phone will be removed. This cannot be
          undone.
        </p>
        <div className={s.actions}>
          <button type="button" className={s.dangerSolid} onClick={confirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete everything"}
          </button>
          <button type="button" className={s.cancel} onClick={() => dialog.current?.close()} disabled={busy}>
            Keep my data
          </button>
        </div>
      </dialog>
    </>
  );
}
