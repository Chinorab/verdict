"use client";

import { fmtDate, fmtPrice } from "./format";
import { heldUpLine, signed, STATUS_TEXT, type ReviewData } from "./review-card";

/*
  Draws the review card as a PNG on the device (FR-026): "Save image" and the share sheet.
  Uses the page's own fonts. Face photos are drawn only when the user turned them on.
*/

const W = 1080;
const PAD = 80;
const C = {
  paper: "#fbfbf9",
  ink: "#141716",
  text2: "#4d5450",
  text3: "#5f6662",
  line: "#d3d7d2",
  accent: "#2b45c4",
  worse: "#b4460e",
  mark: "#7c93ff",
};

function fonts() {
  const css = getComputedStyle(document.documentElement);
  const sans = css.getPropertyValue("--font-hanken").trim() || "Helvetica, Arial, sans-serif";
  const mono = css.getPropertyValue("--font-jetbrains").trim() || "Menlo, monospace";
  return { sans, mono };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

export async function renderReviewPng(data: ReviewData, faces?: { day0: string; latest: string } | null): Promise<Blob> {
  await document.fonts.ready;
  const { sans, mono } = fonts();
  const faceH = faces ? 560 : 0;
  const rowH = 118;
  const H = 300 + (faces ? faceH + 40 : 0) + data.rows.length * rowH + 260;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Mark and header
  let y = PAD;
  ctx.fillStyle = C.ink;
  ctx.fillRect(PAD, y, 44, 44);
  ctx.strokeStyle = C.paper;
  ctx.lineWidth = 4;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(PAD + 12.4, y + 10.3);
  ctx.lineTo(PAD + 22, y + 29.6);
  ctx.lineTo(PAD + 31.6, y + 10.3);
  ctx.stroke();
  ctx.strokeStyle = C.mark;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(PAD + 11, y + 35.7);
  ctx.lineTo(PAD + 33, y + 35.7);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.font = `600 30px ${sans}`;
  ctx.fillText("Measured review", PAD + 62, y + 33);
  ctx.fillStyle = C.text3;
  ctx.font = `400 26px ${mono}`;
  const date = fmtDate(data.date, { month: "short", day: "numeric", year: "numeric" });
  ctx.fillText(date, W - PAD - ctx.measureText(date).width, y + 33);

  // Product and meta
  y += 110;
  ctx.fillStyle = C.ink;
  ctx.font = `400 46px ${sans}`;
  for (const l of wrap(ctx, data.product, W - 2 * PAD).slice(0, 2)) {
    ctx.fillText(l, PAD, y);
    y += 56;
  }
  ctx.fillStyle = C.text2;
  ctx.font = `400 26px ${mono}`;
  const meta = `${data.quick ? "Same day test" : `${data.days} days`}, ${data.sessions} photo ${data.sessions === 1 ? "session" : "sessions"}${
    data.price !== null ? `, paid ${fmtPrice(data.price)}` : ""
  }`;
  ctx.fillText(meta, PAD, y);
  y += 40;

  // Optional faces
  if (faces) {
    const [a, b] = await Promise.all([loadImage(faces.day0), loadImage(faces.latest)]);
    const w = (W - 2 * PAD - 24) / 2;
    for (const [i, img] of [a, b].entries()) {
      const x = PAD + i * (w + 24);
      const scale = Math.max(w / img.width, faceH / img.height);
      const sw = w / scale;
      const sh = faceH / scale;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, faceH);
    }
    y += faceH + 40;
  }

  // Rows
  ctx.fillStyle = C.ink;
  ctx.fillRect(PAD, y, W - 2 * PAD, 2);
  for (const r of data.rows) {
    y += 52;
    ctx.fillStyle = C.ink;
    ctx.font = `500 32px ${sans}`;
    ctx.fillText(r.concern, PAD, y);
    ctx.fillStyle = r.status === "holding_up" ? C.accent : r.status === "getting_worse" ? C.worse : C.text2;
    ctx.font = `400 30px ${sans}`;
    const st = STATUS_TEXT[r.status];
    ctx.fillText(st, W - PAD - ctx.measureText(st).width, y);
    if (r.status !== "missing") {
      ctx.fillStyle = C.text3;
      ctx.font = `400 22px ${mono}`;
      ctx.fillText(`${signed(r.delta)} points, threshold ±${r.threshold.toFixed(1)}`, PAD, y + 38);
    }
    y += rowH - 52;
    ctx.fillStyle = C.line;
    ctx.fillRect(PAD, y, W - 2 * PAD, 2);
  }

  // Summary and fine print
  y += 70;
  ctx.fillStyle = C.ink;
  ctx.font = `500 34px ${sans}`;
  ctx.fillText(heldUpLine(data), PAD, y);
  y += 56;
  ctx.fillStyle = C.text3;
  ctx.font = `400 22px ${sans}`;
  for (const l of wrap(ctx, "Measured on one person with Verdict, from photos compared with the photo to photo variation of day 0. Indicative, not medical advice.", W - 2 * PAD)) {
    ctx.fillText(l, PAD, y);
    y += 32;
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), "image/png"),
  );
}
