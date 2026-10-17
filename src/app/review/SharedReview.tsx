"use client";

import { useSyncExternalStore } from "react";
import { ReviewCard } from "@/components/ReviewCard";
import { CtaLink, Disclaimer } from "@/components/ui";
import { decodeReview } from "@/lib/review-card";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/* Reads the card from the URL fragment, on the device only (the fragment never reaches a server). */
export function SharedReview() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => null);
  if (hash === null) return null;
  const data = decodeReview(hash);
  if (!data) {
    return (
      <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ color: "var(--text-2)" }}>This review link is incomplete or damaged.</p>
        <CtaLink href="/">Run your own trial</CtaLink>
      </div>
    );
  }
  return (
    <div style={{ padding: "28px 0", display: "flex", flexDirection: "column", gap: 20 }}>
      <ReviewCard data={data} />
      <p style={{ fontSize: 14, color: "var(--text-2)" }}>
        Shared by someone who tested this product on their own skin with Verdict. Results vary from person to person.
      </p>
      <CtaLink href="/">Run your own trial</CtaLink>
      <Disclaimer />
    </div>
  );
}
