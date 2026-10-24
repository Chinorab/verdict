// Runs the judges' same day test end to end against a live deployment: typed claim, day 0 photos A and B,
// verdict photo C, through "Upload a photo instead" with the three SYNTHETIC test faces
// (scripts/photos/synthetic, a fictional person). Real YouCam analyses: about 36 units.
// Usage: node scripts/live-quick-run.mjs <deployment url> [--confirm]
// A protected deployment needs E2E_VERCEL_BYPASS (the project's automation bypass secret).
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { ROOT } from './lib/youcam.mjs';

const BASE = process.argv[2];
const confirm = process.argv.includes('--confirm');
if (!BASE || !BASE.startsWith('https://')) {
  console.error('Usage: node scripts/live-quick-run.mjs <https deployment url> [--confirm]');
  process.exit(1);
}
if (!confirm) {
  console.log(`Dry run: would run a same day test on ${BASE}, 3 real analyses (about 36 units). Add --confirm.`);
  process.exit(0);
}

const face = (f) => join(ROOT, 'scripts', 'photos', 'synthetic', `${f}.png`);
const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
try {
  const bypass = process.env.E2E_VERCEL_BYPASS;
  await page.goto(bypass ? `${BASE}/?x-vercel-protection-bypass=${bypass}&x-vercel-set-bypass-cookie=true` : BASE);

  await page.goto(`${BASE}/trial/new?quick=1`);
  await page.getByRole('button', { name: 'Type them' }).click();
  await page.getByLabel('Product name').fill('Synthetic test cream');
  await page.getByLabel('Claim, as printed').fill('Hydrates the skin');
  await page.getByRole('button', { name: 'Hydration' }).click();
  await page.getByRole('button', { name: 'Save claim' }).click();
  await page.getByLabel('Price paid, $').fill('24');
  await page.getByRole('button', { name: 'Start day 0 photos' }).click();
  await page.waitForURL(/\/trial\/[0-9a-f-]+\/capture$/);
  const id = new URL(page.url()).pathname.split('/')[2];
  console.log(at(), 'setup done, trial', id);

  const upload = async (f) => {
    const button = page.getByRole('button', { name: 'Upload a photo instead' }).first();
    await button.waitFor({ timeout: 30000 });
    const chooser = page.waitForEvent('filechooser');
    await button.click();
    await (await chooser).setFiles(face(f));
  };

  await upload('a');
  await page.getByText('Day 0, photo 2 of 2').waitFor({ timeout: 180000 });
  console.log(at(), 'photo A measured');
  await upload('b');
  await page.getByText('Baseline set').waitFor({ timeout: 180000 });
  console.log(at(), 'photo B measured, baseline set');

  await page.goto(`${BASE}/trial/${id}/capture?day=0`);
  await upload('c');
  await page.getByRole('link', { name: 'See the verdict' }).waitFor({ timeout: 180000 });
  console.log(at(), 'verdict photo C measured');
  await page.getByRole('link', { name: 'See the verdict' }).click();
  await page.waitForURL(/\/verdict$/);
  await page.waitForTimeout(1500);
  const headline = await page.locator('h1').first().innerText();
  const rows = await page.getByText(/score .* points, threshold/).allInnerTexts();
  console.log(at(), 'verdict:', headline, '|', rows.join(' | '));
  await page.screenshot({ path: join(ROOT, 'scripts', 'out', 'live-quick-run-verdict.png'), fullPage: true });
} catch (e) {
  console.error(at(), 'FAILED', e.message.split('\n')[0]);
  await page.screenshot({ path: join(ROOT, 'scripts', 'out', 'live-quick-run-failure.png'), fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
}
