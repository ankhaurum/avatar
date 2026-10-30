// Import ChatGPT's independent lips (Hibiki_V3_lip_upper_1130x590.png and
// Hibiki_V3_lip_lower_1130x590.png: one canvas, 10 x the mouth region of art A
// at x 471-584, y 323-382; clean edges, the two meet exactly on their seam)
// in place of the lips cut from art A. As drawn they are 13 % wider than art
// A's mouth, their corner line is 2 deg flatter and the lower lip reaches a
// little further down. Here they are fitted to art A's mouth: scaled along the
// corner line so the corners sit on art A's corners (the thickness is kept),
// rotated to art A's corner line, and placed so the seam lies on art A's mouth
// line (within 0.3 px at the centre). The smile's corner lift stays a mesh
// deformation in the rig. Stored at 2 texture px per art A px (parts/lip_upper.png,
// lip_lower.png, one canvas); the sources' SHA-256, the transform, the corners,
// the seam and the outer contours (per column of art A) go to parts/lips-import.json.
// The source files are not changed. Usage: node import-lips.mjs <upper png> <lower png>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [upperSrc, lowerSrc] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const parts = path.resolve(here, '../parts'), metaFile = path.join(parts, 'meta.json');
const meta = JSON.parse(fs.readFileSync(metaFile));
const def = JSON.parse(fs.readFileSync(path.join(here, 'face-def.json')));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const SRC_ORIGIN = [471, 323], SRC_SCALE = 10; // source px -> art A px: art = origin + px / 10
const load = async f => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; };
const U = await load(upperSrc), L = await load(lowerSrc);
if (U.W !== L.W || U.H !== L.H) throw new Error('the two lips must share one canvas');
const W = U.W, H = U.H;
// corners of the material: the outermost opaque columns of the lower lip (the seam ends there), in art A px
const colSpan = (img, thr = 40) => { const top = {}, bot = {}; for (let y = 0; y < img.H; y++) for (let x = 0; x < img.W; x++) if (img.data[(y * img.W + x) * 4 + 3] > thr) { if (top[x] === undefined) top[x] = y; bot[x] = y; } return { top, bot }; };
const sl = colSpan(L), su = colSpan(U);
const xs = Object.keys(sl.top).map(Number); const x0 = Math.min(...xs), x1 = Math.max(...xs);
const toArt = (x, y) => [SRC_ORIGIN[0] + x / SRC_SCALE, SRC_ORIGIN[1] + y / SRC_SCALE];
const mcL = toArt(x0, (sl.top[x0] + sl.bot[x0]) / 2), mcR = toArt(x1, (sl.top[x1] + sl.bot[x1]) / 2);
// art A's corners (the ends of the mouth line traced on art A)
const ml = def.mouthLine, aL = ml[0], aR = ml[ml.length - 1];
// similarity along the corner line: scale kx along it (width), 1 across it (thickness), rotate to art A's line, corners onto corners
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]);
const dm = sub(mcR, mcL), da = sub(aR, aL), kx = len(da) / len(dm);
const um = [dm[0] / len(dm), dm[1] / len(dm)], vm = [-um[1], um[0]], ua = [da[0] / len(da), da[1] / len(da)], va = [-ua[1], ua[0]];
const midM = mid(mcL, mcR), midA = mid(aL, aR);
const fwd = p => { const d = sub(p, midM), a = d[0] * um[0] + d[1] * um[1], b = d[0] * vm[0] + d[1] * vm[1]; return [midA[0] + a * kx * ua[0] + b * va[0], midA[1] + a * kx * ua[1] + b * va[1]]; };
const inv = q => { const d = sub(q, midA), a = (d[0] * ua[0] + d[1] * ua[1]) / kx, b = d[0] * va[0] + d[1] * va[1]; return [midM[0] + a * um[0] + b * vm[0], midM[1] + a * um[1] + b * vm[1]]; };
// output: 2 texture px per art A px over the mouth region
const TEX = 2, R = { x: 468, y: 320, w: 128, h: 64 }, OW = R.w * TEX, OH = R.h * TEX;
const sample = (img, x, y) => { // bilinear, premultiplied, source px
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, o = [0, 0, 0, 0];
  for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) { const xx = x0 + dx, yy = y0 + dy; if (xx < 0 || yy < 0 || xx >= img.W || yy >= img.H) continue; const i = (yy * img.W + xx) * 4, a = img.data[i + 3] / 255; for (let c = 0; c < 3; c++) o[c] += img.data[i + c] * a * w; o[3] += a * w; }
  return o;
};
const render = img => {
  const out = Buffer.alloc(OW * OH * 4);
  for (let j = 0; j < OH; j++) for (let i = 0; i < OW; i++) {
    const o = [0, 0, 0, 0];
    for (const [ox, oy] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { // 2x2 supersampling
      const q = [R.x + (i + 0.5 + ox) / TEX, R.y + (j + 0.5 + oy) / TEX], p = inv(q), s = sample(img, (p[0] - SRC_ORIGIN[0]) * SRC_SCALE - 0.5, (p[1] - SRC_ORIGIN[1]) * SRC_SCALE - 0.5);
      for (let c = 0; c < 4; c++) o[c] += s[c] / 4;
    }
    const k = (j * OW + i) * 4; if (o[3] < 0.002) continue;
    for (let c = 0; c < 3; c++) out[k + c] = Math.round(Math.min(255, o[c] / o[3])); out[k + 3] = Math.round(o[3] * 255);
  }
  return out;
};
const upOut = render(U), loOut = render(L);
await sharp(upOut, { raw: { width: OW, height: OH, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(parts, 'lip_upper.png'));
await sharp(loOut, { raw: { width: OW, height: OH, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(parts, 'lip_lower.png'));
meta.lip_upper = { x: R.x, y: R.y, w: R.w, h: R.h, texPerArt: TEX, imported: true }; meta.lip_lower = { ...meta.lip_upper };
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
// contours in art A px per column: top of the upper lip, seam (top of the lower lip), bottom of the lower lip
const top = [], seam = [], bottom = [];
for (let i = 0; i < OW; i += TEX) {
  let t = -1, sm = -1, bt = -1;
  for (let j = 0; j < OH; j++) { if (t < 0 && upOut[(j * OW + i) * 4 + 3] > 127) t = j; if (sm < 0 && loOut[(j * OW + i) * 4 + 3] > 127) sm = j; if (loOut[(j * OW + i) * 4 + 3] > 127) bt = j; }
  const x = R.x + (i + TEX / 2) / TEX; if (t >= 0) top.push([x, R.y + t / TEX]); if (sm >= 0) seam.push([x, R.y + sm / TEX]); if (bt >= 0) bottom.push([x, R.y + (bt + 1) / TEX]);
}
const cornersArt = [fwd(mcL), fwd(mcR)];
const seamC = seam.find(p => Math.abs(p[0] - 527.5) < 1), mlC = ml.find(p => Math.abs(p[0] - 528.9) < 1);
fs.writeFileSync(path.join(parts, 'lips-import.json'), JSON.stringify({ sources: { upper: { file: path.basename(upperSrc), sha256: sha(upperSrc) }, lower: { file: path.basename(lowerSrc), sha256: sha(lowerSrc) } }, sourceFrame: { origin: SRC_ORIGIN, scale: SRC_SCALE }, transform: { scaleAlong: kx, scaleAcross: 1, rotateDeg: (Math.atan2(ua[1], ua[0]) - Math.atan2(um[1], um[0])) * 180 / Math.PI, materialCorners: [mcL, mcR], artCorners: [aL, aR] }, region: R, texPerArt: TEX, corners: cornersArt, seam, top, bottom }, null, 1));
console.log('lips imported: scale along', kx.toFixed(3), 'rotate', ((Math.atan2(ua[1], ua[0]) - Math.atan2(um[1], um[0])) * 180 / Math.PI).toFixed(2), 'deg; corners', cornersArt.map(c => c.map(v => v.toFixed(1))), '; seam at centre', seamC && seamC[1].toFixed(1), 'art A line', mlC && mlC[1], '; thickness at centre', (bottom.find(p => Math.abs(p[0] - 527.5) < 1)[1] - top.find(p => Math.abs(p[0] - 527.5) < 1)[1]).toFixed(1));
