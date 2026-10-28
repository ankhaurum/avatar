// Face rig for Hibiki: eyes (white, iris, upper/lower lash), brows, lips and
// the mouth interior, all cut from approved art A. Closing the eye bends the
// upper lash mesh down onto the lower lid; no closed-eye line is drawn. The
// iris is clipped by the white of the eye, teeth and tongue by the cavity.
import fs from 'node:fs';
import { curveY, smooth } from './rig-builder.mjs';

export async function buildFace(b, { parent, order, dir }) {
  const def = JSON.parse(fs.readFileSync(dir + '/face-def.json'));
  const meta = JSON.parse(fs.readFileSync(dir + '/../parts/meta.json'));
  const off = n => [meta[n].x, meta[n].y];

  b.param('EyeLOpen', 0, 1, 1, '左目の開き');
  b.param('EyeROpen', 0, 1, 1, '右目の開き');
  b.param('EyeSmile', 0, 1, 0, '目の笑い');
  b.param('EyeBallX', -1, 1, 0, '視線 左右');
  b.param('EyeBallY', -1, 1, 0, '視線 上下');
  b.param('BrowY', -1, 1, 0, '眉 上下');
  b.param('BrowAngle', -1, 1, 0, '眉 角度');
  b.param('MouthOpen', 0, 1, 0, '口の開き');
  b.param('MouthForm', -1, 1, 0, '口の形');

  const eyes = {
    L: { def: def.eyeL, upperIdx: [0, 11], param: 'EyeLOpen' },
    R: { def: def.eyeR, upperIdx: [0, 11], param: 'EyeROpen' }
  };
  let o = order;
  for (const side of ['L', 'R']) {
    const e = eyes[side], open = e.def.open;
    const upper = open.slice(0, 12), lower = [open[11], ...open.slice(12), open[0]];
    const U = x => curveY(upper, x), L0 = x => curveY(lower, x);
    const xs = open.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), xc = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    const bump = x => { const s = (x - xc) / hw; return Math.max(0, 1 - s * s); };
    // lower lid rises when smiling; the closing line sits just above it
    const Lw = (x, smile) => L0(x) - 2.2 * smile * bump(x);
    const C = (x, smile) => Lw(x, smile) - 0.8 - 1.6 * smile * bump(x);
    const lidTop = (x, t, smile) => C(x, smile) + (U(x) - C(x, smile)) * t;
    const key = { params: [e.param, 'EyeSmile'], keys: [[0, 0.5, 1], [0, 1]] };
    const ease = t => smooth(t) * 0.35 + t * 0.65;
    // white of the eye: its top edge follows the lash, its bottom the lower lid
    await b.part('eye_white_' + side, {
      file: 'eye_white_' + side + '.png', offset: off('eye_white_' + side), parent, order: o++, spacing: 3, dilate: 1,
      detail: [{ x: x0, y: curveY(lower, x0), r: 6, spacing: 1.2 }, { x: x1, y: curveY(lower, x1), r: 6, spacing: 1.2 }],
      key: { ...key, fn: (t, smile) => (x, y) => {
        const u = U(x), l = L0(x), r = (y - u) / Math.max(0.5, l - u);
        const top = lidTop(x, ease(t), smile), bottom = Lw(x, smile);
        return [0, top + r * (bottom - top) - y];
      } }
    });
    await b.part('eye_white_mask_' + side, { file: 'eye_white_' + side + '.png', offset: off('eye_white_' + side), parent, order: o++, maskOnly: true, spacing: 3, dilate: 1,
      detail: [{ x: x0, y: curveY(lower, x0), r: 6, spacing: 1.2 }, { x: x1, y: curveY(lower, x1), r: 6, spacing: 1.2 }],
      key: { ...key, fn: (t, smile) => (x, y) => {
        const u = U(x), l = L0(x), r = (y - u) / Math.max(0.5, l - u);
        const top = lidTop(x, ease(t), smile), bottom = Lw(x, smile);
        return [0, top + r * (bottom - top) - y];
      } } });
    await b.part('eye_iris_' + side, {
      file: 'eye_iris_' + side + '.png', offset: off('eye_iris_' + side), parent, order: o++, spacing: 4, dilate: 1, mask: 'eye_white_mask_' + side,
      key: { params: ['EyeBallX', 'EyeBallY'], keys: [[-1, 0, 1], [-1, 0, 1]], fn: (gx, gy) => () => [gx * 5.5, gy * 2.6] }
    });
    await b.part('eye_lash_lower_' + side, {
      file: 'eye_lash_lower_' + side + '.png', offset: off('eye_lash_lower_' + side), parent, order: o++, spacing: 4, dilate: 2,
      key: { ...key, fn: (t, smile) => (x, y) => [0, (Lw(x, smile) - L0(x)) * (y < L0(x) + 3 ? 1 : 0.7) - (1 - t) * 0.5] }
    });
    // upper lash: bent down so its lower edge lies on the closing line
    await b.part('eye_lash_upper_' + side, {
      file: 'eye_lash_upper_' + side + '.png', offset: off('eye_lash_upper_' + side), parent, order: o++, spacing: 3, dilate: 3,
      detail: [{ x: x0, y: U(x0), r: 8, spacing: 1.5 }, { x: x1, y: U(x1), r: 8, spacing: 1.5 }],
      key: { ...key, fn: (t, smile) => (x, y) => {
        const d = y - U(x), tt = ease(t), target = lidTop(x, tt, smile) + d * (0.75 + 0.25 * tt);
        return [0, target - y];
      } }
    });
  }
  // brows
  for (const side of ['L', 'R']) {
    const poly = def['brow' + side].poly, cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const inner = side === 'L' ? 1 : -1; // inner end of the brow faces the nose
    await b.part('brow_' + side, {
      file: 'brow_' + side + '.png', offset: off('brow_' + side), parent, order: o++, spacing: 6, dilate: 2,
      key: { params: ['BrowY', 'BrowAngle'], keys: [[-1, 0, 1], [-1, 0, 1]], fn: (by, ba) => (x, y) => {
        const s = (x - cx) * inner; // positive toward the inner end
        return [0, -by * 3 + ba * s * 0.09];
      } }
    });
  }
  // mouth
  const ml = def.mouthLine, mx0 = ml[0][0], mx1 = ml[ml.length - 1][0], mxc = (mx0 + mx1) / 2, mhw = (mx1 - mx0) / 2;
  const M = x => curveY(ml, x);
  const sOf = x => Math.max(-1, Math.min(1, (x - mxc) / mhw));
  const formD = (x, form) => { const s = sOf(x), c = s * s; return form >= 0 ? [Math.sign(s) * 1.6 * form * c, -3.2 * form * c] : [Math.sign(s) * 0.6 * form * c, -2.6 * form * c]; };
  const openUpper = (x, open) => { const s = sOf(x); return -1.3 * open * (1 - s * s); };
  const openLower = (x, open) => { const s = sOf(x); return 14 * open * Math.pow(Math.max(0, 1 - s * s), 0.8); };
  const mouthKey = { params: ['MouthOpen', 'MouthForm'], keys: [[0, 1], [-1, 0, 1]] };
  const upperD = (open, form) => (x, y) => { const f = formD(x, form); return [f[0], f[1] * (y > M(x) - 3 ? 1 : 0.6) + openUpper(x, open)]; };
  const lowerD = (open, form) => (x, y) => { const f = formD(x, form); const below = Math.max(0, Math.min(1, (y - M(x)) / 14)); return [f[0] * (1 - below * 0.5), f[1] * (1 - below * 0.6) + openLower(x, open) * (1 - below * 0.15)]; };
  // cavity: a strip between the lips' inner edges, zero height when closed
  const cols = 24, rows = 4;
  const cavityMesh = (tw, th) => {
    const positions = [], triangles = [];
    const [ox, oy] = [meta.cavity.x, meta.cavity.y];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const x = mx0 + (mx1 - mx0) * i / cols, y = M(x) - 0.4 + 0.8 * j / rows;
      positions.push((x - ox) * tw / meta.cavity.w, (y - oy) * th / meta.cavity.h);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i; triangles.push(a, a + 1, a + cols + 2, a, a + cols + 2, a + cols + 1); }
    return { positions, triangles };
  };
  meta.cavity = { x: 478, y: 330, w: 96, h: 49 };
  const cavityKey = { ...mouthKey, fn: (open, form) => (x, y) => {
    const v = (y - (M(x) - 0.4)) / 0.8;
    const up = upperD(open, form)(x, M(x) - 0.1), lo = lowerD(open, form)(x, M(x) + 0.1);
    const top = M(x) + up[1] - 0.6, bottom = M(x) + lo[1] + 0.6;
    return [up[0] * (1 - v) + lo[0] * v, top + (bottom - top) * v - y];
  } };
  // UVs of the cavity strip map onto the whole cavity texture
  await b.part('mouth_cavity', { file: 'mouth_cavity.png', offset: [meta.cavity.x, meta.cavity.y], parent, order: o++,
    mesh: (tw, th) => { const m = cavityMesh(tw, th); const pos = []; for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pos.push(tw * i / cols, th * (0.15 + 0.7 * j / rows)); return { ...m, uvPositions: pos }; },
    key: cavityKey });
  await b.part('mouth_cavity_mask', { file: 'mouth_cavity.png', offset: [meta.cavity.x, meta.cavity.y], parent, order: o++, maskOnly: true, mesh: cavityMesh, key: cavityKey });
  await b.part('mouth_teeth_upper', { file: 'mouth_teeth_upper.png', offset: [495, 337], parent, order: o++, spacing: 4, dilate: 1, mask: 'mouth_cavity_mask',
    key: { ...mouthKey, fn: (open, form) => (x, y) => { const d = upperD(open, form)(x, M(x)); return [d[0], d[1] + M(x) - 6.5 - 337]; } } });
  await b.part('mouth_tongue', { file: 'mouth_tongue.png', offset: [499, 352], parent, order: o++, spacing: 4, dilate: 1, mask: 'mouth_cavity_mask',
    key: { ...mouthKey, fn: (open, form) => (x, y) => { const d = lowerD(open, form)(x, M(x)); return [d[0], d[1] * 0.85 + M(x) - 2 - 352]; } } });
  await b.part('lip_lower', { file: 'lip_lower.png', offset: off('lip_lower'), parent, order: o++, spacing: 4, dilate: 2,
    detail: [{ x: mx0, y: M(mx0), r: 9, spacing: 1.5 }, { x: mx1, y: M(mx1), r: 9, spacing: 1.5 }],
    key: { ...mouthKey, fn: lowerD } });
  await b.part('lip_upper', { file: 'lip_upper.png', offset: off('lip_upper'), parent, order: o++, spacing: 4, dilate: 2,
    detail: [{ x: mx0, y: M(mx0), r: 9, spacing: 1.5 }, { x: mx1, y: M(mx1), r: 9, spacing: 1.5 }],
    key: { ...mouthKey, fn: upperD } });
  return { order: o, mouth: { M, mx0, mx1, mxc, openLower, formD }, eyes };
}
