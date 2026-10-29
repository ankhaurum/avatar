// The pose arms (drawn poses cut from ChatGPT's images) are joined to the
// everyday arms without any cross-fade: the everyday arms move to an "approach"
// pose that lies on the drawn pose's joints (shoulder, elbow, wrist, hand
// direction); where a drawn segment is foreshortened (it turns toward the
// viewer) the everyday segment is foreshortened too (UpperShort / ForeShort:
// the upper arm shrinks about the shoulder, the forearm about the elbow, the
// hand keeps its size), so the everyday arm is never stretched and the pose
// arm is laid on it with hardly any scaling. At that moment the everyday arms
// are hidden and the pose arms shown in one frame, deformed (PoseEnter = 0)
// so that each of their segments lies on the everyday segment it replaces;
// then PoseEnter rises to 1 and the pose arms deform from there into the
// drawn pose. On the way back the same path is taken in reverse. The
// deformation is one warp lattice per pose layer whose key at PoseEnter = 0
// is a blend of per-segment similarity transforms (weighted by the distance
// to each drawn segment's axis), so the joints bend where the drawn joints are.
//
// In-between drawings (an arm half-way into a pose, requested from ChatGPT)
// will go in as a further stage of the same path: POSE_JOINTS[name].mid holds
// their joints, the manifest their layers, and PoseEnter 0 -> 0.5 -> 1 keys
// the everyday approach, the in-between drawing and the drawn pose in turn
// (the in-between layer is shown between the two switches). Not used yet.
import { smooth } from './rig-builder.mjs';

// drawn joints of each pose, rig units (1024x1536): elbow, wrist, fingertip
// (read on the cut layers; the shoulder is the R3 socket of the everyday arm)
export const POSE_JOINTS = {
  chest: { R: { E: [350, 510], W: [448, 425], T: [530, 322] }, L: { E: [675, 510], W: [578, 425], T: [496, 322] }, mid: null },
  chin: { R: { E: [395, 500], W: [455, 312], T: [468, 218] }, L: { E: [665, 500], W: [455, 525], T: [345, 530] }, mid: null },
  reach: { R: { E: [395, 420], W: [385, 490], T: [368, 600] }, L: { E: [660, 520], W: [615, 385], T: [560, 310] }, mid: null },
  hands: { R: { E: [375, 525], W: [470, 700], T: [545, 765] }, L: { E: [650, 525], W: [560, 690], T: [498, 762] }, mid: null }
};
// everyday arm chain (R3 joints) and the resting hand's fingertip
const CHAIN = {
  R: { S: [382, 318], E: [351, 535], W: [282, 729], T: [262, 836], dirn: 1 },
  L: { S: [641, 318], E: [673, 535], W: [744, 730], T: [764, 836], dirn: -1 }
};
const rotv = (v, deg) => { const r = deg * Math.PI / 180; return [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r)]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const dang = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// joints of the everyday arm at the given angles (degrees) and foreshortening (the torso at rest)
export function everydayArm(side, sh, el, wr, su = 1, sf = 1) {
  const c = CHAIN[side], d = c.dirn;
  const ue = rotv([c.E[0] - c.S[0], c.E[1] - c.S[1]], sh * d), E = [c.S[0] + su * ue[0], c.S[1] + su * ue[1]];
  const fw = rotv([c.W[0] - c.E[0], c.W[1] - c.E[1]], (sh + el) * d), W = [E[0] + sf * fw[0], E[1] + sf * fw[1]];
  const ht = rotv([c.T[0] - c.W[0], c.T[1] - c.W[1]], (sh + el + wr) * d), T = [W[0] + ht[0], W[1] + ht[1]];
  return { S: c.S, E, W, T };
}
// the approach: shoulder / elbow / wrist angles and the foreshortening of the
// upper arm and forearm whose elbow and wrist lie on the drawn ones and whose
// hand points the way the drawn one does; shortening is used only as far as
// needed (it costs a little)
export function fitApproach(side, J, ranges = { sh: [-20, 100], el: [-160, 160], wr: [-40, 40], su: [0.4, 1], sf: [0.35, 1] }) {
  let best = null;
  const cost = (sh, el, wr, su, sf) => {
    const a = everydayArm(side, sh, el, wr, su, sf);
    return dist(a.E, J.E) ** 2 + 2 * dist(a.W, J.W) ** 2 + (100 * dang(ang(a.W, a.T), ang(J.W, J.T))) ** 2 + (60 * dang(ang(a.E, a.W), ang(J.E, J.W))) ** 2 + (40 * (1 - su)) ** 2 + (40 * (1 - sf)) ** 2;
  };
  const sus = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4].filter(v => v >= ranges.su[0]), sfs = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35].filter(v => v >= ranges.sf[0]);
  for (let sh = ranges.sh[0]; sh <= ranges.sh[1]; sh += 2) for (let el = ranges.el[0]; el <= ranges.el[1]; el += 2) for (let wr = ranges.wr[0]; wr <= ranges.wr[1]; wr += 5) for (const su of sus) for (const sf of sfs) {
    const c = cost(sh, el, wr, su, sf); if (!best || c < best.c) best = { c, sh, el, wr, su, sf };
  }
  for (let it = 0; it < 4; it++) for (const [k, st, lo, hi] of [['sh', 1, ...ranges.sh], ['el', 1, ...ranges.el], ['wr', 1, ...ranges.wr], ['su', 0.02, ...ranges.su], ['sf', 0.02, ...ranges.sf]]) {
    for (const dv of [-st, st]) { const t = { ...best }; t[k] = Math.min(hi, Math.max(lo, +(t[k] + dv).toFixed(3))); t.c = cost(t.sh, t.el, t.wr, t.su, t.sf); if (t.c < best.c) best = t; }
  }
  const a = everydayArm(side, best.sh, best.el, best.wr, best.su, best.sf);
  return { ...best, arm: a, err: { E: dist(a.E, J.E), W: dist(a.W, J.W), T: dist(a.T, J.T) } };
}
// a similarity taking the drawn segment p0->p1 onto q0->q1 (anchored at p0 ->
// q0; the scale is held within [smin, smax])
function similarity(p0, p1, q0, q1, smin, smax) {
  const s = Math.min(smax, Math.max(smin, dist(q0, q1) / Math.max(1, dist(p0, p1)))), r = ang(q0, q1) - ang(p0, p1);
  const c = Math.cos(r) * s, sn = Math.sin(r) * s;
  const f = p => [q0[0] + (p[0] - p0[0]) * c - (p[1] - p0[1]) * sn, q0[1] + (p[0] - p0[0]) * sn + (p[1] - p0[1]) * c];
  return { f, end: f(p1), s, r };
}
const segDist = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy; const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L)); return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t); };

// per pose: the approach (angles and foreshortening) and the displacement
// fields (PoseEnter = 0) of the upper and lower layers
export function planPose(name) {
  const J = POSE_JOINTS[name], approach = {}, segs = { upper: [], lower: [] }, fits = {};
  for (const side of ['R', 'L']) {
    const fit = fitApproach(side, J[side]); fits[side] = fit;
    approach['Shoulder' + side] = fit.sh; approach['Elbow' + side] = fit.el; approach['Wrist' + side] = fit.wr;
    approach['UpperShort' + side] = fit.su; approach['ForeShort' + side] = fit.sf;
    const S = CHAIN[side].S, d = J[side], a = fit.arm;
    // upper arm: about the shoulder (its top stays with the torso)
    const up = similarity(S, d.E, S, a.E, 0.7, 1.4);
    segs.upper.push({ a: S, b: d.E, sigma: 60, map: up.f, top: S[1] });
    // forearm: from the pose's own elbow (where the upper arm ends) to the everyday wrist
    const fa = similarity(d.E, d.W, up.end, a.W, 0.6, 1.5);
    segs.lower.push({ a: d.E, b: d.W, sigma: 42, map: fa.f });
    // hand: from the pose forearm's wrist, pointing as the everyday hand does
    const hd = similarity(d.W, d.T, fa.end, [fa.end[0] + (a.T[0] - a.W[0]), fa.end[1] + (a.T[1] - a.W[1])], 0.8, 1.25);
    segs.lower.push({ a: d.W, b: d.T, sigma: 40, map: hd.f });
    fit.scales = { upper: up.s, forearm: fa.s, hand: hd.s };
    fit.residual = { elbow: dist(up.end, a.E), wrist: dist(fa.end, a.W), hand: dist(hd.end, a.T) };
  }
  const field = list => (x, y) => {
    let sw = 0, dx = 0, dy = 0;
    for (const s of list) {
      const w = Math.exp(-((segDist([x, y], s.a, s.b) / s.sigma) ** 2)) + 1e-4;
      const q = s.map([x, y]); let k = 1;
      if (s.top !== undefined) k = smooth((y - (s.top - 18)) / 40); // the shoulder top stays
      dx += w * (q[0] - x) * k; dy += w * (q[1] - y) * k; sw += w;
    }
    return [dx / sw, dy / sw];
  };
  return { approach, fits, fields: { upper: field(segs.upper), lower: field(segs.lower) } };
}
