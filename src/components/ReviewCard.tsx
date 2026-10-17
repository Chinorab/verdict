import { fmtDate, fmtPrice } from "@/lib/format";
import { heldUpLine, signed, STATUS_TEXT, type ReviewData } from "@/lib/review-card";
import { Mark } from "./Mark";
import s from "./ReviewCard.module.css";

/* The "My measured review" card (design/project/Review.dc.html), from measurements only. */
export function ReviewCard({ data, faces }: { data: ReviewData; faces?: { day0: string; latest: string } | null }) {
  return (
    <article className={s.card} aria-label="My measured review">
      <div className={s.top}>
        <span className={s.brand}>
          <Mark size={18} />
          Measured review
        </span>
        <span className="num">{fmtDate(data.date, { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
      <div>
        <h2 className={s.title}>{data.product}</h2>
        <p className={`${s.meta} num`}>
          {data.quick ? "Same day test" : `${data.days} days`}, {data.sessions} photo {data.sessions === 1 ? "session" : "sessions"}
        </p>
        {data.price !== null && <p className={`${s.meta} num`}>Paid {fmtPrice(data.price)}</p>}
      </div>
      {faces && (
        <div className={s.faces}>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- local photo kept on the device */}
            <img src={faces.day0} alt="Day 0 photo" />
            <figcaption>Day 0</figcaption>
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- local photo kept on the device */}
            <img src={faces.latest} alt="Latest photo" />
            <figcaption>Day {data.days}</figcaption>
          </figure>
        </div>
      )}
      <ul className={s.rows}>
        {data.rows.map((r, i) => (
          <li key={i} className={s.row}>
            <span className={s.concern}>{r.concern}</span>
            <span className={`${s.status} ${s[r.status]}`}>{STATUS_TEXT[r.status]}</span>
            {r.status !== "missing" && (
              <span className={`${s.numbers} num`}>
                {signed(r.delta)} points, threshold &plusmn;{r.threshold.toFixed(1)}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className={s.summary}>{heldUpLine(data)}</p>
      <p className={s.fine}>
        Measured on one person with Verdict, from photos compared with the photo to photo variation of day 0.
        {data.notMeasured > 0 ? ` ${data.notMeasured} claim${data.notMeasured === 1 ? "" : "s"} could not be measured by photo.` : ""}{" "}
        Indicative, not medical advice.
      </p>
    </article>
  );
}
