// Fixes the chest: 1. trims the chest charm (parts/r3/chest_charm.png, the pendant on the chest
// bow): R3's cut of it was a loose polygon that kept the white shirt around
// the chain and the pendant, and a corner of the navy bow at the pendant's
// lower left, so they swung with the charm (chest_charm_swing). Here the
// pixels reachable from the texture's border through shirt white (lum > 236,
// saturation < 18) or bow navy (blue over red by 20, lum < 110) are made
// transparent; the chain's silver links (lum 120-230 with a tint) and the
// pendant's own white inside its gold rim are not reached. The new edge is
// softened by 0.8 px. A second pass takes the shirt's shadowed white (lum >
// 212, saturation < 22) that touches the removed area, except within 2 px of
// the gold and the gems (the chain's links and their highlights). Recorded in parts/r3/trim.json (idempotent by SHA256).
// 2. fills the bodice (parts/r3/bodice.png) under the charm and between the
// bow's tails: R3 left there a flat beige column (the placket in shadow)
// and jagged fragments of the bow's tails, which showed as a grey block and
// blue shards beside the pendant whenever the charm or the tails swung. The
// strip under the charm (its rest box, 6 units wider, from 14 units below
// its top, under the bow's knot, to 10 units below its bottom) is filled:
// every pixel there that is not plain shirt white (the cream placket shadow,
// the bow's fragments) is replaced by repeated neighbour averaging seeded
// from the shirt pixels only, so the plain shirt continues behind the pendant. Both recorded in parts/r3/trim.json (idempotent by SHA256).
// Usage: node fix-chest.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const dir = path.resolve(here, '../parts/r3'), file = path.join(dir, 'chest_charm.png'), log = path.join(dir, 'trim.json');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const done = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log)) : {};
const s0 = sha(file);
if (done['chest_charm.png'] && done['chest_charm.png'].after === s0) console.log('chest charm already trimmed'); else {
const { data: d, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const removable = i => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3]; if (a < 8) return true; const l = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b); return (l > 236 && sat < 18) || (b > r + 20 && l < 110); };
const vis = new Uint8Array(W * H), stack = [];
for (let x = 0; x < W; x++) for (const i of [x, (H - 1) * W + x]) if (!vis[i] && removable(i)) { vis[i] = 1; stack.push(i); }
for (let y = 0; y < H; y++) for (const i of [y * W, y * W + W - 1]) if (!vis[i] && removable(i)) { vis[i] = 1; stack.push(i); }
while (stack.length) { const i = stack.pop(), x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (vis[j] || !removable(j)) continue; vis[j] = 1; stack.push(j); } }
// second pass: the shirt's shadowed white (lum > 212, saturation < 22) reachable from the removed area, except within 2 px of the gold and the gems (the chain's links and their highlights)
const metal = i => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3]; return a > 100 && ((r > b + 40 && r > 120) || (b > r + 30 && b > 150)); };
const near = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!metal(y * W + x)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1; } }
const removable2 = i => { if (near[i]) return false; const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], l = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b); return l > 212 && sat < 22; };
for (let i = 0; i < W * H; i++) if (vis[i]) stack.push(i);
while (stack.length) { const i = stack.pop(), x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (vis[j] || !removable2(j)) continue; vis[j] = 1; stack.push(j); } }
const out = Buffer.from(d); let removed = 0; for (let i = 0; i < W * H; i++) if (vis[i] && d[i * 4 + 3] > 0) { out[i * 4 + 3] = 0; removed++; }
// islands of fewer than 24 px left beside the chain (bits of shade and bow) are dropped
{ const seen = new Uint8Array(W * H); for (let i0 = 0; i0 < W * H; i0++) { if (seen[i0] || out[i0 * 4 + 3] < 8) continue; const comp = [i0]; seen[i0] = 1; for (let k = 0; k < comp.length; k++) { const i = comp[k], x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (!seen[j] && out[j * 4 + 3] >= 8) { seen[j] = 1; comp.push(j); } } } if (comp.length < 24) for (const i of comp) { out[i * 4 + 3] = 0; removed++; } } }
// the new edge as a soft matte: the kept pixels' mask, closed by 1 px (the chain's links join), blurred 1.2 px, limited by the original alpha; the chain's edge is then a smooth line rather than a pixel staircase
const keepM = Buffer.alloc(W * H); for (let i = 0; i < W * H; i++) keepM[i] = out[i * 4 + 3] >= 8 ? 255 : 0;
const grow = (src, r, isMax) => { const o = Buffer.alloc(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = isMax ? 0 : 255; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; const t = (xx < 0 || yy < 0 || xx >= W || yy >= H) ? 0 : src[yy * W + xx]; v = isMax ? Math.max(v, t) : Math.min(v, t); } o[y * W + x] = v; } return o; };
const closed = grow(grow(keepM, 1, true), 1, false);
const alB = await sharp(closed, { raw: { width: W, height: H, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer();
for (let i = 0; i < W * H; i++) out[i * 4 + 3] = Math.min(d[i * 4 + 3], alB[i]);
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
done['chest_charm.png'] = { before: s0, after: sha(file), removedPixels: removed, rule: 'border-connected shirt white (lum > 236, sat < 18) and bow navy (b > r + 20, lum < 110), then the shirt shade (lum > 212, sat < 22) touching it except within 2 px of gold and gems, made transparent; islands under 24 px dropped; the edge a soft matte (kept mask closed 1 px, blurred 1.2 px)' };
fs.writeFileSync(log, JSON.stringify(done, null, 1));
console.log('chest charm trimmed:', removed, 'px of shirt and bow removed');
}
// 2. the bodice under the charm
const bodFile = path.join(dir, 'bodice.png'), b0 = sha(bodFile);
if (done['bodice.png'] && done['bodice.png'].after === b0) { console.log('bodice already filled'); } else {
  const r3m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'))), bod = r3m.parts.find(p => p.id === 'bodice'), ch = r3m.parts.find(p => p.id === 'chest_charm'), ts = r3m.textureScale;
  const bi = await sharp(bodFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const BW = bi.info.width, BH = bi.info.height, bd = bi.data;
  const x0 = Math.max(0, Math.round((ch.x - bod.x - 6) * ts)), x1 = Math.min(BW - 1, Math.round((ch.x + ch.w - bod.x + 6) * ts)), y0 = Math.max(0, Math.round((ch.y - bod.y + 14) * ts)), y1 = Math.min(BH - 1, Math.round((ch.y + ch.h - bod.y + 10) * ts));
  // every pixel in the strip that is not plain shirt white (lum > 224, sat < 16: the cream placket shadow and the bow's fragments) is filled by repeated averaging of its neighbours, seeded from the shirt pixels around; the result is blended back over 2 px at the strip's edges
  const shirt = i => { const r = bd[i * 4], g = bd[i * 4 + 1], b = bd[i * 4 + 2]; const l = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b); return bd[i * 4 + 3] > 200 && l > 224 && sat < 16; };
  const F = new Float32Array(BW * BH * 3); for (let i = 0; i < BW * BH; i++) for (let c = 0; c < 3; c++) F[i * 3 + c] = bd[i * 4 + c];
  const fill = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * BW + x; if (bd[i * 4 + 3] > 200 && !shirt(i)) fill.push(i); }
  const inFill = new Uint8Array(BW * BH); for (const i of fill) inFill[i] = 1;
  // the fill's sources: shirt pixels (inside the strip too); the fill pixels take part once they have a value, so the strip fills inward from its shirt neighbours
  for (let it = 0; it < 900; it++) for (const i of fill) { const x = i % BW; let t = [0, 0, 0], k = 0; for (const j of [x > 0 ? i - 1 : -1, x < BW - 1 ? i + 1 : -1, i - BW, i + BW]) { if (j < 0 || j >= BW * BH || bd[j * 4 + 3] < 200) continue; if (!inFill[j] && !shirt(j)) continue; for (let c = 0; c < 3; c++) t[c] += F[j * 3 + c]; k++; } if (k) for (let c = 0; c < 3; c++) F[i * 3 + c] = t[c] / k; }
  const bo = Buffer.from(bd); for (const i of fill) for (let c = 0; c < 3; c++) bo[i * 4 + c] = Math.round(F[i * 3 + c]);
  await sharp(bo, { raw: { width: BW, height: BH, channels: 4 } }).png({ compressionLevel: 9 }).toFile(bodFile);
  done['bodice.png'] = { before: b0, after: sha(bodFile), filledPixels: fill.length, box: [x0, y0, x1, y1], rule: 'under the charm (its rest box + 6 units sideways, from 14 units below its top (under the knot) to 10 units below its bottom): every pixel that is not plain shirt white (lum > 224, sat < 16) filled by repeated neighbour averaging seeded from the shirt pixels only' };
  fs.writeFileSync(log, JSON.stringify(done, null, 1));
  console.log('bodice filled under the charm:', fill.length, 'px');
}
