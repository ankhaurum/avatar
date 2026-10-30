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
  const ml = def.mouthLine.map(P), mx0 = ml[0][0], mx1 = ml[ml.length - 1][0], mxc = (mx0 + mx1) / 2, mhw = (mx1 - mx0) / 2;
  const M = x => curveY(ml, x);
  const sOf = x => Math.max(-1, Math.min(1, (x - mxc) / mhw));
  // Four keyforms over MouthOpen x MouthForm, built from art A's closed mouth:
  // closed / open, neutral / smile (and at form -1 a troubled mouth: the
  // corners pulled down and a little out). The smile
  // pulls the corners out and up along a curve, so the closed smile is still a
  // closed line (both lips get the same offset on the mouth line).
  const formD = (x, form) => { const t = sOf(x), c = t * t, c4 = c * c; return form >= 0 ? [t * (3.5 + 5 * c) * s * form, (-4.5 * c - 3 * c4) * s * form] : [-Math.sign(t) * 3.5 * s * form * c, -9.5 * s * form * c]; };
  // opening: the upper lip rises a little (more in the middle when smiling), the jaw takes the lower lip down
  // near the corners the lips stay together (as in the smile), so no dark wedge shows at a corner
  const cornerShut = t => smooth((1 - Math.abs(t)) / 0.3);
  const openUpper = (x, open, form = 0) => { const t = sOf(x); return -(1.3 + 8 * Math.max(0, form)) * s * open * Math.pow(Math.max(0, 1 - t * t), 0.55) * cornerShut(t); };
  const openLower = (x, open, form = 0) => { const t = sOf(x); return (14 - 2 * Math.max(0, form)) * s * open * Math.pow(Math.max(0, 1 - t * t), 0.8) * cornerShut(t); };
  const mouthKey = { params: ['MouthOpen', 'MouthForm'], keys: [[0, 1], [-1, 0, 1]] };
  const upperN = (open, form) => (x, y) => { const f = formD(x, form), up = Math.max(0, Math.min(1, (M(x) - y) / (9 * s))); return [f[0], f[1] * (y > M(x) - 3 * s ? 1 : 0.6) + openUpper(x, open, form) * (1 - 0.7 * up * Math.max(0, form))]; };
  const lowerN = (open, form) => (x, y) => { const f = formD(x, form); const below = Math.max(0, Math.min(1, (y - M(x)) / (14 * s))); return [f[0] * (1 - below * 0.5), f[1] * (1 - below * 0.6) + openLower(x, open, form) * (1 - below * 0.15)]; };
  // Smile (form > 0): the lip edges are placed on the contours of Codex's
  // reference smile (studies/continuity/evidence/default-smile-close.png),
  // registered to art A by the two iris centres (scale 0.609, -0.7 deg). At
  // the default opening (REF_OPEN) the lips lie exactly on the reference;
  // with the mouth closed the same lips meet on one seam (each lip keeps its
  // shape and is moved to the seam), so the smile still closes fully. Each
  // lip vertex keeps its relative place between its outer edge and the seam.
  // The corners are set only a little above art A's own (about 1.2 px): the
  // reference's corner points lie at the far ends of its corner creases, and
  // lifting art A's crease that far bends it into a hook. The upper lip is
  // drawn 1.5 px fuller in the middle than the reference contour (art A's
  // upper lip is darker than the reference's, and compressed to the
  // reference's height it reads as a thin dark line).
  const REF_OPEN = 0.6;
  const ref = { cL: [485.9, 346.6], cR: [568.1, 339.3],
    utop: [[497.9, 341.7], [513.1, 337.5], [521.2, 336.4], [529.3, 337.3], [538.4, 335.1], [551.6, 336], [563.8, 336.9]],
    uin: [[492.8, 345.9], [503, 346.2], [518.2, 345.6], [529.4, 344.9], [543.6, 343.2], [558.8, 341]],
    lin: [[492.9, 349.4], [508.2, 354.3], [518.4, 355.7], [529.5, 355.6], [543.7, 352.4], [558.9, 347.1]],
    lbot: [[498.1, 360], [513.4, 368], [528.7, 369.3], [543.9, 366.6], [559, 357.3]] };
  const curveOf = pts => { const q = [ref.cL, ...pts, ref.cR].map(P); return x => curveY(q, x); };
  const utopR = curveOf(ref.utop);
  const R = { utop: x => utopR(x) - 1.5 * s * Math.max(0, 1 - sOf(x) ** 2), uin: curveOf(ref.uin), lin: curveOf(ref.lin), lbot: curveOf(ref.lbot) };
  const rcL = P(ref.cL), rcR = P(ref.cR);
  const lu = def.lipU.poly.map(P), ll = def.lipL.poly.map(P);
  // the lips' outer contours: from the recut (parts/lips-recut.json, per column of art A) when present, else the extraction polygons
  const recut = fs.existsSync(dir + '/../parts/lips-recut.json') ? JSON.parse(fs.readFileSync(dir + '/../parts/lips-recut.json')) : null;
  const Utop0 = recut ? (x => curveY(recut.top.map(P), x)) : (x => curveY(lu.slice(0, 11), x)), Lbot0 = recut ? (x => curveY(recut.bottom.map(P), x)) : (x => curveY([...ll.slice(10), ll[0]], x));
  const seamC = x => (R.uin(x) + R.lin(x)) / 2;
  const smileD = (open, lip) => (x, y) => {
    // beyond the corners the lip texture (the end of the crease) moves as one
    // piece with its corner: the same shift for every pixel there, whatever
    // its height, so nothing is squeezed onto one line and stuck out as a spike
    if (x < mx0 || x > mx1) { const X = x < mx0 ? rcL[0] : rcR[0], xx = x < mx0 ? mx0 : mx1; return [X - xx, seamC(X) - M(xx)]; }
    const xx = x;
    const u = (xx - mx0) / (mx1 - mx0), X = rcL[0] + u * (rcR[0] - rcL[0]);
    // the opening reaches almost to the corners, as in the reference (the
    // lips meet again over the last tenth of the mouth width); past the
    // reference opening the lower lip opens on a little further than
    // linearly (the lip rolls out), so the lower teeth can show
    const kk = open / REF_OPEN, k = (lip === 'l' ? kk + 0.6 * Math.max(0, kk - 1) ** 1.5 : kk) * smooth(Math.min(u, 1 - u) / 0.14), sm = seamC(X);
    let outer0, outerR, innerR;
    if (lip === 'u') { outer0 = Utop0(xx); innerR = R.uin(X); outerR = R.utop(X); }
    else { outer0 = Lbot0(xx); innerR = R.lin(X); outerR = R.lbot(X); }
    const inner = sm + (innerR - sm) * k, outer = outerR + (sm - innerR) * (1 - k);
    const den = M(xx) - outer0, v = Math.abs(den) < 0.8 * s ? (lip === 'u' ? (y < M(xx) ? 0 : 1) : (y > M(xx) ? 0 : 1)) : Math.max(-1.5, Math.min(2, (y - outer0) / den));
    return [X - xx, outer + v * (inner - outer) - y];
  };
  const mix = (a, b, w) => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  const upperD = (open, form) => (x, y) => form > 0 ? mix(upperN(open, 0)(x, y), smileD(open, 'u')(x, y), form) : upperN(open, form)(x, y);
  const lowerD = (open, form) => (x, y) => form > 0 ? mix(lowerN(open, 0)(x, y), smileD(open, 'l')(x, y), form) : lowerN(open, form)(x, y);
  // cavity: a strip between the lips' inner edges, zero height when closed
  const cols = 96, rows = 4, cav0 = P([478, 330]);
  const cavityMesh = (tw, th) => {
    const positions = [], triangles = [], uvPositions = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      // the cavity stops 7 % of the mouth width short of each corner (the recut lips end about 5 px inside the corners of the mouth line) (the lips are closed there anyway), so no dark sliver reaches the corner
      const x = mx0 + (mx1 - mx0) * (0.07 + 0.86 * i / cols), y = M(x) - 0.2 + 0.4 * j / rows;
      positions.push((x - cav0[0]) * tex, (y - cav0[1]) * tex);
      uvPositions.push(tw * (0.04 + 0.92 * i / cols), th * (0.08 + 0.84 * j / rows));
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i; triangles.push(a, a + 1, a + cols + 2, a, a + cols + 2, a + cols + 1); }
    return { positions, triangles, uvPositions };
  };
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
    const apart = Math.min(1, open * 4) * smooth((1 - Math.abs(t)) / 0.28);
    let top = M(x) + up[1] - 0.3 * s * apart, bottom = M(x) + lo[1] + 0.5 * s * apart;
    // the dark opening closes a little before the lip corners (the corners keep
    // art A's own lip line and no cavity shows beyond it)
    const taper = 1, c = (top + bottom) / 2;
    top = c + (top - c) * taper; bottom = c + (bottom - c) * taper;
    return [up[0] * (1 - v) + lo[0] * v, top + (bottom - top) * v - y];
  } };
  // mouth interior: the cavity and the tongue from Codex's rebuilt oral
  // materials (studies/continuity, see prepare-oral.mjs), the teeth from
  // ChatGPT's upper and lower jaws (tools/import-jaws.mjs, parts/oral/jaws.json).
  // All are clipped by the cavity between the lips' inner edges.
  const mxA = 527;
  const opart = (file, x, y, k = 1) => ({ file: 'oral/' + file, offset: P([x, y]), texScale: tex * k });
  await b.part('mouth_cavity', { ...opart('oral-cavity.png', 478, 330), parent, order: z + 88, mesh: cavityMesh, key: cavityKey });
  await b.part('mouth_cavity_mask', { ...opart('oral-cavity.png', 478, 330), parent, order: z + 88, maskOnly: true, mesh: cavityMesh, key: cavityKey });
  // the tongue's top edge 2 px below the mouth line, following the jaw
  const Ms = (() => { const n = ml.length; let A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0]; for (const [x, y] of ml) { const t = (x - mxc) / mhw, r = [1, t, t * t]; for (let i = 0; i < 3; i++) { v[i] += r[i] * y; for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; } } const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]); const D = det(A), c = [0, 1, 2].map(k => det(A.map((row, i) => row.map((e, j) => j === k ? v[i] : e))) / D); return x => { const t = (x - mxc) / mhw; return c[0] + c[1] * t + c[2] * t * t; }; })();
  const follow = (fnOf, k, top, rel) => ({ ...mouthKey, fn: (open, form) => (x) => { const d = fnOf(open, form)(Math.min(mx1, Math.max(mx0, x)), M(x)); return [d[0], d[1] * k + Ms(x) + rel * s - P([0, top])[1]]; } });
  // Teeth (ChatGPT's jaws, tools/import-jaws.mjs): each jaw is one piece,
  // never stretched, left-right symmetric in the head's own frame: both are
  // children of jaw_tilt, a rotation by the head's tilt in art A (the eye
  // line, -4.2 deg, the viewer's right up), so the row runs parallel to the
  // mouth and the gum line keeps the same distance from the upper lip across
  // the whole width. The upper row follows the lips, as in Live2D: its
  // incisal edge sits just under the seam when the lips part a little (so a
  // small opening shows the smooth tips, not the gum line), and goes down with
  // the lower lip's inner edge (80 %) until the crown top would come within
  // 2 px of the upper lip's inner edge (the gums stay under the lip whatever
  // the lip does); at the reference smile the incisors fill the opening. The
  // lower row hangs 1.5 px above the lower lip's inner edge, behind the upper
  // row: with a wide opening (vowels, surprise) the tips of the lower incisors
  // show, at the resting smile they are behind the upper teeth.
  const jaws = JSON.parse(fs.readFileSync(dir + '/../parts/oral/jaws.json'));
  const JU = jaws.jaws.upper, JL = jaws.jaws.lower, jt = jaws.texturePxPerArtPx;
  const TILT = Math.atan2(247.09 - 255.0, 578.9 - 472.03) * 180 / Math.PI; // art A iris centres
  b.rotation('jaw_tilt', parent, [mxc, M(mxc)], { params: ['MouthOpen'], keys: [[0, 1]], fn: () => ({ angle: TILT }) });
  const tipsRestA = (M(mxc) - tf.offset[1]) / s; // the incisal edges on the mouth line at rest
  const upperTopA = tipsRestA - JU.crownBottom / jt, upperLeftA = mxA - JU.centreX / jt;
  const lowerTopA = tipsRestA - JL.crownTop / jt, lowerLeftA = mxA - JL.centreX / jt;
  // the arch seen from the front: the teeth narrow toward the corners (the
  // reference smile shows the laterals at 0.75 and the canines at 0.35 of the
  // central incisors' width): x' = cx + (x - cx) (1 - 0.3 u^2), u = (x - cx) / half width
  const archX = x => { const u = (x - mxc) / (JU.widthArt / 2 * s); return -(x - mxc) * 0.3 * u * u; };
  const lipsAt = (open, form) => { const up = upperD(open, form)(mxc, M(mxc) - 0.05), lo = lowerD(open, form)(mxc, M(mxc) + 0.05); return { dx: up[0], upperIn: M(mxc) + up[1], lowerIn: M(mxc) + lo[1] }; };
  // the upper incisal edge stays about 2 px above the lower lip's inner edge at the smile, so the dark of the mouth shows under the teeth, as in the reference smile
  // the upper row: its crown tops 6 px above the upper lip's inner edge (the
  // gum line, the papillae and the shaded necks of the crowns under the lip),
  // so its incisal edge is 8 px under that edge when the mouth is open; with a small opening the row
  // follows the lower lip instead, its edge 0.6 px above the lower lip's inner
  // edge (the tips peep, no dark band). At the reference smile the lower lip's
  // inner edge lies just under the incisal edge, as in smile-local.png.
  // the teeth's keys: more MouthOpen keys than the lips (the rows follow a min() of two lip edges, which a 0 / 1 key pair would blend wrongly in between)
  const jawKey = { params: ['MouthOpen', 'MouthForm'], keys: [[0, 0.12, 0.25, 0.4, 0.55, 0.75, 1], [-1, 0, 1]] };
  const jawUpperKey = { ...jawKey, fn: (open, form) => { const L = lipsAt(open, form), tips = Math.min(L.upperIn + 8.0 * s, L.lowerIn - 0.6 * s); return (x, y) => [L.dx + archX(x), tips - M(mxc)]; } };
  // the lower row stays under the lower lip (1 px below its inner edge) and rises to peep 1.5 px above it only with a wide opening (vowels, surprise)
  const jawLowerKey = { ...jawKey, fn: (open, form) => { const L = lipsAt(open, form), tips = L.lowerIn + 1 * s - 2.5 * s * smooth((open - 0.72) / 0.28); return (x, y) => [L.dx + archX(x), tips - M(mxc)]; } };
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
  await b.part('mouth_tongue', { ...opart('tongue.png', mxA - 35, 348, 176 / 70), parent, order: z + 89.2, spacing: 3 * s, dilate: 1, mask: 'mouth_cavity_mask', key: follow(lowerD, 0.85, 348, 2) });
  await b.part('mouth_jaw_lower', { ...opart(path.basename(JL.file), lowerLeftA, lowerTopA, jt), parent: 'jaw_tilt', order: z + 89.3, spacing: 2.5 * s, dilate: 1, mask: 'mouth_cavity_mask', key: jawLowerKey });
  await b.part('mouth_jaw_upper', { ...opart(path.basename(JU.file), upperLeftA, upperTopA, jt), parent: 'jaw_tilt', order: z + 89.4, spacing: 2.5 * s, dilate: 1, mask: 'mouth_cavity_mask', key: jawUpperKey });
  // fine vertices all along the mouth line, so the seam and the inner edges bend smoothly
  const lipDetail = [{ x: mx0, y: M(mx0), r: 9 * s, spacing: 1.5 * s }, { x: mx1, y: M(mx1), r: 9 * s, spacing: 1.5 * s }];
  for (let x = mx0 + 4 * s; x < mx1; x += 4 * s) lipDetail.push({ x, y: M(x), r: 5 * s, spacing: 1.4 * s });
  await b.part('lip_lower', { file: 'lip_lower.png', offset: off('lip_lower'), texScale: tex, parent, order: z + 91, spacing: 4 * s, dilate: 2, detail: lipDetail, key: { ...mouthKey, fn: lowerD } });
  await b.part('lip_upper', { file: 'lip_upper.png', offset: off('lip_upper'), texScale: tex, parent, order: z + 91.1, spacing: 4 * s, dilate: 2, detail: lipDetail, key: { ...mouthKey, fn: upperD } });
  return { M, mx0, mx1, mxc, openLower, s };
}
