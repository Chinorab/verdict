// Copy lint: user facing strings in src/app and src/components must follow the constitution
// (no emoji, no dashes used as punctuation, no AI mentions, one term for check-ins).
// Checks JSX text and string literals; a line ending with `// copy-lint-ignore` is skipped.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIRS = ['src/app', 'src/components'];
const SKIP = [/[\\/]api[\\/]/, /\.test\./];

const RULES = [
  { name: 'emoji', re: /\p{Extended_Pictographic}/u },
  { name: 'en or em dash', re: /[–—]/ },
  { name: 'spaced hyphen used as a dash', re: / - / },
  { name: 'AI mention', re: /\b(AI|A\.I\.|GPT|Claude|artificial intelligence)\b/ },
  { name: 'use "check-in"', re: /\b[Cc]heck ins?\b|\b[Cc]heckpoints?\b/ },
];

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(tsx|ts)$/.test(name) && !SKIP.some((r) => r.test(p))) out.push(p);
  }
  return out;
}

// Pulls user visible text out of a line: JSX text between tags and quoted string literals.
function texts(line) {
  const found = [];
  for (const m of line.matchAll(/>([^<>{}]+)</g)) found.push(m[1]);
  for (const m of line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
    const s = m[2];
    if (/^[\w./@:#-]*$/.test(s)) continue; // identifiers, paths, class names
    if (/calc\(|var\(--|\d(px|rem|%)/.test(s)) continue; // CSS values, not copy
    // css class lists (linear pattern: a nested quantifier here backtracks for minutes on long sentences)
    if (/^[a-z0-9-]+(?: [a-z0-9-]+)*$/.test(s) && !/\s[a-z]+\s/.test(s)) continue;
    found.push(s);
  }
  return found;
}

let problems = 0;
for (const d of DIRS) {
  let list = [];
  try { list = files(join(ROOT, d)); } catch { continue; }
  for (const f of list) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ')) return;
      if (line.includes('copy-lint-ignore')) return;
      for (const t of texts(line)) {
        for (const r of RULES) {
          if (r.re.test(t)) {
            problems++;
            console.log(`${relative(ROOT, f)}:${i + 1}  ${r.name}: "${t.trim().slice(0, 80)}"`);
          }
        }
      }
    });
  }
}

if (problems) {
  console.log(`\n${problems} copy problem(s).`);
  process.exit(1);
}
console.log('Copy lint passed.');
