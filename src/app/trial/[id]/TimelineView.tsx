"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";
import { SafetyNotice } from "@/components/SafetyNotice";
import { CtaLink, Disclaimer, Header, SameDayBadge, SecondaryButton } from "@/components/ui";
import { put } from "@/lib/db";
import { fmtDate, fmtDay, fmtPrice } from "@/lib/format";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { daysBetween, todayIso } from "@/lib/schedule";
import type { Trial } from "@/lib/schemas";
import { nextCheckin, timelineRows, type TimelineRow } from "@/lib/timeline";
import { deriveGuard, loadTrial, type TrialBundle } from "@/lib/trial-data";
import s from "./timeline.module.css";

const hourLabel = (h: number) => new Date(2026, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" });

export function TimelineView({ id }: { id: string }) {
  const [bundle, setBundle] = useState<TrialBundle | null | undefined>(undefined);
  const today = todayIso();

  useEffect(() => {
    let live = true;
    loadTrial(id).then((b) => live && setBundle(b), () => live && setBundle(null));
    return () => {
      live = false;
    };
  }, [id]);

  const rows = useMemo(() => (bundle ? timelineRows(bundle.trial, bundle.sessions, today) : []), [bundle, today]);
  const guard = useMemo(() => (bundle ? deriveGuard(bundle) : null), [bundle]);

  if (bundle === undefined) {
    return (
      <div className="app-column">
        <Header title="" backHref="/" backLabel="All trials" />
      </div>
    );
  }
  if (bundle === null) {
    return (
      <div className="app-column">
        <Header title="Trial" backHref="/" backLabel="All trials" />
        <main className={s.main}>
          <div className={s.empty}>
            <p>This trial is not on this device.</p>
            <CtaLink href="/">Back home</CtaLink>
          </div>
        </main>
      </div>
    );
  }

  const { trial } = bundle;
  const day0Done = rows[0]?.state === "done";
  const next = nextCheckin(rows);

  async function save(t: Trial) {
    setBundle({ ...bundle!, trial: t });
    await put("trials", t);
  }
  const setHour = (h: number) => save({ ...trial, reminderHour: h });
  const paused = trial.status === "paused";
  const demo = trial.kind === "demo";
  const lastReading = guard?.readings.at(-1);
  const acknowledged =
    !!guard && !!lastReading && trial.guardrail.level === guard.level && trial.guardrail.at === lastReading.takenAt;

  function addToCalendar() {
    const url = `${window.location.origin}/trial/${trial.id}`;
    const ics = buildIcs({
      trialId: trial.id,
      product: trial.product.name,
      reminderHour: trial.reminderHour,
      schedule: trial.schedule,
      deadline: trial.deadline,
      url,
      now: new Date(),
      from: today,
    });
    const slug = trial.product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trial";
    downloadIcs(`verdict-${slug}.ics`, ics);
  }

  return (
    <div className="app-column">
      <Header
        title={trial.product.name}
        backHref="/"
        backLabel="All trials"
        right={
          day0Done ? (
            <Link href={`/trial/${trial.id}/compare`} aria-label="Compare photos" style={{ color: "var(--text)", display: "flex", minHeight: 44, alignItems: "center" }}>
              <Icon name="compare" />
            </Link>
          ) : undefined
        }
      />
      <main className={s.main}>
        {trial.kind === "quick" && (
          <div style={{ paddingTop: 20 }}>
            <SameDayBadge />
          </div>
        )}
        {demo && <DemoBanner trial={trial} />}
        {guard && guard.level > 0 && (
          <SafetyNotice
            guard={guard}
            deadline={trial.deadline}
            paused={paused}
            acknowledged={acknowledged}
            onPause={demo ? undefined : () => save({ ...trial, status: "paused" })}
            onResume={demo ? undefined : () => save({ ...trial, status: "active" })}
            onKeep={demo ? undefined : () => save({ ...trial, guardrail: { level: guard.level, concern: guard.concern, at: lastReading?.takenAt } })}
          />
        )}
        {paused && (!guard || guard.level === 0) && (
          <div className={s.reminder} role="status">
            <p className={s.sub}>
              This trial is paused. The return deadline stays <strong className="num">{fmtDate(trial.deadline)}</strong>.
            </p>
            <div>
              <SecondaryButton onClick={() => save({ ...trial, status: "active" })}>Resume the trial</SecondaryButton>
            </div>
          </div>
        )}
        <Countdown trial={trial} today={today} />
        <Track trial={trial} rows={rows} today={today} />

        <ol className={s.list}>
          {rows.map((r) => (
            <Row key={`${r.kind}-${r.day}`} row={r} trial={trial} isNext={r === next && !paused && !demo} today={today} />
          ))}
          <li className={s.row} style={{ gridTemplateColumns: "64px 1fr" }}>
            <span className={`${s.date} ${s.dateDeadline} num`}>
              {fmtDate(trial.deadline)}
              <br />
              Day {daysBetween(trial.schedule[0].date, trial.deadline)}
            </span>
            <span className={s.titleDeadline}>Return window closes</span>
          </li>
        </ol>

        {trial.kind === "real" && (
          <section className={s.reminder} aria-label="Reminders">
            <div className={s.reminderRow}>
              <Icon name="bell" />
              <span>
                Reminders at <span className="num">{hourLabel(trial.reminderHour)}</span>
                {day0Done ? ", the hour of your first photo" : ""}. Same hour, same room, same light each time.
              </span>
            </div>
            <div className={s.reminderControls}>
              <label className={s.note} htmlFor="reminder-hour">
                Hour
              </label>
              <select
                id="reminder-hour"
                className={`${s.select} num`}
                value={trial.reminderHour}
                onChange={(e) => setHour(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
              <SecondaryButton onClick={addToCalendar}>
                <Icon name="calendar" size={18} />
                Add to calendar
              </SecondaryButton>
            </div>
          </section>
        )}

        <div className={s.foot}>
          <Disclaimer />
        </div>
      </main>
    </div>
  );
}

function Countdown({ trial, today }: { trial: Trial; today: string }) {
  const left = daysBetween(today, trial.deadline);
  if (left < 0) {
    return (
      <section className={s.count} aria-label="Return deadline">
        <p className={s.sub}>
          The return window closed on <strong className="num">{fmtDay(trial.deadline)}</strong>.
        </p>
      </section>
    );
  }
  return (
    <section className={s.count} aria-label="Return countdown">
      <div className={s.countRow}>
        <span className={`${s.big} num`}>{left}</span>
        <span className={s.bigLabel}>
          {left === 1 ? "day" : "days"} left
          <br />
          to return
        </span>
      </div>
      <p className={s.sub}>
        Return by <strong className="num">{fmtDay(trial.deadline)}</strong>.{" "}
        <strong className="num">{fmtPrice(trial.purchase.price)}</strong> at stake.
      </p>
    </section>
  );
}

function Track({ trial, rows, today }: { trial: Trial; rows: TimelineRow[]; today: string }) {
  const start = trial.schedule[0].date;
  const total = Math.max(1, daysBetween(start, trial.deadline));
  const pct = (date: string) => Math.min(100, Math.max(0, (daysBetween(start, date) / total) * 100));
  const nowPct = pct(today);
  const verdict = rows.find((r) => r.kind === "verdict");
  return (
    <div className={s.track} aria-hidden="true">
      <div className={s.axis} />
      <div className={s.progress} style={{ width: `${nowPct}%` }} />
      {rows
        .filter((r) => r.kind !== "verdict" || trial.kind === "quick")
        .map((r) => (
          <span
            key={`${r.kind}-${r.day}`}
            className={`${s.dot} ${r.state === "done" ? "" : s.dotOpen}`}
            style={{ left: `${pct(r.date)}%` }}
          />
        ))}
      {verdict && trial.kind !== "quick" && <span className={`${s.dot} ${s.dotVerdict}`} style={{ left: `${pct(verdict.date)}%` }} />}
      <span className={s.today} style={{ left: `${nowPct}%` }} />
      <span className={s.deadlineTick} />
      <span className={`${s.tick} num`} style={{ left: 0 }}>
        D0
      </span>
      {nowPct > 12 && nowPct < 80 && (
        <span className={`${s.tick} ${s.tickToday} num`} style={{ left: `calc(${nowPct}% - 10px)` }}>
          Today
        </span>
      )}
      <span className={`${s.tick} ${s.tickDeadline} num`}>D{total}</span>
    </div>
  );
}

function Row({ row, trial, isNext, today }: { row: TimelineRow; trial: Trial; isNext: boolean; today: string }) {
  const capture = `/trial/${trial.id}/capture?day=${row.day}`;
  const dateCol = (due: boolean) => (
    <span className={`${s.date} ${due ? s.dateDue : ""} num`}>
      {fmtDate(row.date)}
      <br />
      Day {row.day}
    </span>
  );
  const done = <Icon name="check" size={18} weight="regular" label="Done" className={s.check} />;

  if (row.kind === "day0") {
    if (row.state === "done")
      return (
        <li className={s.row}>
          {dateCol(false)}
          <div className={s.body}>
            <span className={s.title}>Baseline, 2 photos</span>
            <span className={s.note}>Noise floor set</span>
          </div>
          {done}
        </li>
      );
    return (
      <li className={`${s.row} ${s.rowDue}`} style={{ gridTemplateColumns: "64px 1fr" }}>
        {dateCol(true)}
        <div className={`${s.body} ${s.bodyDue}`}>
          <div className={s.body}>
            <span className={s.title}>Baseline, 2 photos</span>
            <span className={s.noteStrong}>
              {row.state === "partial"
                ? "1 of 2 photos taken. Take the second one now, without moving."
                : "Two photos one after the other measure how much a reading moves on its own."}
            </span>
          </div>
          <CtaLink href={`/trial/${trial.id}/capture?day=0`} compact>
            {row.state === "partial" ? "Take the second photo" : "Take day 0 photos"}
          </CtaLink>
        </div>
      </li>
    );
  }

  const isVerdict = row.kind === "verdict";
  const label = isVerdict ? "Verdict" : "Check-in";

  if (row.state === "done") {
    const takenDay = row.takenAt?.slice(0, 10);
    return (
      <li className={s.row}>
        {dateCol(false)}
        <div className={s.body}>
          <span className={s.title}>{label}</span>
          {takenDay && takenDay !== row.date && <span className={s.note}>Taken {fmtDate(takenDay)}</span>}
          {isVerdict && (
            <Link href={`/trial/${trial.id}/verdict`} className={s.rowLink}>
              See your result
            </Link>
          )}
        </div>
        {done}
      </li>
    );
  }

  if ((row.state === "due" || row.state === "late") && isNext) {
    const late = row.state === "late";
    return (
      <li className={`${s.row} ${s.rowDue}`} style={{ gridTemplateColumns: "64px 1fr" }}>
        {dateCol(true)}
        <div className={`${s.body} ${s.bodyDue}`}>
          <div className={s.body}>
            <span className={s.title}>{late ? `${label}, missed on ${fmtDate(row.date)}` : `${label}, due today`}</span>
            <span className={s.noteStrong}>
              {late
                ? "You can still take it now. The real date is recorded."
                : trial.kind === "quick"
                  ? "Take one more photo now to see how a verdict works."
                  : `Best taken around ${hourLabel(trial.reminderHour)}, the hour of your day 0 photos.`}
            </span>
          </div>
          <CtaLink href={capture} compact>
            {late ? "Take it now" : "Take today’s photo"}
          </CtaLink>
        </div>
      </li>
    );
  }

  if (row.state === "late") {
    return (
      <li className={s.row} style={{ gridTemplateColumns: "64px 1fr" }}>
        {dateCol(false)}
        <div className={s.body}>
          <span className={s.titleQuiet}>{label}, missed</span>
          <span className={s.note}>Skipped. Later check-ins carry the trial on.</span>
        </div>
      </li>
    );
  }

  const before = daysBetween(row.date, trial.deadline);
  return (
    <li className={s.row} style={{ gridTemplateColumns: "64px 1fr" }}>
      {dateCol(false)}
      <div className={s.body}>
        <span className={isVerdict ? s.title : s.titleQuiet}>{label}</span>
        {isVerdict && before >= 0 && today <= row.date && (
          <span className={s.note}>
            {before} {before === 1 ? "day" : "days"} before the deadline
          </span>
        )}
      </div>
    </li>
  );
}
