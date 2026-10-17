import type { ClaimResult, TargetResult, TargetStatus } from "@/lib/measure/verdict";
import { CONCERN_LABEL } from "@/lib/schemas";
import { Icon } from "./Icon";
import s from "./ResultRow.module.css";

export const STATUS_LABEL: Record<TargetStatus, string> = {
  holding_up: "Holding up",
  getting_worse: "Getting worse",
  no_change: "No measurable change",
  missing: "Not measured this time",
};

const pts = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

/** Detail line: the size of the change next to the threshold it was judged against (constitution I). */
export function targetDetail(t: TargetResult) {
  if (t.status === "missing") return `${CONCERN_LABEL[t.concern]}: no reading at the last check-in`;
  return `${CONCERN_LABEL[t.concern]} score ${pts(t.delta)} points, threshold ±${t.threshold.toFixed(1)}`;
}

export function NoiseBar({ t }: { t: TargetResult }) {
  // Scale so both the threshold band and the change fit, with room around them.
  const range = Math.max(Math.abs(t.toward), t.threshold, 0.1) * 1.6;
  const half = (v: number) => (v / range) * 50;
  const pos = Math.min(98, Math.max(2, 50 - half(t.toward)));
  const bandW = Math.min(96, half(t.threshold) * 2);
  const bandLeft = 50 - bandW / 2;
  return (
    <>
      <div className={s.bar} role="img" aria-label={`${STATUS_LABEL[t.status]}. ${targetDetail(t)}.`}>
        <div className={s.axis} />
        <div className={s.band} style={{ left: `${bandLeft}%`, width: `${bandW}%` }} />
        <div className={s.zero} />
        {t.status !== "missing" && <div className={`${s.mark} ${s[t.status]}`} style={{ left: `${pos}%` }} />}
      </div>
      <div className={`${s.scale} num`} aria-hidden="true">
        <span>Toward the claim</span>
        <span>Away from it</span>
      </div>
    </>
  );
}

function StatusIcon({ status }: { status: TargetStatus }) {
  if (status === "holding_up") return <Icon name="check" size={16} weight="bold" />;
  if (status === "getting_worse") return <Icon name="warning" size={16} weight="regular" />;
  return <span aria-hidden="true" style={{ width: 16, height: 2, background: "currentColor", display: "inline-block" }} />;
}

export function ResultRow({ result }: { result: ClaimResult }) {
  if (!result.measurable) {
    return (
      <article className={`${s.row} ${s.muted}`}>
        <h3 className={s.quote}>&ldquo;{result.text}&rdquo;</h3>
        <span className={s.note}>Not measured. A photo cannot check this one.</span>
      </article>
    );
  }
  return (
    <article className={s.row}>
      <h3 className={s.quote}>&ldquo;{result.text}&rdquo;</h3>
      {result.main && <span className={s.mainTag}>Main claim</span>}
      {result.targets.map((t) => (
        <div key={t.concern} className={s.target}>
          <div className={s.head}>
            <span className={`${s.status} ${s[t.status]}`}>
              <StatusIcon status={t.status} />
              {STATUS_LABEL[t.status]}
            </span>
            {t.status !== "missing" && <span className={`${s.ratio} num`}>{t.ratio.toFixed(1)}&times; threshold</span>}
          </div>
          <p className={`${s.detail} num`}>{targetDetail(t)}</p>
          <NoiseBar t={t} />
        </div>
      ))}
    </article>
  );
}
