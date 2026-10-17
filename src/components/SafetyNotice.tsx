"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/format";
import type { Guard } from "@/lib/measure/guardrail";
import { CONCERN_LABEL } from "@/lib/schemas";
import { Icon } from "./Icon";
import s from "./SafetyNotice.module.css";

const FIND_DERMATOLOGIST = "https://find-a-derm.aad.org/";

/*
  Health guardrail notice (FR-027, design/project/Safety.dc.html). Calm wording, readings next to
  the threshold they crossed, never a diagnosis. Level 1 is a notice; level 2 suggests pausing.
*/
export function SafetyNotice({
  guard,
  deadline,
  paused,
  acknowledged,
  onPause,
  onResume,
  onKeep,
}: {
  guard: Guard;
  deadline: string;
  paused: boolean;
  /** The user chose "Keep measuring" for this reading: show a one line reminder instead. */
  acknowledged: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onKeep?: () => void;
}) {
  const [open, setOpen] = useState(!acknowledged);
  if (guard.level === 0 || !guard.concern || !guard.baseline) return null;

  const name = CONCERN_LABEL[guard.concern];
  const strong = guard.level === 2;

  if (!open) {
    return (
      <div className={s.compact} role="status">
        <Icon name="warning" size={20} />
        <p>
          {name} went up beyond your threshold.{" "}
          <button type="button" className={s.text} style={{ minHeight: 44, padding: 0, fontSize: 14, display: "inline-flex", alignItems: "center" }} onClick={() => setOpen(true)}>
            See readings
          </button>
        </p>
      </div>
    );
  }

  const b = guard.baseline;
  return (
    <section className={s.notice} role="alert" aria-labelledby="safety-h">
      <span className={s.icon} aria-hidden="true">
        <Icon name="warning" size={20} weight="regular" />
      </span>
      <h2 id="safety-h" className={strong ? s.title : s.titleCalm}>
        {strong ? "Consider pausing this product." : `${name} went up at your last check-in.`}
      </h2>
      <p className={s.body}>
        {strong
          ? `${name} went up at two check-ins in a row, more than your day 0 photos vary on their own.`
          : "More than your day 0 photos vary on their own. One reading can be a bad day; the next check-in will tell."}
      </p>
      <dl className={`${s.readings} num`}>
        <dt>Day 0</dt>
        <dd>
          {b.a.toFixed(1)} and {b.b.toFixed(1)}, threshold &plusmn;{b.threshold.toFixed(1)}
        </dd>
        {guard.readings.map((r) => (
          <FragmentRow key={r.takenAt} day={r.day} raw={r.raw} worse={r.worse} />
        ))}
      </dl>
      <p className={s.advice}>If it keeps going, or your skin itches, burns or swells, stop and ask a dermatologist or a pharmacist.</p>
      <p className={s.small}>Verdict cannot tell why skin changes. This is not a diagnosis.</p>
      {strong && <p className={`${s.small} num`}>Return deadline stays {fmtDate(deadline)}. Pausing does not extend it.</p>}
      <div className={s.actions}>
        {strong && !paused && onPause && (
          <button type="button" className={s.primary} onClick={onPause}>
            Pause the trial
          </button>
        )}
        {paused && onResume && (
          <button type="button" className={s.primary} onClick={onResume}>
            Resume the trial
          </button>
        )}
        <a className={s.secondary} href={FIND_DERMATOLOGIST} target="_blank" rel="noopener noreferrer">
          Find a dermatologist
          <Icon name="arrow" size={16} />
        </a>
        {!paused && onKeep && (
          <button
            type="button"
            className={s.text}
            onClick={() => {
              onKeep();
              setOpen(false);
            }}
          >
            Keep measuring
          </button>
        )}
      </div>
    </section>
  );
}

function FragmentRow({ day, raw, worse }: { day: number; raw: number; worse: boolean }) {
  return (
    <>
      <dt>Day {day}</dt>
      <dd className={worse ? s.worse : undefined}>
        {raw.toFixed(1)}
        {worse ? ", beyond the threshold" : ""}
      </dd>
    </>
  );
}
