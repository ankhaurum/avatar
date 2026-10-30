// Import Codex's mouth interior set (one shared canvas, 1736 x 906: the upper
// and lower teeth with gums, the mouth cavity and the tongue; the assembly
// preview Hibiki_V3_assembly_GENERATED_PREVIEW_20261030.png shows how they
// stack) as the rig's oral parts. One scale for all four, so they keep their
// drawn relation, and the set is made for the mouth: the preview's lips
// (corners MOUTH_CANVAS px apart) are art A's lips (corners MOUTH_ART px
// apart, parts/lips-import.json), so art A px per canvas px = MOUTH_ART /
// MOUTH_CANVAS and the rows span the mouth as drawn. Each part is
// cropped to its opaque box and stored at TEX texture px per art A px; the
// cavity is flattened onto its own rim colour (the strip between the lips maps
// a rectangle of it, which must have no transparent corners). The crowns are
// measured in the stored textures (the rig places the rows by them: the gum
// line stays under the upper lip, the incisal edges follow the lips). The
// sources' SHA-256, the scale, the boxes and the measurements go to
// parts/oral/oral.json. The source files are not changed.
// Usage: node import-oral.mjs <upper png> <lower png> <cavity png> <tongue png>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [upperSrc, lowerSrc, cavitySrc, tongueSrc] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const out = path.resolve(here, '../parts/oral');
const MOUTH_CANVAS = 1563; // the preview's lip corners, x 86 .. 1649
const lips = JSON.parse(fs.readFileSync(path.resolve(here, '../parts/lips-import.json')));
const MOUTH_ART = Math.hypot(lips.corners[1][0] - lips.corners[0][0], lips.corners[1][1] - lips.corners[0][1]);
const K = MOUTH_ART / MOUTH_CANVAS, TEX = 4;
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const load = async f => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
const box = im => { let x0 = im.W, y0 = im.H, x1 = -1, y1 = -1; for (let y = 0; y < im.H; y++) for (let x = 0; x < im.W; x++) if (im.d[(y * im.W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
const tooth = (im, x, y) => { const i = (y * im.W + x) * 4, r = im.d[i], g = im.d[i + 1], b = im.d[i + 2]; return im.d[i + 3] > 200 && (r + g + b) / 3 > 110 && r - b < 70; };
// the teeth along one row (y): runs of tooth-bright pixels, the edges at the middles of the gaps
const teethAt = (im, y) => {
  const runs = []; let r = null;
  for (let x = 0; x < im.W; x++) { const t = tooth(im, x, y); if (t && !r) r = { x0: x }; if (!t && r) { r.x1 = x - 1; runs.push(r); r = null; } }
  const m = []; for (const q of runs) { if (m.length && q.x0 - m[m.length - 1].x1 < 6) m[m.length - 1].x1 = q.x1; else m.push({ ...q }); }
  const t = m.filter(q => q.x1 - q.x0 > 15);
  return t.map((q, i) => ({ x0: i ? Math.round((t[i - 1].x1 + q.x0) / 2) : q.x0, x1: i < t.length - 1 ? Math.round((q.x1 + t[i + 1].x0) / 2) : q.x1 }));
};
const extent = (im, x0, x1) => { let top = 1e9, bot = -1; for (let x = x0; x <= x1; x++) { let a = -1, b = -1; for (let y = 0; y < im.H; y++) if (tooth(im, x, y)) { if (a < 0) a = y; b = y; } if (a >= 0) { top = Math.min(top, a); bot = Math.max(bot, b); } } return [top, bot]; };
const manifest = { units: 'art A px', texturePxPerArtPx: TEX, artPerCanvasPx: K, mouthWidthArt: MOUTH_ART, mouthWidthCanvas: MOUTH_CANVAS, sources: {}, jaws: {}, cavity: null, tongue: null };
const store = async (src, name, file, flatten) => {
  const im = await load(src), b = box(im), W = Math.round(b.w * K * TEX), H = Math.round(b.h * K * TEX);
  let p = sharp(src).extract({ left: b.x0, top: b.y0, width: b.w, height: b.h }).resize(W, H, { kernel: 'lanczos3' });
  if (flatten) p = p.flatten({ background: flatten });
  await p.png({ compressionLevel: 9 }).toFile(path.join(out, file));
  manifest.sources[name] = { file: path.basename(src), sha256: sha(src), canvas: [im.W, im.H] };
  return { im, b, W, H, file: 'oral/' + file };
};
// teeth: the central incisors' crown top (the gum line) and incisal edges, the row's centre, each tooth's width
for (const [name, src, rowY] of [['upper', upperSrc, 500], ['lower', lowerSrc, 520]]) {
  const { im, b, W, H, file } = await store(src, name, `jaw-${name}.png`);
  const teeth = teethAt(im, rowY).map(t => ({ ...t, ext: extent(im, Math.round((t.x0 + t.x1) / 2 - (t.x1 - t.x0) * 0.2), Math.round((t.x0 + t.x1) / 2 + (t.x1 - t.x0) * 0.2)) }));
  const n = teeth.length, c = [teeth[n / 2 - 1], teeth[n / 2]]; // the two central incisors
  const crownTop = Math.min(...c.map(t => t.ext[0])), crownBottom = Math.max(...c.map(t => t.ext[1]));
  const x0 = teeth[0].x0, x1 = teeth[n - 1].x1;
  const toTex = v => v * K * TEX;
  manifest.jaws[name] = { file, srcBox: [b.x0, b.y0, b.w, b.h], width: W, height: H,
    centreX: toTex((x0 + x1) / 2 - b.x0), rowLeft: toTex(x0 - b.x0), rowRight: toTex(x1 - b.x0),
    crownTop: toTex(crownTop - b.y0), crownBottom: toTex(crownBottom - b.y0), crownHeightArt: (crownBottom - crownTop) * K, widthArt: b.w * K, rowWidthArt: (x1 - x0) * K,
    teeth: teeth.map(t => ({ widthArt: +((t.x1 - t.x0) * K).toFixed(2), topArt: +((t.ext[0] - crownTop) * K).toFixed(2), bottomArt: +((t.ext[1] - crownTop) * K).toFixed(2) })) };
  console.log(name, W + 'x' + H, 'row centre', ((x0 + x1) / 2).toFixed(1), 'canvas (opaque centre', (b.x0 + b.w / 2).toFixed(1) + ')', 'crown', crownTop, '-', crownBottom, '->', ((crownBottom - crownTop) * K).toFixed(1), 'px art; teeth', teeth.map(t => ((t.x1 - t.x0) * K).toFixed(1)).join(' '));
}
// cavity: flattened onto the mean colour of its rim (sampled near the edge), the dark hole measured for the strip's mapping
{
  const im = await load(cavitySrc), b = box(im);
  const samples = [[0.04, 0.5], [0.96, 0.5], [0.5, 0.03], [0.5, 0.97], [0.15, 0.25], [0.85, 0.75]].map(([u, v]) => [Math.round(b.x0 + u * b.w), Math.round(b.y0 + v * b.h)]);
  const rim = [0, 0, 0]; for (const [x, y] of samples) { const i = (y * im.W + x) * 4; for (let c = 0; c < 3; c++) rim[c] += im.d[i + c] / samples.length; }
  const { W, H, file } = await store(cavitySrc, 'cavity', 'cavity.png', { r: Math.round(rim[0]), g: Math.round(rim[1]), b: Math.round(rim[2]) });
  let hy0 = 1e9, hy1 = -1; const cx = Math.round(b.x0 + b.w / 2); for (let y = b.y0; y < b.y0 + b.h; y++) { const i = (y * im.W + cx) * 4; if (im.d[i + 3] > 200 && (im.d[i] + im.d[i + 1] + im.d[i + 2]) / 3 < 60) { hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y); } }
  manifest.cavity = { file, srcBox: [b.x0, b.y0, b.w, b.h], width: W, height: H, rim: rim.map(Math.round), darkV: [(hy0 - b.y0) / b.h, (hy1 - b.y0) / b.h] };
  console.log('cavity', W + 'x' + H, 'rim', rim.map(Math.round).join(','), 'dark hole v', manifest.cavity.darkV.map(v => v.toFixed(2)).join('..'));
}
// tongue: its top contour (the tip) and centre
{
  const { im, b, W, H, file } = await store(tongueSrc, 'tongue', 'tongue.png');
  let top = 1e9; for (let x = b.x0 + Math.round(b.w * 0.3); x < b.x0 + b.w * 0.7; x++) for (let y = b.y0; y < b.y0 + b.h; y++) if (im.d[(y * im.W + x) * 4 + 3] > 128) { top = Math.min(top, y); break; }
  manifest.tongue = { file, srcBox: [b.x0, b.y0, b.w, b.h], width: W, height: H, centreX: (b.w / 2) * K * TEX, topY: (top - b.y0) * K * TEX, widthArt: b.w * K };
  console.log('tongue', W + 'x' + H, 'top at', top, 'canvas');
}
fs.writeFileSync(path.join(out, 'oral.json'), JSON.stringify(manifest, null, 1));
console.log('oral.json written; scale', K.toFixed(5), 'art px per canvas px');
