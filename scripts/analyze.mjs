// Runs real YouCam skin analyses on local photos and stores everything needed later
// (scores, mask images) because YouCam deletes results after 24 hours.
//
// Usage:
//   node scripts/analyze.mjs --label day0 --mode hd photo-a.jpg photo-b.jpg            (dry run, free)
//   node scripts/analyze.mjs --label day0 --mode hd --confirm photo-a.jpg photo-b.jpg  (spends units)
//
// Options: --mode hd|sd (default hd), --actions age_spot,redness,... (default: all Verdict concerns)
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, CONCERNS, action, apiKey, credits, featureCost, imageSize, upload, createTask, poll } from './lib/youcam.mjs';

const { values, positionals: photos } = parseArgs({
  allowPositionals: true,
  options: {
    label: { type: 'string' },
    mode: { type: 'string', default: 'hd' },
    actions: { type: 'string' },
    confirm: { type: 'boolean', default: false },
  },
});

if (!values.label || photos.length === 0 || !['hd', 'sd'].includes(values.mode)) {
  console.error('Usage: node scripts/analyze.mjs --label <name> [--mode hd|sd] [--actions a,b] [--confirm] <photo> [...]');
  process.exit(1);
}

const mode = values.mode;
const concerns = values.actions ? values.actions.split(',').map((s) => s.trim()) : CONCERNS;
const actions = concerns.map((c) => action(c, mode));
const minShort = mode === 'hd' ? 1080 : 480;

let ok = true;
for (const p of photos) {
  const { w, h } = imageSize(p);
  const short = Math.min(w, h);
  const note = short < minShort ? `  TOO SMALL for ${mode.toUpperCase()} (short side ${short} < ${minShort})` : '';
  if (note) ok = false;
  console.log(`${basename(p)}: ${w}x${h}${note}`);
}
if (!ok) process.exit(1);

const key = apiKey();
const before = await credits(key);
const skus = await featureCost(key);
console.log(`\nMode ${mode.toUpperCase()}, ${actions.length} concerns: ${actions.join(', ')}`);
console.log(`Balance: ${before.spendable} units. Price list:`);
for (const s of skus) console.log(`  ${s.amount} per ${s.proc_unit ?? 'task'}: ${s.description}`);

if (!values.confirm) {
  console.log(`\nDry run. ${photos.length} analyses would run. Add --confirm to spend units.`);
  process.exit(0);
}

const outDir = join(ROOT, 'scripts', 'out', values.label);
mkdirSync(outDir, { recursive: true });

for (const p of photos) {
  const stem = basename(p, extname(p));
  const startedAt = new Date().toISOString();
  process.stdout.write(`\n${stem}: uploading`);
  try {
    const fileId = await upload(key, p);
    process.stdout.write(', analyzing');
    const taskId = await createTask(key, fileId, actions);
    const data = await poll(key, taskId);
    const finishedAt = new Date().toISOString();
    const { w: width, h: height } = imageSize(p);
    const record = { photo: basename(p), label: values.label, mode, actions, taskId, startedAt, finishedAt, width, height, data };
    writeFileSync(join(outDir, `${stem}.json`), JSON.stringify(record, null, 2));

    if (data.task_status !== 'success') {
      console.log(`\n  ERROR: ${data.error ?? JSON.stringify(data).slice(0, 300)}`);
      continue;
    }
    const output = data.results?.output ?? [];
    for (const o of output) {
      console.log(`\n  ${String(o.type).padEnd(22)} raw ${String(o.raw_score).padStart(9)}  ui ${String(o.ui_score).padStart(4)}`);
      for (const [i, url] of (o.mask_urls ?? []).entries()) {
        const res = await fetch(url);
        if (!res.ok) continue;
        const ext = (res.headers.get('content-type') ?? '').includes('png') ? 'png' : 'jpg';
        writeFileSync(join(outDir, `${stem}.${o.type}.${i}.${ext}`), Buffer.from(await res.arrayBuffer()));
      }
    }
  } catch (err) {
    console.log(`\n  FAILED: ${err.message}`);
  }
}

const after = await credits(key);
const spent = before.spendable - after.spendable;
console.log(`\n\nUnits: ${before.spendable} -> ${after.spendable} (spent ${spent} for ${photos.length} photos)`);
appendFileSync(join(ROOT, 'scripts', 'out', 'ledger.jsonl'),
  JSON.stringify({ at: new Date().toISOString(), label: values.label, mode, photos: photos.length, concerns: actions.length, before: before.spendable, after: after.spendable }) + '\n');
console.log(`Saved in scripts/out/${values.label}/`);
