// The neck skin (parts/neck_skin.png, cut from art A by extract-head.cjs) kept
// the thin shaded edges of art A's shirt collar on both sides of the neck
// (art A y 445-515): the shirt itself was filled with skin, but its edge
// shadow, a little darker than the skin, was not. The R3 collar sits lower, so
// on the rig that edge shows as a diagonal line across the neck, and when the
// body turns toward the middle of the page it slides against the collar. Here
// those thin dark lines below the jaw are filled from the skin around them
// (pixels more than 6 lum darker than a 6 px blur, dilated by 1 px, replaced by
// repeated neighbour averaging).
// 2. The skin filled in beside the neck under the side hair (extract-head.cjs
// gives it the mean colour of the visible neck) is lighter than skin in the
// shadow of hair, so when the hair moves against the neck (the body turned at
// a side of the page, a head turn, the hair's sway) it shows as pale patches.
// Here it is darkened where the side hair covers it at rest (the hair layers'
// alpha, blurred 6 px): up to 22 % under the hair, fading in over the edge of
// the cover, so it reads as the hair's shadow. Recorded in parts/neck-fix.json (idempotent).
// Usage: node fix-neck.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const parts = path.resolve(here, '../parts'), log = path.join(parts, 'neck-fix.json'), file = path.join(parts, 'neck_skin.png');
const metaAll = JSON.parse(fs.readFileSync(path.join(parts, 'meta.json'))), meta = metaAll.neck_skin;
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const done = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log)) : null;
const s0 = sha(file);
if (done && done.after === s0) { console.log('already fixed'); process.exit(0); }
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const L = Buffer.alloc(W * H); for (let i = 0; i < W * H; i++) L[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
const Lb = await sharp(L, { raw: { width: W, height: H, channels: 1 } }).blur(6).extractChannel(0).raw().toBuffer();
// the lines: below art A y 440 (under the jaw's own shading), opaque, thin and darker than their surroundings
const mask = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (data[i * 4 + 3] < 200 || meta.y + y < 440) continue; if (Lb[i] - L[i] > 6) mask[i] = 1; }
const dil = new Uint8Array(mask); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (mask[i]) for (const j of [i - 1, i + 1, i - W, i + W]) if (data[j * 4 + 3] >= 200) dil[j] = 1; }
const F = new Float32Array(W * H * 3); for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) F[i * 3 + c] = data[i * 4 + c];
const fill = []; for (let i = 0; i < W * H; i++) if (dil[i]) fill.push(i);
for (let it = 0; it < 400; it++) for (const i of fill) { const x = i % W; let t = [0, 0, 0], k = 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= W * H || data[j * 4 + 3] < 200) continue; for (let c = 0; c < 3; c++) t[c] += F[j * 3 + c]; k++; } if (k) for (let c = 0; c < 3; c++) F[i * 3 + c] = t[c] / k; }
// 2. the hair's cover over the neck part, in the neck part's own pixel grid
const cover = Buffer.alloc(W * H);
for (const name of ['hair_side_R', 'hair_side_L']) {
  const hm = metaAll[name], h = await sharp(path.join(parts, name + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < h.info.height; y++) for (let x = 0; x < h.info.width; x++) { const nx = hm.x + x - meta.x, ny = hm.y + y - meta.y; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const a = h.data[(y * h.info.width + x) * 4 + 3]; const i = ny * W + nx; if (a > cover[i]) cover[i] = a; }
}
const cb = await sharp(cover, { raw: { width: W, height: H, channels: 1 } }).blur(6).extractChannel(0).raw().toBuffer();
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
let shaded = 0;
const out = Buffer.from(data); for (const i of fill) for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(F[i * 3 + c]);
for (let i = 0; i < W * H; i++) { if (data[i * 4 + 3] < 8) continue; const k = 1 - 0.22 * smooth((cb[i] / 255 - 0.15) / 0.45); if (k > 0.999) continue; for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(out[i * 4 + c] * k); shaded++; }
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
fs.writeFileSync(log, JSON.stringify({ before: s0, after: sha(file), linePixels: fill.length, belowArtY: 440, shadedPixels: shaded, shadeMax: 0.22 }, null, 1));
console.log('neck collar lines filled:', fill.length, 'px; skin under the hair shaded:', shaded, 'px');
