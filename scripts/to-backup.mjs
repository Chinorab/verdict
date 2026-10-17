// Turns the day 0 analyses made with analyze.mjs into a Verdict backup file, so a trial started
// before the app was ready continues in the app (contracts/backup-file.md, tasks T007).
// No face photos are included. Real values only: every number comes from scripts/out/.
//
// Usage:
//   node scripts/to-backup.mjs --setup scripts/trial-setup.json --a scripts/out/day0/a.json --b scripts/out/day0/b.json
// Writes scripts/out/<product-slug>.verdict.json, then import it from the app's "Your data" page.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ROOT } from './lib/youcam.mjs';
import { planTrial } from '../src/lib/schedule.ts';

const { values } = parseArgs({ options: { setup: { type: 'string' }, a: { type: 'string' }, b: { type: 'string' } } });
if (!values.setup || !values.a || !values.b) {
  console.error('Usage: node scripts/to-backup.mjs --setup <trial-setup.json> --a <day0 A.json> --b <day0 B.json>');
  process.exit(1);
}

const setup = JSON.parse(readFileSync(values.setup, 'utf8'));
const recA = JSON.parse(readFileSync(values.a, 'utf8'));
const recB = JSON.parse(readFileSync(values.b, 'utf8'));
for (const r of [recA, recB]) {
  if (r.data?.task_status !== 'success') throw new Error(`${r.photo}: analysis did not succeed`);
  if (!r.width || !r.height) throw new Error(`${r.photo}: no image size recorded (rerun analyze.mjs)`);
}
if (recA.mode !== recB.mode) throw new Error('Day 0 photos were analyzed in different modes');

const concernOf = (type) => type.replace(/^hd_/, '').replace(/_v2$/, '');
const start = recA.startedAt.slice(0, 10);
const measurable = setup.claims.filter((c) => c.targets.length > 0);
const plan = planTrial({
  start,
  purchaseDate: setup.purchase.date,
  returnDays: setup.purchase.returnDays,
  claimTimeframes: measurable.map((c) => c.timeframeDays ?? null),
  maxDays: setup.maxTrialDays,
});

const trialId = randomUUID();
const trial = {
  id: trialId,
  kind: 'real',
  status: 'active',
  createdAt: recA.startedAt,
  product: setup.product,
  purchase: { currency: 'USD', ...setup.purchase },
  deadline: plan.deadline,
  trialDays: plan.trialDays,
  verdictDate: plan.verdictDate,
  mode: recA.mode,
  reminderHour: new Date(recA.startedAt).getHours(),
  schedule: plan.schedule,
  decision: 'undecided',
  guardrail: { level: 0 },
  notes: { jamaNoteShown: false, timeframeWarning: plan.timeframeWarning },
};

const mainIndex = Math.max(0, setup.claims.findIndex((c) => c.main));
const claims = setup.claims.map((c, position) => ({
  id: randomUUID(),
  trialId,
  text: c.text,
  timeframeDays: c.timeframeDays ?? null,
  targets: c.targets,
  measurable: c.targets.length > 0,
  unmeasurableReason: c.targets.length ? null : c.unmeasurableReason ?? 'A photo cannot measure this.',
  main: c.targets.length > 0 && position === mainIndex,
  healthTerms: c.healthTerms ?? [],
  fastPromise: c.fastPromise ?? false,
  editedByUser: false,
  position,
}));

const session = (rec, kind) => ({
  id: randomUUID(),
  trialId,
  kind,
  scheduledDay: 0,
  takenAt: rec.startedAt,
  photoId: null,
  width: rec.width,
  height: rec.height,
  quality: null,
  taskId: null,
  state: 'done',
  error: null,
});
const sA = session(recA, 'day0_a');
const sB = session(recB, 'day0_b');
const measurements = [
  [sA, recA],
  [sB, recB],
].flatMap(([s, rec]) =>
  rec.data.results.output.map((o) => ({ sessionId: s.id, concern: concernOf(o.type), raw: o.raw_score, ui: o.ui_score, maskIds: [] })),
);

const backup = {
  format: 'verdict-backup',
  version: 1,
  exportedAt: new Date().toISOString(),
  includesPhotos: false,
  trial,
  claims,
  sessions: [sA, sB],
  measurements,
};
const slug = setup.product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
mkdirSync(join(ROOT, 'scripts', 'out'), { recursive: true });
const out = join(ROOT, 'scripts', 'out', `${slug}.verdict.json`);
writeFileSync(out, JSON.stringify(backup, null, 2));
console.log(`Wrote ${out}`);
console.log(`Day 0 ${start}, deadline ${plan.deadline}, verdict ${plan.verdictDate}, check-ins on days ${plan.schedule.map((s) => s.day).join(', ')}`);
