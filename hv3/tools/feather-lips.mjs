// Soften the seam between the two lip parts. extract-face.cjs split art A's
// lips into an upper and a lower layer pixel row by pixel row along the
// sloping mouth line, so when the smile moves the lips apart the cut showed as
// stair steps. Here the lower lip (drawn first) is extended up to 3.5 px above the
// line with the upper lip's own pixels, and the upper lip fades out over the
// same band with smooth ramps; at rest the pair still recomposes to art A, and
// apart each inner edge is a soft curve instead of a pixel staircase.
// Usage: node feather-lips.mjs   (rewrites hv3/parts/lip_upper.png, lip_lower.png, meta.json once)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const parts = path.resolve(here, '../parts'), metaFile = path.join(parts, 'meta.json');
const meta = JSON.parse(fs.readFileSync(metaFile)), def = JSON.parse(fs.readFileSync(path.join(here, 'face-def.json')));
if (meta.lip_upper.feathered) { console.log('already feathered'); process.exit(0); }
const ml = def.mouthLine;
const lineY = x => { for (let j = 0; j < ml.length - 1; j++) if (x >= ml[j][0] && x <= ml[j + 1][0]) return ml[j][1] + (ml[j + 1][1] - ml[j][1]) * (x - ml[j][0]) / (ml[j + 1][0] - ml[j][0]); return x < ml[0][0] ? ml[0][1] : ml.at(-1)[1]; };
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const load = async n => { const m = meta[n], { data } = await sharp(path.join(parts, n + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { m, data }; };
const U = await load('lip_upper'), L = await load('lip_lower');
// common canvas in art A px
const x0 = Math.min(U.m.x, L.m.x), y0 = Math.min(U.m.y, L.m.y), x1 = Math.max(U.m.x + U.m.w, L.m.x + L.m.w), y1 = Math.max(U.m.y + U.m.h, L.m.y + L.m.h), W = x1 - x0, H = y1 - y0;
const place = P => { const o = Buffer.alloc(W * H * 4); for (let y = 0; y < P.m.h; y++) P.data.copy(o, ((y + P.m.y - y0) * W + P.m.x - x0) * 4, y * P.m.w * 4, (y + 1) * P.m.w * 4); return o; };
const up = place(U), lo = place(L);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ax = x + x0 + 0.5, ay = y + y0 + 0.5, d = lineY(ax) + 0.8 - ay; // > 0 above the split line
  if (d < 0 || d > 3.5) continue;
  const i = (y * W + x) * 4;
  // lower lip: fill in under the upper lip's pixels within the band
  // (its own top edge fades out too, so apart it is a soft curve as well)
  if (up[i + 3] && lo[i + 3] < up[i + 3]) { for (let c = 0; c < 3; c++) lo[i + c] = up[i + c]; lo[i + 3] = Math.round(up[i + 3] * (1 - smooth((d - 2) / 1.5))); }
  // upper lip: fades in over the band
  up[i + 3] = Math.round(up[i + 3] * smooth(d / 3.5));
}
for (const [n, buf] of [['lip_upper', up], ['lip_lower', lo]]) {
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(parts, n + '.png'));
  meta[n] = { x: x0, y: y0, w: W, h: H, feathered: true };
}
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
console.log('lips feathered', W, 'x', H);
