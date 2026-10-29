// Import ChatGPT's complete resting left hand (R3 coordinates, 4096x6144,
// transparent background) in place of R3's hand_L, whose index finger was cut
// off by the hip ribbon. The hand sits in the same box and on the same wrist
// pivot as R3's hand_L, so only the texture changes:
// 1. crop R3's hand_L box and store at 2 texture px per unit (as prepare-r3);
// 2. match the skin colour to the hand it replaces (mean and spread of the
//    skin pixels, per channel), so the toning in build-rig gives the same
//    result as for the other hands;
// 3. clean-edges (hand mode, run after this) takes out the white cuff frill
//    drawn at the wrist, which the rig's own cuff part covers.
// The source file is not changed; its SHA-256 goes into the manifest.
// Usage: node import-hand-l.mjs <source png>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [src] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const dir = path.resolve(here, '../parts/r3'), mf = path.join(dir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(mf));
const p = manifest.parts.find(q => q.id === 'hand_L');
const old = path.join(dir, 'hand_L.png');
const skinStats = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const s = [0, 0, 0], q = [0, 0, 0]; let n = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    if (data[i * 4 + 3] < 250 || r - b < 25 || r < 120) continue; // skin: warm and not dark
    for (let c = 0; c < 3; c++) { s[c] += data[i * 4 + c]; q[c] += data[i * 4 + c] ** 2; } n++;
  }
  const m = s.map(v => v / n); return { m, sd: q.map((v, c) => Math.sqrt(Math.max(1, v / n - m[c] ** 2))), n };
};
const ref = await skinStats(old);
const crop = await sharp(src).extract({ left: p.x * 4, top: p.y * 4, width: p.w * 4, height: p.h * 4 }).resize(p.w * 2, p.h * 2, { kernel: 'lanczos3' }).png().toBuffer();
const tmp = path.join(dir, 'hand_L.new.png'); fs.writeFileSync(tmp, crop);
const cur = await skinStats(tmp); fs.unlinkSync(tmp);
console.log('old skin', ref.m.map(v => v.toFixed(1)), ref.sd.map(v => v.toFixed(1)), 'new skin', cur.m.map(v => v.toFixed(1)), cur.sd.map(v => v.toFixed(1)));
const { data, info } = await sharp(crop).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const out = Buffer.from(data);
for (let i = 0; i < info.width * info.height; i++) {
  if (!data[i * 4 + 3]) continue;
  const r = data[i * 4], b = data[i * 4 + 2];
  // skin only (the cuff frill keeps its white; it is removed afterwards anyway)
  const k = Math.min(1, Math.max(0, (r - b - 10) / 15));
  for (let c = 0; c < 3; c++) { const v = ref.m[c] + (data[i * 4 + c] - cur.m[c]) * ref.sd[c] / cur.sd[c]; out[i * 4 + c] = Math.round(Math.max(0, Math.min(255, data[i * 4 + c] + (v - data[i * 4 + c]) * k))); }
}
await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(old);
p.source = { file: path.basename(src), sha256: crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex'), note: 'ChatGPT: resting left hand drawn complete to the outside of the index finger (R3 box and wrist pivot); skin matched to the R3 hand it replaces' };
fs.writeFileSync(mf, JSON.stringify(manifest, null, 1));
console.log('written', old, p.source.sha256);
