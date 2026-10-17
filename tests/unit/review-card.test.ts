import { describe, expect, it } from "vitest";
import type { ClaimResult } from "@/lib/measure/verdict";
import { decodeReview, encodeReview, heldUpLine, reviewFrom, type ReviewData } from "@/lib/review-card";

const results: ClaimResult[] = [
  {
    claimId: "c1",
    text: "Fades dark spots in 4 weeks",
    main: true,
    measurable: true,
    status: "no_change",
    targets: [{ concern: "age_spot", direction: "decrease", status: "no_change", delta: -1.04, toward: 1.04, threshold: 6, noise: 4, ratio: 0.17 }],
  },
  {
    claimId: "c2",
    text: "Radiant glow",
    main: false,
    measurable: true,
    status: "holding_up",
    targets: [{ concern: "radiance", direction: "increase", status: "holding_up", delta: 3.5, toward: 3.5, threshold: 1.5, noise: 1, ratio: 2.3 }],
  },
  { claimId: "c3", text: "72 hour hydration", main: false, measurable: false, status: "not_measured", targets: [] },
];

const base = {
  trial: { product: { name: "Test Serum", size: "30 ml" }, purchase: { price: 38 } as never, kind: "real" as const },
  results,
  day0Date: "2026-10-12",
  latestDate: "2026-11-07",
  sessions: 5,
  days: 26,
};

describe("reviewFrom", () => {
  it("keeps only measured numbers, with change and threshold per row", () => {
    const d = reviewFrom({ ...base, showPrice: false });
    expect(d.rows).toEqual([
      { claim: "Fades dark spots in 4 weeks", concern: "Dark spots", status: "no_change", delta: -1, threshold: 6 },
      { claim: "Radiant glow", concern: "Radiance", status: "holding_up", delta: 3.5, threshold: 1.5 },
    ]);
    expect(d.price).toBeNull();
    expect(d.notMeasured).toBe(1);
  });

  it("adds the price only when asked", () => {
    expect(reviewFrom({ ...base, showPrice: true }).price).toBe(38);
  });

  it("counts claims that held up", () => {
    expect(heldUpLine(reviewFrom({ ...base, showPrice: false }))).toBe("1 of 2 measurable claims held up on my skin.");
  });
});

describe("link fragment", () => {
  const d: ReviewData = reviewFrom({ ...base, showPrice: true });

  it("round trips, including non ASCII text", () => {
    const withAccents = { ...d, product: "Sérum éclat, 30 ml" };
    expect(decodeReview("#" + encodeReview(withAccents))).toEqual(withAccents);
  });

  it("uses only URL safe characters", () => {
    expect(encodeReview(d)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("refuses tampered or foreign data", () => {
    expect(decodeReview("#not-base64!")).toBeNull();
    expect(decodeReview("#" + btoa(JSON.stringify({ v: 2 })))).toBeNull();
    expect(decodeReview("")).toBeNull();
  });
});
