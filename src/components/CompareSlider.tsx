"use client";

import { useId, useState } from "react";
import { Icon } from "./Icon";
import s from "./CompareSlider.module.css";

export type Side = { label: string; photo?: string | null; mask?: string | null };

/*
  Before and after slider (FR-025, design/project/Compare.dc.html). The left layer (day 0) is
  clipped at the slider position over the right layer (check-in). Operated with the native range
  input, so touch, mouse and keyboard all work.
*/
export function CompareSlider({ left, right, overlay }: { left: Side; right: Side; overlay: boolean }) {
  const id = useId();
  const [pos, setPos] = useState(50);
  const hasAnything = !!(left.photo || right.photo || (overlay && (left.mask || right.mask)));

  const layer = (side: Side) => (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- local images from this device */}
      {side.photo && <img src={side.photo} alt="" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- local images from this device */}
      {overlay && side.mask && <img src={side.mask} alt="" className={s.mask} />}
    </>
  );

  return (
    <div>
      <div
        className={s.frame}
        style={{ ["--pos" as string]: `${pos}%` }}
        role="img"
        aria-label={`${left.label} on the left of the slider, ${right.label} on the right`}
      >
        {hasAnything ? (
          <>
            <div className={s.layer}>{layer(right)}</div>
            <div className={`${s.layer} ${s.left}`}>{layer(left)}</div>
            <div className={s.divider} aria-hidden="true" />
            <div className={s.handle} aria-hidden="true">
              <Icon name="compare" size={18} />
            </div>
          </>
        ) : (
          <p className={s.empty}>
            {overlay ? "No photos or overlays are kept for this trial. The numbers below are the measurement." : "Turn on the overlay to see what was measured."}
          </p>
        )}
      </div>
      <div className={`${s.labels} num`}>
        <span>{left.label}</span>
        <span>{right.label}</span>
      </div>
      <label htmlFor={id} className="visually-hidden">
        Slide between {left.label} and {right.label}
      </label>
      <input id={id} className={s.range} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} />
    </div>
  );
}
