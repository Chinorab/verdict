// Assembles the demo video: the recorded take plus each narration clip placed at the start of its scene.
// Usage: node video/build.mjs   ->   video/out/verdict-demo.mp4 (1920 x 1080, H.264, AAC)
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const pkgs = 'C:/Users/Anas/AppData/Local/Microsoft/WinGet/Packages';
const ffDir = readdirSync(pkgs).find((d) => d.startsWith('Gyan.FFmpeg'));
const bin = join(pkgs, ffDir, readdirSync(join(pkgs, ffDir)).find((d) => d.startsWith('ffmpeg')), 'bin');
const FFMPEG = join(bin, 'ffmpeg.exe');

const { scenes, end } = JSON.parse(readFileSync(join(HERE, 'raw', 'scenes.json'), 'utf8'));
const LEAD = 0.45; // voice starts just after the caption has changed

mkdirSync(join(HERE, 'out'), { recursive: true });
const inputs = ['-i', join(HERE, 'raw', 'take.webm')];
const filters = [];
scenes.forEach((s, i) => {
  inputs.push('-i', join(HERE, 'voice', `${s.name}.wav`));
  const ms = Math.round((s.start + LEAD) * 1000);
  filters.push(`[${i + 1}:a]adelay=${ms}|${ms},aresample=48000[a${i}]`);
});
filters.push(`${scenes.map((_, i) => `[a${i}]`).join('')}amix=inputs=${scenes.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`);

const out = join(HERE, 'out', 'verdict-demo.mp4');
execFileSync(
  FFMPEG,
  [
    '-y', '-v', 'error', ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '0:v', '-map', '[aout]',
    '-t', String(Math.ceil(end)),
    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    out,
  ],
  { stdio: 'inherit' },
);
console.log('built', out, `${Math.ceil(end)} s`);
