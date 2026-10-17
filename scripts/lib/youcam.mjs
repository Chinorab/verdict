// Minimal YouCam S2S client for the calibration scripts. No dependencies (Node 20+).
// The key is read from YOUCAM_API_KEY (environment or .env.local) and never printed.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = 'https://yce-api-01.makeupar.com';
export const UPLOAD_PATH = '/s2s/v2.0/file';
export const TASK_PATH = '/s2s/v2.1/task/skin-analysis';
const CREDIT_PATH = '/s2s/v1.0/client/credit';
const COST_PATH = '/s2s/v2.0/credit/feature-cost';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Concerns Verdict can map claims to. skin_type is excluded: it is a category, not a score.
export const CONCERNS = [
  'age_spot', 'wrinkle', 'texture', 'dark_circle', 'redness', 'pore', 'acne',
  'oiliness', 'moisture', 'firmness', 'radiance', 'eye_bag',
];
export const action = (concern, mode) => {
  if (mode === 'hd') return `hd_${concern}`;
  return concern === 'dark_circle' ? 'dark_circle_v2' : concern;
};

function loadEnvFile() {
  const p = join(ROOT, '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function apiKey() {
  loadEnvFile();
  const k = process.env.YOUCAM_API_KEY;
  if (!k) {
    console.error('YOUCAM_API_KEY is not set. Put it in .env.local at the repo root.');
    process.exit(2);
  }
  return k;
}

const headers = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });

async function call(key, method, path, { body, params } = {}) {
  const url = new URL(BASE + path);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method, headers: headers(key), body: body && JSON.stringify(body) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function credits(key) {
  const json = await call(key, 'GET', CREDIT_PATH);
  const batches = json.results ?? [];
  const spendable = batches.filter((b) => String(b.type ?? '').startsWith('Api'))
    .reduce((s, b) => s + (b.amount ?? 0), 0);
  return { spendable, batches };
}

export async function featureCost(key) {
  const skus = [];
  let token;
  do {
    const params = { page_size: '20' };
    if (token) params.starting_token = token;
    const json = await call(key, 'GET', COST_PATH, { params });
    skus.push(...(json.result?.skus ?? []));
    token = json.result?.next_token;
  } while (token);
  return skus.filter((s) => String(s.run_task_url ?? '').includes('skin-analysis'));
}

// Reads width and height from a JPEG or PNG header without decoding the image.
export function imageSize(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error(`Cannot read image size of ${path}`);
}

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

export async function upload(key, path) {
  const ct = TYPES[extname(path).toLowerCase()];
  if (!ct) throw new Error(`Unsupported file type: ${path} (jpg, jpeg or png only)`);
  const size = statSync(path).size;
  if (size >= 10 * 1024 * 1024) throw new Error(`${path} is over 10 MB`);
  const meta = await call(key, 'POST', UPLOAD_PATH, {
    body: { files: [{ content_type: ct, file_name: basename(path), file_size: size }] },
  });
  const file = meta.data.files[0];
  const req = file.requests[0];
  // The PUT is mandatory: without it the task fails with 500 or 404.
  const put = await fetch(req.url, { method: req.method ?? 'PUT', headers: req.headers ?? { 'Content-Type': ct }, body: readFileSync(path) });
  if (!put.ok) throw new Error(`Upload PUT failed: HTTP ${put.status}`);
  return file.file_id;
}

export async function createTask(key, fileId, actions, { overlay = true } = {}) {
  const json = await call(key, 'POST', TASK_PATH, {
    body: {
      src_file_id: fileId,
      dst_actions: actions,
      format: 'json',
      miniserver_args: { enable_mask_overlay: overlay },
    },
  });
  return json.data.task_id;
}

export async function poll(key, taskId, { interval = 5000, max = 40 } = {}) {
  for (let n = 0; n < max; n++) {
    const json = await call(key, 'GET', `${TASK_PATH}/${encodeURIComponent(taskId)}`);
    const status = json.data?.task_status;
    if (status === 'success' || status === 'error') return json.data;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Task ${taskId} still running after polling. Check later with the same task id (valid 24h); do not resubmit.`);
}
