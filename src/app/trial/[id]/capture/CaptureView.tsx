"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { QualityStrip } from "@/components/QualityStrip";
import { analyzeSession, AnalysisError, concernsForTrial, type AnalysisStatus } from "@/lib/analyze-client";
import {
  loadKit,
  openKit,
  qualityView,
  type CapturedImage,
  type FaceQuality,
  type KitSession,
} from "@/lib/camera-kit";
import { errorCopy } from "@/lib/copy";
import { fmtHour } from "@/lib/format";
import { toJpeg } from "@/lib/image";
import { todayIso } from "@/lib/schedule";
import type { Mode, Session } from "@/lib/schemas";
import { nextCheckin, timelineRows } from "@/lib/timeline";
import { addCapture, CaptureRefused, finishDay0 } from "@/lib/trial-actions";
import { loadTrial, type TrialBundle } from "@/lib/trial-data";
import s from "./capture.module.css";

/*
  Guided capture (T046, T052). Day 0 takes photos A and B one after the other; a check-in takes one.
  Every photo is stored on the device before it is sent, so a dropped connection never loses it,
  and a session that already has a task resumes polling instead of paying for a new analysis.
*/

type Step =
  | { kind: "day0"; shot: 1 | 2; sessionKind: "day0_a" | "day0_b"; day: 0 }
  | { kind: "checkin"; sessionKind: "checkin"; day: number; isVerdict: boolean };

type Phase =
  | { name: "loading" }
  | { name: "missing"; code: "not_found" | "wrong_state" }
  | { name: "camera" }
  | { name: "analyzing"; status: AnalysisStatus }
  | { name: "error"; code: string; retryAfter?: string; session: Session | null }
  | { name: "done"; step: Step };

// The stored photo can be sent again as is: nothing about the photo itself was refused.
const RETRY_SAME = new Set(["network", "timeout", "rate_limited", "unavailable", "upload_blocked", "upload_failed", "upload_missing", "unknown"]);
const CAPS = new Set(["cap_device", "cap_global"]);

function stepFor(b: TrialBundle, day: number | null): Step | null {
  const done = b.sessions.filter((x) => x.state === "done");
  const a = done.some((x) => x.kind === "day0_a");
  const bb = done.some((x) => x.kind === "day0_b");
  if (!a || !bb) return { kind: "day0", shot: a ? 2 : 1, sessionKind: a ? "day0_b" : "day0_a", day: 0 };

  const rows = timelineRows(b.trial, b.sessions, todayIso());
  const row =
    day === null
      ? nextCheckin(rows)
      : rows.find((r) => r.kind !== "day0" && r.day === day && r.state !== "done" && r.state !== "upcoming");
  if (!row || row.kind === "day0") return null;
  return { kind: "checkin", sessionKind: "checkin", day: row.day, isVerdict: row.kind === "verdict" };
}

/** A stored photo whose analysis did not finish: resume it before taking a new one. */
function unfinished(b: TrialBundle, step: Step): Session | null {
  return (
    b.sessions.findLast(
      (x) =>
        x.kind === step.sessionKind &&
        (x.state === "pending" || x.state === "analyzing") &&
        x.photoId !== null &&
        (step.kind === "day0" || x.scheduledDay === step.day),
    ) ?? null
  );
}


export function CaptureView({ id, day }: { id: string; day: number | null }) {
  const [bundle, setBundle] = useState<TrialBundle | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [quality, setQuality] = useState<FaceQuality | null>(null);
  const [kitReady, setKitReady] = useState(false);
  const [level, setLevel] = useState<"strict" | "moderate">("strict");
  const [cameraKey, setCameraKey] = useState(0);
  const [flash, setFlash] = useState(false);
  const [help, setHelp] = useState(false);
  const [shot, setShot] = useState<{ width: number; height: number; mode: Mode } | null>(null);
  const kit = useRef<KitSession | null>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = useRef(false);

  const live = useMemo(() => (bundle ? stepFor(bundle, day) : null), [bundle, day]);
  // A finished photo keeps its own step: the reloaded trial already points at the next one.
  const step = phase.name === "done" ? phase.step : live;
  const view = qualityView(quality);

  const analyze = useCallback(
    async (b: TrialBundle, session: Session, current: Step) => {
      const mode = b.trial.mode;
      if (!mode) return setPhase({ name: "error", code: "wrong_state", session: null });
      setShot({ width: session.width, height: session.height, mode });
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setPhase({ name: "analyzing", status: session.taskId ? "analyzing" : "uploading" });
      try {
        await analyzeSession({
          session,
          mode,
          concerns: concernsForTrial(b.claims),
          signal: ctrl.signal,
          onStatus: (status) => setPhase({ name: "analyzing", status }),
        });
        if (current.sessionKind === "day0_b") await finishDay0(b.trial.id);
        const next = await loadTrial(b.trial.id);
        if (!next) return setPhase({ name: "missing", code: "not_found" });
        setBundle(next);
        if (current.sessionKind === "day0_a") {
          // Photo B right away, in the same light and position (FR-008).
          setQuality(null);
          setCameraKey((k) => k + 1);
          setPhase({ name: "camera" });
        } else {
          setPhase({ name: "done", step: current });
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const err = e instanceof AnalysisError ? e : new AnalysisError("unknown");
        const latest = await loadTrial(b.trial.id);
        if (latest) setBundle(latest);
        setPhase({ name: "error", code: err.code, retryAfter: err.retryAfter, session });
      }
    },
    [],
  );

  // Load the trial, then resume an unfinished analysis or open the camera.
  useEffect(() => {
    let live = true;
    void (async () => {
      const b = await loadTrial(id);
      if (!live) return;
      if (!b) return setPhase({ name: "missing", code: "not_found" });
      setBundle(b);
      const st = stepFor(b, day);
      if (b.trial.kind === "demo" || !st) return setPhase({ name: "missing", code: "wrong_state" });
      const pending = unfinished(b, st);
      if (pending) return void analyze(b, pending, st);

      // Warn before photos are taken when today's analyses are used up.
      try {
        const res = await fetch("/api/budget", { cache: "no-store" });
        if (res.ok) {
          const q = (await res.json()) as { deviceRemaining: number; globalOpen: boolean; resumesAt?: string };
          if (!live) return;
          if (!q.globalOpen) return setPhase({ name: "error", code: "cap_global", retryAfter: q.resumesAt, session: null });
          if (q.deviceRemaining <= 0) return setPhase({ name: "error", code: "cap_device", retryAfter: q.resumesAt, session: null });
        }
      } catch {
        // Offline: the photo can still be taken and stored; the analysis reports the problem.
      }
      if (live) setPhase({ name: "camera" });
    })();
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, [id, day, analyze]);

  const onPhoto = useCallback(
    async (img: CapturedImage, fromKit: boolean) => {
      if (!bundle || !step || busy.current) return;
      busy.current = true;
      kit.current?.close();
      kit.current = null;
      setKitReady(false);
      if (fromKit) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 500);
      }
      try {
        const q = fromKit && quality ? quality : null;
        const { session, trial } = await addCapture({
          trialId: bundle.trial.id,
          kind: step.sessionKind,
          scheduledDay: step.day,
          blob: img.blob,
          width: img.width,
          height: img.height,
          quality: q ? { position: String(q.position ?? ""), frontal: String(q.frontal ?? ""), lighting: String(q.lighting ?? "") } : null,
        });
        const b = { ...bundle, trial };
        setBundle(b);
        await analyze(b, session, step);
      } catch (e) {
        setPhase({ name: "error", code: e instanceof CaptureRefused ? e.code : "storage_unavailable", session: null });
      } finally {
        busy.current = false;
      }
    },
    [bundle, step, quality, analyze],
  );

  const onUpload = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        // Keeps the full resolution (HD needs 1080 px on the short side), fixes orientation.
        const img = await toJpeg(file, 2560, 0.92);
        await onPhoto(img, false);
      } catch {
        setPhase({ name: "error", code: "error_below_min_image_size", session: null });
      }
    },
    [onPhoto],
  );

  function retake() {
    setQuality(null);
    setCameraKey((k) => k + 1);
    setPhase({ name: "camera" });
  }

  const retryTarget = phase.name === "error" ? phase.session : null;
  const title =
    step?.kind === "day0"
      ? `Day 0, photo ${step.shot} of 2`
      : step?.kind === "checkin"
        ? step.isVerdict
          ? `Verdict photo, day ${step.day}`
          : `Check-in, day ${step.day}`
        : "Take a photo";

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <Link href={`/trial/${id}`} aria-label="Close camera" className={s.iconLink}>
          <Icon name="close" />
        </Link>
        <span className={`${s.title} num`}>{title}</span>
        <button
          type="button"
          aria-label="How capture works"
          aria-expanded={help}
          className={s.iconButton}
          onClick={() => setHelp((h) => !h)}
        >
          <Icon name="info" />
        </button>
      </header>

      {bundle?.trial.kind === "quick" && <span className={s.badge}>Same day test</span>}
      {help && (
        <p className={s.help}>
          The camera checks light, framing and angle, then takes the photo by itself. If only the light is short of
          ideal, the button below takes the photo for you. The photo is kept on this phone and sent only to YouCam for
          the measurement.
        </p>
      )}

      {phase.name === "camera" && step && (
        <>
          <QualityStrip view={view} />
          <Camera
            key={cameraKey}
            level={level}
            flash={flash}
            onReady={(session) => {
              kit.current = session;
              setKitReady(true);
            }}
            onQuality={setQuality}
            onPhoto={(img) => void onPhoto(img, true)}
            onFailed={(code) => {
              kit.current = null;
              setKitReady(false);
              setPhase({ name: "error", code, session: null });
            }}
          />
          <footer className={s.footer}>
            <span className={`${s.count} num`}>
              {step.kind === "day0" ? `${step.shot === 2 ? 1 : 0}/2 taken` : "1 photo"}
            </span>
            <button
              type="button"
              className={s.shutter}
              aria-label="Take photo"
              disabled={!kitReady || !view.canShoot}
              onClick={() => {
                if (!kit.current?.capture()) setPhase({ name: "error", code: "camera_failed", session: null });
              }}
            >
              <span />
            </button>
            <span className={s.shutterHint}>{kitReady && !view.canShoot ? "Follow the hints above" : ""}</span>
          </footer>
          <Reminders step={step} reminderHour={bundle?.trial.reminderHour ?? null} />
          <UploadButton onFile={onUpload} />
        </>
      )}

      {phase.name === "loading" && (
        <div className={s.panel}>
          <p className={`${s.panelText} ${s.breathe}`}>Opening your trial</p>
        </div>
      )}

      {phase.name === "analyzing" && <Analyzing status={phase.status} />}
      {(phase.name === "analyzing" || (phase.name === "error" && phase.session)) && shot && (
        <p className={`${s.meta} num`}>
          Photo {shot.width} x {shot.height}, {shot.mode === "hd" ? "HD" : "SD"} detail
        </p>
      )}

      {phase.name === "missing" && (
        <div className={s.panel}>
          <p className={s.panelTitle}>{errorCopy(phase.code).title}</p>
          <p className={s.panelText}>{errorCopy(phase.code).action}</p>
          <div className={s.actions}>
            <Link href={phase.code === "not_found" ? "/" : `/trial/${id}`} className={s.primary}>
              {phase.code === "not_found" ? "Go to the start" : "Back to the trial"}
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      )}

      {phase.name === "error" && (
        <div className={s.panel} role="alert">
          <p className={s.panelTitle}>{errorCopy(phase.code, phase.retryAfter).title}</p>
          <p className={s.panelText}>{errorCopy(phase.code, phase.retryAfter).action}</p>
          <div className={s.actions}>
            {CAPS.has(phase.code) ? (
              <Link href={`/trial/${id}`} className={s.primary}>
                Back to the trial
                <Icon name="arrow" />
              </Link>
            ) : retryTarget && RETRY_SAME.has(phase.code) && bundle && step ? (
              <button type="button" className={s.primary} onClick={() => void analyze(bundle, retryTarget, step)}>
                Try again
                <Icon name="arrow" />
              </button>
            ) : phase.code === "camera_resolution" && level === "strict" ? (
              <button
                type="button"
                className={s.primary}
                onClick={() => {
                  setLevel("moderate");
                  retake();
                }}
              >
                Try a lighter check
                <Icon name="arrow" />
              </button>
            ) : (
              <button type="button" className={s.primary} onClick={retake}>
                Take the photo again
                <Icon name="camera" />
              </button>
            )}
            {!CAPS.has(phase.code) && <UploadButton onFile={onUpload} />}
          </div>
        </div>
      )}

      {phase.name === "done" && step && (
        <div className={s.panel}>
          {step.kind === "day0" ? (
            <>
              <p className={s.panelTitle}>Baseline set</p>
              <p className={s.panelText}>
                Your two photos show how much each reading moves on its own. Changes smaller than that will read as no
                measurable change.
              </p>
              <Link href={`/trial/${id}`} className={s.primary}>
                {bundle?.trial.kind === "quick" ? "Take the verdict photo" : "See your schedule"}
                <Icon name="arrow" />
              </Link>
            </>
          ) : (
            <>
              <p className={s.panelTitle}>Photo measured</p>
              <p className={s.panelText}>Your results are saved on this phone.</p>
              <Link href={step.isVerdict ? `/trial/${id}/verdict` : `/trial/${id}`} className={s.primary}>
                {step.isVerdict ? "See the verdict" : "Back to the trial"}
                <Icon name="arrow" />
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Camera({
  level,
  flash,
  onReady,
  onQuality,
  onPhoto,
  onFailed,
}: {
  level: "strict" | "moderate";
  flash: boolean;
  onReady: (kit: KitSession) => void;
  onQuality: (q: FaceQuality) => void;
  onPhoto: (img: CapturedImage) => void;
  onFailed: (code: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onReady, onQuality, onPhoto, onFailed });
  useEffect(() => {
    handlers.current = { onReady, onQuality, onPhoto, onFailed };
  });
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let session: KitSession | null = null;
    let live = true;
    loadKit()
      .then((ymk) => {
        if (!live) return;
        // The photo is 1080 px wide whatever the container width (research R2), and its height follows
        // the container's shape. Never wider than tall keeps the short side at 1080 (HD); the height
        // is capped so the shutter below stays on screen (Safari on a phone shows about 645 px).
        const w = Math.min(mount.current?.clientWidth ?? 0, 480);
        const h = Math.min(Math.round(w * 1.25), Math.max(w, window.innerHeight - 280));
        const size = w >= 300 ? { width: w, height: h } : {};
        session = openKit(
          ymk,
          {
            onQuality: (q) => handlers.current.onQuality(q),
            onCaptured: (img) => handlers.current.onPhoto(img),
            onFailed: (code) => handlers.current.onFailed(code),
            onOpened: () => setOpened(true),
          },
          { level, ...size },
        );
        handlers.current.onReady(session);
      })
      .catch(() => {
        if (live) handlers.current.onFailed("kit_unavailable");
      });
    return () => {
      live = false;
      session?.close();
    };
  }, [level]);

  return (
    <div className={s.stage} role="img" aria-label="Live front camera with the face guide">
      <div id="YMK-module" ref={mount} className={s.mount} />
      {!opened && (
        <div className={s.stageNote}>
          <Icon name="camera" size={28} />
          <span className={s.breathe}>Starting the camera</span>
        </div>
      )}
      {flash && <div className={s.flash} aria-hidden="true" />}
    </div>
  );
}

function Reminders({ step, reminderHour }: { step: Step; reminderHour: number | null }) {
  return (
    <>
      <ul className={s.reminders}>
        <li>
          <Icon name="noMakeup" size={18} />
          No makeup
        </li>
        <li>
          <Icon name="room" size={18} />
          Same room
        </li>
        <li>
          <Icon name="hour" size={18} />
          {step.kind === "checkin" && reminderHour !== null ? `Near ${fmtHour(reminderHour)}` : "Same hour"}
        </li>
      </ul>
      <p className={s.lead}>
        {step.kind === "day0"
          ? step.shot === 1
            ? "Two photos today show how much a reading moves on its own. That sets your noise floor."
            : "Photo 1 is measured. Take the second one now, without moving."
          : "Same room, same light and the same hour as day 0 keep the photos comparable."}
      </p>
    </>
  );
}

function Analyzing({ status }: { status: AnalysisStatus }) {
  const order: AnalysisStatus[] = ["uploading", "analyzing", "saving"];
  const labels: Record<AnalysisStatus, string> = {
    uploading: "Sending the photo to YouCam",
    analyzing: "Measuring your skin",
    saving: "Saving the results on this phone",
  };
  const at = order.indexOf(status);
  return (
    <div className={s.panel} aria-live="polite">
      <p className={s.panelTitle}>Measuring this photo</p>
      <ol className={s.steps}>
        {order.map((st, i) => (
          <li key={st} className={i < at ? s.ok : i === at ? `${s.breathe}` : s.wait}>
            {i < at ? <Icon name="check" size={16} weight="bold" /> : <Icon name="clock" size={16} />}
            {labels[st]}
          </li>
        ))}
      </ol>
      <p className={s.panelText}>This takes about a minute. You can leave this screen; the photo is saved.</p>
    </div>
  );
}

function UploadButton({ onFile }: { onFile: (f: File | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={s.secondary} onClick={() => input.current?.click()}>
        <Icon name="upload" size={16} />
        Upload a photo instead
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className={s.srOnly}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}
