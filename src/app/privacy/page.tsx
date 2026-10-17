import type { Metadata } from "next";
import { DeleteAll } from "@/components/DeleteAll";
import { Icon, type IconName } from "@/components/Icon";
import { Disclaimer, Header } from "@/components/ui";
import { SOURCES } from "@/lib/sources";
import s from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Where Verdict keeps your face photos, what is sent for analysis, and how to delete everything.",
};

const REPO = "https://github.com/Chinorab/verdict";

/*
  Every statement below describes the real data flows (constitution II, FR-033). The layout
  follows design/project/Privacy.dc.html; its sample copy (on device measurement, accounts,
  revocable links) did not match the product and was rewritten.
*/
function Block({ icon, title, strong, children }: { icon: IconName; title: string; strong?: boolean; children: React.ReactNode }) {
  const id = `p-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={`${s.block} ${strong ? s.blockStrong : ""}`}>
      <Icon name={icon} size={22} />
      <div className={s.content}>
        <h2 id={id} className={s.h2}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="app-column">
      <Header title="Privacy" backHref="/" />
      <main className={s.main}>
        <section className={s.intro}>
          <h1 className={s.h1}>Your face photos are kept on this phone.</h1>
          <p className={s.lead}>
            They leave it only to be measured by YouCam, the skin analysis service, and Verdict never stores them. There
            is no account.
          </p>
        </section>

        <Block icon="lock" title="Kept only on this phone" strong>
          <ul className={s.list}>
            <li>Face photos and detection overlays</li>
            <li>Measurements and results</li>
            <li>Product, claims, price and dates</li>
          </ul>
          <p className={s.text}>
            They live in this browser&apos;s storage, outside your camera roll. Clearing this site&apos;s data, or the
            button below, removes them. You can also save a trial as a backup file; it stays wherever you put it.
          </p>
        </Block>

        <Block icon="camera" title="Sent to measure your skin">
          <p className={s.text}>
            Each face photo goes straight from this phone to YouCam (Perfect Corp.), which returns scores and overlays.
            Verdict&apos;s server only asks for the upload link and the result. It never receives or keeps the photo.
          </p>
          <p className={s.text}>
            YouCam says it keeps uploaded files and analysis tasks for 30 days, and describes analysis results as kept
            for 24 hours.
          </p>
          <p className={s.text}>
            The camera guide is YouCam&apos;s camera kit, loaded from YouCam&apos;s servers into this page while the camera
            is open.
          </p>
          <div className={s.sources}>
            <a href={SOURCES.youcamFileRetention.url} target="_blank" rel="noopener noreferrer">
              {SOURCES.youcamFileRetention.label}
            </a>
            <a href={SOURCES.youcamSkinAnalysis.url} target="_blank" rel="noopener noreferrer">
              {SOURCES.youcamSkinAnalysis.label}
            </a>
          </div>
        </Block>

        <Block icon="image" title="Label photos">
          <p className={s.text}>
            The photo of the product label is sent to Anthropic, which reads the printed claims. Never a photo of your
            face. Verdict does not store the label photo, on this phone or anywhere else.
          </p>
          <div className={s.sources}>
            <a href={SOURCES.anthropicPrivacy.url} target="_blank" rel="noopener noreferrer">
              {SOURCES.anthropicPrivacy.label}
            </a>
          </div>
        </Block>

        <Block icon="info" title="One small cookie">
          <p className={s.text}>
            It lets Verdict&apos;s server count how many analyses this device ran today (5 a day), so the free service
            lasts for everyone. It holds a random code and two counters, nothing about you.
          </p>
        </Block>

        <Block icon="share" title="Shared, only when you choose">
          <p className={s.text}>
            Your measured review: numbers only, unless you add photos yourself. A shared link carries the numbers inside
            the link. Nothing is stored on a server, so a link cannot be withdrawn once sent.
          </p>
        </Block>

        <Block icon="notMeasurable" title="Never">
          <ul className={s.list}>
            <li>Sold, or shared with brands and retailers</li>
            <li>Used by Verdict to train software</li>
            <li>Used for advertising or tracking</li>
          </ul>
        </Block>

        <section className={s.delete} aria-labelledby="delete-h">
          <h2 id="delete-h" className={s.h2}>
            Delete everything
          </h2>
          <p className={s.small}>
            Removes every trial, photo and measurement from this phone. You confirm first. It cannot be undone. Photos
            already sent for analysis follow YouCam&apos;s retention above.
          </p>
          <DeleteAll />
        </section>

        <section className={s.contact}>
          <span>
            Questions: <a href={`${REPO}/issues`}>open an issue on GitHub</a>
          </span>
          <span>Verdict is an independent project. Source code: <a href={REPO}>github.com/Chinorab/verdict</a></span>
          <span className={`${s.updated} num`}>Last updated Oct 17, 2026</span>
        </section>

        <div className={s.foot}>
          <Disclaimer />
        </div>
      </main>
    </div>
  );
}
