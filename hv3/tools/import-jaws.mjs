// Import ChatGPT's upper and lower jaws (teeth with gums, transparent
// background; the director checked them on magenta) as the mouth interior:
// 1. crop each to its opaque box and store at 4 texture px per art A px, scaled
//    so the central incisors are about 11.5 px wide in art A (the reference
//    smile, studies/continuity/materials/smile-local.png registered to art A,
//    shows them at 10-12 px);
// 2. measure, in the stored textures, where the incisal edges and the gum line
//    lie (for the rig: the crowns are placed just under the upper lip's inner
//    edge, the gums hidden by the lip and the mouth mask);
// 3. record the sources' SHA-256 and the measurements in parts/oral/jaws.json.
// The source files are not changed. Usage: node import-jaws.mjs <upper png> <lower png>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [upperSrc, lowerSrc] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const out = path.resolve(here, '../parts/oral');
// art A px per source px: the upper central incisors are 216 px wide in the source
export const K_UPPER = 11.5 / 216, K_LOWER = 11.5 / 216 * (1613 / 1558) * 0.93; // the lower arch is drawn a little smaller and narrower
const TEX = 4; // texture px per art A px
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const manifest = { units: 'art A px', texturePxPerArtPx: TEX, jaws: {} };
for (const [name, src, k] of [['upper', upperSrc, K_UPPER], ['lower', lowerSrc, K_LOWER]]) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, W = Math.round(w * k * TEX), H = Math.round(h * k * TEX);
  const file = `jaw-${name}.png`;
  await sharp(src).extract({ left: x0, top: y0, width: w, height: h }).resize(W, H, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(path.join(out, file));
  // measurements on the stored texture: per column the first / last tooth-bright
  // pixel (teeth: light and nearly grey; gums: pink)
  const t = await sharp(path.join(out, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const tooth = i => { const r = t.data[i * 4], g = t.data[i * 4 + 1], b = t.data[i * 4 + 2]; return t.data[i * 4 + 3] > 200 && (r + g + b) / 3 > 150 && r - b < 70; };
  const cx = Math.round(W / 2), cols = [];
  for (let x = 0; x < W; x++) { let top = -1, bot = -1; for (let y = 0; y < H; y++) if (tooth(y * W + x)) { if (top < 0) top = y; bot = y; } cols.push([top, bot]); }
  const mid = cols.slice(cx - 6, cx + 6);
  const crownTop = Math.min(...mid.map(c => c[0]).filter(v => v >= 0)), crownBottom = Math.max(...mid.map(c => c[1]));
  manifest.jaws[name] = { source: path.basename(src), sha256: sha(src), file: 'oral/' + file, srcBox: [x0, y0, w, h], scale: k, width: W, height: H,
    // in the stored texture (px): the centre column, the top and bottom of the central incisors' crowns
    centreX: W / 2, crownTop, crownBottom, crownHeightArt: (crownBottom - crownTop) / TEX, widthArt: W / TEX };
  console.log(name, W, 'x', H, 'crown', crownTop, '-', crownBottom, '(', ((crownBottom - crownTop) / TEX).toFixed(1), 'px art A )', 'arch width', (W / TEX).toFixed(1));
}
fs.writeFileSync(path.join(out, 'jaws.json'), JSON.stringify(manifest, null, 1));
