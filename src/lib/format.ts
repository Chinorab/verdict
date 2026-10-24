/* Display helpers. Dates are ISO YYYY-MM-DD and formatted in UTC so they never shift a day. */

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export const fmtDay = (iso: string) => fmtDate(iso, { weekday: "short", month: "short", day: "numeric" });

export function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "3 PM". The narrow space browsers put before AM and PM is missing from the mono font, so a plain no-break space is used. */
export const fmtHour = (h: number) =>
  new Date(2026, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" }).replace(/\s/g, "\u00a0");
