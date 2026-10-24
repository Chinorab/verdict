// Publishes the author's real trial as the read only demo (decision 2026-10-24: numbers only,
// no face photos). Input: a backup exported from the phone's "Your data" page WITHOUT photos.
// Usage: node scripts/publish-demo.mjs scripts/demo-in/<file>.verdict.json [output path, for tests]
// Writes public/demo/demo-trial.verdict.json. Run again after each check-in.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT } from './lib/youcam.mjs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/publish-demo.mjs <backup.verdict.json>');
  process.exit(1);
}

const fail = (msg) => {
  console.error(`Refused: ${msg}`);
  process.exit(1);
};

let b;
try {
  b = JSON.parse(readFileSync(input, 'utf8'));
} catch {
  fail('the file is not readable JSON.');
}
if (b.format !== 'verdict-backup' || b.version !== 1) fail('not a Verdict backup (format verdict-backup, version 1).');
if (b.includesPhotos !== false || 'photos' in b) fail('the backup includes photos. Export it again without photos.');
if (!b.trial || !Array.isArray(b.sessions) || !Array.isArray(b.measurements) || !Array.isArray(b.claims)) {
  fail('the backup is missing its trial, claims, sessions or measurements.');
}
if (b.trial.kind === 'quick') fail('this is a same day test, not a real trial.');

const done = b.sessions.filter((s) => s.state === 'done');
if (!done.some((s) => s.kind === 'day0_a') || !done.some((s) => s.kind === 'day0_b')) fail('day 0 is not finished.');

// Text corrections the author asked for (scripts/demo-overrides.json). Concerns never change.
const corrections = JSON.parse(readFileSync(join(ROOT, 'scripts', 'demo-overrides.json'), 'utf8'));
const overrides = corrections.claims ?? [];
const claims = b.claims.map((c) => {
  const o = overrides.find((x) => x.from === c.text);
  return o ? { ...c, text: o.to, editedByUser: true } : c;
});
for (const o of overrides) {
  if (b.claims.some((c) => c.text === o.from)) console.log(`Claim corrected: "${o.from}" -> "${o.to}"`);
}

// Keep the measurements; drop what only matters on the phone (task ids, photo links, masks).
const out = {
  ...b,
  // The product name is published without its brand (scripts/demo-overrides.json).
  trial: { ...b.trial, kind: 'demo', product: { ...b.trial.product, ...(corrections.product ? { name: corrections.product.name } : {}) } },
  claims,
  sessions: b.sessions.map((s) => ({ ...s, taskId: null, photoId: null })),
  measurements: b.measurements.map((m) => ({ ...m, maskIds: [] })),
};

const path = process.argv[3] ?? join(ROOT, 'public', 'demo', 'demo-trial.verdict.json');
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(out, null, 2) + '\n');

const day = (iso) => iso.slice(0, 10);
console.log(`Published ${out.trial.product.name}: ${path}`);
console.log(`Exported ${b.exportedAt}, mode ${b.trial.mode}, return deadline ${b.trial.deadline}`);
for (const s of done) {
  const n = b.measurements.filter((m) => m.sessionId === s.id).length;
  console.log(`  ${s.kind.padEnd(7)} day ${String(s.scheduledDay).padStart(2)}  ${day(s.takenAt)}  ${s.width} x ${s.height}  ${n} concerns`);
}
const open = b.sessions.length - done.length;
if (open) console.log(`  (${open} photo(s) not measured, kept out of the results)`);
