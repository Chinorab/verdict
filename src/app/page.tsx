import Link from "next/link";
import { ErasedNotice } from "@/components/ErasedNotice";
import { Icon } from "@/components/Icon";
import { Mark } from "@/components/Mark";
import { CtaLink, Disclaimer, SecondaryLink } from "@/components/ui";
import { MEASURE_CONFIG } from "@/lib/measure/config";
import { SOURCES } from "@/lib/sources";
import s from "./landing.module.css";

/*
  Landing (design/project/Main.dc.html and DesktopHome.dc.html). Every figure links to its source
  (src/lib/sources.ts). The mockup's sample result card is replaced by a labelled method diagram,
  and its privacy line is corrected: photos are kept on the phone and sent only for analysis.
*/

const STATS = [
  {
    num: `${SOURCES.unverifiableBrands.percent}%`,
    text: `of ${SOURCES.unverifiableBrands.brands} skincare brands had no independently verifiable evidence behind any of their high impact claims. Unverifiable does not mean false; it means you cannot check.`,
    src: SOURCES.unverifiableBrands,
  },
  {
    num: `${SOURCES.undeclaredActives.found} of ${SOURCES.undeclaredActives.tested}`,
    text: "skin products sold online for eczema, psoriasis, dermatitis or dark spots contained a strong prescription steroid that was not on the label.",
    src: SOURCES.undeclaredActives,
  },
  {
    num: `${SOURCES.magazineAds.percent}%`,
    text: "of the claims in nearly 300 magazine beauty ads were judged acceptable by researchers.",
    src: SOURCES.magazineAds,
  },
  {
    num: "FDA",
    text: "Cosmetics can go on sale in the US without FDA approval, color additives aside.",
    src: SOURCES.fdaApproval,
  },
];

export default function Home() {
  const k = MEASURE_CONFIG?.k;
  return (
    <div className={s.page}>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <div className={s.wrap}>
        <header className={s.top}>
          <Link href="/" aria-label="Verdict home" className={s.brand}>
            <Mark size={22} />
            <span>Verdict</span>
          </Link>
          <nav className={s.nav} aria-label="Main">
            <a href="#how" className={s.navLink}>
              How it works
            </a>
            <Link href="/privacy" className={s.navLink}>
              Privacy
            </Link>
            <span className={s.navCta}>
              <CtaLink href="/trial/new" compact>
                Start a trial
              </CtaLink>
            </span>
          </nav>
        </header>

        <ErasedNotice />

        <main id="main">
        <section className={s.hero}>
          <div className={s.heroText}>
            <h1 className={`${s.h1} rise`}>Find out if it works on your skin before the return window closes.</h1>
            <p className={`${s.lead} rise`} style={{ animationDelay: "80ms" }}>
              Scan the label. Photograph your skin on a schedule. Get a result for each claim, shown next to the
              measurement error.
            </p>
            <div className={`${s.actions} rise`} style={{ animationDelay: "160ms" }}>
              <CtaLink href="/trial/new">Start a trial</CtaLink>
              <SecondaryLink href="/trial/new?quick=1">Same day test, 10 minutes</SecondaryLink>
              <Link href="/demo" className={s.quiet}>
                <Icon name="arrow" size={18} />
                See the author&apos;s real trial
              </Link>
              <Link href="/privacy" className={s.quiet}>
                <Icon name="lock" size={18} />
                Face photos are kept on your phone
              </Link>
              <span className={s.quiet}>
                <Icon name="camera" size={18} />
                Best on a phone; a laptop webcam works in lower detail
              </span>
            </div>
          </div>

          <figure className={`${s.figure} rise`} style={{ animationDelay: "240ms" }}>
            <span className={s.figTitle}>How a result is judged</span>
            <div
              className={s.diagram}
              role="img"
              aria-label="Diagram. A shaded band around zero shows how much a reading moves on its own. A change inside the band is no measurable change. A change well outside it counts."
            >
              <span className={`${s.dLabel} ${s.dLabelOut}`}>Clears the band: counts</span>
              <span className={`${s.dLabel} ${s.dLabelIn}`}>Inside the band: no change</span>
              <div className={s.dAxis} />
              <div className={s.dBand} />
              <div className={s.dZero} />
              <div className={`${s.dMark} ${s.dOut}`} />
              <div className={`${s.dMark} ${s.dIn}`} />
              <span className={`${s.dLabel} ${s.dLabelBand} num`}>your noise band</span>
            </div>
            <div className={`${s.dScale} num`} aria-hidden="true">
              <span>Toward the claim</span>
              <span>Away from it</span>
            </div>
            <figcaption className={s.figCaption}>Illustration of the method, not a result.</figcaption>
          </figure>
        </section>

        <section aria-label="Why measure" className={s.stats}>
          {STATS.map((st) => (
            <div key={st.src.url} className={s.stat}>
              <span className={`${s.statNum} num`}>{st.num}</span>
              <div className={s.statBody}>
                <p className={s.statText}>{st.text}</p>
                <a href={st.src.url} target="_blank" rel="noopener noreferrer" className={s.statSource}>
                  {st.src.label}
                </a>
              </div>
            </div>
          ))}
        </section>

        <section id="how" aria-labelledby="how-h" className={s.section}>
          <h2 id="how-h" className={s.h2}>
            How a trial runs
          </h2>
          <ol className={s.steps}>
            <li className={s.step}>
              <Icon name="camera" size={22} />
              <div>
                <h3>Scan the label</h3>
                <p>Each printed claim is matched to something a camera can measure. Claims it cannot check are left out, and we say so.</p>
              </div>
            </li>
            <li className={s.step}>
              <Icon name="calendar" size={22} />
              <div>
                <h3>Photograph on schedule</h3>
                <p>Two photos on day 0 set your noise floor. Check-ins are placed so the verdict lands before the deadline.</p>
              </div>
            </li>
            <li className={s.step}>
              <Icon name="check" size={22} />
              <div>
                <h3>Keep or return</h3>
                <p>A result for each claim, a clear suggestion, and the refund at stake. The decision stays yours.</p>
              </div>
            </li>
          </ol>
        </section>

        <section aria-labelledby="noise-h" className={`${s.section} ${s.noise}`}>
          <div>
            <h2 id="noise-h" className={s.h2}>
              Every reading wobbles. We show by how much.
            </h2>
          </div>
          <p>
            Light, angle and the camera shift a measurement a little every time. Your two day 0 photos measure that
            wobble on your own skin. A change counts only when it is{" "}
            {k ? `more than ${k} times that wobble` : "clearly bigger than that wobble"}, and every result is shown next
            to its threshold.
          </p>
        </section>

        <section aria-labelledby="priv-h" className={s.privacy}>
          <h2 id="priv-h" className={s.privacyTitle}>
            <Icon name="lock" size={22} />
            Face photos are kept on your phone, and sent only to be measured.
          </h2>
          <Link href="/privacy">
            Read how data is handled
            <Icon name="arrow" size={18} />
          </Link>
        </section>

        </main>

        <footer className={s.footer}>
          <Disclaimer />
          <nav aria-label="Footer">
            <Link href="/privacy">Privacy</Link>
            <Link href="/settings">Your data</Link>
            <a href="https://github.com/Chinorab/verdict">Source code</a>
            <span>&copy; 2026 Verdict</span>
          </nav>
        </footer>
      </div>
    </div>
  );
}
