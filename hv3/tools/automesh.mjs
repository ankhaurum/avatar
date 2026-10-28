// Automatic mesh from a part's alpha: trace the outline of the (slightly
// dilated) opaque region, simplify it, place interior points on a lattice whose
// spacing shrinks inside detail zones (eye rims, mouth corners, hair tips) and
// triangulate with the outline as constraint edges.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cdt2d = require('cdt2d');

function dilate(mask, w, h, r) {
  let cur = mask;
  for (let k = 0; k < r; k++) {
    const next = cur.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (cur[y * w + x]) continue;
      if ((x > 0 && cur[y * w + x - 1]) || (x < w - 1 && cur[y * w + x + 1]) || (y > 0 && cur[(y - 1) * w + x]) || (y < h - 1 && cur[(y + 1) * w + x])) next[y * w + x] = 1;
    }
    cur = next;
  }
  return cur;
}

// Boundary loops along pixel edges (opaque pixel on the right-hand side).
function traceLoops(mask, w, h) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  const edges = new Map();
  const add = (x0, y0, x1, y1) => {
    const k = x0 + ',' + y0;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push([x1, y1]);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    if (!at(x, y - 1)) add(x, y, x + 1, y);
    if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!at(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  while (edges.size) {
    const [startKey] = edges.keys();
    let [x, y] = startKey.split(',').map(Number);
    const loop = [];
    let prev = null;
    for (;;) {
      const k = x + ',' + y;
      const list = edges.get(k);
      if (!list) break;
      // at a diagonal pinch, prefer the right turn so loops stay simple
      let idx = 0;
      if (list.length > 1 && prev) {
        const dx = x - prev[0], dy = y - prev[1];
        idx = list.findIndex(([nx, ny]) => (nx - x) === -dy && (ny - y) === dx);
        if (idx < 0) idx = 0;
      }
      const [nx, ny] = list.splice(idx, 1)[0];
      if (!list.length) edges.delete(k);
      loop.push([x, y]);
      prev = [x, y];
      x = nx; y = ny;
      if (x + ',' + y === startKey && !edges.has(startKey)) break;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

function simplify(points, tolOf) {
  // Douglas-Peucker on a closed loop, split at the two farthest points.
  const n = points.length;
  if (n < 8) return points;
  let far = 0, best = -1;
  for (let i = 0; i < n; i++) { const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]); if (d > best) { best = d; far = i; } }
  const dp = (pts) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let idx = -1, dmax = 0;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L;
      if (d - tolOf(p) > dmax) { dmax = d - tolOf(p); idx = i; }
    }
    if (idx < 0) return [a, b];
    const left = dp(pts.slice(0, idx + 1)), right = dp(pts.slice(idx));
    return left.slice(0, -1).concat(right);
  };
  const first = dp(points.slice(0, far + 1)), second = dp(points.slice(far).concat([points[0]]));
  return first.slice(0, -1).concat(second.slice(0, -1));
}

function resample(loop, spacingOf) {
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const s = Math.min(spacingOf(a), spacingOf(b));
    const n = Math.max(1, Math.ceil(len / s));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}

function inside(loops, x, y) {
  let c = false;
  for (const l of loops) for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i], [xj, yj] = l[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function distToLoops(loops, x, y) {
  let best = Infinity;
  for (const l of loops) for (let i = 0; i < l.length; i++) {
    const a = l[i], b = l[(i + 1) % l.length];
    const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L));
    best = Math.min(best, Math.hypot(a[0] + vx * t - x, a[1] + vy * t - y));
  }
  return best;
}

/**
 * @param alpha Uint8Array (w*h) alpha channel of the part texture
 * @param opts {spacing, dilate, threshold, detail:[{x,y,r,spacing}] in texture px, extraPoints:[[x,y]]}
 * @returns {positions:number[], triangles:number[]} in texture pixels
 */
export function autoMesh(alpha, w, h, opts = {}) {
  const spacing = opts.spacing ?? 24, detail = opts.detail ?? [];
  const spacingOf = ([x, y]) => {
    let s = spacing;
    for (const d of detail) {
      const t = Math.hypot(x - d.x, y - d.y) / d.r;
      if (t < 1) s = Math.min(s, d.spacing + (spacing - d.spacing) * t * t);
    }
    return s;
  };
  let mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = alpha[i] > (opts.threshold ?? 4) ? 1 : 0;
  // pad by one pixel so the outline never touches the texture border
  mask = dilate(mask, w, h, opts.dilate ?? 2);
  let loops = traceLoops(mask, w, h)
    .map(l => simplify(l, p => Math.max(0.7, spacingOf(p) / 10)))
    .filter(l => { let a = 0; for (let i = 0; i < l.length; i++) { const p = l[i], q = l[(i + 1) % l.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2 > spacingOf(l[0]) * spacingOf(l[0]) * 0.15; })
    .map(l => resample(l, spacingOf));
  const points = [], edges = [];
  const ids = new Map();
  const idOf = p => { const k = p[0].toFixed(3) + ',' + p[1].toFixed(3); if (!ids.has(k)) { ids.set(k, points.length); points.push(p); } return ids.get(k); };
  for (const l of loops) {
    const idx = l.map(idOf);
    idx.forEach((v, i) => { const w = idx[(i + 1) % idx.length]; if (v !== w) edges.push([v, w]); });
  }
  const hash=new Map(),cell=4,key=(x,y)=>Math.floor(x/cell)+","+Math.floor(y/cell);
  const near=(x,y,r)=>{const n=Math.ceil(r/cell);const cx=Math.floor(x/cell),cy=Math.floor(y/cell);for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++)for(const p of hash.get((cx+i)+","+(cy+j))||[])if(Math.hypot(p[0]-x,p[1]-y)<r)return true;return false;};
  const remember=p=>{const k=key(p[0],p[1]);if(!hash.has(k))hash.set(k,[]);hash.get(k).push(p);};
  points.forEach(remember);
  // interior lattice: coarse everywhere, finer inside detail zones
  const lattice = (s, x0, y0, x1, y1, accept) => {
    const dy = s * Math.sqrt(3) / 2;
    for (let j = 0, y = y0; y <= y1; y += dy, j++) for (let x = x0 + (j % 2) * s / 2; x <= x1; x += s) {
      if (!accept(x, y)) continue;
      if (!inside(loops, x, y)) continue;
      if (distToLoops(loops, x, y) < spacingOf([x, y]) * 0.45) continue;
      if (near(x, y, spacingOf([x, y]) * 0.5)) continue;
      points.push([x, y]); remember([x, y]);
    }
  };
  lattice(spacing, spacing / 2, spacing / 2, w, h, (x, y) => spacingOf([x, y]) > spacing * 0.75);
  for (const d of detail) lattice(d.spacing, d.x - d.r, d.y - d.r, d.x + d.r, d.y + d.r, (x, y) => spacingOf([x, y]) <= spacing * 0.75 && Math.hypot(x - d.x, y - d.y) < d.r);
  for (const p of opts.extraPoints ?? []) if (inside(loops, p[0], p[1])) points.push(p);
  const tris = cdt2d(points, edges, { exterior: false });
  return { positions: points.flat(), triangles: tris.flat(), loops: loops.length };
}
