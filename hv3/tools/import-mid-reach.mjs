// Import ChatGPT's in-between right arm for the "reach" pose (R3 coordinates,
// 4096x6144, transparent background, shoulder laid on arm_R_upper's socket).
// As drawn, the hand reaches in to the middle of the body, the puff sleeve and
// arm are a size smaller than R3's, and a navy shoulder strap with a bit of
// bare shoulder (not in R3's costume) is drawn at the top. Here:
// 1. the strap and the bare shoulder are cut away (the R3 shoulder frill
//    covers the top of the puff anyway);
// 2. the arm is scaled up about the shoulder socket to R3's sleeve width and
//    turned outward about the socket, so the hand lies on the path between
//    the resting hand and the drawn reach (no zigzag in and out);
// 3. it is split at the elbow into an upper layer (shoulder, puff sleeve,
//    band and flounce, under the shoulder frill) and a lower layer (forearm
//    sleeve, cuff, hand, in front of the body), stored at 2 texture px per unit
//    in hv3/parts/pose with the transform and the source SHA-256 in the manifest.
// Usage: node import-mid-reach.mjs <source png>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [src] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const out = path.resolve(here, '../parts/pose'), mf = path.join(out, 'manifest.json');
const S = [382, 318];                 // arm_R_upper socket (rig units)
export const SCALE = 1.06, ROT = 30;  // as seen beside the everyday arm (the puff looked a size large at 1.18); outward, clockwise on screen
// drawn joints (rig units, before the transform): elbow, wrist, middle fingertip
export const DRAWN = { E: [418, 445], W: [482, 545], T: [520, 612] };
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
// the strap: a navy band along the top-left edge of the puff; the bare shoulder: skin at the top-left
const STRAP = [[340, 286], [396, 286], [396, 303], [381, 305], [367, 313], [357, 325], [348, 336], [338, 336]];
const SKIN_BOX = [344, 288, 361, 334]; // above the bow (its jewel and gold trim are warm too)

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const px = (x, y, c) => { x = Math.min(W - 1, Math.max(0, x)); y = Math.min(H - 1, Math.max(0, y)); return data[(y * W + x) * 4 + c]; };
const sample = (x, y) => { // bilinear, premultiplied
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, o = [0, 0, 0, 0];
  for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const a = px(x0 + dx, y0 + dy, 3) / 255; for (let c = 0; c < 3; c++) o[c] += px(x0 + dx, y0 + dy, c) * a * w; o[3] += a * w;
  }
  return o;
};
const th = ROT * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
export const fwd = ([x, y]) => { const dx = (x - S[0]) * SCALE, dy = (y - S[1]) * SCALE; return [S[0] + dx * cs - dy * sn, S[1] + dx * sn + dy * cs]; };
// the last of the strap lies along the puff's top-left edge: that strip is cut
// off along a straight line (placed coordinates, above the sleeve bow)
const TOP_CUT = [[330, 290], [376, 290], [376, 300], [360, 302], [350, 305], [343, 308], [330, 308]];
const keep = (rx, ry) => { // source rig coords: drop the strap (navy) and the bare shoulder (skin)
  const i = (Math.round(ry * 4) * W + Math.round(rx * 4)) * 4, r = data[i], g = data[i + 1], b = data[i + 2], lum = (r + g + b) / 3;
  const navy = lum < 125 && b >= r - 5, skin = r - b > 25 && lum > 120 && r > 150 && r - g < 70;
  if (navy && inPoly([rx, ry], STRAP)) return 0;
  if (skin && rx > SKIN_BOX[0] && rx < SKIN_BOX[2] && ry > SKIN_BOX[1] && ry < SKIN_BOX[3]) return 0;
  if (inPoly(fwd([rx, ry]), TOP_CUT)) return 0;
  return 1;
};
const inv = ([X, Y]) => { const dx = X - S[0], dy = Y - S[1]; return [S[0] + (dx * cs + dy * sn) / SCALE, S[1] + (-dx * sn + dy * cs) / SCALE]; };
// transformed joints and the elbow cut (perpendicular to the forearm, through the elbow, 18 units down it)
const J = { E: fwd(DRAWN.E), W: fwd(DRAWN.W), T: fwd(DRAWN.T) };
const fa = [J.W[0] - J.E[0], J.W[1] - J.E[1]], fl = Math.hypot(...fa), fu = [fa[0] / fl, fa[1] / fl];
const cutAt = (X, Y) => (X - J.E[0]) * fu[0] + (Y - J.E[1]) * fu[1]; // signed distance along the forearm from the elbow
// output region (rig units): the transformed bounding box of the drawn arm
const corners = [[300, 280], [560, 280], [560, 680], [300, 680]].map(fwd);
const X0 = Math.floor(Math.min(...corners.map(c => c[0]))) - 4, Y0 = Math.floor(Math.min(...corners.map(c => c[1]))) - 4;
const X1 = Math.ceil(Math.max(...corners.map(c => c[0]))) + 4, Y1 = Math.ceil(Math.max(...corners.map(c => c[1]))) + 4;
const TW = (X1 - X0) * 2, TH = (Y1 - Y0) * 2;
const layers = { upper: Buffer.alloc(TW * TH * 4), lower: Buffer.alloc(TW * TH * 4) };
for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
  const X = X0 + (i + 0.5) / 2, Y = Y0 + (j + 0.5) / 2;
  // 2x2 supersampling in source
  const o = [0, 0, 0, 0];
  for (const [ox, oy] of [[-0.125, -0.125], [0.125, -0.125], [-0.125, 0.125], [0.125, 0.125]]) {
    const p = inv([X + ox, Y + oy]); if (!keep(p[0], p[1])) continue;
    const s = sample(p[0] * 4 - 0.5, p[1] * 4 - 0.5); for (let c = 0; c < 4; c++) o[c] += s[c] / 4;
  }
  if (o[3] < 0.002) continue;
  const col = [o[0] / o[3], o[1] / o[3], o[2] / o[3]], lum = (col[0] + col[1] + col[2]) / 3, sat = Math.max(...col) - Math.min(...col);
  const d = cutAt(X, Y);
  // the flounce hangs 20 units below the elbow: white there stays with the
  // upper layer. The navy forearm goes to both layers over a band of 20 units
  // (the upper layer keeps it down to 34, the lower layer starts at 14 with a
  // soft edge), so when the two layers deform differently no gap opens at the
  // elbow: the lower layer is drawn over the upper one's navy
  const flounce = d < 40 && lum > 190 && sat < 40;
  const k = (j * TW + i) * 4;
  if (d < 34 || flounce) { const dst = layers.upper; for (let c = 0; c < 3; c++) dst[k + c] = Math.round(col[c]); dst[k + 3] = Math.round(o[3] * 255); }
  if (d >= 14 && !flounce) { const dst = layers.lower, soft = Math.min(1, (d - 14) / 6); for (let c = 0; c < 3; c++) dst[k + c] = Math.round(col[c]); dst[k + 3] = Math.round(o[3] * 255 * soft); }
}
fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(mf));
const mid = { source: path.basename(src), sha256: crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex'), transform: { pivot: S, scale: SCALE, rotateDeg: ROT }, cut: { strap: STRAP, shoulderSkinBox: SKIN_BOX }, joints: { drawn: DRAWN, placed: J }, layers: {} };
for (const [layer, buf] of Object.entries(layers)) {
  // trim to the opaque box
  let x0 = TW, y0 = TH, x1 = -1, y1 = -1;
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) if (buf[(j * TW + i) * 4 + 3] > 2) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(TW - 1, x1 + 2); y1 = Math.min(TH - 1, y1 + 2);
  const file = `reach_mid_${layer}.png`;
  await sharp(buf, { raw: { width: TW, height: TH, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png({ compressionLevel: 9 }).toFile(path.join(out, file));
  mid.layers[layer] = { file: 'pose/' + file, x: X0 + x0 / 2, y: Y0 + y0 / 2, w: (x1 - x0 + 1) / 2, h: (y1 - y0 + 1) / 2 };
}
manifest.poses.reach.mid = mid;
fs.writeFileSync(mf, JSON.stringify(manifest, null, 1));
console.log('placed joints', JSON.stringify(J), 'layers', JSON.stringify(mid.layers));
