// Rebuilds the neck skin (parts/neck_skin.png, cut from art A by extract-head.cjs)
// and trims head_under's neck block, so the neck looks like art A's skin
// whichever way the body turns and whatever the side hair does. Replaces
// fix-neck.mjs (#86), whose darkening of the skin under the hair read as dirt.
// What was wrong (seen by drawing the parts one at a time, 2026-10-30):
// 1. the part's alpha was a wide feather (about 15 px at the sides, 20 px at
//    the collar): under the side hair it faded out over the shirt's shoulders
//    and beyond the body's outline, and once the hair moved against the
//    body (a turn, the sway) the faded skin showed as a grey smear outside
//    the neck, and the body's lighter neck showed through the feather;
// 2. art A's hair tips over the neck were baked into the skin (the hair parts
//    carry the same tips), and darkened 22 % by fix-neck they looked like
//    blue-grey streaks on the neck, doubled when the hair moved;
// 3. head_under (drawn over the neck skin) kept a block of neck under the
//    chin with straight cut edges that showed when the hair moved;
// 4. the thin shaded edges of art A's shirt collar remained in the skin (the
//    one thing fix-neck got right; done again here).
// What it does, in the part's own pixel grid (1 px per art A px):
// - starts from the texture before #86 (its SHA256 is checked);
// - fills the collar's edge lines from the skin around them;
// - takes the hair tips out of the skin below the jaw (bluish pixels, dilated
//   2 px, filled by repeated neighbour averaging), so the hair parts alone draw them;
// - under the side hair (the hair's alpha at rest, blurred 4 px) the skin,
//   which extract-head had filled with a flat light mean colour, keeps its
//   smooth fill but is matched in tone to the neck at the hair's edge (a
//   per-row ratio smoothed over the rows), darkening by at most 8 % over 30
//   px (the neck turning away under the hair), so what shows when the hair
//   moves is the neck's own shading, not a pale patch and not a shadow;
// - the alpha below the face becomes the neck's silhouette: R3's own neck
//   part (the body under the collar, in art A's coordinates through the
//   build's art A transform) and the face (head_skin), with the right
//   contour the mirror of the left about x 527.5 (the neck is symmetric;
//   R3's neck is wider on the right), eroded 2 px,
//   with a 1.5 px soft edge; opaque inside (the body's lighter neck no longer
//   shows through), nothing over the shirt's shoulders or outside the body;
// - the skin on the right that art A hides under the hair is art A's own
//   left neck mirrored about the axis (the tendons, the darker edge),
//   matched in tone to the right's skin just inside the hair (the light is
//   from the left), with a thin line at the contour, so when the hair swings
//   off it the neck looks like the other side in shadow, not a pale band;
// - head_skin and head_under (the face, warped by the head's turn) kept a
//   block of neck below the jaw with straight edges; their alpha is cut 3 px
//   under the jaw line (art A's chin and jaw, measured as the edge of the
//   chin's shadow: JAW), soft 2 px, so the neck below the jaw is the neck
//   skin alone (its own pixels there are the same) and the chin moves over
//   it as in Live2D;
// - head_skin and head_under also kept, beside the jaw and cheeks under the
//   side hair, a wedge of filled skin with straight cut edges (the texture's
//   hull), which showed as a flat patch when the hair swung away during a
//   turn; below the cheekbones (art A y 300 and down) their alpha now fades
//   out 5 px outside the skin that art A shows (each row from its first to
//   its last skin pixel, so the hair's strands over the cheeks are not gaps),
//   with a crisp 1.2 px edge; on the right the kept margin reaches the
//   mirror of the left cheek's edge and takes art A's left cheek mirrored
//   (the face is symmetric about x 527.5; the cheek continues under the
//   hair to there), elsewhere it is up to 14 % darker
//   toward the edge (a cheek's contour; a 10 px margin blurred 5 px read as
//   a smudge when the hair swung), so a little
//   shadowed skin remains under the hair's edge and the hair's swing reveals
//   a rounded cheek, not a cut; and that remaining skin is matched in tone
//   to the face's edge the same way as the neck's (a smoothed per-row ratio,
//   darkening by up to 8 % over 12 px) instead of the flat grey-mauve fill,
//   so it reads as the cheek in the hair's shadow, not a grey patch.
// - R3's neck part is trimmed 8 px inward on both sides above the collar, so
//   it never shows beside the neck skin (see step 7).
// Recorded in parts/neck-fix.json (SHA256 before / after; idempotent).
// Usage: node rebuild-neck.mjs   (parts/neck_skin.png must be the pre-#86
// texture: git show 22d5144:hv3/parts/neck_skin.png)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const parts = path.resolve(here, '../parts'), log = path.join(parts, 'neck-fix.json');
const metaAll = JSON.parse(fs.readFileSync(path.join(parts, 'meta.json')));
const r3m = JSON.parse(fs.readFileSync(path.join(parts, 'r3/manifest.json')));
const artA = { scale: 0.551, offset: [223.5, 6.4] }; // build-rig.mjs: art A px -> rig units (R3 px / 4)
const BEFORE_NECK = '831638734725a4774a2c9853b22cd6a5030627248c442d4476c4bec4a93edc89'; // neck_skin.png before #86
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const load = async f => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
const blur1 = async (buf, W, H, sigma) => sharp(buf, { raw: { width: W, height: H, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
// min / max filters of radius r on a 0..255 single-channel buffer
const morph = (src, W, H, r, isMax) => { const out = Buffer.alloc(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = isMax ? 0 : 255; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r + r) continue; const xx = x + dx, yy = y + dy; const s = (xx < 0 || yy < 0 || xx >= W || yy >= H) ? 0 : src[yy * W + xx]; v = isMax ? Math.max(v, s) : Math.min(v, s); } out[y * W + x] = v; } return out; };
// fill the masked pixels from their unmasked neighbours by repeated averaging
const fillFrom = (F, W, H, mask, alpha, iters) => { const fill = []; for (let i = 0; i < W * H; i++) if (mask[i]) fill.push(i); for (let it = 0; it < iters; it++) for (const i of fill) { const x = i % W; let t = [0, 0, 0], k = 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= W * H || alpha[j] < 150) continue; for (let c = 0; c < 3; c++) t[c] += F[j * 3 + c]; k++; } if (k) for (let c = 0; c < 3; c++) F[i * 3 + c] = t[c] / k; } return fill.length; };

const done = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log)) : null;
const neckFile = path.join(parts, 'neck_skin.png'), underFile = path.join(parts, 'head_under.png');
const s0 = sha(neckFile);
if (done && done.tool === 'rebuild-neck' && done.neck_skin.after === s0) { console.log('already rebuilt'); process.exit(0); }
if (s0 !== BEFORE_NECK) { console.error('parts/neck_skin.png is not the texture before #86 (' + s0.slice(0, 12) + '); restore it with: git show 22d5144:hv3/parts/neck_skin.png > hv3/parts/neck_skin.png'); process.exit(1); }
const mN = metaAll.neck_skin, neck = await load(neckFile), W = neck.W, H = neck.H;
const artIm = await load(path.resolve(here, '../../v3/artwork/hibiki-static-a.png'));
// samplers in the neck part's grid (x, y) -> alpha of other parts at the same art A point
const headSkin = await load(path.join(parts, 'head_skin.png')), mHS = metaAll.head_skin;
const headA = (x, y) => { const hx = mN.x + x - mHS.x, hy = mN.y + y - mHS.y; return (hx < 0 || hy < 0 || hx >= headSkin.W || hy >= headSkin.H) ? 0 : headSkin.d[(hy * headSkin.W + hx) * 4 + 3]; };
const r3Alpha = async id => { const p = r3m.parts.find(p => p.id === id), im = await load(path.join(parts, p.file)), ts = r3m.textureScale; return (x, y) => { const wx = artA.offset[0] + (mN.x + x) * artA.scale, wy = artA.offset[1] + (mN.y + y) * artA.scale; const tx = Math.round((wx - p.x) * ts), ty = Math.round((wy - p.y) * ts); return (tx < 0 || ty < 0 || tx >= im.W || ty >= im.H) ? 0 : im.d[(ty * im.W + tx) * 4 + 3]; }; };
const r3Neck = await r3Alpha('neck');
// the side hair's cover at rest
const cover = Buffer.alloc(W * H);
for (const name of ['hair_side_R', 'hair_side_L']) { const hm = metaAll[name], h = await load(path.join(parts, name + '.png')); for (let y = 0; y < h.H; y++) for (let x = 0; x < h.W; x++) { const nx = hm.x + x - mN.x, ny = hm.y + y - mN.y; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const a = h.d[(y * h.W + x) * 4 + 3]; const i = ny * W + nx; if (a > cover[i]) cover[i] = a; } }
const coverB = await blur1(cover, W, H, 4);
const d = neck.d, alpha = Buffer.alloc(W * H); for (let i = 0; i < W * H; i++) alpha[i] = d[i * 4 + 3];
const F = new Float32Array(W * H * 3); for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) F[i * 3 + c] = d[i * 4 + c];
// the neck zone: below the face. The face is head_skin's alpha above the jaw
// line only: head_skin's hull also spread beside the jaw under the hair, and
// counting that as face kept a flat block of fill there out of the neck's
// tone match (it showed while the hair swung)
const JAW = [[440, 360], [455, 368], [460, 372], [475, 384], [490, 394], [505, 402], [527, 408], [550, 402], [565, 389], [580, 376], [590, 370], [610, 360]]; // art A px: the chin's shadow edge, measured 2026-10-30
const jawY = x => { for (let i = 1; i < JAW.length; i++) if (x <= JAW[i][0]) { const [x0, y0] = JAW[i - 1], [x1, y1] = JAW[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return JAW[JAW.length - 1][1]; };
// art A's visible face per row: the span from its first to its last skin pixel (the hair strands over
// the cheeks are not gaps), 5 px wider on each side (the cheek turns away behind the hair's edge)
const artSkinA = (ax, ay) => { if (ax < 0 || ay < 0 || ax >= artIm.W || ay >= artIm.H) return false; const i = (ay * artIm.W + ax) * 4, r = artIm.d[i], g = artIm.d[i + 1], b = artIm.d[i + 2]; return artIm.d[i + 3] > 200 && r - b > 25 && (r + g + b) / 3 > 95; };
const FACE_MARGIN = 5;
const faceSpan = ay => { let a0 = -1, b0 = -1; for (let ax = 380; ax < 680; ax++) if (artSkinA(ax, ay)) { if (a0 < 0) a0 = ax; b0 = ax; } return a0 < 0 ? null : [a0 - FACE_MARGIN, b0 + FACE_MARGIN]; };
const faceW = new Float32Array(W * H); for (let y = 0; y < H; y++) { const ay = mN.y + y; const sp = ay >= 300 ? faceSpan(ay) : null; for (let x = 0; x < W; x++) { const ax = mN.x + x; const x0 = Math.max(JAW[0][0], Math.min(JAW[JAW.length - 1][0], ax)); const above = 1 - smooth((ay - jawY(x0) - 1) / 4); const inSpan = ay < 300 ? smooth(headA(x, y) / 60) : (sp ? smooth((ax - sp[0] + 1) / 2) * smooth((sp[1] - ax + 1) / 2) : 0); faceW[y * W + x] = inSpan * above; } }
// 1. the collar's edge lines (as fix-neck): thin lines below art A y 440, darker than a 6 px blur of their surroundings
const L = Buffer.alloc(W * H); for (let i = 0; i < W * H; i++) L[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
const Lb = await blur1(L, W, H, 6);
const lines = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (alpha[i] < 200 || mN.y + y < 440) continue; if (Lb[i] - L[i] > 6) lines[i] = 1; }
const linesD = morph(Buffer.from(lines.map(v => v * 255)), W, H, 1, true); const lineMask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) lineMask[i] = linesD[i] > 0 && alpha[i] >= 200 ? 1 : 0;
const linePixels = fillFrom(F, W, H, lineMask, alpha, 400);
// 2. the hair tips baked into the skin below the jaw: bluish pixels (red hardly above blue), not the white of the collar
const wisp = Buffer.alloc(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (alpha[i] < 150 || faceW[i] > 0.5) continue; const r = F[i * 3], g = F[i * 3 + 1], b = F[i * 3 + 2]; if (r - b < 32 && !(r > 200 && g > 190)) wisp[i] = 255; }
const wispD = morph(wisp, W, H, 2, true); const wispMask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) wispMask[i] = wispD[i] > 0 && alpha[i] >= 150 && faceW[i] <= 0.5 ? 1 : 0;
const wispPixels = fillFrom(F, W, H, wispMask, alpha, 900);
// 3. the skin under the side hair: extract-head's fill there is smooth but flat
// and light (the mean of the visible neck). It keeps its own gradient and is
// matched in tone to the neck beside it: per row and side, the ratio of the
// visible skin at the hair's edge (up to 10 px inward; the face's own pixels
// beside the jaw count) to the fill just inside the edge, smoothed over the
// rows (sigma 6; rows without a reference take their neighbours'), multiplies
// the fill, darkening further by up to 8 % over 30 px into the hair. (A
// per-row replacement by the reference colour, an earlier try, left
// horizontal and vertical steps where the reference changed.)
const cx = 527.5 - mN.x; let coverPixels = 0;
const smoothRows = rows => { const n = rows.length, out = new Array(n); // gaps from the nearest valid row, then a gaussian over the rows (sigma 6)
  const valid = rows.map((r, y) => r ? y : -1).filter(y => y >= 0); if (!valid.length) return rows.map(() => null);
  const filled = rows.map((r, y) => r || rows[valid.reduce((b, v) => Math.abs(v - y) < Math.abs(b - y) ? v : b, valid[0])]);
  for (let y = 0; y < n; y++) { const acc = [0, 0, 0]; let wsum = 0; for (let d = -18; d <= 18; d++) { const yy = y + d; if (yy < 0 || yy >= n) continue; const w = Math.exp(-d * d / 72); for (let c = 0; c < 3; c++) acc[c] += filled[yy][c] * w; wsum += w; } out[y] = acc.map(v => v / wsum); }
  return out; };
const kRows = [[], []];
for (let y = 0; y < H; y++) for (const [si, side] of [[0, -1], [1, 1]]) {
  kRows[si][y] = null;
  let e = -1; for (let x = Math.round(cx); x >= 0 && x < W; x += side) { const i = y * W + x; if (alpha[i] < 150) break; if (coverB[i] > 128) { e = x; break; } }
  if (e < 0) continue;
  let ref = [0, 0, 0], k = 0; for (let x = e - side; Math.abs(x - e) <= 10 && x >= 0 && x < W && k < 4; x -= side) { const i = y * W + x; if (alpha[i] < 150 || coverB[i] > 128) continue; for (let c = 0; c < 3; c++) ref[c] += F[i * 3 + c]; k++; }
  let fe = [0, 0, 0], kf = 0; for (let x = e; Math.abs(x - e) < 4 && x >= 0 && x < W; x += side) { const i = y * W + x; if (alpha[i] < 150) continue; for (let c = 0; c < 3; c++) fe[c] += F[i * 3 + c]; kf++; }
  if (!k || !kf) continue;
  kRows[si][y] = [0, 1, 2].map(c => Math.min(1.4, Math.max(0.6, (ref[c] / k) / Math.max(1, fe[c] / kf))));
}
const kS = [smoothRows(kRows[0]), smoothRows(kRows[1])];
for (let y = 0; y < H; y++) for (const [si, side] of [[0, -1], [1, 1]]) {
  const kk0 = kS[si][y]; if (!kk0) continue;
  let e = -1; for (let x = Math.round(cx); x >= 0 && x < W; x += side) { const i = y * W + x; if (alpha[i] < 8) break; if (coverB[i] > 128) { e = x; break; } }
  if (e < 0) continue;
  for (let x = e - 4 * side; x >= 0 && x < W; x += side) { const i = y * W + x; if (alpha[i] < 8 || faceW[i] > 0.5) continue; const w = smooth((coverB[i] / 255 - 0.3) / 0.4); if (w <= 0) continue; const dist = Math.max(0, (x - e) * side), kk = 1 - 0.08 * smooth((dist - 2) / 30); for (let c = 0; c < 3; c++) F[i * 3 + c] = F[i * 3 + c] * (1 - w) + F[i * 3 + c] * kk0[c] * kk * w; coverPixels++; }
}
// 3b. the neck's right side (the viewer's right, under the side hair): R3's
// neck part (the body under the collar) is wide on that side, so the skin
// spread under the hair to the shoulder with no contour, and once the hair
// moved the neck had no edge. The neck is taken as symmetric about its axis
// (x 527.5): from the ear's level down (art A y 318; behind the jaw's corner and beside the jaw too,
// where the skin had spread widest), the right contour is the mirror of the
// left contour of R3's neck (smoothed over the rows), both sides are cut to
// it. Where art A shows no skin (under the hair), the skin is art A's left
// neck mirrored (see below), ending in a thin line at the contour.
const xcN = 527.5 - mN.x;
const artAt = (x, y) => { const ax = mN.x + x, ay = mN.y + y; if (ax < 0 || ay < 0 || ax >= artIm.W || ay >= artIm.H) return null; const i = (ay * artIm.W + ax) * 4; return [artIm.d[i], artIm.d[i + 1], artIm.d[i + 2], artIm.d[i + 3]]; };
const artSkin = (x, y) => { const p = artAt(x, y); return !!p && p[3] > 200 && p[0] - p[2] > 25 && (p[0] + p[1] + p[2]) / 3 > 95; };
const NECK_TOP = 318; // art A y at the ear (the neck's top edge then lies behind the cheek's contour): the neck's contour runs from there down, behind the jaw's corner and beside the jaw (not only below the chin)
const neckRow = y => mN.y + y >= NECK_TOP;
const sk = Buffer.alloc(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (artSkin(x, y)) sk[y * W + x] = 255; // art A's visible skin, in the part's grid
const inSil = (x, y) => r3Neck(x, y) > 128; // R3's neck only: the head's hull spreads beside the jaw under the hair
const xlRaw = new Array(H).fill(null);
for (let y = 0; y < H; y++) { if (!neckRow(y)) continue; for (let x = 0; x <= Math.round(xcN); x++) if (inSil(x, y)) { xlRaw[y] = x; break; } }
const validL = xlRaw.map((v, y) => v !== null ? y : -1).filter(y => y >= 0);
const xl = new Array(H).fill(null);
if (validL.length) { for (let y = 0; y < H; y++) { if (!neckRow(y)) continue; const near = validL.reduce((b, v) => Math.abs(v - y) < Math.abs(b - y) ? v : b, validL[0]); xl[y] = xlRaw[y] !== null ? xlRaw[y] : xlRaw[near]; }
  for (let pass = 0; pass < 3; pass++) for (let y = 1; y < H - 1; y++) if (xl[y] !== null && xl[y - 1] !== null && xl[y + 1] !== null) xl[y] = (xl[y - 1] + 2 * xl[y] + xl[y + 1]) / 4; }
const xr = xl.map(v => v === null ? null : 2 * xcN - v);
// the right side's hidden strip (under the hair, where art A shows no skin)
// takes art A's own left neck, mirrored about the axis (x 527.5): the neck is
// symmetric, and the left side shows what the right hides: the tendons and
// the darker edge before the contour. The light comes from the left, so the
// right's visible skin at the hair's edge is darker than the left's at the
// same distance; the mirror is therefore matched in tone to the right's own
// skin just inside the hair (per row, the ratio of the last 6 px of visible
// skin to the mirror there, smoothed over the rows), and keeps its own
// darkening toward the contour. The boundary is the row's end of visible skin
// (the first 4 px without skin outward from the axis, smoothed), blended over
// 4 px, so the hair strands' ragged edge does not make the mix blotchy. A thin
// line (15 % over the last 3 px) marks the contour. The mirror is darkened toward the contour (by
// up to 28 % at it): art A's left neck brightens again just before its own
// contour (the lit side's rim), and mirrored unshaded that rim became a pale
// band along the right contour whenever the hair swung off it. The strip beside the
// jaw's corner (under the ear), hidden too, takes the mirror as well. Flat
// fills (the extraction's mean colour, a tone match, a shading ramp) and the
// raw mirror (too light, and with the left collar's edge line) all read as a
// pale band or a grey step beside the jaw whenever the hair swung off it.
let edgeShaded = 0, mirrored = 0;
const xsRaw = new Array(H).fill(null);
for (let y = 0; y < H; y++) { if (xr[y] === null) continue; let run = 0, end = -1; for (let x = Math.round(xcN); x < W; x++) { if (artSkin(x, y)) { run = 0; continue; } if (run === 0) end = x; if (++run >= 4) { xsRaw[y] = end; break; } } }
const xs = new Array(H).fill(null); { const valid = xsRaw.map((v, y) => v !== null ? y : -1).filter(y => y >= 0); for (let y = 0; y < H; y++) { if (xr[y] === null) continue; const near = valid.length ? valid.reduce((b, v) => Math.abs(v - y) < Math.abs(b - y) ? v : b, valid[0]) : -1; xs[y] = xsRaw[y] !== null ? xsRaw[y] : (near >= 0 ? xsRaw[near] : xr[y] - 15); } for (let p = 0; p < 2; p++) for (let y = 1; y < H - 1; y++) if (xs[y] !== null && xs[y - 1] !== null && xs[y + 1] !== null) xs[y] = (xs[y - 1] + 2 * xs[y] + xs[y + 1]) / 4; }
// the mirror's source is the part's own left side after steps 1-2 (the collar's edge line filled, the hair tips taken out), within the left contour, so neither comes across
const mirrorAt = (x, y) => { const mx = Math.round(2 * xcN - x); if (mx < 0 || mx >= W || alpha[y * W + mx] < 150) return null; if (xl[y] !== null && mx < xl[y] + 1) return null; return [F[(y * W + mx) * 3], F[(y * W + mx) * 3 + 1], F[(y * W + mx) * 3 + 2]]; };
const kMirRaw = new Array(H).fill(null);
for (let y = 0; y < H; y++) { if (xs[y] === null) continue; let a = [0, 0, 0], m = [0, 0, 0], k = 0; for (let x = Math.round(xs[y]) - 6; x < Math.round(xs[y]); x++) { if (x < 0 || x >= W) continue; const i = y * W + x; if (!artSkin(x, y) || alpha[i] < 150) continue; const p = mirrorAt(x, y); if (!p) continue; for (let c = 0; c < 3; c++) { a[c] += F[i * 3 + c]; m[c] += p[c]; } k++; } if (k >= 2) kMirRaw[y] = [0, 1, 2].map(c => Math.min(1.2, Math.max(0.5, a[c] / Math.max(1, m[c])))); }
const kMir = smoothRows(kMirRaw);
const MIRROR_TOP = 345; // art A y: the mirror runs from just above the jaw's corners down; the rows above belong to the face parts
for (let y = 0; y < H; y++) { if (xr[y] === null || xs[y] === null || !kMir[y] || mN.y + y < MIRROR_TOP) continue; for (let x = Math.ceil(xcN); x < W; x++) { const i = y * W + x; if (alpha[i] < 8) continue; if (faceW[i] > 0.5 && x < xs[y] + 2) continue; /* the face zone beside the jaw's corner is hidden skin too, beyond the visible skin */
  const w = smooth((x - xs[y] + 2) / 4); if (w > 0) { const p = mirrorAt(x, y); if (p) { const shade = 1 - 0.28 * smooth((x - xs[y]) / Math.max(1, xr[y] - xs[y])); for (let c = 0; c < 3; c++) F[i * 3 + c] = F[i * 3 + c] * (1 - w) + p[c] * kMir[y][c] * shade * w; mirrored++; } else { const t = (x - xs[y]) / Math.max(1, xr[y] - xs[y]); const k = 1 - 0.30 * smooth(t) * w; for (let c = 0; c < 3; c++) F[i * 3 + c] *= k; } }
  if (!artSkin(x, y)) { const t = (x - (xr[y] - 3)) / 3; if (t > 0) { const k = 1 - 0.15 * smooth(t); for (let c = 0; c < 3; c++) F[i * 3 + c] *= k; edgeShaded++; } } } }
// 4. the alpha below the face: R3's neck and the face, eroded 2 px, soft 1.5 px, within the old texture's extent
const sil = Buffer.alloc(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; sil[i] = (r3Neck(x, y) > 128 || headA(x, y) > 128) ? 255 : 0; }
for (let y = 0; y < H; y++) { if (xl[y] === null) continue; for (let x = 0; x < W; x++) if (x < xl[y] - 1 || x > xr[y] + 1) sil[y * W + x] = 0; }
const silE = morph(sil, W, H, 2, false), silS = await blur1(silE, W, H, 1.5);
const ext = Buffer.alloc(W * H); for (let i = 0; i < W * H; i++) ext[i] = alpha[i] > 12 ? 255 : 0; const extS = await blur1(ext, W, H, 1.5);
// in the neck's rows the contour may reach past the extent extract-head painted (behind the jaw's corner): those pixels are filled from the neck skin beside them, and the extent does not cut the contour there
const grown = new Uint8Array(W * H); for (let y = 0; y < H; y++) { if (!neckRow(y)) continue; for (let x = 0; x < W; x++) { const i = y * W + x; if (silS[i] > 20 && alpha[i] <= 12) grown[i] = 1; } }
const grownPixels = fillFrom(F, W, H, grown, alpha, 300);
for (let y = 0; y < H; y++) { if (!neckRow(y)) continue; for (let x = 0; x < W; x++) { const i = y * W + x; if (grown[i]) extS[i] = 255; } }
const out = Buffer.alloc(W * H * 4); let opaqueAdded = 0;
for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(Math.min(255, Math.max(0, F[i * 3 + c]))); const aNew = Math.min(silS[i], extS[i]); const a = Math.round(alpha[i] * faceW[i] + aNew * (1 - faceW[i])); if (a > alpha[i] + 20) opaqueAdded++; out[i * 4 + 3] = a; }
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(neckFile);
// 5. head_skin and head_under: nothing below the jaw line (3 px under it, soft 2 px)
const cutBelowJaw = async (file, m) => { const before = sha(file), im = await load(file); const keep = Buffer.alloc(im.W * im.H); for (let y = 0; y < im.H; y++) for (let x = 0; x < im.W; x++) keep[y * im.W + x] = (m.y + y) < jawY(m.x + x) + 3 ? 255 : 0; const keepS = await blur1(keep, im.W, im.H, 2); const o = Buffer.from(im.d); let cut = 0; for (let i = 0; i < im.W * im.H; i++) { const a = im.d[i * 4 + 3], a2 = Math.min(a, keepS[i]); if (a2 < a) { o[i * 4 + 3] = a2; cut++; } } await sharp(o, { raw: { width: im.W, height: im.H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file); return { before, after: sha(file), cut }; };
// 6. the sides of the face under the hair: fade out 10 px beyond art A's visible skin (below y 300)
const fadeSides = async (file, m) => { const im = await load(file); const skin = Buffer.alloc(im.W * im.H); for (let y = 0; y < im.H; y++) for (let x = 0; x < im.W; x++) { const ax = m.x + x, ay = m.y + y; if (ax < 0 || ay < 0 || ax >= artIm.W || ay >= artIm.H) continue; const i = (ay * artIm.W + ax) * 4, r = artIm.d[i], g = artIm.d[i + 1], b = artIm.d[i + 2]; if (artIm.d[i + 3] > 200 && r - b > 25 && (r + g + b) / 3 > 90) skin[y * im.W + x] = 255; } for (let y = 0; y < im.H; y++) { let a = -1, b = -1; for (let x = 0; x < im.W; x++) if (skin[y * im.W + x]) { if (a < 0) a = x; b = x; } for (let x = a; x >= 0 && x <= b; x++) skin[y * im.W + x] = 255; } /* the hair's strands over the cheeks are not gaps in the face: each row's skin spans from its first to its last skin pixel */ // the kept face per row: FACE_MARGIN outside the visible skin on the left; on the right up to the mirror of the left edge (1055 - x), where art A's cheek continues under the hair
  const keep = Buffer.alloc(im.W * im.H); const rEnd = new Array(im.H).fill(-1);
  for (let y = 0; y < im.H; y++) { let a0 = -1, b0 = -1; for (let x = 0; x < im.W; x++) if (skin[y * im.W + x]) { if (a0 < 0) a0 = x; b0 = x; } if (a0 < 0) continue; const mirror = 1055 - 2 * m.x - a0; rEnd[y] = Math.min(im.W - 1, Math.max(b0 + FACE_MARGIN, mirror)); for (let x = Math.max(0, a0 - FACE_MARGIN); x <= rEnd[y]; x++) keep[y * im.W + x] = 255; }
  const keepS = await blur1(keep, im.W, im.H, 1.2); const o = Buffer.from(im.d); let cut = 0;
  // the filled skin beside the face (a flat grey-mauve) is matched in tone to the face's edge as the neck's is: per row and side, the ratio of the last 4 skin pixels to the first 4 filled pixels, smoothed over the rows
  const spanOf = [], kRaw = [[], []]; for (let y = 0; y < im.H; y++) { let a0 = -1, b0 = -1; for (let x = 0; x < im.W; x++) if (skin[y * im.W + x]) { if (a0 < 0) a0 = x; b0 = x; } spanOf[y] = [a0, b0]; for (const [si, edge, side] of [[0, a0, -1], [1, b0, 1]]) { kRaw[si][y] = null; if (edge < 0) continue; let ref = [0, 0, 0], k = 0; for (let x = edge; Math.abs(x - edge) < 4 && x >= 0 && x < im.W; x -= side) { const i = y * im.W + x; if (im.d[i * 4 + 3] < 200) continue; for (let c = 0; c < 3; c++) ref[c] += im.d[i * 4 + c]; k++; } let fe = [0, 0, 0], kf = 0; for (let x = edge + side; Math.abs(x - edge) <= 4 && x >= 0 && x < im.W; x += side) { const i = y * im.W + x; if (im.d[i * 4 + 3] < 200) continue; for (let c = 0; c < 3; c++) fe[c] += im.d[i * 4 + c]; kf++; } if (k && kf) kRaw[si][y] = [0, 1, 2].map(c => Math.min(1.4, Math.max(0.6, (ref[c] / k) / Math.max(1, fe[c] / kf)))); } }
  const kFace = [smoothRows(kRaw[0]), smoothRows(kRaw[1])];
  // the mirrored cheek's tone ratio: the last 6 px of visible skin on the right vs the mirror there
  const kMirFRaw = new Array(im.H).fill(null); for (let y = 0; y < im.H; y++) { const sp = spanOf[y]; if (sp[1] < 0) continue; let a = [0, 0, 0], mm = [0, 0, 0], k = 0; for (let x = sp[1] - 5; x <= sp[1]; x++) { if (x < 0 || x >= im.W) continue; const i = y * im.W + x; if (!skin[i] || im.d[i * 4 + 3] < 200) continue; const ax = m.x + x, ay = m.y + y, mxA = Math.round(1055 - ax); if (!artSkinA(mxA, ay)) continue; const j = (ay * artIm.W + mxA) * 4; for (let c = 0; c < 3; c++) { a[c] += im.d[i * 4 + c]; mm[c] += artIm.d[j + c]; } k++; } if (k >= 2) kMirFRaw[y] = [0, 1, 2].map(c => Math.min(1.2, Math.max(0.5, a[c] / Math.max(1, mm[c])))); }
  const kMirF = smoothRows(kMirFRaw); for (let y = 0; y < im.H; y++) { const w = smooth((m.y + y - 290) / 20); if (w <= 0) continue; for (let x = 0; x < im.W; x++) { const i = y * im.W + x; if (skin[i]) continue; const sp = spanOf[y]; const sideK = sp[0] >= 0 && x < sp[0] ? kFace[0][y] : (sp[1] >= 0 && x > sp[1] ? kFace[1][y] : null); if (!sideK) continue; const dist = x < sp[0] ? sp[0] - x : x - sp[1], kk = 1 - 0.14 * smooth(dist / FACE_MARGIN); const ax = m.x + x, ay = m.y + y; let mxA = Math.round(1055 - ax); for (let d = 0; d <= 8 && !artSkinA(mxA, ay); d++) mxA++; /* the nearest skin inward on the mirrored side (the left's own hair tips are skipped) */ if (x > sp[1] && artSkinA(mxA, ay) && kMirF[y]) { const j = (ay * artIm.W + mxA) * 4; for (let c = 0; c < 3; c++) o[i * 4 + c] = Math.round(Math.min(255, im.d[i * 4 + c] * (1 - w) + artIm.d[j + c] * kMirF[y][c] * w)); } else for (let c = 0; c < 3; c++) o[i * 4 + c] = Math.round(Math.min(255, im.d[i * 4 + c] * (1 - w) + im.d[i * 4 + c] * sideK[c] * kk * w)); } for (let x = 0; x < im.W; x++) { const i = y * im.W + x, a = o[i * 4 + 3], a2 = Math.round(a * (1 - w) + Math.min(a, keepS[i]) * w); if (a2 < a) { o[i * 4 + 3] = a2; cut++; } } } await sharp(o, { raw: { width: im.W, height: im.H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file); return cut; };
const headUnder = await cutBelowJaw(underFile, metaAll.head_under), headSkinRec = await cutBelowJaw(path.join(parts, 'head_skin.png'), mHS);
headUnder.sideFade = await fadeSides(underFile, metaAll.head_under); headSkinRec.sideFade = await fadeSides(path.join(parts, 'head_skin.png'), mHS); headUnder.after = sha(underFile); headSkinRec.after = sha(path.join(parts, 'head_skin.png'));
// 7. R3's own neck part (parts/r3/neck.png, the body's neck under the collar,
// a child of the torso) is wider than the neck skin on both sides: at rest it
// shows 2-4 px beyond the neck skin's contour, and up to 8 px when the head
// turns (the neck skin follows the head, R3's neck the torso). That strip of
// flat, lighter skin is what showed beside the neck whenever the side hair
// swung off it. Where the neck skin covers it (above the collar: art A y <
// 470, fading to no trim by y 490) its sides are trimmed R3_TRIM px inward
// (soft 1.5 px), so it stays hidden under the neck skin at any head turn and
// only fills between the neck skin and the collar lower down. Its cleaned
// SHA256 in parts/r3/clean.json is updated to the trimmed file, so
// clean-edges.mjs does not re-clean it.
const R3_TRIM = 8;
{
  const r3neck = r3m.parts.find(p => p.id === 'neck'), r3File = path.join(parts, r3neck.file), ts = r3m.textureScale;
  const cleanLog = path.join(parts, 'r3/clean.json'), clean = JSON.parse(fs.readFileSync(cleanLog));
  const n0 = sha(r3File);
  if (done && done.r3_neck && done.r3_neck.after === n0) console.log('R3 neck already trimmed');
  else {
    const im = await load(r3File); const o = Buffer.from(im.d); const al = Buffer.alloc(im.W * im.H); for (let i = 0; i < im.W * im.H; i++) al[i] = im.d[i * 4 + 3];
    let trimmed = 0;
    for (let ty = 0; ty < im.H; ty++) {
      const ay = ((r3neck.y + ty / ts) - artA.offset[1]) / artA.scale; // art A row
      const m = R3_TRIM * (1 - smooth((ay - 470) / 20)); if (m <= 0.01) continue;
      const mt = m * artA.scale * ts; // in texture px
      let l = -1, r = -1; for (let x = 0; x < im.W; x++) if (al[ty * im.W + x] > 128) { if (l < 0) l = x; r = x; } if (l < 0) continue;
      for (let x = 0; x < im.W; x++) { const i = ty * im.W + x; if (x < l + mt || x > r - mt) { if (al[i]) { al[i] = 0; trimmed++; } } }
    }
    const alS = await blur1(al, im.W, im.H, 1.5);
    for (let i = 0; i < im.W * im.H; i++) o[i * 4 + 3] = Math.min(im.d[i * 4 + 3], alS[i]);
    await sharp(o, { raw: { width: im.W, height: im.H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(r3File);
    const n1 = sha(r3File);
    if (clean['neck.png']) { clean['neck.png'].cleaned = n1; clean['neck.png'].trimmedBy = 'rebuild-neck.mjs'; fs.writeFileSync(cleanLog, JSON.stringify(clean, null, 1)); }
    globalThis.r3NeckRec = { before: n0, after: n1, trimmedPixels: trimmed, trimArtPx: R3_TRIM, rows: 'art A y < 470, fading to 0 by 490' };
    console.log('R3 neck trimmed:', trimmed, 'px');
  }
  if (!globalThis.r3NeckRec) globalThis.r3NeckRec = done.r3_neck;
}
fs.writeFileSync(log, JSON.stringify({ tool: 'rebuild-neck', neck_skin: { before: s0, after: sha(neckFile) }, r3_neck: globalThis.r3NeckRec, head_under: headUnder, head_skin: headSkinRec, linePixels, wispPixels, coverPixels, opaqueAdded, silhouette: 'r3 neck + head_skin, the right contour the mirror of the left about x 527.5, eroded 2 px, soft 1.5 px', edgeShadedPixels: edgeShaded, mirroredPixels: mirrored, grownPixels, underHairDarkenMax: 0.10, jaw: JAW }, null, 1));
console.log('neck skin rebuilt: collar lines', linePixels, 'px; hair tips taken out', wispPixels, 'px; skin under the hair continued', coverPixels, 'px; made opaque', opaqueAdded, 'px; cut below the jaw: head_under', headUnder.cut, 'px, head_skin', headSkinRec.cut, 'px; faded beside the cheeks and jaw: head_under', headUnder.sideFade, 'px, head_skin', headSkinRec.sideFade, 'px');
