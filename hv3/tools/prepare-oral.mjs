// Mouth interior for the smile, from Codex's rebuilt oral materials
// (studies/continuity/materials). Only the teeth and the inside of the mouth
// are used; the smile itself is made by deforming art A's lips in the rig.
// - teeth: the upper tooth row of smile-local.png (natural ivory incisors,
//   smaller lateral teeth receding to the corners), cut between the inner
//   edges of its lips. Each column is shifted so the row's top edge is level
//   (the rig sets it on art A's mouth line); dark gaps at the corners become
//   transparent so the cavity behind shows through.
// - cavity and tongue: oral-cavity.png and tongue.png as they are.
// Usage: node prepare-oral.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const src = path.resolve(here, '../../studies/continuity/materials'), out = path.resolve(here, '../parts/oral');
fs.mkdirSync(out, { recursive: true });
// inner lip edges traced on smile-local.png (its px)
const top = [[22, 36], [45, 40], [80, 42], [104, 42], [130, 40], [150, 36], [170, 30], [186, 25]];
const bottom = [[22, 37], [45, 50], [80, 57], [104, 60], [130, 57], [150, 52], [170, 44], [186, 26]];
const at = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, b] = [pts[i - 1], pts[i]]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return pts.at(-1)[1]; };
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const { data, info } = await sharp(path.join(src, 'smile-local.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const x0 = 22, x1 = 186, W = x1 - x0, H = 30, ref = at(top, 104), o = Buffer.alloc(W * H * 4);
for (let x = x0; x < x1; x++) {
  const t0 = at(top, x + 0.5), b0 = at(bottom, x + 0.5);
  for (let v = 0; v < H; v++) {
    const y = v + t0 - 1.5, yi = Math.floor(y), f = y - yi; if (yi < 0 || yi + 1 >= info.height) continue;
    const px = c => data[(yi * info.width + x) * 4 + c] * (1 - f) + data[((yi + 1) * info.width + x) * 4 + c] * f;
    const col = [px(0), px(1), px(2)], lum = (col[0] + col[1] + col[2]) / 3;
    // inside the opening (soft 1 px edges), tooth-bright pixels only
    const inside = smooth((y - (t0 - 1)) / 1.2) * (1 - smooth((y - b0) / 1.2));
    // (not the pink gloss of the lower lip)
    const a = inside * smooth((lum - 95) / 60) * (1 - smooth((col[0] - col[2] - 35) / 15));
    const k = (v * W + (x - x0)) * 4; for (let c = 0; c < 3; c++) o[k + c] = Math.round(col[c]); o[k + 3] = Math.round(255 * a);
  }
}
await sharp(o, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(out, 'teeth-upper.png'));
for (const f of ['oral-cavity.png', 'tongue.png']) fs.copyFileSync(path.join(src, f), path.join(out, f));
// where the incisors' centre and top edge are in the output (for the rig)
fs.writeFileSync(path.join(out, 'teeth-upper.json'), JSON.stringify({ source: 'studies/continuity/materials/smile-local.png', width: W, height: H, centreX: 104 - x0, topY: 1.5, toothRowWidth: 164 }, null, 1));
console.log('teeth', W, 'x', H);
