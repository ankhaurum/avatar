// The side hair layers were cut from art A as the exact difference against the
// skin under them, so the thin, half-transparent hair beside the jaw holds a
// very dark navy colour (the composite's colour with the skin taken out). At
// rest that recomposes art A exactly, but as soon as the skin under it moves
// (smile, head turn, hair sway) or the page shows the face smaller, that dark
// colour reads as a black band next to the cheek. Here those half-transparent
// dark pixels take the lit blue of the opaque hair next to them (the
// transparency is kept), so the inside of the hair beside the jaw is the light
// blue of art A's lit hair. Only the lower part of the side layers (below the
// eyes, down to the jaw) is touched; the fringe, the hair over the face and
// the strands over the neck below the jaw are not.
// Recorded in parts/hair-inner.json (idempotent). Usage: node lighten-hair-inner.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const parts = path.resolve(here, '../parts'), log = path.join(parts, 'hair-inner.json');
const meta = JSON.parse(fs.readFileSync(path.join(parts, 'meta.json')));
const done = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log)) : {};
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
for (const name of ['hair_side_R', 'hair_side_L']) {
  const file = path.join(parts, name + '.png'), s0 = sha(file);
  if (done[name] && done[name].after === s0) { console.log('already', name); continue; }
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, m = meta[name];
  const lum = i => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  // the lit hair: opaque, clearly blue and not dark
  const lit = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 240 && data[i * 4 + 2] > data[i * 4] + 60 && lum(i) > 95) lit[i] = 1;
  // local lit colour: the blurred premultiplied lit pixels
  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) if (lit[i]) { for (let c = 0; c < 3; c++) buf[i * 4 + c] = data[i * 4 + c]; buf[i * 4 + 3] = 255; }
  const bl = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).blur(22).raw().toBuffer();
  // distance (px, up to 48) from each pixel to the nearest transparent one: the
  // dark band lies along the inner (face-side) edge of the layer
  const dist = new Uint8Array(W * H).fill(255); let front = [];
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] < 60) { dist[i] = 0; front.push(i); }
  for (let r = 1; r <= 48 && front.length; r++) { const next = []; for (const i of front) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && dist[j] === 255) { dist[j] = r; next.push(j); } } front = next; }
  const out = Buffer.from(data); let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = data[i * 4 + 3] / 255;
    if (a < 0.04) continue;
    // beside the cheek and the jaw only (art A y 300 .. 410, fading out by 430): the strands over the neck
    // below the jaw keep their dark translucent colour from art A, so at rest the neck recomposes art A and when
    // the hair moves against the neck (the body turned at a side of the page) they read as strands, not as a pale smear
    const ay = m.y + y, dark = 1 - smooth((lum(i) - 70) / 50), below = smooth((ay - 300) / 40) * (1 - smooth((ay - 410) / 20)), edge = 1 - smooth((dist[i] - 28) / 20);
    const k = dark * below * edge;
    if (k < 0.02 || bl[i * 4 + 3] < 12) continue; // (sharp gives the blurred colour back un-premultiplied)
    for (let c = 0; c < 3; c++) { const litC = bl[i * 4 + c]; out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(data[i * 4 + c] + (litC - data[i * 4 + c]) * 0.75 * k))); }
    // and the hair there is made more opaque (it was half-transparent navy over the skin: a lit strand, not a shadow)
    // (faint pixels at the layer's ragged edge stay faint, so no blue specks appear on the skin)
    out[i * 4 + 3] = Math.round(255 * (a + (0.9 - a) * 0.8 * k * smooth((a - 0.25) / 0.35)));
    n++;
  }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
  done[name] = { before: s0, after: sha(file), pixels: n };
  console.log('lightened', name, n, 'px');
}
fs.writeFileSync(log, JSON.stringify(done, null, 1));
