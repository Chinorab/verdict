"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CompareSlider } from "@/components/CompareSlider";
import { DemoBanner } from "@/components/DemoBanner";
import { Icon } from "@/components/Icon";
import { CtaLink, Disclaimer, Header, SameDayBadge } from "@/components/ui";
import { get } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { buildBaselines } from "@/lib/measure/baseline";
import { measureConfig } from "@/lib/measure/config";
import { daysBetween } from "@/lib/schedule";
import { CONCERN_LABEL, type Concern, type Session } from "@/lib/schemas";
import { loadTrial, type TrialBundle } from "@/lib/trial-data";
import s from "./compare.module.css";

type Urls = { day0Photo?: string; day0Mask?: string; laterPhoto?: string; laterMask?: string };

export function CompareView({ id }: { id: string }) {
  const [bundle, setBundle] = useState<TrialBundle | null | undefined>(undefined);
  const [concern, setConcern] = useState<Concern | null>(null);
  const [laterId, setLaterId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [urls, setUrls] = useState<Urls>({});

  useEffect(() => {
    let live = true;
    loadTrial(id).then((b) => live && setBundle(b), () => live && setBundle(null));
    return () => {
      live = false;
    };
  }, [id]);

  const done = useMemo(() => bundle?.sessions.filter((x) => x.state === "done") ?? [], [bundle]);
  const day0 = done.find((x) => x.kind === "day0_a");
  const day0b = done.find((x) => x.kind === "day0_b");
  const checkins = done.filter((x) => x.kind === "checkin");
  const later: Session | undefined = checkins.find((x) => x.id === laterId) ?? checkins.at(-1);
  const concerns = useMemo(() => {
    const set = new Set<Concern>();
    for (const c of bundle?.claims ?? []) for (const t of c.targets) set.add(t.concern);
    return [...set];
  }, [bundle]);
  const current = concern ?? concerns[0] ?? null;

  // Load photos and the masks for the chosen concern from this device.
  useEffect(() => {
    if (!bundle || !day0 || !later || !current) return;
    let live = true;
    const made: string[] = [];
    const url = async (photoId?: string | null) => {
      if (!photoId) return undefined;
      const p = await get("photos", photoId);
      if (!p) return undefined;
      const u = URL.createObjectURL(p.blob);
      made.push(u);
      return u;
    };
    const maskOf = (sessionId: string) => bundle.measurements.get(sessionId)?.find((m) => m.concern === current)?.maskIds[0];
    (async () => {
      const next: Urls = {
        day0Photo: await url(day0.photoId),
        day0Mask: await url(maskOf(day0.id)),
        laterPhoto: await url(later.photoId),
        laterMask: await url(maskOf(later.id)),
      };
      if (live) setUrls(next);
    })();
    return () => {
      live = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [bundle, day0, later, current]);

  if (bundle === undefined) return <div className="app-column"><Header title="Compare" backHref={`/trial/${id}`} /></div>;
  if (!bundle || !day0 || !day0b || !later || !current) {
    return (
      <div className="app-column">
        <Header title="Compare" backHref={`/trial/${id}`} backLabel="Back to timeline" />
        <main className={s.main}>
          <p className={s.empty}>{bundle ? "Comparing needs day 0 and at least one check-in." : "This trial is not on this device."}</p>
          <CtaLink href={bundle ? `/trial/${id}` : "/"}>{bundle ? "Open the timeline" : "Back home"}</CtaLink>
        </main>
      </div>
    );
  }

  const trial = bundle.trial;
  const value = (sessionId: string) => bundle.measurements.get(sessionId)?.find((m) => m.concern === current)?.raw;
  const a = value(day0.id);
  const b = value(day0b.id);
  const v = value(later.id);
  let threshold: number | null = null;
  try {
    const base = buildBaselines(bundle.measurements.get(day0.id) ?? [], bundle.measurements.get(day0b.id) ?? [], measureConfig())[current];
    threshold = base?.threshold ?? null;
  } catch {
    threshold = null;
  }
  const mean = a !== undefined && b !== undefined ? (a + b) / 2 : undefined;
  const change = mean !== undefined && v !== undefined ? v - mean : undefined;
  const dayOf = (x: Session) => daysBetween(day0.takenAt.slice(0, 10), x.takenAt.slice(0, 10));
  const f = (n?: number) => (n === undefined ? "n/a" : n.toFixed(1));
  const signed = (n?: number) => (n === undefined ? "n/a" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`);

  return (
    <div className="app-column">
      <Header title="Compare" backHref={`/trial/${id}`} backLabel="Back to timeline" />
      <main className={s.main}>
        {trial.kind === "quick" && <div style={{ paddingTop: 16 }}><SameDayBadge /></div>}
        {trial.kind === "demo" && <DemoBanner trial={trial} />}

        <div role="group" aria-label="What to compare" className={s.tabs} style={{ gridTemplateColumns: `repeat(${Math.min(concerns.length, 4)}, minmax(0, 1fr))` }}>
          {concerns.map((c) => (
            <button key={c} type="button" className={s.tab} aria-pressed={c === current} onClick={() => setConcern(c)}>
              {CONCERN_LABEL[c]}
            </button>
          ))}
        </div>

        {checkins.length > 1 && (
          <label className={s.pick}>
            Compare day 0 with
            <select className={`${s.select} num`} value={later.id} onChange={(e) => setLaterId(e.target.value)}>
              {checkins.map((x) => (
                <option key={x.id} value={x.id}>
                  Day {dayOf(x)}, {fmtDate(x.takenAt.slice(0, 10))}
                </option>
              ))}
            </select>
          </label>
        )}

        <CompareSlider
          overlay={overlay}
          left={{ label: `Day 0, ${fmtDate(day0.takenAt.slice(0, 10))}`, photo: urls.day0Photo, mask: urls.day0Mask }}
          right={{ label: `Day ${dayOf(later)}, ${fmtDate(later.takenAt.slice(0, 10))}`, photo: urls.laterPhoto, mask: urls.laterMask }}
        />

        <label className={s.toggle}>
          <span>Detection overlay</span>
          <span className={s.toggleRight}>
            <span className="num">{overlay ? "On" : "Off"}</span>
            <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
          </span>
        </label>

        <section aria-live="polite" aria-label="Measured values" className={s.values}>
          <h2 className={s.h2}>{CONCERN_LABEL[current]} score</h2>
          <div className={s.grid}>
            <div>
              <span className={s.k}>Day 0</span>
              <span className={`${s.v} num`}>{f(mean)}</span>
            </div>
            <div>
              <span className={s.k}>Day {dayOf(later)}</span>
              <span className={`${s.v} num`}>{f(v)}</span>
            </div>
            <div>
              <span className={s.k}>Change</span>
              <span className={`${s.v} num`}>{signed(change)}</span>
            </div>
          </div>
          <p className={`${s.noise} num`}>
            Day 0 photos: {f(a)} and {f(b)}.{" "}
            {threshold !== null ? <>Your threshold: &plusmn;{threshold.toFixed(1)} points.</> : "Threshold available once calibration is done."}
          </p>
        </section>

        <Link href={`/trial/${id}/verdict`} className={s.link}>
          See the verdict
          <Icon name="arrow" size={18} />
        </Link>
        <Disclaimer />
      </main>
    </div>
  );
}
