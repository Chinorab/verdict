"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { ReviewCard } from "@/components/ReviewCard";
import { CtaLink, Disclaimer, Header, SameDayBadge, SecondaryButton } from "@/components/ui";
import { get } from "@/lib/db";
import { daysBetween } from "@/lib/schedule";
import { encodeReview, reviewFrom } from "@/lib/review-card";
import { renderReviewPng } from "@/lib/review-image";
import { deriveVerdict, loadTrial, type TrialBundle } from "@/lib/trial-data";
import { todayIso } from "@/lib/schedule";
import s from "./review.module.css";

type Faces = { day0: string; latest: string };

export function ReviewView({ id }: { id: string }) {
  const [bundle, setBundle] = useState<TrialBundle | null | undefined>(undefined);
  const [withFaces, setWithFaces] = useState(false);
  const [withPrice, setWithPrice] = useState(true);
  const [faces, setFaces] = useState<Faces | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let live = true;
    loadTrial(id).then((b) => live && setBundle(b), () => live && setBundle(null));
    return () => {
      live = false;
    };
  }, [id]);

  const state = useMemo(() => (bundle ? deriveVerdict(bundle, todayIso()) : null), [bundle]);
  const ready = state?.kind === "ready" ? state : null;

  // Face photos are loaded only after the user turns them on, and released when turned off.
  useEffect(() => {
    if (!withFaces || !ready) return;
    let urls: string[] = [];
    let live = true;
    (async () => {
      const [a, b] = await Promise.all([
        ready.day0.photoId ? get("photos", ready.day0.photoId) : undefined,
        ready.latest.photoId ? get("photos", ready.latest.photoId) : undefined,
      ]);
      if (!live || !a || !b) return;
      urls = [URL.createObjectURL(a.blob), URL.createObjectURL(b.blob)];
      setFaces({ day0: urls[0], latest: urls[1] });
    })();
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
      setFaces(null);
    };
  }, [withFaces, ready]);

  if (bundle === undefined) return <div className="app-column"><Header title="Share" backHref={`/trial/${id}/verdict`} /></div>;
  if (!bundle || !ready) {
    return (
      <div className="app-column">
        <Header title="Share" backHref={`/trial/${id}/verdict`} backLabel="Back to verdict" />
        <main className={s.main}>
          <p className={s.empty}>{bundle ? "Your review is ready once the verdict is." : "This trial is not on this device."}</p>
          <CtaLink href={bundle ? `/trial/${id}` : "/"}>{bundle ? "Open the timeline" : "Back home"}</CtaLink>
        </main>
      </div>
    );
  }

  const trial = bundle.trial;
  const photosAvailable = !!ready.day0.photoId && !!ready.latest.photoId;
  const data = reviewFrom({
    trial,
    results: ready.results,
    day0Date: ready.day0.takenAt.slice(0, 10),
    latestDate: ready.latest.takenAt.slice(0, 10),
    sessions: ready.sessionsDone,
    days: daysBetween(ready.day0.takenAt.slice(0, 10), ready.latest.takenAt.slice(0, 10)),
    showPrice: withPrice,
  });
  const link = () => `${window.location.origin}/review#${encodeReview(data)}`;
  const shownFaces = withFaces ? faces : null;

  async function save() {
    setStatus("Preparing the image…");
    const png = await renderReviewPng(data, shownFaces);
    const url = URL.createObjectURL(png);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verdict-measured-review.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Image saved");
  }

  async function share() {
    try {
      const png = await renderReviewPng(data, shownFaces);
      const file = new File([png], "verdict-measured-review.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My measured review" });
      } else if (navigator.share) {
        await navigator.share({ title: "My measured review", url: link() });
      } else {
        await copy();
        return;
      }
      setStatus("Shared");
    } catch {
      setStatus("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setStatus("Link copied. It holds the numbers only, never photos.");
    } catch {
      setStatus("Copying is blocked in this browser.");
    }
  }

  return (
    <div className="app-column">
      <Header title="Share" backHref={`/trial/${id}/verdict`} backLabel="Back to verdict" />
      <main className={s.main}>
        <section className={s.intro}>
          {trial.kind === "quick" && <SameDayBadge />}
          <h1 className={s.h1}>My measured review</h1>
        </section>

        <ReviewCard data={data} faces={shownFaces} />

        <div className={s.toggles}>
          <label className={s.toggle}>
            <span>
              <span className={s.toggleTitle}>Add face photos</span>
              <span className={s.toggleNote}>
                {photosAvailable ? "Off by default. Only in the saved image, never in links." : "No photos kept for this trial."}
              </span>
            </span>
            <input type="checkbox" role="switch" checked={withFaces} disabled={!photosAvailable} onChange={(e) => setWithFaces(e.target.checked)} />
          </label>
          <label className={s.toggle}>
            <span className={s.toggleTitle}>Show price paid</span>
            <input type="checkbox" role="switch" checked={withPrice} onChange={(e) => setWithPrice(e.target.checked)} />
          </label>
        </div>

        <div className={s.actions}>
          <SecondaryButton onClick={copy}>
            <Icon name="copy" size={18} />
            Copy link
          </SecondaryButton>
          <SecondaryButton onClick={save}>
            <Icon name="download" size={18} />
            Save image
          </SecondaryButton>
          <SecondaryButton onClick={share}>
            <Icon name="share" size={18} />
            Share
          </SecondaryButton>
        </div>
        <p className={s.status} aria-live="polite">
          {status}
        </p>
        <p className={s.note}>A shared link carries the numbers inside it. Nothing is stored on a server, so it cannot be withdrawn once sent.</p>
        <Disclaimer />
      </main>
    </div>
  );
}
