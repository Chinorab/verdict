"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { errorCopy } from "@/lib/copy";
import { toJpeg } from "@/lib/image";
import { LabelReading } from "@/lib/schemas";
import s from "./new.module.css";

type State =
  | { kind: "idle" }
  | { kind: "reading"; preview: string }
  | { kind: "done"; preview: string; total: number; measurable: number }
  | { kind: "error"; preview?: string; title: string; action: string };

/* Step 1 of 3 (design/project/Scan.dc.html): photograph the label, read its claims. */
export function ScanStep({ onRead, onTypeInstead }: { onRead: (r: LabelReading) => void; onTypeInstead: () => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const preview = state.kind === "idle" ? undefined : state.preview;

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function handle(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setState({ kind: "reading", preview: url });
    try {
      // Re-encoded on the phone; only this label image is sent (never a face photo).
      const { blob } = await toJpeg(file, 1568);
      const body = new FormData();
      body.append("image", blob, "label.jpg");
      const res = await fetch("/api/claims", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = json?.error?.code ?? "unknown";
        const copy = errorCopy(code, json?.error?.retryAfter);
        setState({ kind: "error", preview: url, ...copy });
        return;
      }
      const reading = LabelReading.parse(json);
      const measurable = reading.claims.filter((c) => c.measurable).length;
      setState({ kind: "done", preview: url, total: reading.claims.length, measurable });
      // Short pause so the count is readable before moving on.
      setTimeout(() => onRead(reading), 900);
    } catch {
      setState({ kind: "error", preview: url, ...errorCopy("network") });
    }
  }

  const busy = state.kind === "reading" || state.kind === "done";

  return (
    <main className={s.main}>
      <section className={s.intro}>
        <h1 className={s.h1}>Photograph the claims</h1>
        <p className={s.lead}>Front or back of the pack, wherever the promises are printed.</p>
      </section>

      <div className={s.finder} role="img" aria-label={preview ? "Photo of the product label" : "Camera frame for the label"}>
        <span className={`${s.corner} ${s.tl}`} />
        <span className={`${s.corner} ${s.tr}`} />
        <span className={`${s.corner} ${s.bl}`} />
        <span className={`${s.corner} ${s.br}`} />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="" className={s.preview} />
        ) : (
          <p className={s.finderHint}>Use good light and fill the frame with the text.</p>
        )}
        {state.kind === "reading" && <span className={s.sweep} aria-hidden="true" />}
      </div>

      <div aria-live="polite">
        {state.kind === "reading" && (
          <p className={`${s.status} ${s.statusOk}`}>
            <span>Reading the label…</span>
          </p>
        )}
        {state.kind === "done" && (
          <p className={`${s.status} ${s.statusOk}`}>
            <Icon name="check" size={18} weight="regular" />
            <span>
              {state.total} {state.total === 1 ? "claim" : "claims"} read, {state.measurable} can be measured
            </span>
          </p>
        )}
        {state.kind === "error" && (
          <div className={`${s.status} ${s.statusError}`} role="alert">
            <Icon name="warning" size={18} />
            <span>
              {state.title} {state.action}
            </span>
          </div>
        )}
      </div>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => handle(e.target.files?.[0])} />

      <div className={s.controls}>
        <button type="button" className={s.textButton} onClick={() => upload.current?.click()} disabled={busy}>
          <Icon name="image" />
          Upload
        </button>
        <button
          type="button"
          className={s.shutter}
          aria-label="Take photo of the label"
          onClick={() => camera.current?.click()}
          disabled={busy}
        >
          <span />
        </button>
        <button type="button" className={s.textButton} onClick={onTypeInstead} disabled={busy}>
          Type them
        </button>
      </div>
    </main>
  );
}
