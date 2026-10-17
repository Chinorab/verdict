/* One error shape for every route (contracts/api.md). Never includes keys or upstream bodies. */
export function apiError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code, message, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiOk(body: unknown) {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
