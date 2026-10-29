// Cut the arm sets out of the pose images along the arms' own contours.
// The outline of each layer in pose-def.json is a list of anchor points placed
// near the contour. Between anchors the outline is densified, every new point
// snaps across the segment to the strongest colour edge nearby, and the points
// are joined by the cheapest path over the edge map (a livewire / magnetic
// lasso). A point written [x, y, 0] keeps its segment to the next point
// straight (seams hidden under other parts). The filled outline, anti-aliased,
// becomes the alpha of <name>_<layer>_cut.png, which prepare-pose-arms.mjs then
// registers to R3.
// Usage: node cut-pose-arms.mjs <pose image dir> <out dir>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [poseDir, outDir] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const defs = JSON.parse(fs.readFileSync(path.join(here, 'pose-def.json')));
fs.mkdirSync(outDir, { recursive: true });

// colour edge strength: the largest Sobel response over R, G and B
function edgeMap(img, W, H) {
  const G = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    let best = 0;
    for (let c = 0; c < 3; c++) {
      const p = (dx, dy) => img[((y + dy) * W + x + dx) * 3 + c];
      const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
      const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
      best = Math.max(best, Math.hypot(gx, gy));
    }
    G[y * W + x] = best / 8;
  }
  return G;
}
// cheapest 8-connected path from a to b inside their bounding box (padded)
function livewire(G, W, H, a, b, pad = 5) {
  const x0 = Math.max(1, Math.floor(Math.min(a[0], b[0])) - pad), y0 = Math.max(1, Math.floor(Math.min(a[1], b[1])) - pad);
  const x1 = Math.min(W - 2, Math.ceil(Math.max(a[0], b[0])) + pad), y1 = Math.min(H - 2, Math.ceil(Math.max(a[1], b[1])) + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, dist = new Float32Array(w * h).fill(Infinity), prev = new Int32Array(w * h).fill(-1), done = new Uint8Array(w * h);
  const s = (Math.round(a[1]) - y0) * w + Math.round(a[0]) - x0, t = (Math.round(b[1]) - y0) * w + Math.round(b[0]) - x0;
  const cost = j => { const g = G[(y0 + Math.floor(j / w)) * W + x0 + j % w]; return 1 / (1 + g / 6) + 0.04; };
  dist[s] = 0; const heap = [[0, s]];
  const push = (d, j) => { heap.push([d, j]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, i] = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break;
    const x = i % w, y = Math.floor(i / w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx, nd = d + cost(j) * (dx && dy ? 1.414 : 1);
      if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); }
    }
  }
  const out = []; for (let i = t; i !== -1 && i !== s; i = prev[i]) out.push([x0 + i % w + 0.5, y0 + Math.floor(i / w) + 0.5]);
  return out.reverse();
}
function refine(G, W, H, anchors) {
  const pts = [];
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k], b = anchors[(k + 1) % anchors.length];
    pts.push([a[0], a[1]]);
    if (a[2] === 0) { const L = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 1; i < L; i++) pts.push([a[0] + (b[0] - a[0]) * i / L, a[1] + (b[1] - a[1]) * i / L]); continue; } // straight seam
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 10), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    let from = [a[0], a[1]];
    for (let i = 1; i <= n; i++) {
      let p = [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n];
      if (i < n) { // snap across the segment to the strongest edge within 5 px
        let best = -1, bp = p;
        for (let d = -5; d <= 5; d += 0.5) { const x = Math.round(p[0] + nx * d), y = Math.round(p[1] + ny * d), g = G[y * W + x] - Math.abs(d) * 1.5; if (g > best) { best = g; bp = [x + 0.5, y + 0.5]; } }
        p = bp;
      }
      pts.push(...livewire(G, W, H, from, p));
      from = p;
    }
  }
  return pts;
}

for (const [name, d] of Object.entries(defs)) {
  const file = path.join(poseDir, d.file);
  const { data: img, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const blurred = await sharp(img, { raw: { width: W, height: H, channels: 3 } }).blur(0.7).raw().toBuffer();
  const G = edgeMap(blurred, W, H);
  for (const layer of ['upper', 'lower']) {
    // the pixel path is smoothed (moving average over 5 points) so the edge has no stair steps
    const shapes = d[layer].map(poly => { const p = refine(G, W, H, poly), n = p.length; return p.map((_, i) => { let x = 0, y = 0; for (let k = -2; k <= 2; k++) { const q = p[(i + k + n) % n]; x += q[0]; y += q[1]; } return [x / 5, y / 5]; }); });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${shapes.map(s => `<polygon points="${s.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ')}" fill="#fff"/>`).join('')}</svg>`;
    // soft edge about 1.5 px wide, set about 0.7 px inside the outline so no colour from beyond it bleeds in
    const { data: mask } = await sharp(Buffer.from(svg)).blur(0.9).greyscale().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) out[i * 4 + c] = img[i * 3 + c]; out[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (mask[i] / 255 - 0.4) / 0.55))); }
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(outDir, `${name}_${layer}_cut.png`));
  }
  console.log('cut', name);
}
