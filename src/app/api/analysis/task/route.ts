import { apiError, apiOk } from "@/lib/api-response";
import { checkAnalysis, countAnalysis } from "@/lib/budget";
import { TaskRequest } from "@/lib/schemas";
import { createTask, YouCamError } from "@/lib/youcam";

/*
  POST /api/analysis/task (contracts/api.md). Creates one skin analysis task in the trial's
  mode (SD and HD never mixed) and counts it against today's device cap.
  Returns a device bound token instead of the raw task id.
*/
export async function POST(request: Request) {
  const parsed = TaskRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "bad_request", "Invalid analysis request.");
  const { fileId, mode, concerns } = parsed.data;

  let cap;
  try {
    cap = await checkAnalysis();
  } catch {
    return apiError(503, "unavailable", "Analyses are not available right now.");
  }
  if (!cap.ok) return apiError(429, cap.code, "Analysis limit reached.", { retryAfter: cap.resumesAt.toISOString() });

  try {
    const taskId = await createTask(fileId, mode, [...new Set(concerns)]);
    const token = await countAnalysis(taskId);
    return apiOk({ taskId: token });
  } catch (e) {
    if (e instanceof YouCamError) {
      if (e.status === 429) return apiError(429, "rate_limited", "Too many requests. Try again in a minute.");
      if (e.status === 400) return apiError(400, "bad_request", "The analysis request was refused.");
      // A missing upload makes YouCam answer 404 or 500 (the PUT did not happen).
      if (e.status === 404) return apiError(409, "upload_missing", "The photo did not finish uploading. Try again.");
    }
    return apiError(502, "upstream", "The analysis service did not answer. Try again.");
  }
}
