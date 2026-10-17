import { DEFAULT_DIRECTION, type Concern, type ExtractedClaim, type LabelReading } from "@/lib/schemas";

/* In memory state of the new trial flow. Nothing is stored until the user confirms. */

export type DraftClaim = ExtractedClaim & { key: string; main: boolean; editedByUser: boolean };

export type Draft = {
  product: { name: string; size: string };
  claims: DraftClaim[];
  purchase: { price: string; date: string; retailer: string; online: boolean; returnDays: number | null };
};

let n = 0;
export const newKey = () => `c${Date.now().toString(36)}${(n++).toString(36)}`;

/** Main claim (FR-024): first measurable claim with a timeframe, else the first measurable one. */
export function withDefaultMain(claims: DraftClaim[]): DraftClaim[] {
  if (claims.some((c) => c.main && c.measurable)) return claims;
  const pick = claims.find((c) => c.measurable && c.timeframeDays) ?? claims.find((c) => c.measurable);
  return claims.map((c) => ({ ...c, main: c === pick }));
}

export function fromReading(r: LabelReading): Pick<Draft, "product" | "claims"> {
  return {
    product: { name: r.product.name, size: r.product.size ?? "" },
    claims: withDefaultMain(r.claims.map((c) => ({ ...c, key: newKey(), main: false, editedByUser: false }))),
  };
}

/** Health terms for claims typed by hand (the label reader returns its own). */
export function healthTermsIn(text: string, concerns: Concern[]): DraftClaim["healthTerms"] {
  const t = text.toLowerCase();
  const out: DraftClaim["healthTerms"] = [];
  if (/eczema|dermatitis/.test(t)) out.push("eczema");
  if (/psoriasis/.test(t)) out.push("psoriasis");
  if (concerns.includes("age_spot") || /dark spot|hyperpigment|melasma/.test(t)) out.push("dark_spots");
  return out;
}

const FAST_WORDS = /\b(instant(ly)?|fast|rapid(ly)?|quick(ly)?|overnight|immediate(ly)?)\b/i;

export function typedClaim(text: string, concerns: Concern[], timeframeDays: number | null): DraftClaim {
  const targets = concerns.map((concern) => ({ concern, direction: DEFAULT_DIRECTION[concern] }));
  return {
    key: newKey(),
    text,
    timeframeDays,
    targets,
    measurable: targets.length > 0,
    unmeasurableReason: targets.length ? null : "You marked this as not measurable by photo.",
    healthTerms: healthTermsIn(text, concerns),
    fastPromise: (timeframeDays !== null && timeframeDays <= 28) || FAST_WORDS.test(text),
    main: false,
    editedByUser: true,
  };
}

/** FR-028: online purchase plus a fast promise about eczema, psoriasis or dark spots. */
export const needsJamaNote = (d: Draft) =>
  d.purchase.online && d.claims.some((c) => c.fastPromise && c.healthTerms.length > 0);
