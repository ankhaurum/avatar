// Rebuild the whites of the eyes as one seamless surface. The parts cut by
// extract-face.cjs kept art A's visible white and filled the place of the
// iris by interpolation, which came out lighter and left its outline on the
// white when the iris moved. Here the whole white gets one smooth shading,
// with colours sampled from art A's visible white: the clear white in the
// middle, a slightly reddish tone toward the inner and outer corners, and the
// shadow of the upper lid along the top. The part's outline (alpha) is kept.
// Usage: node remake-white.mjs   (rewrites hv3/parts/eye_white_L.png, eye_white_R.png)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const parts = path.resolve(here, '../parts'), art = path.resolve(here, '../../v3/artwork/hibiki-static-a.png');
const meta = JSON.parse(fs.readFileSync(path.join(parts, 'meta.json'))), def = JSON.parse(fs.readFileSync(path.join(here, 'face-def.json')));
const { data: A, info: ai } = await sharp(art).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const mean = list => { const m = [0, 0, 0]; for (const c of list) for (let k = 0; k < 3; k++) m[k] += c[k] / list.length; return m; };
for (const side of ['L', 'R']) {
  const name = 'eye_white_' + side, m = meta[name], e = def['eye' + side], [cx, cy, r] = e.iris;
  const { data } = await sharp(path.join(parts, name + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const xs = e.open.map(p => p[0]), ex0 = Math.min(...xs), ex1 = Math.max(...xs);
  // visible white of art A: inside the part, away from the iris, opaque
  const vis = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = (y * m.w + x) * 4, ax = m.x + x + 0.5, ay = m.y + y + 0.5;
    if (data[i + 3] < 250 || Math.hypot(ax - cx, ay - cy) < r + 2) continue;
    const j = ((m.y + y) * ai.width + m.x + x) * 4; vis.push({ ax, ay, c: [A[j], A[j + 1], A[j + 2]] });
  }
  const lum = c => (c[0] + c[1] + c[2]) / 3, sorted = [...vis].sort((a, b) => lum(b.c) - lum(a.c));
  const white = mean(sorted.slice(0, Math.max(1, Math.round(sorted.length * 0.4))).map(v => v.c));
  const near = (x0, x1) => mean(vis.filter(v => v.ax >= x0 && v.ax <= x1).map(v => v.c));
  const cornerL = near(ex0, ex0 + 4), cornerR = near(ex1 - 4, ex1);
  // the opening's top and bottom along x (from the part's alpha)
  const top = new Float32Array(m.w).fill(NaN), bot = new Float32Array(m.w).fill(NaN);
  for (let x = 0; x < m.w; x++) for (let y = 0; y < m.h; y++) if (data[(y * m.w + x) * 4 + 3] > 128) { if (isNaN(top[x])) top[x] = y; bot[x] = y + 1; }
  const out = Buffer.from(data), wC = (ex1 - ex0) * 0.32;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = (y * m.w + x) * 4; if (!data[i + 3]) continue;
    const ax = m.x + x + 0.5, kl = 1 - smooth((ax - ex0) / wC), kr = 1 - smooth((ex1 - ax) / wC);
    let c = white.map((v, k) => v + (cornerL[k] - v) * kl * 0.85 + (cornerR[k] - v) * kr * 0.85);
    // lid shadow: darker along the top third of the opening
    const t = isNaN(top[x]) ? 1 : (y + 0.5 - top[x]) / Math.max(1, bot[x] - top[x]);
    const shade = 1 - 0.16 * (1 - smooth(t / 0.45));
    c = c.map(v => Math.round(Math.min(255, v * shade)));
    for (let k = 0; k < 3; k++) out[i + k] = c[k];
  }
  await sharp(out, { raw: { width: m.w, height: m.h, channels: 4 } }).png().toFile(path.join(parts, name + '.png'));
  console.log(name, 'white', white.map(Math.round), 'corners', cornerL.map(Math.round), cornerR.map(Math.round));
}
