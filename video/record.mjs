// Records the Verdict demo video: a 1920 x 1080 frame with the scene caption on the left and the real app at
// phone size on the right, driven end to end by this script.
//
// Data rules (docs/video-script.md):
// - Faces are the three SYNTHETIC test faces (scripts/photos/synthetic, a fictional person), labelled on screen.
// - Every YouCam reply is the real response recorded for those faces (scripts/out/synthetic), masks included.
// - The label reading is the real one Claude returned for the author's product (kept in the demo trial).
// - The author's own trial is public/demo/demo-trial.verdict.json.
// - The product's brand name is hidden on screen (contest rule: no third party trademarks).
//
// Usage: start the production build on port 3770 (npx next start -p 3770), then node video/record.mjs
// Writes video/raw/<id>.webm and video/raw/scenes.json (scene start times in seconds).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BASE = process.env.VIDEO_BASE ?? 'http://localhost:3770';
const RAW = join(HERE, 'raw');
const SYN = join(ROOT, 'scripts', 'out', 'synthetic');
const FACES = join(ROOT, 'scripts', 'photos', 'synthetic');
const DUR = JSON.parse(readFileSync(join(HERE, 'voice', 'durations.json'), 'utf8'));
const PAD = 0.7;
const KIT_SRC = 'https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js';
const BRAND = 'SVR Extreme Sensifine';

const demo = JSON.parse(readFileSync(join(ROOT, 'public', 'demo', 'demo-trial.verdict.json'), 'utf8'));
const results = Object.fromEntries(
  ['a', 'b', 'c'].map((f) => {
    const rec = JSON.parse(readFileSync(join(SYN, `${f}.json`), 'utf8'));
    const out = rec.data.results.output
      .filter((o) => (!o.region || o.region === 'whole') && Number.isFinite(o.raw_score) && Number.isFinite(o.ui_score))
      .map((o) => {
        const concern = o.type.replace(/^hd_/, '').replace(/_v2$/, '');
        return { concern, raw: o.raw_score, ui: o.ui_score, maskUrls: [`https://masks.test/${f}/${o.type}.jpg`] };
      });
    return [f, out];
  }),
);

// Caption panel for each scene (left side of the frame).
const CAPTIONS = {
  title: { h: 'Verdict', p: 'Find out if a skincare product works on your skin, before the return window closes.', card: true },
  problem: {
    h: '47% of 633 skincare brands',
    p: 'had no independently verifiable evidence behind any of their high impact claims.',
    note: 'M11 report, Dermatology Times, Oct 13, 2026',
    card: true,
  },
  scan: { h: 'Scan the label', p: 'Each claim is matched to a concern YouCam AI Skin Analysis measures, or left out with a reason.', note: 'The real reading of the author’s product label, replayed. Brand name hidden.' },
  claim: { h: 'Add a claim', p: 'Pick what a photo can check for it.' },
  purchase: { h: 'Plan around the return window', p: 'The verdict lands before the deadline.' },
  capture: { h: 'Day 0, two photos', p: 'YouCam JS Camera Kit checks light, framing and angle live.', note: 'Synthetic test face, not a real person.' },
  baseline: { h: 'Your noise floor', p: 'Two photos measured by YouCam AI Skin Analysis in HD. Their difference is how much a reading moves on its own.', note: 'Real YouCam results for the synthetic test faces.' },
  demo: { h: 'The author’s real trial', p: 'Running now, published as numbers only. No face photo.', note: 'Brand name hidden.' },
  verdict: { h: 'Verdict day', p: 'Each claim gets a result next to its threshold, then Keep or Return.', note: 'Synthetic test faces: shows how a verdict reads, not a product result.' },
  rawscore: { h: 'raw_score, never ui_score', p: 'YouCam’s display score ran up to 40 points above the raw score in our tests.' },
  compare: { h: 'Compare', p: 'Day 0 and verdict day with YouCam’s detection masks.', note: 'Synthetic test faces.' },
  privacy: { h: 'Kept on your phone', p: 'Face photos go only to YouCam. A calm health guardrail, never a diagnosis.' },
  closing: { h: 'Verdict', p: 'verdict-skin.vercel.app', note: 'Same day test in 10 minutes, no account.', card: true },
};

const WRAPPER = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500&family=JetBrains+Mono:wght@400&display=swap"><style>
html,body{margin:0;height:100%;background:#111413;color:#f3f4f1;font-family:'Hanken Grotesk','Helvetica Neue',Arial,sans-serif;overflow:hidden}
.frame{display:grid;grid-template-columns:1fr 520px;height:100%;padding:0 120px 0 140px;gap:80px;align-items:center}
.cap{max-width:760px;transition:opacity .45s ease,transform .45s ease}
.cap.out{opacity:0;transform:translateY(10px)}
.cap h1{font-size:64px;font-weight:400;letter-spacing:-1px;line-height:1.1;margin:0 0 24px}
.cap p{font-size:30px;line-height:1.45;color:#c9ceca;margin:0}
.cap .note{margin-top:28px;font-size:20px;color:#9db0ff;border-left:2px solid #9db0ff;padding-left:14px;font-family:'JetBrains Mono',ui-monospace,Menlo,monospace}
.bar{width:84px;height:3px;background:#9db0ff;margin-bottom:28px}
.phone{width:448px;height:970px;border:1px solid #2e3331;overflow:hidden;background:#f3f4f1;justify-self:center;transition:opacity .45s ease}
.phone iframe{width:390px;height:844px;border:0;transform:scale(1.1487);transform-origin:0 0}
.card .frame{grid-template-columns:1fr}
.card .phone{opacity:0;position:absolute;right:120px}
.card .cap h1{font-size:96px}.card .cap p{font-size:40px}
</style></head><body><div class="frame"><div class="cap" id="cap"><div class="bar"></div><h1></h1><p></p><div class="note" hidden></div></div>
<div class="phone"><iframe id="app" src="about:blank"></iframe></div></div></body></html>`;

// Camera kit double: shows the synthetic face named in localStorage "__face", captures it on demand or automatically.
const DOUBLE = `(() => {
  const listeners = new Map(); let next = 0;
  const emit = (e, p) => { for (const l of [...listeners.values()]) if (l.event === e) l.cb(p); };
  const face = () => localStorage.getItem('__face') || 'a';
  const shoot = async () => {
    const f = face();
    const blob = await (await fetch('https://faces.test/' + f + '.png')).blob();
    emit('faceDetectionCaptured', { images: [{ image: blob, width: 1086, height: 1448 }] });
  };
  window.__ymk = { emit, shoot };
  window.YMK = {
    init: () => {},
    openCameraKit: () => {
      const m = document.getElementById('YMK-module');
      if (m) { m.innerHTML = '<img alt="" src="https://faces.test/' + face() + '.png" style="display:block;width:100%;height:420px;object-fit:cover">'; }
      setTimeout(() => emit('cameraOpened'), 300);
    },
    close: () => {},
    capture: () => { void shoot(); return true; },
    addEventListener: (event, cb) => { const id = ++next; listeners.set(id, { event, cb }); return id; },
    removeEventListener: (id) => listeners.delete(id),
  };
  if (typeof window.YMKAsyncInit === 'function') window.YMKAsyncInit();
})();`;

// Hides the product's brand name wherever the app renders it.
const HIDE_BRAND = `(() => {
  const swap = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.includes(${JSON.stringify(BRAND)})) n.nodeValue = n.nodeValue.split(${JSON.stringify(BRAND)}).join('Soothing cream');
  };
  new MutationObserver(() => document.body && swap(document.body)).observe(document, { childList: true, subtree: true, characterData: true });
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  rmSync(RAW, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: RAW, size: { width: 1920, height: 1080 } },
  });
  await context.addInitScript(HIDE_BRAND);

  // Network: wrapper page, camera kit double, synthetic faces and masks, analysis replies, label reading.
  await context.route(`${BASE}/__video`, (r) => r.fulfill({ contentType: 'text/html', body: WRAPPER }));
  await context.route(KIT_SRC, (r) => r.fulfill({ contentType: 'text/javascript', body: DOUBLE }));
  await context.route('https://faces.test/*', (r) =>
    r.fulfill({ contentType: 'image/png', body: readFileSync(join(FACES, r.request().url().split('/').pop())) }),
  );
  await context.route('https://masks.test/**', (r) => {
    const [, , , face, file] = r.request().url().split('/');
    r.fulfill({ contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' }, body: readFileSync(join(SYN, `${face}.${file.replace('.jpg', '')}.0.jpg`)) });
  });
  await context.route('**/api/budget', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ deviceRemaining: 5, globalOpen: true }) }));
  await context.route('**/api/analysis/upload', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ fileId: 'f', upload: { url: 'https://upload.test/put', method: 'PUT', headers: {} } }) }),
  );
  await context.route('https://upload.test/**', (r) => r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }));
  // Analyses are created in this order: day 0 photo A, day 0 photo B, verdict photo C.
  const queue = ['a', 'b', 'c'];
  await context.route('**/api/analysis/task', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ taskId: `task-${queue.shift()}` }) }));
  await context.route('**/api/analysis/task/*', async (r) => {
    const face = r.request().url().split('task-').pop();
    await sleep(1800); // a short wait, so the measuring steps are visible
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success', results: results[face] }) });
  });
  const reading = demo.claims
    .filter((c) => !c.editedByUser)
    .sort((a, b) => a.position - b.position)
    .map(({ text, timeframeDays, targets, measurable, unmeasurableReason, healthTerms, fastPromise }) => ({
      text, timeframeDays, targets, measurable, unmeasurableReason, healthTerms, fastPromise,
    }));
  await context.route('**/api/claims', async (r) => {
    await sleep(1500);
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ product: { name: demo.trial.product.name, size: null }, claims: reading }) });
  });

  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-24T16:00:00'));
  const t0 = Date.now();
  await page.goto(`${BASE}/__video`);
  const app = page.frameLocator('#app');
  const frame = () => page.frame({ url: (u) => u.href.startsWith(BASE) && !u.pathname.startsWith('/__video') });

  const scenes = [];
  const caption = async (name) => {
    const c = CAPTIONS[name];
    await page.evaluate(
      ([c]) => {
        const el = document.getElementById('cap');
        el.classList.add('out');
        setTimeout(() => {
          el.querySelector('h1').textContent = c.h;
          el.querySelector('p').textContent = c.p;
          const n = el.querySelector('.note');
          n.hidden = !c.note;
          n.textContent = c.note || '';
          document.body.classList.toggle('card', !!c.card);
          el.classList.remove('out');
        }, 250);
      },
      [c],
    );
  };
  // Runs a scene: caption, actions, then holds until its narration has been heard.
  const scene = async (name, actions = async () => {}) => {
    const start = (Date.now() - t0) / 1000;
    scenes.push({ name, start });
    await caption(name);
    await actions();
    const left = DUR[name] + PAD - ((Date.now() - t0) / 1000 - start);
    if (left > 0) await sleep(left * 1000);
  };
  const go = async (path) => {
    await page.evaluate((u) => (document.getElementById('app').src = u), `${BASE}${path}`);
    await sleep(1200);
  };

  await go('/');
  await scene('title');
  await scene('problem');

  await scene('scan', async () => {
    await go('/trial/new');
    await page.evaluate(() => localStorage.setItem('__face', 'a'));
    const chooser = page.waitForEvent('filechooser');
    await app.getByRole('button', { name: 'Upload' }).click();
    const grey = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
      const x = c.getContext('2d'); x.fillStyle = '#e7e9e5'; x.fillRect(0, 0, 900, 1200);
      return c.toDataURL('image/png').split(',')[1];
    });
    await (await chooser).setFiles({ name: 'label.png', mimeType: 'image/png', buffer: Buffer.from(grey, 'base64') });
    await app.getByRole('heading', { name: 'What it promises, and how we check' }).waitFor();
    await sleep(1500);
    await app.getByRole('heading', { name: 'What it promises, and how we check' }).scrollIntoViewIfNeeded();
  });

  await scene('claim', async () => {
    await app.getByRole('button', { name: 'Add a claim' }).click();
    await app.getByLabel('Claim, as printed').pressSequentially('Sa texture fraîche hydrate', { delay: 35 });
    await app.getByRole('button', { name: 'Hydration' }).click();
    await sleep(400);
    await app.getByRole('button', { name: 'Save claim' }).click();
  });

  await scene('purchase', async () => {
    await app.getByLabel('Price paid, $').pressSequentially('30', { delay: 80 });
    await app.getByLabel('Bought on', { exact: true }).fill('2026-10-24');
    await app.getByRole('button', { name: '30', exact: true }).click();
    await app.getByText(/Return by/).scrollIntoViewIfNeeded();
  });

  await scene('capture', async () => {
    await app.getByRole('button', { name: 'Start day 0 photos' }).click();
    await app.getByText('Day 0, photo 1 of 2').waitFor();
    await sleep(1200);
    await frame().evaluate(() => window.__ymk.emit('faceQualityChanged', { hasFace: true, position: 'good', frontal: 'notgood', lighting: 'ok' }));
    await sleep(1400);
    await frame().evaluate(() => window.__ymk.emit('faceQualityChanged', { hasFace: true, position: 'good', frontal: 'good', lighting: 'ok' }));
    await sleep(1400);
    await frame().evaluate(() => window.__ymk.emit('faceQualityChanged', { hasFace: true, position: 'good', frontal: 'good', lighting: 'good' }));
    await sleep(900);
    await frame().evaluate(() => window.__ymk.shoot());
    await page.evaluate(() => localStorage.setItem('__face', 'b')); // the camera reopens on face B
  });

  await scene('baseline', async () => {
    await app.getByText('Day 0, photo 2 of 2').waitFor({ timeout: 20000 });
    // The camera reopens for photo B: show face B, then the kit captures it by itself.
    await frame().evaluate(() => {
      const img = document.querySelector('#YMK-module img');
      if (img) img.src = 'https://faces.test/b.png';
    });
    await sleep(900);
    await frame().evaluate(() => window.__ymk.emit('faceQualityChanged', { hasFace: true, position: 'good', frontal: 'good', lighting: 'good' }));
    await sleep(700);
    await frame().evaluate(() => window.__ymk.shoot());
    await app.getByText('Baseline set').waitFor({ timeout: 20000 });
  });
  const trialId = new URL(frame().url()).pathname.split('/')[2];

  await scene('demo', async () => {
    await go('/demo');
    await app.getByText(/Real trial by the author/).first().waitFor();
  });

  // Verdict day of the synthetic trial: Nov 19, photo C.
  await page.clock.setFixedTime(new Date('2026-11-19T16:00:00'));
  await scene('verdict', async () => {
    await page.evaluate(() => localStorage.setItem('__face', 'c'));
    await go(`/trial/${trialId}/capture?day=26`);
    await app.getByText(/Verdict photo, day 26/).waitFor();
    await sleep(800);
    await frame().evaluate(() => window.__ymk.emit('faceQualityChanged', { hasFace: true, position: 'good', frontal: 'good', lighting: 'good' }));
    await sleep(600);
    await frame().evaluate(() => window.__ymk.shoot());
    await app.getByRole('link', { name: 'See the verdict' }).waitFor({ timeout: 20000 });
    await sleep(600);
    await app.getByRole('link', { name: 'See the verdict' }).click();
    await sleep(1500);
  });

  await scene('rawscore', async () => {
    await frame().evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
  });

  await scene('compare', async () => {
    await go(`/trial/${trialId}/compare`);
    await sleep(800);
    const slider = app.getByRole('slider').first();
    if (await slider.count()) {
      await slider.focus();
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('ArrowLeft');
        await sleep(90);
      }
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press('ArrowRight');
        await sleep(90);
      }
    }
  });

  await scene('privacy', async () => {
    await go('/privacy');
    await sleep(2500);
    await frame().evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));
  });

  await go('/');
  await scene('closing');
  await sleep(800);

  writeFileSync(join(RAW, 'scenes.json'), JSON.stringify({ scenes, end: (Date.now() - t0) / 1000 }, null, 1));
  const video = page.video();
  await context.close();
  const dest = join(RAW, 'take.webm');
  await video.saveAs(dest);
  await video.delete();
  await browser.close();
  console.log('recorded', dest, scenes.map((s) => `${s.name}@${s.start.toFixed(1)}`).join(' '));
  for (const f of readdirSync(RAW)) if (f.endsWith('.webm') && f !== 'take.webm') console.log('extra file', f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
