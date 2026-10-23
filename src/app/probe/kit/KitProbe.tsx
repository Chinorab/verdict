"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CtaButton, Segmented, SecondaryButton } from "@/components/ui";

/* Camera Kit v2.5 (research R3). Only what the probe needs. */
type Ymk = {
  init: (args: Record<string, unknown>) => void;
  openCameraKit: () => void;
  capture: () => unknown;
  close: () => void;
  addEventListener: (event: string, cb: (payload: unknown) => void) => unknown;
  removeEventListener: (id: unknown) => void;
};
declare global {
  interface Window {
    YMK?: Ymk;
    YMKAsyncInit?: () => void;
  }
}

const SDK = "https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js";
const CONTAINERS = ["default", "1080 x 1920"] as const;
const VIDEO = ["1080p", "1920p"] as const;
const LEVELS = ["strict", "moderate"] as const;

type Run = {
  container: string;
  video: string;
  level: string;
  reported: { width: unknown; height: unknown };
  decoded: { width: number; height: number } | null;
  type: string;
  bytes: number;
  at: string;
};

export function KitProbe() {
  const [ready, setReady] = useState(false);
  const [container, setContainer] = useState<(typeof CONTAINERS)[number]>("default");
  const [video, setVideo] = useState<(typeof VIDEO)[number]>("1080p");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("strict");
  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const setup = useRef({ container, video, level });
  useEffect(() => {
    setup.current = { container, video, level };
  }, [container, video, level]);

  const note = useCallback(
    (line: string) => setLog((l) => [`${new Date().toISOString().slice(11, 19)} ${line}`, ...l].slice(0, 30)),
    [],
  );

  useEffect(() => {
    async function onCaptured(result: unknown) {
      const first = (result as { images?: { image?: unknown; width?: unknown; height?: unknown }[] })?.images?.[0];
      if (!first) return note(`captured without images ${JSON.stringify(result)}`);
      const img = first.image;
      const blob = img instanceof Blob ? img : typeof img === "string" ? await (await fetch(img)).blob() : null;
      let decoded: Run["decoded"] = null;
      if (blob) {
        try {
          const bmp = await createImageBitmap(blob);
          decoded = { width: bmp.width, height: bmp.height };
          bmp.close();
        } catch {
          note("could not decode the capture");
        }
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      }
      const { container: c, video: v, level: l } = setup.current;
      setRuns((r) => [
        ...r,
        {
          container: c,
          video: v,
          level: l,
          reported: { width: first.width, height: first.height },
          decoded,
          type: blob?.type ?? typeof img,
          bytes: blob?.size ?? 0,
          at: new Date().toISOString(),
        },
      ]);
      note(`captured ${String(first.width)} x ${String(first.height)}`);
      window.YMK?.close();
      setOpen(false);
    }

    // Listener ids, removed on unmount so a remount does not double every event.
    const ids: unknown[] = [];
    const wire = () => {
      const ymk = window.YMK;
      if (!ymk || ids.length) return;
      ids.push(ymk.addEventListener("loaded", () => note("loaded")));
      ids.push(ymk.addEventListener("faceQualityChanged", (q) => setQuality(JSON.stringify(q))));
      for (const e of ["cameraOpened", "cameraClosed", "cameraFailed", "unsupportedResolution", "faceDetectionStarted"]) {
        ids.push(ymk.addEventListener(e, (p) => note(`${e} ${p === undefined ? "" : JSON.stringify(p)}`)));
      }
      ids.push(ymk.addEventListener("faceDetectionCaptured", (result) => void onCaptured(result)));
      setReady(true);
      note("sdk ready");
    };
    const onError = (e: ErrorEvent) => note(`error ${e.message}`);
    const onReject = (e: PromiseRejectionEvent) => note(`rejection ${String(e.reason)}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    // The SDK calls YMKAsyncInit when it loads; the load event covers a script loaded by an earlier mount.
    window.YMKAsyncInit = wire;
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SDK}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SDK;
      script.async = true;
      script.onerror = () => note("sdk failed to load");
      document.body.appendChild(script);
    }
    if (window.YMK) wire();
    script.addEventListener("load", wire);
    const el = script;
    return () => {
      el.removeEventListener("load", wire);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
      for (const id of ids) window.YMK?.removeEventListener(id);
      window.YMK?.close();
    };
  }, [note]);

  function start() {
    const ymk = window.YMK;
    note(`tap open ${container}, ${video}, ${level}`);
    if (!ymk) return note("YMK missing");
    try {
      ymk.close();
    } catch (e) {
      note(`close before open threw ${String(e)}`);
    }
    const args: Record<string, unknown> = {
      faceDetectionMode: "skincare",
      imageFormat: "blob",
      language: "enu",
      qualityLevel: level,
      videoQuality: video,
      hideFlipCameraButton: false,
    };
    if (container !== "default") Object.assign(args, { width: 1080, height: 1920 });
    try {
      ymk.init(args);
      ymk.openCameraKit();
      setOpen(true);
      note("openCameraKit called");
    } catch (e) {
      note(`open threw ${String(e)}`);
    }
  }

  // Manual capture: the size matters here, not whether the quality check passed.
  function shoot() {
    try {
      const r = window.YMK?.capture();
      note(`capture called ${r === undefined ? "" : String(r)}`);
    } catch (e) {
      note(`capture threw ${String(e)}`);
    }
  }

  function stop() {
    window.YMK?.close();
    setOpen(false);
  }

  const report = () =>
    JSON.stringify(
      {
        device: {
          userAgent: navigator.userAgent,
          screen: `${screen.width} x ${screen.height}`,
          viewport: `${innerWidth} x ${innerHeight}`,
          pixelRatio: devicePixelRatio,
        },
        runs,
        lastQuality: quality,
        events: log,
      },
      null,
      2,
    );

  async function copy() {
    try {
      await navigator.clipboard.writeText(report());
      setCopied(true);
    } catch {
      setCopied(false);
      note("copy failed, select the text below instead");
    }
  }

  return (
    <>
      <Segmented legend="Container" options={CONTAINERS} value={container} onChange={setContainer} />
      <Segmented legend="Video quality" options={VIDEO} value={video} onChange={setVideo} />
      <Segmented legend="Quality check" options={LEVELS} value={level} onChange={setLevel} />
      {open ? (
        <>
          <CtaButton onClick={shoot}>Take photo now</CtaButton>
          <SecondaryButton onClick={stop}>Close camera</SecondaryButton>
        </>
      ) : (
        <CtaButton onClick={start} disabled={!ready}>
          {ready ? "Open camera" : "Loading camera kit"}
        </CtaButton>
      )}
      <div id="YMK-module" />
      {quality && <p style={{ fontSize: 12, color: "var(--text-2)", wordBreak: "break-all" }}>Quality: {quality}</p>}
      {runs.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500 }}>Captures</h2>
          {runs.map((r) => (
            <p key={r.at} style={{ fontSize: 14 }}>
              {r.container}, {r.video}, {r.level}: reported {String(r.reported.width)} x {String(r.reported.height)},
              decoded {r.decoded ? `${r.decoded.width} x ${r.decoded.height}` : "unknown"}, {r.type},{" "}
              {Math.round(r.bytes / 1024)} KB
            </p>
          ))}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Last capture" style={{ width: 120, border: "1px solid var(--line)" }} />
          )}
        </section>
      )}
      {ready && (
        <>
          <SecondaryButton onClick={copy}>{copied ? "Copied" : "Copy results"}</SecondaryButton>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", userSelect: "all" }}>{report()}</pre>
        </>
      )}
    </>
  );
}
