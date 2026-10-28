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
    // smiling raises the lower lid; the closing line sits just above it
    const Lw = (x, smile) => L0(x) - 2.2 * s * smile * bump(x);
    const C = (x, smile) => Lw(x, smile) - 0.8 * s - 1.6 * s * smile * bump(x);
    const lidTop = (x, t, smile) => C(x, smile) + (U(x) - C(x, smile)) * t;
    const key = { params: [e.param, 'EyeSmile'], keys: [[0, 0.5, 1], [0, 1]] };
    const ease = t => smooth(t) * 0.35 + t * 0.65;
    const corners = [{ x: x0, y: L0(x0), r: 6 * s, spacing: 1.2 * s }, { x: x1, y: L0(x1), r: 6 * s, spacing: 1.2 * s }];
    const whiteFn = (t, smile) => (x, y) => {
      const u = U(x), l = L0(x), r = (y - u) / Math.max(0.5 * s, l - u);
      const top = lidTop(x, ease(t), smile), bottom = Lw(x, smile);
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
    // upper lash: bent down so its lower edge lies on the closing line
    await b.part('eyelash_upper_' + e.id, {
      file: n('eye_lash_upper') + '.png', offset: off(n('eye_lash_upper')), texScale: tex, parent, order: z + zOf.upper, spacing: 3 * s, dilate: 3,
      detail: [{ x: x0, y: U(x0), r: 8 * s, spacing: 1.5 * s }, { x: x1, y: U(x1), r: 8 * s, spacing: 1.5 * s }],
      key: { ...key, fn: (t, smile) => (x, y) => {
        const d = y - U(x), tt = ease(t);
        return [0, lidTop(x, tt, smile) + d * (0.75 + 0.25 * tt) - y];
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
  const formD = (x, form) => { const t = sOf(x), c = t * t; return form >= 0 ? [Math.sign(t) * 1.6 * s * form * c, -3.2 * s * form * c] : [Math.sign(t) * 0.6 * s * form * c, -2.6 * s * form * c]; };
  const openUpper = (x, open) => { const t = sOf(x); return -1.3 * s * open * (1 - t * t); };
  const openLower = (x, open) => { const t = sOf(x); return 14 * s * open * Math.pow(Math.max(0, 1 - t * t), 0.8); };
  const mouthKey = { params: ['MouthOpen', 'MouthForm'], keys: [[0, 1], [-1, 0, 1]] };
  const upperD = (open, form) => (x, y) => { const f = formD(x, form); return [f[0], f[1] * (y > M(x) - 3 * s ? 1 : 0.6) + openUpper(x, open)]; };
  const lowerD = (open, form) => (x, y) => { const f = formD(x, form); const below = Math.max(0, Math.min(1, (y - M(x)) / (14 * s))); return [f[0] * (1 - below * 0.5), f[1] * (1 - below * 0.6) + openLower(x, open) * (1 - below * 0.15)]; };
  // cavity: a strip between the lips' inner edges, zero height when closed
  const cols = 24, rows = 4, cav = r3.get('mouth_cavity');
  const cavityMesh = (tw, th) => {
    const positions = [], triangles = [], uvPositions = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const x = mx0 + (mx1 - mx0) * i / cols, y = M(x) - 0.2 + 0.4 * j / rows;
      positions.push((x - cav.x) * 2, (y - cav.y) * 2);
      uvPositions.push(tw * (0.04 + 0.92 * i / cols), th * (0.08 + 0.84 * j / rows));
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i; triangles.push(a, a + 1, a + cols + 2, a, a + cols + 2, a + cols + 1); }
    return { positions, triangles, uvPositions };
  };
  const cavityKey = { ...mouthKey, fn: (open, form) => (x, y) => {
    const v = (y - (M(x) - 0.2)) / 0.4;
    const up = upperD(open, form)(x, M(x) - 0.05), lo = lowerD(open, form)(x, M(x) + 0.05);
    const top = M(x) + up[1] - 0.5 * s, bottom = M(x) + lo[1] + 0.5 * s;
    return [up[0] * (1 - v) + lo[0] * v, top + (bottom - top) * v - y];
  } };
  const r3part = id => ({ file: r3.get(id).file, offset: [r3.get(id).x, r3.get(id).y], texScale: 2 });
  await b.part('mouth_cavity', { ...r3part('mouth_cavity'), parent, order: z + 88, mesh: cavityMesh, key: cavityKey });
  await b.part('mouth_cavity_mask', { ...r3part('mouth_cavity'), parent, order: z + 88, maskOnly: true, mesh: cavityMesh, key: cavityKey });
  const follow = (fnOf, k = 1) => ({ ...mouthKey, fn: (open, form) => (x) => { const d = fnOf(open, form)(x, M(x)); return [d[0], d[1] * k]; } });
  await b.part('mouth_teeth_upper', { ...r3part('mouth_teeth_upper'), parent, order: z + 89, spacing: 3, dilate: 1, mask: 'mouth_cavity_mask', key: follow(upperD) });
  await b.part('mouth_teeth_lower', { ...r3part('mouth_teeth_lower'), parent, order: z + 89.1, spacing: 3, dilate: 1, mask: 'mouth_cavity_mask', key: follow(lowerD, 0.95) });
  await b.part('mouth_tongue', { ...r3part('mouth_tongue'), parent, order: z + 89.2, spacing: 3, dilate: 1, mask: 'mouth_cavity_mask', key: follow(lowerD, 0.8) });
  const lipDetail = [{ x: mx0, y: M(mx0), r: 9 * s, spacing: 1.5 * s }, { x: mx1, y: M(mx1), r: 9 * s, spacing: 1.5 * s }];
  await b.part('lip_lower', { file: 'lip_lower.png', offset: off('lip_lower'), texScale: tex, parent, order: z + 91, spacing: 4 * s, dilate: 2, detail: lipDetail, key: { ...mouthKey, fn: lowerD } });
  await b.part('lip_upper', { file: 'lip_upper.png', offset: off('lip_upper'), texScale: tex, parent, order: z + 91.1, spacing: 4 * s, dilate: 2, detail: lipDetail, key: { ...mouthKey, fn: upperD } });
  return { M, mx0, mx1, mxc, openLower, s };
}
