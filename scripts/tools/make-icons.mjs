// Rasterizes the V mark (design/project/Favicon.dc.html) into the PWA and Apple icons.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const mark = (pad) => {
  // pad: fraction of the canvas kept as safe zone around the mark (maskable icons need ~10%)
  const s = 32 / (1 - 2 * pad);
  const o = -(s - 32) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o} ${o} ${s} ${s}"><rect x="${o}" y="${o}" width="${s}" height="${s}" fill="#141716"/><path d="M9 7.5l7 14 7-14" fill="none" stroke="#F3F4F1" stroke-width="3" stroke-linecap="square"/><path d="M8 26h16" stroke="#7C93FF" stroke-width="2.5"/></svg>`;
};

mkdirSync('public/icons', { recursive: true });
const jobs = [
  ['public/icons/icon-192.png', 192, 0],
  ['public/icons/icon-512.png', 512, 0],
  ['public/icons/maskable-512.png', 512, 0.12],
  ['src/app/apple-icon.png', 180, 0.08],
];
for (const [out, size, pad] of jobs) {
  await sharp(Buffer.from(mark(pad))).resize(size, size).png().toFile(out);
  console.log(out);
}
