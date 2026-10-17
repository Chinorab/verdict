import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { refundTask, taskFromToken } from "@/lib/budget";
import { getTask, YouCamError } from "@/lib/youcam";

/*
  GET /api/analysis/task/{token} (contracts/api.md). Polls YouCam once per call; the client
  polls every 4 s. Only the device that created the task can read it. A task that ends in
  error gives its slot back once (FR-034). ui scores are returned for reference only; the app
  computes verdicts from raw scores (FR-019).
*/
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/analysis/task/[taskId]">) {
  const { taskId: token } = await ctx.params;
  if (!token || token.length > 600) return apiError(400, "bad_request", "Invalid task.");

  let taskId: string | null;
  try {
    taskId = await taskFromToken(token);
  } catch {
    return apiError(503, "unavailable", "Analyses are not available right now.");
  }
  if (!taskId) return apiError(404, "not_found", "This analysis does not belong to this device.");

  try {
    const result = await getTask(taskId);
    if (result.status === "error") {
      await refundTask(taskId);
      return apiOk({ status: "error", code: result.code });
    }
    return apiOk(result);
  } catch (e) {
    if (e instanceof YouCamError && e.status === 429) return apiOk({ status: "running" });
    return apiError(502, "upstream", "The analysis service did not answer. Try again.");
  }
}
