// Turn the Photoshop cuts of the pose images into rig textures:
// 1. remove the flat studio background that remains along the outer edge,
// 2. map the cut from pose-image px into rig units with the similarity that
//    matches the pose torso landmarks to R3 (jewel, buttons, shoulder frills),
// 3. store at 2 texture px per unit in hv3/parts/pose with a manifest.
// Usage: node prepare-pose-arms.mjs <cut dir> <pose image dir>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [cutDir, poseDir] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const out = path.resolve(here, '../parts/pose');
fs.mkdirSync(out, { recursive: true });
const defs = JSON.parse(fs.readFileSync(path.join(here, 'pose-def.json')));
// R3 landmarks in rig units, read from the assembled R3 body
const R3 = { jewel: [512.9, 308.6], buttonL: [482, 481], buttonR: [545, 481], frillR: [358.6, 280], frillL: [657, 269] };

function similarity(from, to) {
  const n = from.length, mean = a => [a.reduce((s, p) => s + p[0], 0) / n, a.reduce((s, p) => s + p[1], 0) / n];
  const mp = mean(from), mq = mean(to);
  let a = 0, b = 0, d = 0;
  from.forEach((p, i) => { const px = p[0] - mp[0], py = p[1] - mp[1], qx = to[i][0] - mq[0], qy = to[i][1] - mq[1]; a += px * qx + py * qy; b += px * qy - py * qx; d += px * px + py * py; });
  a /= d; b /= d;
  return { a, b, tx: mq[0] - (a * mp[0] - b * mp[1]), ty: mq[1] - (b * mp[0] + a * mp[1]) };
}

const manifest = { units: '1024x1536 rig units', textureScale: 2, poses: {} };
for (const [name, d] of Object.entries(defs)) {
  const keys = Object.keys(d.landmarks).filter(k => R3[k]);
  const T = similarity(keys.map(k => d.landmarks[k]), keys.map(k => R3[k]));
  // background colour: mean of the image corners
  const { data: img, info } = await sharp(path.join(poseDir, d.file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let bg = [0, 0, 0], cnt = 0;
  for (const [cx, cy] of [[20, 20], [info.width - 60, 20], [20, info.height - 60], [info.width - 60, info.height - 60]])
    for (let y = cy; y < cy + 40; y++) for (let x = cx; x < cx + 40; x++) { const i = (y * info.width + x) * 3; for (let c = 0; c < 3; c++) bg[c] += img[i + c]; cnt++; }
  bg = bg.map(v => v / cnt);
  // background region: flood fill from the image border over near-grey pixels, then widen by 3 px;
  // only pixels there are un-mixed from the background (the white sleeves have grey shading too)
  const near = new Uint8Array(info.width * info.height), queue = [];
  const grey = i => Math.hypot(img[i * 3] - bg[0], img[i * 3 + 1] - bg[1], img[i * 3 + 2] - bg[2]) < 22;
  for (let x = 0; x < info.width; x++) for (const y of [0, info.height - 1]) { const i = y * info.width + x; if (grey(i)) { near[i] = 1; queue.push(i); } }
  for (let y = 0; y < info.height; y++) for (const x of [0, info.width - 1]) { const i = y * info.width + x; if (grey(i) && !near[i]) { near[i] = 1; queue.push(i); } }
  while (queue.length) { const i = queue.pop(), x = i % info.width; for (const j of [x > 0 ? i - 1 : -1, x < info.width - 1 ? i + 1 : -1, i - info.width, i + info.width]) if (j >= 0 && j < near.length && !near[j] && grey(j)) { near[j] = 1; queue.push(j); } }
  for (let r = 0; r < 3; r++) { const n2 = near.slice(); for (let i = 0; i < near.length; i++) if (!near[i]) { const x = i % info.width; if ((x > 0 && near[i - 1]) || (x < info.width - 1 && near[i + 1]) || near[i - info.width] || near[i + info.width]) n2[i] = 1; } near.set(n2); }
  manifest.poses[name] = { source: d.file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(poseDir, d.file))).digest('hex'), transform: T, layers: {} };
  for (const layer of ['upper', 'lower']) {
    const { data, info: ci } = await sharp(path.join(cutDir, `${name}_${layer}_cut.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = ci.width, H = ci.height, src = new Float32Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      let a = data[i * 4 + 3] / 255;
      if (!a) continue;
      const col = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
      const dist = Math.hypot(col[0] - bg[0], col[1] - bg[1], col[2] - bg[2]);
      // pixels close to the studio grey are (partly) background
      const k = near[i] ? Math.min(1, Math.max(0, (dist - 6) / 26)) : 1;
      if (k < 1) for (let c = 0; c < 3; c++) col[c] = k > 0.02 ? Math.min(255, Math.max(0, (col[c] - bg[c] * (1 - k)) / k)) : col[c];
      a *= k;
      for (let c = 0; c < 3; c++) src[i * 4 + c] = col[c] * a; // premultiplied
      src[i * 4 + 3] = a;
    }
    // bounds of the layer in rig units
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (src[(y * W + x) * 4 + 3] > 0.01) {
      for (const [px, py] of [[x, y], [x + 1, y + 1]]) { const ux = T.a * px - T.b * py + T.tx, uy = T.b * px + T.a * py + T.ty; x0 = Math.min(x0, ux); y0 = Math.min(y0, uy); x1 = Math.max(x1, ux); y1 = Math.max(y1, uy); }
    }
    x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 2; y1 = Math.ceil(y1) + 2;
    const s = 2, ow = (x1 - x0) * s, oh = (y1 - y0) * s, dst = Buffer.alloc(ow * oh * 4);
    const det = T.a * T.a + T.b * T.b;
    const at = (x, y, c) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : src[(y * W + x) * 4 + c];
    for (let v = 0; v < oh; v++) for (let u = 0; u < ow; u++) {
      const ux = x0 + (u + 0.5) / s - T.tx, uy = y0 + (v + 0.5) / s - T.ty;
      const px = (T.a * ux + T.b * uy) / det - 0.5, py = (-T.b * ux + T.a * uy) / det - 0.5;
      const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
      const o = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) o[c] = at(ix, iy, c) * (1 - fx) * (1 - fy) + at(ix + 1, iy, c) * fx * (1 - fy) + at(ix, iy + 1, c) * (1 - fx) * fy + at(ix + 1, iy + 1, c) * fx * fy;
      const k = (v * ow + u) * 4;
      if (o[3] > 0.002) { for (let c = 0; c < 3; c++) dst[k + c] = Math.round(Math.min(255, o[c] / o[3])); dst[k + 3] = Math.round(o[3] * 255); }
    }
    const file = `${name}_${layer}.png`;
    await sharp(dst, { raw: { width: ow, height: oh, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(out, file));
    manifest.poses[name].layers[layer] = { file: 'pose/' + file, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  console.log(name, 'scale', Math.hypot(T.a, T.b).toFixed(4), 'angle', (Math.atan2(T.b, T.a) * 180 / Math.PI).toFixed(2));
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
