// Compares raw_score (and ui_score, for reference only) between analyses of identical
// captures, to measure how much a reading moves on its own.
// Usage: node scripts/noise.mjs scripts/out/day0/a.json scripts/out/day0/b.json [more.json]
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const files = process.argv.slice(2);
if (files.length < 2) {
  console.error('Usage: node scripts/noise.mjs <a.json> <b.json> [more.json]');
  process.exit(1);
}

const runs = files.map((f) => {
  const rec = JSON.parse(readFileSync(f, 'utf8'));
  const scores = {};
  for (const o of rec.data?.results?.output ?? []) {
    // Pores and wrinkles come per region; the whole face entry is the one Verdict uses.
    if (o.region && o.region !== 'whole') continue;
    if (!Number.isFinite(o.raw_score)) continue; // 'all', 'skin_age', 'resize_image'
    scores[o.type] = { raw: o.raw_score, ui: o.ui_score };
  }
  return { name: basename(f), mode: rec.mode, scores };
});

if (new Set(runs.map((r) => r.mode)).size > 1) {
  console.error('Runs mix SD and HD. Compare runs of the same mode only.');
  process.exit(1);
}

const types = [...new Set(runs.flatMap((r) => Object.keys(r.scores)))].sort();
const stats = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1));
  return { mean, range: Math.max(...xs) - Math.min(...xs), sd };
};
const f = (n) => (Number.isFinite(n) ? n.toFixed(2) : 'n/a');

console.log(`Runs: ${runs.map((r) => r.name).join(', ')} (${runs[0].mode.toUpperCase()})\n`);
console.log('| Concern | raw values | raw range | raw range % of mean | ui values | ui range |');
console.log('|---|---|---|---|---|---|');
for (const t of types) {
  const raw = runs.map((r) => r.scores[t]?.raw).filter(Number.isFinite);
  const ui = runs.map((r) => r.scores[t]?.ui).filter(Number.isFinite);
  if (raw.length < 2) continue;
  const s = stats(raw);
  const u = ui.length >= 2 ? stats(ui) : { range: NaN };
  const pct = s.mean ? (100 * s.range) / Math.abs(s.mean) : NaN;
  console.log(`| ${t} | ${raw.map(f).join(' / ')} | ${f(s.range)} | ${f(pct)}% | ${ui.join(' / ')} | ${f(u.range)} |`);
}
