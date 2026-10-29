// Tighten the cut edges of the body, arm, hand and pose textures, pixel by pixel:
// 1. defringe: every pixel within the edge band (near a transparent pixel) takes
//    its colour from the opaque interior next to it, so the dark or grey rim left
//    by the cut (background mixed into the last pixel) disappears while the
//    shape stays;
// 2. the alpha is smoothed a little and pulled in by about a third of a pixel,
//    so a stair-stepped cut becomes one soft line without a halo;
// 3. hands: the pieces of sleeve and cuff drawn in the hand images (hidden under
//    the cuff at rest, but showing when the wrist turns) are taken out by colour
//    (white / navy cloth against skin), and loose crumbs away from the hand are
//    dropped.
// Art A face and hair parts and the oral parts are not touched. The work is
// recorded in parts/<dir>/clean.json (the SHA-256 of each cleaned file), so
// running the tool again skips files already cleaned; prepare-r3.mjs /
// prepare-pose-arms.mjs give back the originals.
// Usage: node clean-edges.mjs            (cleans parts/r3 and parts/pose)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const parts = path.resolve(here, '../parts');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// distance (px, up to R) from each pixel to the nearest pixel with alpha < 0.5
function edgeDistance(a, W, H, R) {
  const d = new Float32Array(W * H).fill(R + 1);
  const off = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const r = Math.hypot(dx, dy); if (r <= R) off.push([dx, dy, r]); }
  off.sort((p, q) => p[2] - q[2]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (a[i] < 0.5) { d[i] = 0; continue; }
    for (const [dx, dy, r] of off) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || a[ny * W + nx] < 0.5) { d[i] = r; break; } }
  }
  return d;
}
function blurAlpha(a, W, H, k) { // separable 3-tap [k, 1-2k, k]
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; t[i] = a[i] * (1 - 2 * k) + (x > 0 ? a[i - 1] : 0) * k + (x < W - 1 ? a[i + 1] : 0) * k; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; o[i] = t[i] * (1 - 2 * k) + (y > 0 ? t[i - W] : 0) * k + (y < H - 1 ? t[i + W] : 0) * k; }
  return o;
}
function components(mask, W, H) { // 4-connected labels of mask > 0
  const lab = new Int32Array(W * H).fill(-1), sizes = []; let n = 0;
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || lab[s] >= 0) continue;
    const q = [s]; lab[s] = n; let size = 0;
    while (q.length) { const i = q.pop(); size++; const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && mask[j] && lab[j] < 0) { lab[j] = n; q.push(j); } }
    sizes.push(size); n++;
  }
  return { lab, sizes };
}

export async function cleanEdges(file, { band = 1.6, interior = 2.4, shrink = 0.3, hand = false } = {}) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const a = new Float32Array(N), rgb = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { a[i] = data[i * 4 + 3] / 255; for (let c = 0; c < 3; c++) rgb[i * 3 + c] = data[i * 4 + c]; }
  if (hand) {
    // cloth against skin: pixels that are not warm (skin and nails have red well
    // over blue): white, grey-blue or navy. Only connected pieces of at least
    // 50 px that reach the outline are cloth (the cuff and the sleeve beside the
    // hand); small pale spots inside the hand (nails, highlights) stay.
    const cloth = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (a[i] < 0.5) continue;
      const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2], lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
      cloth[i] = (lum > 195 && sat < 32) || (r - b < 14 && lum > 100) || (b - r > 10 && lum < 140) ? 1 : 0;
    }
    // close one-pixel gaps, then keep only the big pieces that touch the outline
    const grow = m => { const o = m.slice(); for (let i = 0; i < N; i++) if (!m[i]) { const x = i % W; if ((x > 0 && m[i - 1]) || (x < W - 1 && m[i + 1]) || (i >= W && m[i - W]) || (i + W < N && m[i + W])) o[i] = 1; } return o; };
    const closed = grow(cloth); const er = closed.slice(); for (let i = 0; i < N; i++) if (closed[i]) { const x = i % W; if (!(x > 0 && closed[i - 1]) || !(x < W - 1 && closed[i + 1]) || !(i >= W && closed[i - W]) || !(i + W < N && closed[i + W])) er[i] = cloth[i]; }
    const { lab, sizes } = components(er, W, H);
    const touches = new Uint8Array(sizes.length);
    for (let i = 0; i < N; i++) if (lab[i] >= 0) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j < 0 || j >= N || a[j] < 0.5) { touches[lab[i]] = 1; break; } }
    const take = new Float32Array(N);
    for (let i = 0; i < N; i++) if (lab[i] >= 0 && sizes[lab[i]] >= 50 && touches[lab[i]]) take[i] = 1;
    // grow by one pixel (the anti-aliased rim is cloth-coloured too), soften, and take it out
    const grown = blurAlpha(grow(take), W, H, 0.25);
    for (let i = 0; i < N; i++) a[i] *= 1 - Math.min(1, grown[i] * 1.4);
    // loose crumbs: keep the main piece and anything at least 1.5 % of its size
    const mask = new Uint8Array(N); for (let i = 0; i < N; i++) mask[i] = a[i] > 0.1 ? 1 : 0;
    const cc = components(mask, W, H), big = Math.max(...cc.sizes);
    for (let i = 0; i < N; i++) if (cc.lab[i] >= 0 && cc.sizes[cc.lab[i]] < big * 0.015) a[i] = 0;
  }
  // 1. defringe
  const R = Math.ceil(interior) + 2, d = edgeDistance(a, W, H, R);
  const out = new Float32Array(rgb);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (a[i] < 0.02 || d[i] > band) continue;
    let sr = 0, sg = 0, sb = 0, sw = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (d[j] < interior || a[j] < 0.95) continue;
      const w = 1 / (dx * dx + dy * dy); sr += rgb[j * 3] * w; sg += rgb[j * 3 + 1] * w; sb += rgb[j * 3 + 2] * w; sw += w;
    }
    if (!sw) continue;
    // the last pixel takes the interior colour fully; a little inside it blends
    const k = Math.min(1, Math.max(0, 1 - (d[i] - 1) / Math.max(0.01, band - 1)));
    out[i * 3] += (sr / sw - rgb[i * 3]) * k; out[i * 3 + 1] += (sg / sw - rgb[i * 3 + 1]) * k; out[i * 3 + 2] += (sb / sw - rgb[i * 3 + 2]) * k;
  }
  // 2. alpha: smooth and pull in
  const ab = blurAlpha(a, W, H, 0.22);
  const buf = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const al = Math.min(1, Math.max(0, (ab[i] - shrink) / (1 - shrink)));
    for (let c = 0; c < 3; c++) buf[i * 4 + c] = Math.round(Math.min(255, Math.max(0, out[i * 3 + c])));
    buf[i * 4 + 3] = Math.round(al * 255);
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
}

const run = async (dir, pick, opts) => {
  const d = path.join(parts, dir), log = path.join(d, 'clean.json');
  const done = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log)) : {};
  for (const f of fs.readdirSync(d).filter(pick).sort()) {
    const file = path.join(d, f), s = sha(file);
    if (done[f] && done[f].cleaned === s) continue;
    await cleanEdges(file, { ...opts, ...(opts.per?.(f) || {}) });
    done[f] = { source: s, cleaned: sha(file) };
    console.log('cleaned', dir + '/' + f);
  }
  fs.writeFileSync(log, JSON.stringify(done, null, 1));
};
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  // R3: the drawn parts (the toned / mirrored hands are made from them by build-rig)
  await run('r3', f => /\.png$/.test(f) && !/_(tone|mirror)\.png$/.test(f) && !/^mouth_/.test(f), { band: 1.6, interior: 2.4, shrink: 0.3, per: f => /^hand_/.test(f) ? { hand: true } : null });
  // pose arms: the studio grey reaches about two pixels in
  await run('pose', f => /\.png$/.test(f), { band: 2.2, interior: 3, shrink: 0.3 });
}
