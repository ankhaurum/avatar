// Face rig for Hibiki. Eyes (white, iris, upper/lower lash), brows and lips are
// cut from approved art A and placed on the R3 head by a similarity transform
// (art A px -> rig units) that matches the eye and mouth centres. Closing the
// eye bends the upper lash mesh down onto the lower lid; no closed-eye line is
// drawn. The iris is clipped by the white of the eye, teeth and tongue (R3) by
// the mouth cavity.
import fs from 'node:fs';
import path from 'node:path';
import { curveY, smooth } from './rig-builder.mjs';

export async function buildFace(b, { parent: base, parents = {}, z, dir, tf, r3 }) {
  const def = JSON.parse(fs.readFileSync(dir + '/face-def.json'));
  const meta = JSON.parse(fs.readFileSync(dir + '/../parts/meta.json'));
  const s = tf.scale, P = ([x, y]) => [tf.offset[0] + x * s, tf.offset[1] + y * s];
  const off = n => P([meta[n].x, meta[n].y]);
  const tex = 1 / s; // texture px per unit for art A parts

  b.param('EyeLOpen', 0, 1, 1, '左目の開き');
  b.param('EyeROpen', 0, 1, 1, '右目の開き');
  b.param('EyeSmile', 0, 1, 0, '目の笑い');
  b.param('EyeBallX', -1, 1, 0, '視線 左右');
  b.param('EyeBallY', -1, 1, 0, '視線 上下');
  b.param('BrowY', -1, 1, 0, '眉 上下');
  b.param('BrowAngle', -1, 1, 0, '眉 角度');
  b.param('MouthOpen', 0, 1, 0, '口の開き');
  b.param('MouthForm', -1, 1, 0, '口の形');

  // Art A naming is viewer-side (L = viewer left); the rig uses the character's
  // side like R3 (R = viewer left).
  const sides = [{ a: 'L', id: 'R', def: def.eyeL, param: 'EyeROpen' }, { a: 'R', id: 'L', def: def.eyeR, param: 'EyeLOpen' }];
  const zOf = { white: 85, iris: 86, lower: 87, upper: 87.2, brow: 88 };
  for (const e of sides) {
    let parent = parents['eye' + e.id] || base;
    const open = e.def.open.map(P);
    const upper = open.slice(0, 12), lower = [open[11], ...open.slice(12), open[0]];
    const U = x => curveY(upper, x), L0 = x => curveY(lower, x);
    const xs = open.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), xc = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    const bump = x => { const t = (x - xc) / hw; return Math.max(0, 1 - t * t); };
    // smiling raises the lower lid; the closing line lies on it, so the closed
    // lashes meet with no gap, also when smiling
    const Lw = (x, smile) => L0(x) - 3.4 * s * smile * bump(x);
    const C = (x, smile) => Lw(x, smile) - 0.3 * s;
    const lidTop = (x, t, smile) => C(x, smile) + (U(x) - C(x, smile)) * t;
    const key = { params: [e.param, 'EyeSmile'], keys: [[0, 0.5, 1], [0, 1]] };
    const ease = t => smooth(t) * 0.35 + t * 0.65;
    const corners = [{ x: x0, y: L0(x0), r: 6 * s, spacing: 1.2 * s }, { x: x1, y: L0(x1), r: 6 * s, spacing: 1.2 * s }];
    // the white closes to zero height on the lower lid, corner to corner
    const whiteFn = (t, smile) => (x, y) => {
      const u = U(x), l = L0(x), r = (y - u) / Math.max(0.5 * s, l - u);
      const bottom = Lw(x, smile), top = bottom + (u - bottom) * ease(t);
      return [0, top + r * (bottom - top) - y];
    };
    const n = side => side + '_' + e.a;
    await b.part('eye_white_' + e.id, { file: n('eye_white') + '.png', offset: off(n('eye_white')), texScale: tex, parent, order: z + zOf.white, spacing: 3 * s, dilate: 1, detail: corners, key: { ...key, fn: whiteFn } });
    await b.part('eye_white_mask_' + e.id, { file: n('eye_white') + '.png', offset: off(n('eye_white')), texScale: tex, parent, order: z + zOf.white, maskOnly: true, spacing: 3 * s, dilate: 1, detail: corners, key: { ...key, fn: whiteFn } });
    // the iris keeps its round shape when the eye opens wide (it is clipped by the widened white)
    await b.part('eye_iris_' + e.id, {
      file: n('eye_iris') + '.png', offset: off(n('eye_iris')), texScale: tex, parent: parents['iris' + e.id] || parent, order: z + zOf.iris, spacing: 4 * s, dilate: 1, mask: 'eye_white_mask_' + e.id,
      key: { params: ['EyeBallX', 'EyeBallY'], keys: [[-1, 0, 1], [-1, 0, 1]], fn: (gx, gy) => () => [gx * 5.5 * s, gy * 2.6 * s] }
    });
    await b.part('eyelash_lower_' + e.id, {
      file: n('eye_lash_lower') + '.png', offset: off(n('eye_lash_lower')), texScale: tex, parent, order: z + zOf.lower, spacing: 4 * s, dilate: 2,
      key: { ...key, fn: (t, smile) => (x, y) => [0, (Lw(x, smile) - L0(x)) * (y < L0(x) + 3 * s ? 1 : 0.7) - (1 - t) * 0.5 * s] }
    });
    // upper lash: bent down so its lower edge lies on the closing line. The
    // closing travel is averaged along the lid (+-4 px of art A) and fades out
    // along the eyeliner wing beyond the corners, so the lid closes in one
    // smooth curve and its ends lie on the ends of the lower lash.
    // near a corner and beyond it the lid moves as it does 5 px inside the corner
    const cl = x => Math.min(x1 - 5 * s, Math.max(x0 + 5 * s, x));
    const travel = (x, tt, smile) => lidTop(cl(x), tt, smile) - U(cl(x));
    const wing = 20 * s;
    const travelS = (x, tt, smile) => {
      let a = 0; for (let k = -4; k <= 4; k++) a += travel(x + k * s, tt, smile);
      const out = x < x0 ? (x0 - x) / wing : x > x1 ? (x - x1) / wing : 0;
      return a / 9 * (1 - smooth(out));
    };
    await b.part('eyelash_upper_' + e.id, {
      file: n('eye_lash_upper') + '.png', offset: off(n('eye_lash_upper')), texScale: tex, parent, order: z + zOf.upper, spacing: 3 * s, dilate: 3,
      detail: [{ x: x0, y: U(x0), r: 14 * s, spacing: 1 * s }, { x: x1, y: U(x1), r: 14 * s, spacing: 1 * s }],
      key: { ...key, fn: (t, smile) => (x, y) => {
        const d = y - U(Math.min(x1, Math.max(x0, x))), tt = ease(t);
        return [0, travelS(x, tt, smile) + d * (0.25 * tt - 0.25)];
      } }
    });
    parent = parents['brow' + e.id] || base;
    const poly = def['brow' + e.a].poly.map(P), cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const inner = e.id === 'R' ? 1 : -1; // inner end of the brow faces the nose
    await b.part('brow_' + e.id, {
      file: n('brow') + '.png', offset: off(n('brow')), texScale: tex, parent, order: z + zOf.brow, spacing: 6 * s, dilate: 2,
      key: { params: ['BrowY', 'BrowAngle'], keys: [[-1, 0, 1], [-1, 0, 1]], fn: (by, ba) => (x) => [0, (-by * 3 + ba * (x - cx) * inner / s * 0.09) * s] }
    });
  }
  // mouth
  const parent = parents.mouth || base;
  // the lips: ChatGPT's independent lips when imported (parts/lips-import.json, tools/import-lips.mjs: their seam is the mouth line), else art A's cut
  const lipsImp = fs.existsSync(dir + '/../parts/lips-import.json') ? JSON.parse(fs.readFileSync(dir + '/../parts/lips-import.json')) : null;
  const ml = (lipsImp ? [lipsImp.corners[0], ...lipsImp.seam.filter(p => p[0] > lipsImp.corners[0][0] + 1 && p[0] < lipsImp.corners[1][0] - 1), lipsImp.corners[1]] : def.mouthLine).map(P), mx0 = ml[0][0], mx1 = ml[ml.length - 1][0], mxc = (mx0 + mx1) / 2, mhw = (mx1 - mx0) / 2;
  const M = x => curveY(ml, x);
  const sOf = x => Math.max(-1, Math.min(1, (x - mxc) / mhw));
  // Four keyforms over MouthOpen x MouthForm, built from art A's closed mouth:
  // closed / open, neutral / smile (and at form -1 a troubled mouth: the
  // corners pulled down and a little out). The smile
  // pulls the corners out and up along a curve, so the closed smile is still a
  // closed line (both lips get the same offset on the mouth line).
  // (smile: the corners 3 px out and 2.5 px up at most; art A's mouth is already a slight smile)
  const formD = (x, form) => { const t = sOf(x), c = t * t, c4 = c * c; return form >= 0 ? [t * (1.5 + 1.5 * c) * s * form, (-1.5 * c - 1.0 * c4) * s * form] : [-Math.sign(t) * 3.5 * s * form * c, -9.5 * s * form * c]; };
  // opening: the upper lip rises a little (more in the middle when smiling), the jaw takes the lower lip down
  // near the corners the lips stay together: the opening fades out from 55 % of
  // the half width and is closed from 80 % on (the preview's lips meet over the
  // outer 30 %), so no dark wedge runs out to a corner
  const cornerShut = t => smooth((0.8 - Math.abs(t)) / 0.25);
  const openUpper = (x, open, form = 0) => { const t = sOf(x); return -(1.3 + 8 * Math.max(0, form)) * s * open * Math.pow(Math.max(0, 1 - t * t), 0.55) * cornerShut(t); };
  const openLower = (x, open, form = 0) => { const t = sOf(x); return (14 - 2 * Math.max(0, form)) * s * open * Math.pow(Math.max(0, 1 - t * t), 0.8) * cornerShut(t); };
  const mouthKey = { params: ['MouthOpen', 'MouthForm'], keys: [[0, 1], [-1, 0, 1]] };
  const upperN = (open, form) => (x, y) => { const f = formD(x, form), up = Math.max(0, Math.min(1, (M(x) - y) / (9 * s))); return [f[0], f[1] * (y > M(x) - 3 * s ? 1 : 0.6) + openUpper(x, open, form) * (1 - 0.4 * up * Math.max(0, form))]; };
  const lowerN = (open, form) => (x, y) => { const f = formD(x, form); const below = Math.max(0, Math.min(1, (y - M(x)) / (14 * s))); return [f[0] * (1 - below * 0.5), f[1] * (1 - below * 0.6) + openLower(x, open, form) * (1 - below * 0.15)]; };
  // The lips are the imported material, undistorted (one uniform scale, see
  // tools/import-lips.mjs): no keyform presses them onto another contour. The
  // smile is only the corners' lift (formD) and the opening (openUpper /
  // openLower), so the lips keep their drawn thickness and detail at every
  // opening. (The earlier smile mapped the lips onto the traced contours of
  // Codex's reference photo, which squeezed and blurred them.)
  const upperD = upperN, lowerD = lowerN;
  const recut = lipsImp;
  // cavity: a strip between the lips' inner edges, zero height when closed
  const cols = 96, rows = 4, cav0 = P([478, 330]);
  const cavityMeshUV = (u0, u1, v0, v1) => (tw, th) => {
    const positions = [], triangles = [], uvPositions = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      // the cavity reaches to 1.5 % of the mouth width from each corner: where the lips part near a corner the dark of the mouth shows between them, as in the preview, not the skin; at the corner itself the lips meet and the strip has no height
      const x = mx0 + (mx1 - mx0) * (0.015 + 0.97 * i / cols), y = M(x) - 0.2 + 0.4 * j / rows;
      positions.push((x - cav0[0]) * tex, (y - cav0[1]) * tex);
      uvPositions.push(tw * (u0 + (u1 - u0) * i / cols), th * (v0 + (v1 - v0) * j / rows));
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i; triangles.push(a, a + 1, a + cols + 2, a, a + cols + 2, a + cols + 1); }
    return { positions, triangles, uvPositions };
  };
  const cavityMesh = cavityMeshUV(0.04, 0.96, 0.08, 0.92);
  const cavityKey = { ...mouthKey, fn: (open, form) => (x, y) => {
    const v = (y - (M(x) - 0.2)) / 0.4;
    const up = upperD(open, form)(x, M(x) - 0.05), lo = lowerD(open, form)(x, M(x) + 0.05);
    // the opening between the lips' inner edges: zero height when closed (also
    // when smiling), and at the corners it ends exactly where the lips meet, so
    // nothing dark shows outside them. Only in the middle it reaches 1 px under
    // the lower lip's inner edge (the lip covers that strip).
    const t = sOf(x), mid = Math.max(0, 1 - t * t * t * t);
    // edges 1 px under each lip (the lips' soft inner edges cover them), only
    // where the lips are apart (none in the closed quarter at each corner)
    const apart = Math.min(1, open * 4) * smooth((0.8 - Math.abs(t)) / 0.25);
    let top = M(x) + up[1] - 0.3 * s * apart, bottom = M(x) + lo[1] + 0.5 * s * apart;
    // the dark opening closes a little before the lip corners (the corners keep
    // art A's own lip line and no cavity shows beyond it)
    const taper = 1, c = (top + bottom) / 2;
    top = c + (top - c) * taper; bottom = c + (bottom - c) * taper;
    return [up[0] * (1 - v) + lo[0] * v, top + (bottom - top) * v - y];
  } };
  // mouth interior: Codex's set of the cavity, the tongue and the two jaws on
  // one canvas (tools/import-oral.mjs, parts/oral/oral.json), at one scale.
  // All are clipped by the cavity between the lips' inner edges.
  const oral = JSON.parse(fs.readFileSync(dir + '/../parts/oral/oral.json'));
  const mxA = (mxc - tf.offset[0]) / s; // the rows and the tongue centred on the mouth
  const opart = (file, x, y, k = 1) => ({ file: 'oral/' + file, offset: P([x, y]), texScale: tex * k });
  // the strip between the lips maps the middle band of the cavity (its dark
  // hole with the inner lips' red at the ends); the texture is opaque (flattened
  // onto its rim colour), so the same mesh is the mask of the teeth and tongue
  const cavityMeshC = cavityMeshUV(0.04, 0.96, 0.22, 0.78);
  await b.part('mouth_cavity', { ...opart('cavity.png', 478, 330), parent, order: z + 88, mesh: cavityMeshC, key: cavityKey });
  await b.part('mouth_cavity_mask', { ...opart('cavity.png', 478, 330), parent, order: z + 88, maskOnly: true, mesh: cavityMeshC, key: cavityKey });
  // Teeth (Codex's jaws, tools/import-oral.mjs): each jaw is one piece,
  // never stretched, left-right symmetric in the head's own frame: both are
  // children of jaw_tilt, a rotation to the mouth's own corner line (about
  // -5.2 deg, the viewer's right up), so the row runs parallel to the mouth,
  // symmetric to it, and the gum line keeps the same distance from the upper
  // lip across the whole width. The upper row follows the lips, as in Live2D: its
  // incisal edge sits just under the seam when the lips part a little (so a
  // small opening shows the smooth tips, not the gum line), and goes down with
  // the lower lip's inner edge (80 %) until the crown top would come within
  // 2 px of the upper lip's inner edge (the gums stay under the lip whatever
  // the lip does); at the reference smile the incisors fill the opening. The
  // lower row hangs 1.5 px above the lower lip's inner edge, behind the upper
  // row: with a wide opening (vowels, surprise) the tips of the lower incisors
  // show, at the resting smile they are behind the upper teeth.
  const JU = oral.jaws.upper, JL = oral.jaws.lower, jt = oral.texturePxPerArtPx;
  const TILT = Math.atan2(ml[ml.length - 1][1] - ml[0][1], ml[ml.length - 1][0] - ml[0][0]) * 180 / Math.PI; // the mouth's corner line
  b.rotation('jaw_tilt', parent, [mxc, M(mxc)], { params: ['MouthOpen'], keys: [[0, 1]], fn: () => ({ angle: TILT }) });
  const tipsRestA = (M(mxc) - tf.offset[1]) / s; // the incisal edges on the mouth line at rest
  const upperTopA = tipsRestA - JU.crownBottom / jt, upperLeftA = mxA - JU.centreX / jt;
  const lowerTopA = tipsRestA - JL.crownTop / jt, lowerLeftA = mxA - JL.centreX / jt;
  // the arch: the set is drawn for the mouth's width, with its own front-view
  // arch (the side teeth narrow and turn away, the ends under the corners), so
  // the rows are placed as drawn, not narrowed
  const archX = () => 0;
  // the lips' inner edges at the mouth's centre, as the rig draws them: the lips
  // are keyed at MouthOpen 0 and 1 only (linear between), so the teeth, keyed
  // more finely, take the same linear blend of the two ends, not the lip
  // functions' own curve, or the rows would sit off the lips between the keys
  const lipsAtEnd = (open, form) => { const up = upperD(open, form)(mxc, M(mxc) - 0.05), lo = lowerD(open, form)(mxc, M(mxc) + 0.05); return { dx: up[0], upperIn: M(mxc) + up[1], lowerIn: M(mxc) + lo[1] }; };
  const lipsAt = (open, form) => { const a = lipsAtEnd(0, form), b = lipsAtEnd(1, form), l = (p, q) => p + (q - p) * open; return { dx: l(a.dx, b.dx), upperIn: l(a.upperIn, b.upperIn), lowerIn: l(a.lowerIn, b.lowerIn) }; };
  // the upper incisal edge stays about 2 px above the lower lip's inner edge at the smile, so the dark of the mouth shows under the teeth, as in the reference smile
  // the upper row: its crown tops COVER px above the upper lip's inner edge (the
  // gum line, the papillae and the lower necks of the lateral incisors under the
  // lip), so its incisal edge is crown height - COVER under that edge when the mouth is open; with a small opening the row
  // follows the lower lip instead, its edge 0.3 px above the lower lip's inner
  // edge (1.2 px above the lip's drawn edge): as in the preview, a slight dark
  // gap under the tips, in which the lower incisors' edges show as a thin row (the lower row, below). At the reference smile the lower lip's
  // inner edge lies just under the incisal edge, as in smile-local.png.
  // the teeth's keys: more MouthOpen keys than the lips (the rows follow a min() of two lip edges, which a 0 / 1 key pair would blend wrongly in between)
  const jawKey = { params: ['MouthOpen', 'MouthForm'], keys: [[0, 0.12, 0.25, 0.4, 0.55, 0.75, 1], [-1, 0, 1]] };
  // the crown height hidden under the upper lip comes from the set itself: how
  // far the gum reaches below the central incisors' crown top along the row
  // (the 90th percentile over the columns: the side teeth's necks and most
  // papillae; a few deeper gum wedges between the teeth stay visible, as in the preview) plus 1 px
  // for the lip's soft edge, so no gum shows at any opening; the lip's edge
  // lies at the gum line, as in the preview, and the crowns show almost whole
  const COVER = JU.gumDepthArt + 1;
  const jawUpperKey = { ...jawKey, fn: (open, form) => { const L = lipsAt(open, form), tips = Math.min(L.upperIn + (JU.crownHeightArt - COVER) * s, L.lowerIn - 0.3 * s); return (x, y) => [L.dx + archX(x), tips - M(mxc)]; } };
  // the lower row: its incisors' edges 0.2 px under the lower lip's inner edge, 0.7 px above the lip's drawn edge (a thin row under the upper tips, as in the preview), rising by 2 px more with a wide opening (vowels, surprise). The row is bent down toward its ends (2.5 px at the ends, as the lower arch turns down and away in perspective), so its canines, 3 px taller than its incisors, do not stand up at the sides where the lower lip's edge rises toward the corners
  const lowArchY = x => { const u = (x - mxc) / (JL.rowWidthArt / 2 * s); return 2.5 * s * u * u; };
  const jawLowerKey = { ...jawKey, fn: (open, form) => { const L = lipsAt(open, form), tips = L.lowerIn + 0.2 * s - 2 * s * smooth((open - 0.72) / 0.28); return (x, y) => [L.dx + archX(x), tips - M(mxc) + lowArchY(x)]; } };
  if (!lipsImp) {
  // the corners: a small soft shadow (the mouth's depth) at each corner, moving with it; it replaces the crease that was drawn beyond the corners (taken out of the skin by recut-lips)
  {
    const cw = 8, chh = 5, buf = Buffer.alloc(cw * chh * 4);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) { const u = (x + 0.5 - cw / 2) / (cw / 2), v = (y + 0.5 - chh / 2) / (chh / 2), r = Math.sqrt(u * u + v * v), a = Math.max(0, 1 - r) ** 1.8 * 0.22; const i = (y * cw + x) * 4; buf[i] = 118; buf[i + 1] = 58; buf[i + 2] = 60; buf[i + 3] = Math.round(255 * a); }
    await (await import('sharp')).default(buf, { raw: { width: cw, height: chh, channels: 4 } }).png().toFile(dir + '/../parts/oral/corner-shadow.png');
    for (const [id, c, sideSign] of [['R', recut ? recut.corners[0] : def.mouthLine[0], -1], ['L', recut ? recut.corners[1] : def.mouthLine[def.mouthLine.length - 1], 1]]) {
      const cx = c[0] - sideSign * 1.0, cy = c[1]; // just inside the corner
      await b.part('mouth_corner_' + id, { file: 'oral/corner-shadow.png', offset: P([cx - cw / 2, cy - chh / 2]), texScale: tex, parent, order: z + 90.5, spacing: 3 * s, dilate: 0,
        key: { ...mouthKey, fn: (open, form) => { const d = upperD(open, form)(P([c[0], c[1]])[0] + sideSign * 0.01, P([c[0], c[1]])[1] - 0.3); return () => [d[0], d[1]]; } } });
    }
  }
  }
  // the depth of the mouth toward the corners: the side teeth turn away and
  // sink into the shadow of the cheeks (a real smile shows 6-8 teeth in the
  // light); a shade on the cavity's own mesh, transparent in the middle and
  // dark from 55 % of the half width outward, drawn over the teeth
  {
    const sw = 180, sh = 100, buf = Buffer.alloc(sw * sh * 4);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const u = Math.abs((x + 0.5) / sw * 2 - 1) / 0.92, a = Math.min(1, Math.max(0, (u - 0.55) / 0.42)); const i = (y * sw + x) * 4; buf[i] = 48; buf[i + 1] = 18; buf[i + 2] = 20; buf[i + 3] = Math.round(255 * a * a * 0.92); }
    await (await import('sharp')).default(buf, { raw: { width: sw, height: sh, channels: 4 } }).png().toFile(dir + '/../parts/oral/mouth-shade.png');
    await b.part('mouth_shade', { ...opart('mouth-shade.png', 478, 330), parent, order: z + 89.6, mesh: cavityMesh, key: cavityKey });
  }
  // the tongue: behind the lower row, its tip 1.5 px under the lower lip's
  // inner edge (hidden) and, with a wide opening (vowels, surprise), rising to
  // 2 px above the lower incisors' edges, so the floor of the mouth shows pink
  // under the dark cavity; keyed like the rows, tilted with them
  const TG = oral.tongue, tgTop = 348;
  const tongueKey = { ...jawKey, fn: (open, form) => { const L = lipsAt(open, form), top = L.lowerIn + 1.5 * s - 5 * s * smooth((open - 0.6) / 0.4); return () => [L.dx, top - P([0, tgTop])[1]]; } };
  await b.part('mouth_tongue', { ...opart(path.basename(TG.file), mxA - TG.centreX / jt, tgTop - TG.topY / jt, jt), parent: 'jaw_tilt', order: z + 89.2, spacing: 3 * s, dilate: 1, mask: 'mouth_cavity_mask', key: tongueKey });
  await b.part('mouth_jaw_lower', { ...opart(path.basename(JL.file), lowerLeftA, lowerTopA, jt), parent: 'jaw_tilt', order: z + 89.3, spacing: 2.5 * s, dilate: 1, mask: 'mouth_cavity_mask', key: jawLowerKey });
  await b.part('mouth_jaw_upper', { ...opart(path.basename(JU.file), upperLeftA, upperTopA, jt), parent: 'jaw_tilt', order: z + 89.4, spacing: 2.5 * s, dilate: 1, mask: 'mouth_cavity_mask', key: jawUpperKey });
  // fine vertices all along the mouth line, so the seam and the inner edges bend smoothly
  const lipDetail = [{ x: mx0, y: M(mx0), r: 9 * s, spacing: 1.5 * s }, { x: mx1, y: M(mx1), r: 9 * s, spacing: 1.5 * s }];
  for (let x = mx0 + 4 * s; x < mx1; x += 4 * s) lipDetail.push({ x, y: M(x), r: 5 * s, spacing: 1.4 * s });
  await b.part('lip_lower', { file: 'lip_lower.png', offset: off('lip_lower'), texScale: tex * (meta.lip_lower.texPerArt || 1), parent, order: z + 91, spacing: 4 * s, dilate: 2, detail: lipDetail, key: { ...mouthKey, fn: lowerD } });
  await b.part('lip_upper', { file: 'lip_upper.png', offset: off('lip_upper'), texScale: tex * (meta.lip_upper.texPerArt || 1), parent, order: z + 91.1, spacing: 4 * s, dilate: 2, detail: lipDetail, key: { ...mouthKey, fn: upperD } });
  return { M, mx0, mx1, mxc, openLower, s };
}
