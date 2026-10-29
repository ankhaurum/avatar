// Face rig for Hibiki. Eyes (white, iris, upper/lower lash), brows and lips are
// cut from approved art A and placed on the R3 head by a similarity transform
// (art A px -> rig units) that matches the eye and mouth centres. Closing the
// eye bends the upper lash mesh down onto the lower lid; no closed-eye line is
// drawn. The iris is clipped by the white of the eye, teeth and tongue (R3) by
// the mouth cavity.
import fs from 'node:fs';
import { curveY, smooth } from './rig-builder.mjs';

export async function buildFace(b, { parent, z, dir, tf, r3 }) {
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
    const open = e.def.open.map(P);
    const upper = open.slice(0, 12), lower = [open[11], ...open.slice(12), open[0]];
    const U = x => curveY(upper, x), L0 = x => curveY(lower, x);
    const xs = open.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), xc = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    const bump = x => { const t = (x - xc) / hw; return Math.max(0, 1 - t * t); };
    // smiling raises the lower lid; the closing line lies on it, so the closed
    // lashes meet with no gap, also when smiling
    const Lw = (x, smile) => L0(x) - 2.2 * s * smile * bump(x);
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
    await b.part('eye_iris_' + e.id, {
      file: n('eye_iris') + '.png', offset: off(n('eye_iris')), texScale: tex, parent, order: z + zOf.iris, spacing: 4 * s, dilate: 1, mask: 'eye_white_mask_' + e.id,
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
    const poly = def['brow' + e.a].poly.map(P), cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const inner = e.id === 'R' ? 1 : -1; // inner end of the brow faces the nose
    await b.part('brow_' + e.id, {
      file: n('brow') + '.png', offset: off(n('brow')), texScale: tex, parent, order: z + zOf.brow, spacing: 6 * s, dilate: 2,
      key: { params: ['BrowY', 'BrowAngle'], keys: [[-1, 0, 1], [-1, 0, 1]], fn: (by, ba) => (x) => [0, (-by * 3 + ba * (x - cx) * inner / s * 0.09) * s] }
    });
  }
  // mouth
  const ml = def.mouthLine.map(P), mx0 = ml[0][0], mx1 = ml[ml.length - 1][0], mxc = (mx0 + mx1) / 2, mhw = (mx1 - mx0) / 2;
  const M = x => curveY(ml, x);
  const sOf = x => Math.max(-1, Math.min(1, (x - mxc) / mhw));
  // Four keyforms over MouthOpen x MouthForm, built from art A's closed mouth:
  // closed / open, neutral / smile (and a slight frown at form -1). The smile
  // pulls the corners out and up along a curve, so the closed smile is still a
  // closed line (both lips get the same offset on the mouth line).
  const formD = (x, form) => { const t = sOf(x), c = t * t, c4 = c * c; return form >= 0 ? [Math.sign(t) * 3.2 * s * form * c, (-6.5 * c4 - 0.8 * c) * s * form] : [Math.sign(t) * 0.6 * s * form * c, -2.6 * s * form * c]; };
  // opening: the upper lip rises a little (more in the middle when smiling), the jaw takes the lower lip down
  const openUpper = (x, open, form = 0) => { const t = sOf(x); return -(1.3 + 1.2 * Math.max(0, form)) * s * open * (1 - t * t); };
  const openLower = (x, open, form = 0) => { const t = sOf(x); return (14 - 3 * Math.max(0, form)) * s * open * Math.pow(Math.max(0, 1 - t * t), 0.8); };
  const mouthKey = { params: ['MouthOpen', 'MouthForm'], keys: [[0, 1], [-1, 0, 1]] };
  const upperD = (open, form) => (x, y) => { const f = formD(x, form); return [f[0], f[1] * (y > M(x) - 3 * s ? 1 : 0.6) + openUpper(x, open, form)]; };
  const lowerD = (open, form) => (x, y) => { const f = formD(x, form); const below = Math.max(0, Math.min(1, (y - M(x)) / (14 * s))); return [f[0] * (1 - below * 0.5), f[1] * (1 - below * 0.6) + openLower(x, open, form) * (1 - below * 0.15)]; };
  // cavity: a strip between the lips' inner edges, zero height when closed
  const cols = 24, rows = 4, cav0 = P([478, 330]);
  const cavityMesh = (tw, th) => {
    const positions = [], triangles = [], uvPositions = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const x = mx0 + (mx1 - mx0) * i / cols, y = M(x) - 0.2 + 0.4 * j / rows;
      positions.push((x - cav0[0]) * tex, (y - cav0[1]) * tex);
      uvPositions.push(tw * (0.04 + 0.92 * i / cols), th * (0.08 + 0.84 * j / rows));
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i; triangles.push(a, a + 1, a + cols + 2, a, a + cols + 2, a + cols + 1); }
    return { positions, triangles, uvPositions };
  };
  const cavityKey = { ...mouthKey, fn: (open, form) => (x, y) => {
    const v = (y - (M(x) - 0.2)) / 0.4;
    const up = upperD(open, form)(x, M(x) - 0.05), lo = lowerD(open, form)(x, M(x) + 0.05);
    // zero height when closed (also when smiling), a little past the lip edges when open
    const top = M(x) + up[1] - 0.5 * s * open, bottom = M(x) + lo[1] + 0.5 * s * open;
    return [up[0] * (1 - v) + lo[0] * v, top + (bottom - top) * v - y];
  } };
  // mouth interior: the cavity, upper teeth and tongue Codex painted for art A
  // (v3/artwork/split-e, FACE_mouth_*), in art A px. The upper teeth ride on
  // the upper lip, the tongue on the jaw; both are clipped by the cavity.
  const oral = { FACE_mouth_cavity: [478, 330], FACE_mouth_teeth_upper: [495, 341], FACE_mouth_tongue: [499, 347] };
  const opart = id => ({ file: 'oral/' + id + '.png', offset: P(oral[id]), texScale: tex });
  await b.part('mouth_cavity', { ...opart('FACE_mouth_cavity'), parent, order: z + 88, mesh: cavityMesh, key: cavityKey });
  await b.part('mouth_cavity_mask', { ...opart('FACE_mouth_cavity'), parent, order: z + 88, maskOnly: true, mesh: cavityMesh, key: cavityKey });
  // Codex painted them level; art A's mouth line rises to the viewer's right, so
  // each column is set on the mouth line: the teeth's top edge 2.5 px above it
  // (under the upper lip), the tongue's top edge 3 px below it.
  const follow = (fnOf, k, top, rel) => ({ ...mouthKey, fn: (open, form) => (x) => { const d = fnOf(open, form)(x, M(x)); return [d[0], d[1] * k + M(x) + rel * s - P([0, top])[1]]; } });
  await b.part('mouth_teeth_upper', { ...opart('FACE_mouth_teeth_upper'), parent, order: z + 89, spacing: 2 * s, dilate: 1, mask: 'mouth_cavity_mask', key: follow(upperD, 1, 342, -2.5) });
  await b.part('mouth_tongue', { ...opart('FACE_mouth_tongue'), parent, order: z + 89.2, spacing: 2 * s, dilate: 1, mask: 'mouth_cavity_mask', key: follow(lowerD, 0.85, 348, 3) });
  const lipDetail = [{ x: mx0, y: M(mx0), r: 9 * s, spacing: 1.5 * s }, { x: mx1, y: M(mx1), r: 9 * s, spacing: 1.5 * s }];
  await b.part('lip_lower', { file: 'lip_lower.png', offset: off('lip_lower'), texScale: tex, parent, order: z + 91, spacing: 4 * s, dilate: 2, detail: lipDetail, key: { ...mouthKey, fn: lowerD } });
  await b.part('lip_upper', { file: 'lip_upper.png', offset: off('lip_upper'), texScale: tex, parent, order: z + 91.1, spacing: 4 * s, dilate: 2, detail: lipDetail, key: { ...mouthKey, fn: upperD } });
  return { M, mx0, mx1, mxc, openLower, s };
}
