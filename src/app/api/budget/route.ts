import { budgetStatus, writeDevice } from "@/lib/budget";

// GET /api/budget (contracts/api.md): lets the UI warn before a quick run starts.
export async function GET() {
  try {
    const { deviceRemaining, globalOpen, resumesAt, device } = await budgetStatus();
    await writeDevice(device);
    return Response.json(
      { deviceRemaining, globalOpen, ...(resumesAt ? { resumesAt } : {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Missing server configuration: report analyses as unavailable without leaking details.
    return Response.json(
      { error: { code: "unavailable", message: "Analyses are not available right now." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
