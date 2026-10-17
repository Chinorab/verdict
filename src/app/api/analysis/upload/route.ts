import { apiError, apiOk } from "@/lib/api-response";
import { checkAnalysis } from "@/lib/budget";
import { imageFitsMode } from "@/lib/measure/baseline";
import { UploadRequest } from "@/lib/schemas";
import { createUpload, YouCamError } from "@/lib/youcam";

/*
  POST /api/analysis/upload (contracts/api.md). Returns a YouCam pre signed URL; the browser
  PUTs the face photo straight to YouCam, so it never passes through Verdict (constitution II).
*/
export async function POST(request: Request) {
  const parsed = UploadRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "bad_request", "Invalid upload request.");
  const { contentType, size, width, height, mode } = parsed.data;

  if (!imageFitsMode({ width, height }, mode)) {
    return apiError(422, mode === "hd" ? "error_mode_mismatch" : "error_below_min_image_size", "The photo is too small for this trial.");
  }

  let cap;
  try {
    cap = await checkAnalysis();
  } catch {
    return apiError(503, "unavailable", "Analyses are not available right now.");
  }
  if (!cap.ok) return apiError(429, cap.code, "Analysis limit reached.", { retryAfter: cap.resumesAt.toISOString() });

  try {
    const ticket = await createUpload(contentType, size);
    return apiOk({ fileId: ticket.fileId, upload: { url: ticket.url, method: ticket.method, headers: ticket.headers } });
  } catch (e) {
    if (e instanceof YouCamError && e.status === 429) return apiError(429, "rate_limited", "Too many requests. Try again in a minute.");
    return apiError(502, "upstream", "The analysis service did not answer. Try again.");
  }
}
