import { checkLabel, countLabel } from "@/lib/budget";
import { ClaimsError, readLabel } from "@/lib/claims";

// POST /api/claims (contracts/api.md). Accepts a label photo only; face photos never come here.

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  Response.json({ error: { code, message, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err(400, "bad_request", "Send the label photo as form data.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) return err(400, "bad_request", "No label photo received.");
  if (!TYPES.includes(file.type as (typeof TYPES)[number])) return err(400, "bad_request", "Use a JPEG, PNG or WebP photo.");
  if (file.size > MAX_BYTES) return err(413, "bad_request", "The photo is too large. It must be under 4 MB.");

  let cap;
  try {
    cap = await checkLabel();
  } catch {
    return err(503, "unavailable", "Label reading is not available right now.");
  }
  if (!cap.ok) return err(429, cap.code, "Daily label limit reached.", { retryAfter: cap.resumesAt.toISOString() });

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const reading = await readLabel({ data, mediaType: file.type as (typeof TYPES)[number] });
    await countLabel();
    if (reading.claims.length === 0) {
      return err(422, "no_claims", "No claims could be read on this label.", { product: reading.product });
    }
    return Response.json(reading, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ClaimsError) {
      if (e.code === "config") return err(503, "unavailable", "Label reading is not available right now.");
      if (e.code === "unreadable" || e.code === "refused") return err(422, "no_claims", "No claims could be read on this label.");
    }
    return err(502, "upstream", "Label reading failed. Try again.");
  }
}
