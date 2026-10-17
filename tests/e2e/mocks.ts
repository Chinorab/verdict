import type { Page, Route } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/*
  Playwright route mocks for every paid call (constitution: paid APIs are always mocked in tests).
  Fixtures in tests/fixtures/ are recorded from real calibration responses (tasks T028); until
  they exist, the helpers below fail loudly instead of inventing data.
*/

const FIXTURES = join(__dirname, "..", "fixtures");

export function fixture<T = unknown>(rel: string): T {
  const p = join(FIXTURES, rel);
  if (!existsSync(p)) throw new Error(`Missing recorded fixture ${rel}. Record it from a real calibration run first.`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

export async function mockBudget(page: Page, body = { deviceRemaining: 5, globalOpen: true }) {
  await page.route("**/api/budget", (r) => json(r, body));
}

export async function mockClaims(page: Page, rel = "claims/serum.json") {
  await page.route("**/api/claims", (r) => json(r, fixture(rel)));
}

/** Upload ticket, direct PUT and task polling, answered from a recorded task response. */
export async function mockAnalysis(page: Page, taskFixture = "youcam/task-success-hd.json") {
  await page.route("**/api/analysis/upload", (r) =>
    json(r, { fileId: "file-test", upload: { url: "https://upload.test/put", method: "PUT", headers: {} } }),
  );
  await page.route("https://upload.test/**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.route("**/api/analysis/task", (r) => json(r, { taskId: "task-test" }));
  await page.route("**/api/analysis/task/*", (r) => json(r, fixture(taskFixture)));
}
