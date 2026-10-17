import { z } from "zod";
import type { ClaimResult } from "./measure/verdict";
import { CONCERN_LABEL, type Trial } from "./schemas";

/*
  "My measured review" (FR-026, research R11). Built only from measurements. A shared link
  carries the card's numbers in the URL fragment (#...), which browsers never send to a server.
  Face photos are never part of a link; they can only be added to the saved image, by choice.
*/

const Row = z.object({
  claim: z.string().max(200),
  concern: z.string().max(40),
  status: z.enum(["holding_up", "getting_worse", "no_change", "missing"]),
  delta: z.number(),
  threshold: z.number(),
});

export const ReviewData = z.object({
  v: z.literal(1),
  product: z.string().max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(0).max(400),
  sessions: z.number().int().min(1).max(100),
  price: z.number().min(0).max(100000).nullable(),
  quick: z.boolean(),
  rows: z.array(Row).max(30),
  notMeasured: z.number().int().min(0).max(30),
});
export type ReviewData = z.infer<typeof ReviewData>;

export function reviewFrom(input: {
  trial: Pick<Trial, "product" | "purchase" | "kind">;
  results: ClaimResult[];
  day0Date: string;
  latestDate: string;
  sessions: number;
  days: number;
  showPrice: boolean;
}): ReviewData {
  const rows = input.results.flatMap((r) =>
    r.targets.map((t) => ({
      claim: r.text,
      concern: CONCERN_LABEL[t.concern],
      status: t.status,
      delta: Math.round(t.delta * 10) / 10,
      threshold: Math.round(t.threshold * 10) / 10,
    })),
  );
  return {
    v: 1,
    product: [input.trial.product.name, input.trial.product.size].filter(Boolean).join(", "),
    date: input.latestDate,
    days: input.days,
    sessions: input.sessions,
    price: input.showPrice ? input.trial.purchase.price : null,
    quick: input.trial.kind === "quick",
    rows,
    notMeasured: input.results.filter((r) => !r.measurable).length,
  };
}

/** "1 of 4 measurable claims held up on my skin." Counted per claim, not per concern. */
export function heldUpLine(data: ReviewData): string {
  const byClaim = new Map<string, boolean>();
  for (const r of data.rows) byClaim.set(r.claim, (byClaim.get(r.claim) ?? true) && r.status === "holding_up");
  const total = byClaim.size;
  const held = [...byClaim.values()].filter(Boolean).length;
  return `${held} of ${total} measurable ${total === 1 ? "claim" : "claims"} held up on my skin.`;
}

const toB64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export const encodeReview = (d: ReviewData) => toB64Url(JSON.stringify(d));

export function decodeReview(fragment: string): ReviewData | null {
  const raw = fragment.replace(/^#/, "");
  if (!raw || raw.length > 12000) return null;
  try {
    const parsed = ReviewData.safeParse(JSON.parse(fromB64Url(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const STATUS_TEXT: Record<ReviewData["rows"][number]["status"], string> = {
  holding_up: "Holding up",
  getting_worse: "Getting worse",
  no_change: "No measurable change",
  missing: "Not measured",
};

export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

