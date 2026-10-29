// Bring R3's hands (and the added Hand4 hands) to approved art A's skin. The
// hands are lighter, cooler and flatter than art A's face and neck: each
// channel is moved to art A's skin mean and part of the way to its spread
// (the detail of the drawing is kept). A mirrored hand would be lit from the
// other side, so its column brightness profile is put back to the original
// one (the light keeps coming from the same side).
import sharp from 'sharp';

let ref = null;
async function stats(file, pick) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const s = [0, 0, 0], q = [0, 0, 0]; let n = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    if (data[i * 4 + 3] < 250 || (pick && !pick(i % info.width, Math.floor(i / info.width), data, i))) continue;
    for (let c = 0; c < 3; c++) { s[c] += data[i * 4 + c]; q[c] += data[i * 4 + c] ** 2; } n++;
  }
  const m = s.map(v => v / n); return { m, sd: q.map((v, c) => Math.sqrt(Math.max(1, v / n - m[c] ** 2))) };
}
// art A skin: the cheeks of the head skin layer and the front of the neck,
// averaged (the cheeks are lit and blushed, the neck is in half shade like the hands)
export async function skinRef(headSkin, box, neckSkin, neckBox) {
  const inside = (x, y, b) => x > b[0] && x < b[2] && y > b[1] && y < b[3];
  const a = await stats(headSkin, (x, y) => inside(x, y, box.cheekL) || inside(x, y, box.cheekR)), b = await stats(neckSkin, (x, y) => inside(x, y, neckBox));
  ref = { m: a.m.map((v, c) => (v + b.m[c]) / 2), sd: a.sd.map((v, c) => (v + b.sd[c]) / 2) };
  return ref;
}
export async function handStats(files) {
  const all = await Promise.all(files.map(f => stats(f)));
  return { m: [0, 1, 2].map(c => all.reduce((a, s) => a + s.m[c], 0) / all.length), sd: [0, 1, 2].map(c => all.reduce((a, s) => a + s.sd[c], 0) / all.length) };
}
export async function toneHand(src, dst, hands, { mirror = false, meanK = 0.85, sdK = 0.5 } = {}) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, out = Buffer.from(data);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) {
    const target = hands.m[c] + (ref.m[c] - hands.m[c]) * meanK, spread = hands.sd[c] + (ref.sd[c] - hands.sd[c]) * sdK;
    out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(target + (data[i * 4 + c] - hands.m[c]) * spread / hands.sd[c])));
  }
  let img = sharp(out, { raw: { width: W, height: H, channels: 4 } });
  if (mirror) {
    // column brightness of the original, smoothed; after the flop each column gets the original's light back
    const prof = new Float32Array(W), cnt = new Float32Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (out[i + 3] < 200) continue; prof[x] += (out[i] + out[i + 1] + out[i + 2]) / 3; cnt[x]++; }
    const sm = Float32Array.from(prof, (v, x) => { let a = 0, n = 0; for (let k = -6; k <= 6; k++) { const j = x + k; if (j >= 0 && j < W && cnt[j]) { a += prof[j] / cnt[j]; n++; } } return n ? a / n : 0; });
    const flopped = await img.flop().raw().toBuffer();
    for (let x = 0; x < W; x++) {
      const g = sm[x] && sm[W - 1 - x] ? Math.max(0.85, Math.min(1.15, sm[x] / sm[W - 1 - x])) : 1;
      for (let y = 0; y < H; y++) { const i = (y * W + x) * 4; for (let c = 0; c < 3; c++) flopped[i + c] = Math.min(255, Math.round(flopped[i + c] * g)); }
    }
    img = sharp(flopped, { raw: { width: W, height: H, channels: 4 } });
  }
  await img.png().toFile(dst);
}
