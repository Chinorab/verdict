"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";
import { demoToday } from "@/lib/demo-core";
import { ResultRow } from "@/components/ResultRow";
import { SafetyNotice } from "@/components/SafetyNotice";
import { CtaLink, Disclaimer, Header, SameDayBadge } from "@/components/ui";
import { put } from "@/lib/db";
import { fmtDate, fmtPrice, plural } from "@/lib/format";
import { worsened, type ClaimResult, type Suggestion } from "@/lib/measure/verdict";
import { daysBetween, todayIso } from "@/lib/schedule";
import { CONCERN_LABEL, type Trial } from "@/lib/schemas";
import { deriveGuard, deriveVerdict, loadTrial, type TrialBundle, type VerdictState } from "@/lib/trial-data";
import s from "./verdict.module.css";

const HEADLINE: Record<Suggestion, string> = { keep: "Keep it.", return: "Return it.", none: "The return window has closed." };

/** Plain sentence built only from measured statuses (no invented wording about the product). */
export function summarize(results: ClaimResult[]): string {
  const main = results.find((r) => r.main && r.measurable);
  const parts: string[] = [];
  if (main) {
    const quote = `“${main.text}”`;
    const line = {
      holding_up: `The main claim, ${quote}, held up beyond your measurement noise.`,
      no_change: `The main claim, ${quote}, showed no change bigger than your measurement noise.`,
      getting_worse: `The main claim, ${quote}, moved the other way, beyond your measurement noise.`,
      missing: `The main claim, ${quote}, could not be measured at the last check-in.`,
    }[main.status === "not_measured" ? "missing" : main.status];
    parts.push(line);
  }
  const worse = worsened(results).map((c) => CONCERN_LABEL[c]);
  if (worse.length) parts.push(`${worse.join(" and ")} got worse.`);
  return parts.join(" ");
}

export function VerdictView({ id }: { id: string }) {
  const [bundle, setBundle] = useState<TrialBundle | null | undefined>(undefined);
  const today = todayIso();

  useEffect(() => {
    let live = true;
    loadTrial(id).then((b) => live && setBundle(b), () => live && setBundle(null));
    return () => {
      live = false;
    };
  }, [id]);

  if (bundle === undefined) return <Shell id={id} title="Verdict" />;
  if (bundle === null) {
    return (
      <Shell id={id} title="Verdict">
        <div className={s.empty}>
          <p>This trial is not on this device.</p>
          <CtaLink href="/">Back home</CtaLink>
        </div>
      </Shell>
    );
  }

  // The demo is read at its last measured photo, like its timeline.
  const at = bundle.trial.kind === "demo" ? demoToday(bundle.trial, bundle.sessions, today) : today;
  const state = deriveVerdict(bundle, at);
  return <Ready bundle={bundle} state={state} today={at} onDecide={(t) => setBundle({ ...bundle, trial: t })} />;
}

function Shell({ id, title, right, children }: { id: string; title: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="app-column">
      <Header title={title} backHref={`/trial/${id}`} backLabel="Back to timeline" right={right} />
      <main className={s.main}>{children}</main>
    </div>
  );
}

function Ready({
  bundle,
  state,
  today,
  onDecide,
}: {
  bundle: TrialBundle;
  state: VerdictState;
  today: string;
  onDecide: (t: Trial) => void;
}) {
  const { trial } = bundle;
  const quick = trial.kind === "quick";
  const product = [trial.product.name, trial.product.size].filter(Boolean).join(", ");

  if (state.kind !== "ready") {
    const msg = {
      not_calibrated: "Results are not available yet: the measurement settings are still being calibrated on real photos.",
      no_baseline: "Your verdict needs both day 0 photos first.",
      no_checkin: "Your verdict needs at least one check-in after day 0.",
    }[state.kind];
    return (
      <Shell id={trial.id} title="Verdict">
        <div className={s.empty}>
          <span className={s.product}>{product}</span>
          <p>{msg}</p>
          {state.kind !== "not_calibrated" && <CtaLink href={`/trial/${trial.id}`}>Open the timeline</CtaLink>}
        </div>
        <Disclaimer />
      </Shell>
    );
  }

  const guard = deriveGuard(bundle);
  const day = daysBetween(state.day0.takenAt.slice(0, 10), state.latest.takenAt.slice(0, 10));
  const daysLeft = daysBetween(today, trial.deadline);
  const k = state.cfg.k;

  async function decide(decision: Trial["decision"]) {
    const next = { ...trial, decision };
    onDecide(next);
    await put("trials", next);
  }

  const choice = (value: "return" | "keep", label: string) => {
    const suggested = state.suggestion === value;
    return (
      <div className={s.choice}>
        <span className={s.suggested}>
          {suggested && (
            <>
              <Icon name="check" size={12} weight="bold" />
              Suggested
            </>
          )}
        </span>
        <button
          type="button"
          className={`${s.btn} ${suggested ? s.btnPrimary : ""}`}
          aria-pressed={trial.decision === value}
          onClick={() => decide(value)}
        >
          {label}
        </button>
      </div>
    );
  };

  return (
    <Shell id={trial.id} title="Verdict" right={<span className="num">Day {day}</span>}>
      {guard && guard.level > 0 && (
        <SafetyNotice guard={guard} deadline={trial.deadline} paused={trial.status === "paused"} acknowledged={false} />
      )}
      {trial.kind === "demo" && <DemoBanner trial={trial} />}
      <section className={s.top}>
        {quick && (
          <div className={s.badgeRow}>
            <SameDayBadge />
          </div>
        )}
        <span className={s.product}>{product}</span>
        <h1 className={`${s.headline} rise`}>{HEADLINE[state.suggestion]}</h1>
        <p className={`${s.summary} rise`} style={{ animationDelay: "100ms" }}>
          {summarize(state.results)}
          {quick && " A same day test shows how a verdict works; real changes take weeks."}
        </p>
      </section>

      <div className={`${s.stats} rise`} style={{ animationDelay: "200ms" }}>
        <div className={s.stat}>
          <span className={`${s.statValue} num`}>{fmtPrice(trial.purchase.price)}</span>
          <span className={s.statLabel}>{state.suggestion === "none" ? "paid" : "refund at stake"}</span>
        </div>
        <div className={s.stat}>
          <span className={`${s.statValue} num`}>{daysLeft >= 0 ? plural(daysLeft, "day") : "Closed"}</span>
          <span className={s.statLabel}>
            {daysLeft >= 0 ? `left, until ${fmtDate(trial.deadline)}` : `on ${fmtDate(trial.deadline)}`}
          </span>
        </div>
      </div>

      {state.suggestion !== "none" && trial.kind !== "demo" && (
        <>
          <div className={s.choices}>
            {choice("return", "Return")}
            {choice("keep", "Keep")}
          </div>
          <p className={s.hint}>Your call. Verdict only reports what it measured.</p>
        </>
      )}

      <section className={s.claims} aria-labelledby="claims-h">
        <h2 id="claims-h" className={s.h2}>
          By claim
        </h2>
        <div className={s.legend}>
          <span>
            <span className={s.swatchBand} />
            Your threshold
          </span>
          <span>
            <span className={s.swatchMark} />
            Change since day 0
          </span>
        </div>
        <p className={s.method}>
          A change counts when it is more than {k} times your day 0 noise, with a minimum per measure. Measured from{" "}
          {plural(state.sessionsDone, "photo session")} between {fmtDate(state.day0.takenAt.slice(0, 10))} and{" "}
          {fmtDate(state.latest.takenAt.slice(0, 10))}.
        </p>
        {state.results.map((r) => (
          <ResultRow key={r.claimId} result={r} />
        ))}
      </section>

      {trial.kind === "demo" && state.suggestion !== "none" && (
        <p className={s.hint}>Suggested: {state.suggestion === "keep" ? "Keep" : "Return"}. The author&apos;s own decision is not part of the demo.</p>
      )}
      <nav className={s.links} aria-label="More">
        <Link href={`/trial/${trial.id}/compare`}>
          Compare photos
          <Icon name="arrow" size={18} />
        </Link>
        <Link href={`/trial/${trial.id}/review`}>
          Share my measured review
          <Icon name="arrow" size={18} />
        </Link>
      </nav>

      <Disclaimer>Indicative results, not medical advice. Measured from photos of your skin.</Disclaimer>
    </Shell>
  );
}
