// Cut the lips again from approved art A, and lay clean skin under them.
// The first cut (extract-face.cjs) took the lips inside hand-drawn polygons
// with a 4 px soft edge: skin pixels inside that edge stayed in the lip
// layers (a pale fringe once the lips move), the upper lip came out as a thin
// band with a jagged top, and the skin under the lips kept a lip-shaped
// reddish stain. Here:
// 1. the lip is found by its colour (red against skin: r - g over 50 and not
//    bright), holes (highlights) closed, so the whole thickness of both lips
//    as drawn is taken, with a 1 px anti-aliased edge that does not reach the
//    skin (alpha 0 outside the lip);
// 2. the lip colour at the edge is the exact difference against the skin laid
//    under it, so at rest art A recomposes exactly and apart no skin fringe
//    moves with the lip;
// 3. the skin under the lips (head_skin, head_under) is filled from the
//    surrounding skin: either Photoshop's content-aware fill of the region
//    (--filled <png>: art A with the region filled, made by tools/fill-lips.jsx)
//    or, without it, a harmonic fill from the skin 4 px out (no reddish
//    boundary pixels), and the crease beyond each corner is filled too (a
//    small soft shadow part takes its place in the rig);
// 4. the two lips are split along art A's mouth line with a 1.2 px soft
//    overlap, and their outer contours (per column) are written to
//    parts/lips-recut.json with the source's SHA-256, for the rig.
// Usage: node recut-lips.mjs [--filled <png>]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const parts = path.resolve(here, '../parts'), metaFile = path.join(parts, 'meta.json');
const artA = path.resolve(here, '../../v3/artwork/hibiki-static-a.png');
const filledArg = process.argv.indexOf('--filled'), filledFile = filledArg > 0 ? process.argv[filledArg + 1] : null;
const def = JSON.parse(fs.readFileSync(path.join(here, 'face-def.json')));
const meta = JSON.parse(fs.readFileSync(metaFile));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const ml = def.mouthLine;
const lineY = x => { for (let j = 0; j < ml.length - 1; j++) if (x >= ml[j][0] && x <= ml[j + 1][0]) return ml[j][1] + (ml[j + 1][1] - ml[j][1]) * (x - ml[j][0]) / (ml[j + 1][0] - ml[j][0]); return x < ml[0][0] ? ml[0][1] : ml[ml.length - 1][1]; };
const cornerL = ml[0], cornerR = ml[ml.length - 1];

// region of art A (px)
const R = { x: 470, y: 322, w: 124, h: 58 };
const { data: A, info } = await sharp(artA).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const AW = info.width;
const px = (x, y) => { const i = (y * AW + x) * 3; return [A[i], A[i + 1], A[i + 2]]; };
const W = R.w, H = R.h, N = W * H;
// 1. lip-ness
const lip = new Float32Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = px(R.x + x, R.y + y), lum = (r + g + b) / 3; lip[y * W + x] = smooth((r - g - 48) / 16) * smooth((228 - lum) / 14); }
// binary, closed (radius 2), holes filled, then one soft pixel at the edge
const bin = new Uint8Array(N); for (let i = 0; i < N; i++) bin[i] = lip[i] > 0.5 ? 1 : 0;
const dil = (m, r) => { const o = new Uint8Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let dy = -r; dy <= r && !v; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && dx * dx + dy * dy <= r * r && m[yy * W + xx]) { v = 1; break; } } o[y * W + x] = v; } return o; };
const ero = (m, r) => { const inv = new Uint8Array(N); for (let i = 0; i < N; i++) inv[i] = 1 - m[i]; const d = dil(inv, r); for (let i = 0; i < N; i++) inv[i] = 1 - d[i]; return inv; };
let mask = ero(dil(bin, 2), 2);
// holes: flood the outside, everything not reached is lip
{ const out = new Uint8Array(N), q = []; for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (!mask[i]) { out[i] = 1; q.push(i); } } for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (!mask[i] && !out[i]) { out[i] = 1; q.push(i); } }
  while (q.length) { const i = q.pop(), x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && !mask[j] && !out[j]) { out[j] = 1; q.push(j); } }
  for (let i = 0; i < N; i++) if (!out[i]) mask[i] = 1; }
// the dark crease within 7 px of each corner is not lip either (a small soft shadow part takes its place)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!mask[i]) continue; const ax = R.x + x + 0.5, [r, g, b] = px(R.x + x, R.y + y); if ((ax < cornerL[0] + 7 || ax > cornerR[0] - 7) && (r + g + b) / 3 < 150) mask[i] = 0; }
// nothing beyond the corners (the crease there is skin, filled below)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ax = R.x + x + 0.5; if (ax < cornerL[0] + 0.5 || ax > cornerR[0] - 0.5) mask[y * W + x] = 0; }
// keep only the biggest piece (the lips), not specks
{ const lab = new Int32Array(N).fill(-1), sizes = []; let n = 0; for (let s = 0; s < N; s++) { if (!mask[s] || lab[s] >= 0) continue; const q = [s]; lab[s] = n; let size = 0; while (q.length) { const i = q.pop(); size++; const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && mask[j] && lab[j] < 0) { lab[j] = n; q.push(j); } } sizes.push(size); n++; }
  const big = sizes.indexOf(Math.max(...sizes)); for (let i = 0; i < N; i++) mask[i] = lab[i] === big ? 1 : 0; }
// soft edge: alpha = 1 inside, falling over one pixel at the boundary (never beyond the lip)
const alpha = new Float32Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!mask[i]) continue; let edge = 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j < 0 || j >= N || !mask[j]) edge++; alpha[i] = edge ? 0.55 + 0.1 * lip[i] : 1; }
// 3. the skin under the lips
const hole = dil(mask, 4);
// the crease beyond the corners (dark pixels along the mouth line, up to 9 px out) goes too
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ax = R.x + x + 0.5, ay = R.y + y + 0.5; if (ax > cornerL[0] - 9 && ax < cornerR[0] + 9 && (ax < cornerL[0] + 2 || ax > cornerR[0] - 2) && Math.abs(ay - lineY(ax)) < 3.5) { const [r, g, b] = px(R.x + x, R.y + y); if ((r + g + b) / 3 < 200 || r - g > 48) hole[y * W + x] = 1; } }
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (mask[i] || !bin[i]) continue; const ax = R.x + x + 0.5; if (ax < cornerL[0] + 7 || ax > cornerR[0] - 7) hole[i] = 1; }
const F = new Float32Array(N * 3);
if (filledFile) {
  const { data: Fd, info: fi } = await sharp(filledFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (fi.width !== AW) throw new Error('filled image must be art A sized');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = ((R.y + y) * fi.width + R.x + x) * 3, k = (y * W + x) * 3; for (let c = 0; c < 3; c++) F[k + c] = hole[y * W + x] ? Fd[i + c] : px(R.x + x, R.y + y)[c]; }
} else {
  // harmonic fill: boundary = skin outside the hole that is not reddish
  const known = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, [r, g, b] = px(R.x + x, R.y + y); known[i] = !hole[i] && r - g < 50 ? 1 : 0; if (!hole[i] && !known[i]) hole[i] = 1; for (let c = 0; c < 3; c++) F[i * 3 + c] = [r, g, b][c]; }
  let m = [0, 0, 0], n = 0; for (let i = 0; i < N; i++) if (known[i]) { for (let c = 0; c < 3; c++) m[c] += F[i * 3 + c]; n++; }
  for (let i = 0; i < N; i++) if (!known[i]) for (let c = 0; c < 3; c++) F[i * 3 + c] = m[c] / n;
  for (let it = 0; it < 4000; it++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (known[i]) continue; for (let c = 0; c < 3; c++) F[i * 3 + c] = (F[(i - 1) * 3 + c] + F[(i + 1) * 3 + c] + F[(i - W) * 3 + c] + F[(i + W) * 3 + c]) / 4; }
}
// 2. lip colour: exact difference against the filled skin
const lipRGBA = new Float32Array(N * 4);
for (let i = 0; i < N; i++) { const a = alpha[i]; if (!a) continue; const x = i % W, y = (i - x) / W, p = px(R.x + x, R.y + y); for (let c = 0; c < 3; c++) lipRGBA[i * 4 + c] = Math.max(0, Math.min(255, (p[c] - (1 - a) * F[i * 3 + c]) / a)); lipRGBA[i * 4 + 3] = a; }
// 4. split along the mouth line with a soft 1.2 px overlap; outer contours per column
const up = Buffer.alloc(N * 4), lo = Buffer.alloc(N * 4), top = {}, bottom = {};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x, a = lipRGBA[i * 4 + 3]; if (!a) continue;
  const ax = R.x + x + 0.5, ay = R.y + y + 0.5, d = lineY(ax) - ay; // > 0 above the line
  // the dark crease pixels on and just above the line (lum < 160) belong to the lower lip only, so the upper lip's inner edge is lip colour when the mouth opens
  const lum = (lipRGBA[i * 4] + lipRGBA[i * 4 + 1] + lipRGBA[i * 4 + 2]) / 3;
  const wu = smooth((d - 0.3) / 1.7) * (d < 3.5 ? smooth((lum - 125) / 35) : 1), wl = d <= 2.0 ? 1 : 1 - smooth((d - 2.0) / 0.8) * (lum < 160 ? 0.5 : 1);
  for (let c = 0; c < 3; c++) { up[i * 4 + c] = Math.round(lipRGBA[i * 4 + c]); lo[i * 4 + c] = Math.round(lipRGBA[i * 4 + c]); }
  up[i * 4 + 3] = Math.round(255 * a * wu); lo[i * 4 + 3] = Math.round(255 * a * wl);
  if (mask[i]) { const X = R.x + x; if (top[X] === undefined || y < top[X]) top[X] = y; if (bottom[X] === undefined || y > bottom[X]) bottom[X] = y; }
}
await sharp(up, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(parts, 'lip_upper.png'));
await sharp(lo, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(parts, 'lip_lower.png'));
meta.lip_upper = { x: R.x, y: R.y, w: W, h: H, recut: true }; meta.lip_lower = { x: R.x, y: R.y, w: W, h: H, recut: true };
// the skin layers: the filled region replaces the pixels under the hole (opaque there already)
for (const n of ['head_skin', 'head_under']) {
  const m = meta[n], { data, info: si } = await sharp(path.join(parts, n + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!hole[y * W + x]) continue; const X = R.x + x - m.x, Y = R.y + y - m.y; if (X < 0 || Y < 0 || X >= si.width || Y >= si.height) continue; const i = (Y * si.width + X) * 4; if (data[i + 3] < 8) continue; for (let c = 0; c < 3; c++) data[i + c] = Math.round(F[(y * W + x) * 3 + c]); }
  await sharp(data, { raw: { width: si.width, height: si.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(parts, n + '.png'));
}
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
const cols = Object.keys(top).map(Number).sort((a, b) => a - b);
const topLine = cols.map(X => [X + 0.5, R.y + top[X]]), bottomLine = cols.map(X => [X + 0.5, R.y + bottom[X] + 1]);
fs.writeFileSync(path.join(parts, 'lips-recut.json'), JSON.stringify({ source: 'v3/artwork/hibiki-static-a.png', sha256: sha(artA), fill: filledFile ? 'photoshop content-aware (' + path.basename(filledFile) + ')' : 'harmonic', region: R, lipness: 'smooth((r-g-48)/16) * smooth((228-lum)/14), closed r2, holes filled', corners: [cornerL, cornerR], top: topLine, bottom: bottomLine }, null, 1));
console.log('lips recut: columns', cols[0], '-', cols[cols.length - 1], 'thickness at centre', bottom[527] - top[527] + 1, 'px; fill', filledFile ? 'photoshop' : 'harmonic');
