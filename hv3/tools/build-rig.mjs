// Build hv3/hibiki.rig.json from the R3 body parts (hv3/parts/r3) and the face
// parts cut from approved art A (hv3/parts). Authored in 1024x1536 units (R3 px / 4)
// and written in approved art A pixels (see the end).
// Run: node hv3/tools/build-rig.mjs  (needs the npm packages sharp and cdt2d)
import fs from 'node:fs';
import sharp from 'sharp';
import path from 'node:path';
import { RigBuilder, smooth } from './rig-builder.mjs';
import { buildFace } from './face-rig.mjs';
import { skinRef, handStats, toneHand } from './hand-tone.mjs';

const dir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const out = path.resolve(dir, '..');
const r3m = JSON.parse(fs.readFileSync(path.join(out, 'parts/r3/manifest.json')));
const r3 = new Map(r3m.parts.map(p => [p.id, p]));
const joint = id => r3m.rig[id].pivot;
const b = new RigBuilder(out, 1024, 1536);

// ---- parameters
for (const [id, lo, hi, label] of [['AngleX', -30, 30, '顔 左右'], ['AngleY', -30, 30, '顔 上下'], ['AngleZ', -30, 30, '顔 傾き'],
  ['BodyAngleX', -10, 10, '体 左右'], ['LowerAngleX', -10, 10, '腰から下 左右（体に遅れて）'], ['BodyAngleY', -10, 10, '体 前後'], ['BodyAngleZ', -10, 10, '体 傾き']]) b.param(id, lo, hi, 0, label);
b.param('Breath', 0, 1, 0, '呼吸');
b.param('ShoulderUp', 0, 1, 0, '肩をすくめる');
for (const s of ['R', 'L']) {
  const ja = s === 'R' ? '右' : '左';
  b.param('Shoulder' + s, -20, 100, 0, ja + '肩（外へ上げる）');
  b.param('Elbow' + s, -120, 160, 0, ja + '肘（外へ＋／体の前へ−）');
  b.param('Wrist' + s, -40, 40, 0, ja + '手首');
  b.param('Hand' + s, 0, 4, 0, ja + '手の形');
}
// pose arm sets drawn from ChatGPT's pose images replace both everyday arms
b.param('ArmsDefault', 0, 1, 1, 'ふだんの腕の表示');
for (const [id, label] of [['PoseChest', '胸に手を当てる腕'], ['PoseChin', '顎に手を添える腕'], ['PoseReach', '手を前に差し出す腕'], ['PoseHands', '両手を体の前で重ねる腕']]) b.param(id, 0, 1, 0, label);
// the pose arms slide the last bit into place while they fade in (0 = a little
// below and smaller, 1 = in place); the hand shapes cross-fade (0 = the resting hand, 1 = the chosen shape)
b.param('PoseEnter', 0, 1, 1, 'ポーズの腕の到着');
for (const s of ['R', 'L']) b.param('HandFade' + s, 0, 1, 1, (s === 'R' ? '右' : '左') + '手の形の切り替わり');
for (const [id, label] of [['HairFront', '前髪の揺れ'], ['HairSide', '横髪の揺れ'], ['BowSway', 'リボンの揺れ'], ['SkirtSway', 'スカートの揺れ'], ['DrapeSway', '垂れ布の揺れ'], ['SleeveSwayR', '右袖飾りの揺れ'], ['SleeveSwayL', '左袖飾りの揺れ'],
  ['HairBack', '後ろ髪・毛先の揺れ'], ['FrillSway', '肩のフリルの揺れ'], ['HipBowSway', '腰のリボンの揺れ'], ['SkirtSway2', 'スカート下段の揺れ'],
  ['CharmSway', '垂れ布の先の飾りの揺れ'], ['LegSway', '脚の飾り・ブーツのリボンの揺れ'], ['BodySwayX', '上半身の遅れ（左右）'], ['BodySwayZ', '上半身の遅れ（傾き）']]) b.param(id, -1.5, 1.5, 0, label);

// ---- body
const hips = joint('hips');
// the whole body leans about the hips; BodySwayX/Z come from physics (the upper
// body follows the head a little later)
b.rotation('body', null, hips, { params: ['BodyAngleZ', 'BodyAngleX', 'BodySwayX', 'BodySwayZ'], keys: [[-10, 0, 10], [-10, 0, 10], [-1.5, 0, 1.5], [-1.5, 0, 1.5]], fn: (z, x, sx, sz) => ({ angle: z * 0.9 + sz * 1.6, dx: sx * 4 }) });
// torso: turning (BodyAngleX) rotates the upper body about the spine (see the
// shape of the turn below). The turn grows from the hips upward. Breathing
// lifts the chest.
const T = { x: 230, y: 200, w: 564, h: 640 }, tc = [512, 360];
// BodyAngleY < 0 leans forward: the chest comes down and toward the viewer
// (slightly larger), > 0 leans back. Keys at the ends and the middle of each
// direction, so large turns keep their shape.
// Body hierarchy (as in Live2D): body rotation (BodyAngleZ, about the hips)
// -> upper body warp (torso: BodyAngleX/Y, breath) and lower body warp
// (lower_turn: LowerAngleX) -> parts. The turn of a point is one function of
// its place, used by both warps, so the waist seam is continuous at rest.
const upOf = y => Math.max(0, Math.min(1, (hips[1] - y) / (hips[1] - T.y)));
// Shape of the turn, keyed the way a modeller sets the ends (BodyAngleX +-10:
// the body clearly turned, about 35 deg). At each height the body section has a
// half-width a (table below). The front centre line (ribbon, button row) moves
// 0.42 a toward the turn. The near half (the side the body turns away from; it
// comes toward the viewer) widens a little and is seen larger and a little
// lower (the viewer looks slightly down on it); the far half narrows strongly
// and recedes (smaller, higher): the far edge of the body moves 0.30 a inward,
// so the far arm and shoulder, drawn behind the bodice, go partly behind it,
// and beyond the far edge (shoulder, arm, hand) things move inward further
// still. The neck and collar (y < 268) move as one piece with the centre line.
const table = (tab, y) => { if (y <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (y <= tab[i][0]) { const [y0, a0] = tab[i - 1], [y1, a1] = tab[i]; return a0 + (a1 - a0) * (y - y0) / (y1 - y0); } return tab[tab.length - 1][1]; };
// half-width of the body by height (neck, collar, chest, waist, skirt), measured on the R3 parts
const halfW = y => table([[220, 40], [262, 44], [296, 66], [322, 108], [450, 110], [505, 86], [566, 97], [620, 118], [700, 158], [1040, 200]], y);
// the chest turns fully, the hips about half
const turnShare = y => 0.5 + 0.5 * Math.max(0, Math.min(1, (800 - y) / 350));
const EYE_Y = 240, DEPTH = 0.045;
const turnXY = (ax, x, y) => {
  const s = ax / 10 * turnShare(y); if (!s) return [0, 0];
  const a = halfW(y), rx = x - tc[0], sg = Math.sign(s), m = Math.abs(s);
  const xc = 0.42 * a * s;                                                 // front centre line
  const near = -sg * a * (1 + 0.05 * m), far = sg * a * (1 - 0.28 * m);  // the two edges
  let X, z;                                                                // z: +1 toward the viewer
  if (rx * sg >= 0) { // far half: the surface is compressed toward the edge, more near it, never folding
    const u = Math.min(1, rx * sg / a), k = 0.28 * m, q = u * (1 - k * u) / (1 - k);
    X = xc + (far - xc) * q; z = -Math.pow(u, 0.8);
    if (rx * sg > a) { X += (rx * sg - a) * (1 - 0.28 * m) * sg; z = -1; }
  } else { // near half: the surface is stretched a little toward the centre
    const u = Math.min(1, -rx * sg / a), k = 0.25 * m, r = u + k * u * (1 - u);
    X = xc + (near - xc) * r; z = Math.pow(u, 0.8);
    if (-rx * sg > a) { X += (-rx * sg - a) * (1 + 0.04 * m) * -sg; z = 1; }
  }
  const rigid = 1 - smooth((y - 268) / 40);
  // the near / far size difference (perspective about the eye level): full on
  // the upper body, fading toward the hem so the skirt tilts only a little
  const depth = DEPTH * Math.max(0.3, 1 - Math.max(0, (y - 560) / 480));
  return [(X - rx) * (1 - rigid) + xc * rigid, (y - EYE_Y) * depth * m * z * (1 - rigid)];
};
const turnX = (ax, x, y) => turnXY(ax, x, y)[0];
// the far arm and its shoulder frill go behind the body and get smaller, the near arm comes forward and gets larger
const armTurn = (ax, px) => { const side = px - tc[0] >= 0 ? 1 : -1, far = Math.max(0, side * ax / 10), near = Math.max(0, -side * ax / 10); return { dx: -side * 28 * far + side * 6 * near, scale: 0.06 * near - 0.07 * far }; };
// the shoulders (the band beside the neck, from the collar down to the top of
// the chest) rise with each breath a little and with a shrug (ShoulderUp)
const shoulderBand = (x, y) => { const nx = Math.abs(x - tc[0]) / (T.w / 2); return smooth((nx - 0.12) / 0.25) * smooth((y - 236) / 30) * (1 - smooth((y - 340) / 70)); };
b.warp('torso', 'body', [T.x, T.y, T.w, T.h], 12, 10, {
  params: ['BodyAngleX', 'BodyAngleY', 'Breath', 'ShoulderUp'], keys: [[-10, -5, 0, 5, 10], [-10, -5, 0, 5, 10], [0, 1], [0, 1]], fn: (ax, ay, br, sh) => (x, y) => {
    const nx = (x - tc[0]) / (T.w / 2), up = upOf(y), rx = x - tc[0];
    const [turn, turnY] = turnXY(ax, x, y);
    const chest = Math.max(0, 1 - Math.abs(y - 330) / 150), band = shoulderBand(x, y);
    const lean = -ay / 10, k = 0.05 * lean * up;
    return [turn + rx * k + br * nx * 1.6 * chest - sh * nx * 3 * band, turnY + lean * 16 * up * up + (y - tc[1]) * k * 0.5 - Math.abs(nx) * lean * 3 * up - br * 2.2 * chest * (0.6 + 0.4 * up) - br * 1.4 * band - sh * 12 * band];
  }
});
// lower body: the skirt, hip ribbon and drapes turn the same way as the waist
// above them, less toward the hem
const LB = [180, 480, 680, 560];
// LowerAngleX follows BodyAngleX a little later (set by the motion), so the
// hips and skirt come round after the chest
b.warp('lower_turn', 'body', LB, 8, 6, { params: ['LowerAngleX'], keys: [[-10, -5, 0, 5, 10]], fn: ax => (x, y) => turnXY(ax, x, y) });
// legs (not under the body rotation): a small shift the same way, fading toward the feet
b.warp('legs_turn', null, [300, 700, 430, 840], 4, 6, { params: ['LowerAngleX'], keys: [[-10, 0, 10]], fn: ax => (x, y) => { const f = 1 - 0.7 * Math.max(0, Math.min(1, (y - 760) / 700)); return [turnX(ax, 512 + (x - 512) * 0.4, 800) * f, 0]; } });
// shoulder frills swing about their seams
for (const s of ['R', 'L']) b.rotation('shoulder_frill_' + s + '_swing', 'torso', r3.get('shoulder_frill_' + s).pivot, { params: ['FrillSway', 'BodyAngleX'], keys: [[-1.5, 0, 1.5], [-10, 0, 10]], fn: (v, ax) => { const t = armTurn(ax, r3.get('shoulder_frill_' + s).pivot[0]); return { angle: v * 7 * (s === 'R' ? 1 : -1), dx: t.dx * 0.6, scale: t.scale * 1.2 }; } });
// ---- head and neck
const headPivot = joint('head');
// the whole head turns about the base of the neck: tilting rotates it, turning
// moves it a little sideways, nodding down lowers it and brings it forward
b.rotation('head', 'torso', headPivot, { params: ['AngleZ', 'AngleX', 'AngleY'], keys: [[-30, 0, 30], [-30, 0, 30], [-30, 0, 30]], fn: (zz, xx, yy) => ({ angle: zz * 0.4 - xx * 0.06, dx: xx / 30 * 5, dy: -yy / 30 * (yy < 0 ? 9 : 4), scale: yy < 0 ? -yy / 30 * 0.015 : 0 }) });
// Face hierarchy (as in Live2D): head rotation (AngleZ, about the base of the
// neck) -> face XY warp (head_turn) -> one deformer per part: the skin and
// contour, each eye, each brow, the mouth, the fringe, the side and back hair.
// AngleX/AngleY move each part by its depth in the head (nose, mouth and fringe
// in front, contour and ears in the middle, back hair behind) without
// stretching the features: eyes, brows and mouth are moved rigidly (a shift and
// a small near/far scale), only the skin is warped (the contour narrows on the
// far side and widens on the near side). At 30 deg the nose moves about 12 %
// of the face width sideways and 7 % up or down (reference samples).
const H = { x: 372, y: 14, w: 280, h: 262 }, hc = [511, 152];
const TURN = 0.25, PITCH = 0.15; // sin of the effective head turn / pitch at 30
// z: depth in front of the contour plane (rig units; nose 44, mouth 34, brows
// 30, eyes 28, fringe tips 40, contour 0, back hair -6)
const depthShift = (z, ax, ay) => [ax / 30 * z * TURN, -ay / 30 * z * PITCH];
// face XY: a small common shift of the whole face plane
b.warp('head_turn', 'head', [H.x, H.y, H.w, H.h], 4, 4, { params: ['AngleX', 'AngleY'], keys: [[-30, 0, 30], [-30, 0, 30]], fn: (ax, ay) => () => depthShift(0, ax, ay) });
// hair sway: tips move most, roots stay
const sway = (y0, h, amp, lift = 0.25) => v => (x, y) => { const t = Math.max(0, Math.min(1, (y - y0) / h)); const k = Math.pow(t, 1.6); return [v * amp * k, Math.abs(v) * amp * lift * k * k]; };
const box = id => { const p = r3.get(id); return [p.x, p.y, p.w, p.h]; };
const pad = ([x, y, w, h], m) => [x - m, y - m, w + 2 * m, h + 2 * m];
// head skin and hair come from approved art A (native resolution), placed on the
// R3 head with the same similarity as the face features
const artA = { scale: 0.551, offset: [223.5, 6.4] };
const metaA = JSON.parse(fs.readFileSync(path.join(out, 'parts/meta.json')));
const aBox = n => { const m = metaA[n]; return [artA.offset[0] + m.x * artA.scale, artA.offset[1] + m.y * artA.scale, m.w * artA.scale, m.h * artA.scale]; };
// The face surface: depth of the skin (nose highest, 0 on the face contour)
// and its shift for a head turn / nod. The skin and the hair lying on it use
// the same field, so hair never slides over or off the cheeks (as in Live2D:
// the near side hair stays on the cheek's outer contour).
const AA = (x, y) => [artA.offset[0] + x * artA.scale, artA.offset[1] + y * artA.scale];
const zFace = (x, y) => { const nx = (x - AA(524, 0)[0]) / (130 * 0.551), ny = (y - AA(0, 290)[1]) / (140 * 0.551), r = Math.min(1, nx * nx + ny * ny); const nose = Math.exp(-(((x - AA(524, 0)[0]) / (26 * 0.551)) ** 2 + ((y - AA(0, 305)[1]) / (34 * 0.551)) ** 2)); return 34 * (1 - r) ** 1.4 + 14 * nose; }; // falls smoothly to 0 at the contour
const faceShift = (x, y, ax, ay, extra = 0) => { const p = depthShift(zFace(x, y) + extra, ax, ay), ny = (y - hc[1]) / (H.h / 2), chin = Math.max(0, ny) ** 1.5; return [p[0], p[1] + Math.max(0, -ay) / 30 * 9 * chin]; };
const HK = [-30, -15, 0, 15, 30];
const fr = pad(aBox('hair_front'), 6);
// parallax: the fringe is in front of the face, so it moves more with the head turn
// the fringe moves at least as far as the face under it, its tips (in front of
// the forehead) further; toward its ends it meets the side hair on the face field
b.warp('fringe_sway', 'head_turn', fr, 18, 9, { params: ['HairFront', 'AngleX', 'AngleY'], keys: [[-1.5, 0, 1.5], HK, HK], fn: (v, ax, ay) => { const f = sway(fr[1] + 25, fr[3] - 25, 9)(v); return (x, y) => { const d = f(x, y), t = Math.max(0, Math.min(1, (y - fr[1] - fr[3] * 0.25) / (fr[3] * 0.65))), e = 1 - smooth((Math.abs(x - (fr[0] + fr[2] / 2)) - (fr[2] / 2 - 50)) / 40), p = faceShift(x, y, ax, ay, Math.max(0, (4 + 36 * t) * e - zFace(x, y))); return [d[0] + p[0], d[1] + p[1]]; }; } });
const sideR = pad(aBox('hair_side_R'), 4), sideL = pad(aBox('hair_side_L'), 4);
// side hair (the back hair is drawn in the same layers): the whole length sways
// with HairSide, the tips trail more with HairBack; it lies behind the face, so
// it moves less than the face with the head turn (parallax)
// the side layers hold the hair beside the face (contour depth) and the back
// hair behind it: the upper part moves with the contour, the lower part (back)
// a little the other way
// side hair: on the face it moves with the face field; the hair on the side the
// head turns toward (the far side) moves a little further, over the cheek;
// the lower part (the back hair) lags a little behind
const CX = AA(524, 0)[0];
const sideFn = r => (v, vb, ax, ay) => { // the swing is in the ends below the jaw (over the clothes), the hair beside the cheeks stays on them
  const f = sway(r[1] + r[3] * 0.5, r[3] * 0.5, 9)(v), g = sway(r[1] + r[3] * 0.62, r[3] * 0.38, 10, 0.4)(vb); return (x, y) => { const a = f(x, y), c = g(x, y), t = Math.max(0, Math.min(1, (y - r[1] - r[3] * 0.4) / (r[3] * 0.5))), far = Math.sign(x - CX) === Math.sign(ax) ? 1 : 0, p = faceShift(x, y, ax, ay, far * 5 * (1 - t) - 6 * t); return [a[0] + c[0] + p[0], a[1] + c[1] + p[1]]; }; };
b.warp('side_sway_R', 'head_turn', sideR, 12, 22, { params: ['HairSide', 'HairBack', 'AngleX', 'AngleY'], keys: [[-1.5, 0, 1.5], [-1.5, 0, 1.5], HK, HK], fn: sideFn(sideR) });
b.warp('side_sway_L', 'head_turn', sideL, 12, 22, { params: ['HairSide', 'HairBack', 'AngleX', 'AngleY'], keys: [[-1.5, 0, 1.5], [-1.5, 0, 1.5], HK, HK], fn: sideFn(sideL) });

// ---- arms (R = character's right = viewer left). Outward raise turns the
// right arm clockwise on screen and the left arm counter-clockwise.
for (const s of ['R', 'L']) {
  const dirn = s === 'R' ? 1 : -1;
  b.rotation('arm_' + s + '_upper', 'torso', joint('arm_' + s + '_upper'), { params: ['Shoulder' + s, 'BodyAngleX'], keys: [[-20, 0, 100], [-10, -5, 0, 5, 10]], fn: (v, ax) => ({ angle: v * dirn, ...armTurn(ax, joint('arm_' + s + '_upper')[0]) }) });
  b.rotation('arm_' + s + '_lower', 'arm_' + s + '_upper', joint('arm_' + s + '_lower'), { params: ['Elbow' + s], keys: [[-120, 0, 160]], fn: v => ({ angle: v * dirn }) });
  b.rotation('hand_' + s, 'arm_' + s + '_lower', joint('hand_' + s), { params: ['Wrist' + s], keys: [[-40, 0, 40]], fn: v => ({ angle: v * dirn }) });
  // sleeve decorations swing a little around their own knots
  for (const id of ['sleeve_bow_upper_', 'sleeve_elbow_frill_']) b.rotation(id + s + '_swing', 'arm_' + s + '_upper', r3.get(id + s).pivot, { params: ['SleeveSway' + s], keys: [[-1.5, 0, 1.5]], fn: v => ({ angle: v * 6 }) });
  for (const id of ['sleeve_bow_wrist_', 'sleeve_cuff_']) b.rotation(id + s + '_swing', 'arm_' + s + '_lower', r3.get(id + s).pivot, { params: ['SleeveSway' + s], keys: [[-1.5, 0, 1.5]], fn: v => ({ angle: v * 5 }) });
}
// ---- chest and hip ornaments, skirt, drapes
const bow = pad([395, 280, 230, 160], 6);
// the chest ribbon and charm stand a little in front of the chest: they move a little further with the turn (parallax)
b.warp('chest_bow_sway', 'torso', bow, 4, 4, { params: ['BowSway', 'BodyAngleX'], keys: [[-1.5, 0, 1.5], [-10, 0, 10]], fn: (v, ax) => { const f = sway(bow[1] + 40, bow[3] - 40, 7, 0.15)(v); return (x, y) => { const d = f(x, y); return [d[0] + ax / 10 * 1.5, d[1]]; }; } });
b.rotation('chest_charm_swing', 'torso', r3.get('chest_charm').pivot, { params: ['BowSway', 'BodyAngleX'], keys: [[-1.5, 0, 1.5], [-10, 0, 10]], fn: (v, ax) => ({ angle: v * 12, dx: ax / 10 * 2 }) });
const hipBow = pad([505, 515, 240, 345], 6);
b.warp('hip_bow_sway', 'lower_turn', hipBow, 4, 6, { params: ['HipBowSway'], keys: [[-1.5, 0, 1.5]], fn: sway(hipBow[1] + 40, hipBow[3] - 40, 10, 0.15) });
const skirt = pad([295, 527, 425, 300], 8);
b.warp('skirt_sway', 'lower_turn', skirt, 6, 4, { params: ['SkirtSway', 'LowerAngleX'], keys: [[-1.5, 0, 1.5], [-10, 0, 10]], fn: (v, ax) => (x, y) => {
  const t = Math.max(0, Math.min(1, (y - skirt[1] - 20) / (skirt[3] - 20))), k = t * t;
  const nx = (x - 512) / (skirt[2] / 2);
  return [v * 11 * k - ax / 10 * 2 * k, Math.abs(v) * 2.5 * k * (nx * Math.sign(v) > 0 ? 1 : -0.4)];
} });
// the lower tiers swing again on top of the upper skirt, later and further
b.warp('skirt_sway2', 'skirt_sway', skirt, 6, 4, { params: ['SkirtSway2'], keys: [[-1.5, 0, 1.5]], fn: v => (x, y) => { const t = Math.max(0, Math.min(1, (y - skirt[1] - skirt[3] * 0.45) / (skirt[3] * 0.55))); return [v * 8 * t * t, Math.abs(v) * 1.5 * t * t]; } });
for (const s of ['R', 'L']) {
  b.rotation('drape_' + s + '_swing', 'lower_turn', joint('drape_' + s + '_root'), { params: ['DrapeSway', 'LowerAngleX'], keys: [[-1.5, 0, 1.5], [-10, 0, 10]], fn: (v, ax) => ({ angle: v * 7 - ax * 0.4 }) });
  b.rotation('drape_charm_' + s + '_swing', 'drape_' + s + '_swing', r3.get('drape_charm_' + s).pivot, { params: ['CharmSway'], keys: [[-1.5, 0, 1.5]], fn: v => ({ angle: v * 16 }) });
}
// leg ornaments (full view): the garter bow and jewel, the boot ribbons
for (const id of ['garter_bow_L', 'garter_jewel_L', 'boot_bow_L', 'boot_bow_R']) b.rotation(id + '_swing', 'legs_turn', r3.get(id).pivot, { params: ['LegSway'], keys: [[-1.5, 0, 1.5]], fn: v => ({ angle: v * (id.startsWith('boot') ? 7 : 12) }) });

// ---- parts
const parentOf = p => {
  const id = p.id;
  if (/^(garter_bow_L|garter_jewel_L|boot_bow_L|boot_bow_R)$/.test(id)) return id + '_swing';
  if (/^(thigh|stocking|garter|boot)/.test(id)) return 'legs_turn';
  if (/^drape_charm_/.test(id)) return 'drape_charm_' + id.slice(-1) + '_swing';
  if (/^drape_/.test(id)) return 'drape_' + id.slice(-1) + '_swing';
  if (/^(skirt_ruffle_lower|skirt_navy_lower|skirt_lining)$/.test(id)) return 'skirt_sway2';
  if (/^shoulder_frill_/.test(id)) return 'shoulder_frill_' + id.slice(-1) + '_swing';
  if (/^skirt_/.test(id)) return 'skirt_sway';
  if (/^hip_bow/.test(id)) return 'hip_bow_sway';
  if (/^chest_charm/.test(id)) return 'chest_charm_swing';
  if (/^chest_bow/.test(id)) return 'chest_bow_sway';
  if (/^(bodice|collar|neck|shoulder_frill)/.test(id)) return 'torso';
  // R3 head skin, ears and hair are replaced by art A (see below)
  if (/^(hair_|face_base|ear_)/.test(id)) return 'skip';
  if (/^mouth_/.test(id)) return 'skip';
  // the bare forearm is fully covered by the glove sleeve; at large elbow angles
  // its rounded ends would show past the elbow frill
  if (/^forearm_/.test(id)) return 'skip';
  let m = id.match(/^(upper_arm|sleeve_upper)_(R|L)$/); if (m) return 'arm_' + m[2] + '_upper';
  m = id.match(/^(sleeve_bow_upper|sleeve_elbow_frill|sleeve_bow_wrist|sleeve_cuff)_(R|L)$/); if (m) return m[0] + '_swing';
  m = id.match(/^(forearm|sleeve_forearm)_(R|L)$/); if (m) return 'arm_' + m[2] + '_lower';
  m = id.match(/^hand_(R|L)/); if (m) return 'hand_' + m[1];
  throw Error('No parent for ' + id);
};
const handShapes = ['', '_open', '_wave', '_point', '_relaxed_fist'];
const metaA0 = JSON.parse(fs.readFileSync(path.join(out, 'parts/meta.json'))).head_skin;
await skinRef(path.join(out, 'parts/head_skin.png'), { cheekL: [455 - metaA0.x, 290 - metaA0.y, 495 - metaA0.x, 330 - metaA0.y], cheekR: [560 - metaA0.x, 285 - metaA0.y, 600 - metaA0.x, 325 - metaA0.y] }, path.join(out, 'parts/neck_skin.png'), (n => [495 - n.x, 385 - n.y, 555 - n.x, 425 - n.y])(JSON.parse(fs.readFileSync(path.join(out, 'parts/meta.json'))).neck_skin));
const handRef = await handStats(r3m.parts.filter(p => /^hand_/.test(p.id)).map(p => path.join(out, 'parts', p.file)));
for (const p of r3m.parts) {
  const parent = parentOf(p);
  if (parent === 'skip') continue;
  const o = { file: p.file, offset: [p.x, p.y], texScale: 2, parent, order: p.z, spacing: 10 };
  if (p.group === 'hair') Object.assign(o, { spacing: 9, tips: { spacing: 3.5, at: 0.9 } });
  if (/^(skirt_|drape_|hip_bow_long)/.test(p.id)) Object.assign(o, { tips: { spacing: 5, at: 0.95 } });
  if (p.id === 'face_base') Object.assign(o, { spacing: 8 });
  if (/^hand_/.test(p.id)) {
    const s = p.id[5], k = handShapes.indexOf(p.id.slice(6));
    o.spacing = 6;
    // one shape per hand; while HandFade rises the resting hand gives way to the chosen shape
    o.opacity = { params: ['Hand' + s, 'ArmsDefault', 'HandFade' + s], keys: [[0, 1, 2, 3, 4], [0, 1], [0, 1]], fn: (v, d, f) => d * (k === 0 ? (v === 0 ? 1 : 1 - f) : (v === k ? f : 0)) };
  }
  if (/^(upper_arm|sleeve)_/.test(p.id)) o.opacity = { params: ['ArmsDefault'], keys: [[0, 1]], fn: d => d };
  // shoulder: the top of the upper arm stays with the torso so the joint bends
  let m = p.id.match(/^(upper_arm|sleeve_upper)_(R|L)$/);
  if (m) {
    const pv = joint('arm_' + m[2] + '_upper');
    o.blend = { parent: 'torso', weight: (x, y) => 1 - smooth((y - (pv[1] - 18)) / 40) };
  }
  // elbow: the top of the forearm sleeve follows the upper arm a little
  m = p.id.match(/^(forearm|sleeve_forearm)_(R|L)$/);
  if (m) {
    const pv = joint('arm_' + m[2] + '_lower');
    o.blend = { parent: 'arm_' + m[2] + '_upper', weight: (x, y) => 0.6 * (1 - smooth((y - (pv[1] - 8)) / 22)) };
  }
  // lower arm in front of the bodice and ribbons while the elbow bends inward
  m = p.id.match(/_(R|L)(_open|_wave|_point|_relaxed_fist)?$/);
  if (m && /^(forearm|sleeve_forearm|sleeve_cuff|sleeve_bow_wrist|hand)/.test(p.id)) o.orderSwitch = [{ param: 'Elbow' + m[1], below: -25, add: 40 }, { param: 'Elbow' + m[1], above: 95, add: 25 }];
  // the elbow frill wraps the joint, so it stays above a raised forearm
  m = p.id.match(/^sleeve_elbow_frill_(R|L)$/);
  if (m) o.orderSwitch = [{ param: 'Elbow' + m[1], above: 95, add: 30 }];
  // Hands: toned to art A's skin. The hands are drawn hanging with the thumb
  // toward the body; a flat rotation cannot turn the forearm, so each shape is
  // used as drawn or mirrored about the wrist line, by where its gesture puts
  // the palm and thumb: waving (palm forward, thumb toward the body when
  // raised), presenting to the side (palm up, thumb up), both hands in front of
  // the waist (palm out, fingers toward the centre, thumb down) and pointing
  // (index finger on the upper side) are mirrored; resting and the loose fist
  // stay as drawn.
  if (/^hand_/.test(p.id)) {
    const mirror = /_(wave|open|point)$/.test(p.id), file = p.file.replace('.png', mirror ? '_mirror.png' : '_tone.png');
    await toneHand(path.join(out, 'parts', p.file), path.join(out, 'parts', file), handRef, { mirror });
    if (mirror) { const pv = r3m.rig['hand_' + p.id[5]].pivot; o.offset = [2 * pv[0] - (p.x + p.w), p.y]; }
    o.file = file;
  }
  await b.part(p.id, o);
}
// pose arms: upper (shoulder skin, puff sleeve) under the R3 shoulder frills,
// lower (forearm sleeve, cuff, hands) in front of the chest ribbons and the face
const poseM = JSON.parse(fs.readFileSync(path.join(out, 'parts/pose/manifest.json')));
const poseParam = { chest: 'PoseChest', chin: 'PoseChin', reach: 'PoseReach', hands: 'PoseHands' };
// arriving: from a little lower and smaller (as if still coming up) into place
b.rotation('pose_enter', 'torso', [512, 430], { params: ['PoseEnter'], keys: [[0, 1]], fn: v => ({ dy: 28 * (1 - v), scale: -0.03 * (1 - v) }) });
for (const [name, pz] of Object.entries(poseM.poses)) for (const [layer, L] of Object.entries(pz.layers))
  await b.part('pose_' + name + '_' + layer, { file: L.file, offset: [L.x, L.y], texScale: 2, parent: 'pose_enter', order: layer === 'upper' ? 56 : 92, spacing: 12, dilate: 2,
    opacity: { params: [poseParam[name]], keys: [[0, 1]], fn: v => v } });
// art A head: skin under the face features, side hair over the face edge, fringe over the brows
const aPart = (id, parent, order, o = {}) => b.part(id, { file: id + '.png', offset: [artA.offset[0] + metaA[id].x * artA.scale, artA.offset[1] + metaA[id].y * artA.scale], texScale: 1 / artA.scale, parent, order, spacing: 8, dilate: 2, ...o });
// neck: under the R3 collar; the top follows the head, the bottom stays with the torso
await aPart('neck_skin', 'head', 57.5, { spacing: 8, blend: { parent: 'torso', weight: (x, y) => smooth((y - 222) / 40) } });
// cheeks and jaw: the smile lifts the cheeks, opening the mouth lowers the chin
// with the lower lip (art A px converted to rig units)
const A_ = (x, y) => [artA.offset[0] + x * artA.scale, artA.offset[1] + y * artA.scale];
const fr0 = A_(380, 230), fr1 = A_(670, 440);
const gauss = (x, y, c, r) => Math.exp(-(((x - c[0]) ** 2 + (y - c[1]) ** 2) / (r * r)));
b.warp('face_expr', 'head_turn', [fr0[0], fr0[1], fr1[0] - fr0[0], fr1[1] - fr0[1]], 10, 10, { params: ['MouthForm', 'MouthOpen'], keys: [[-1, 0, 1], [0, 1]], fn: (form, open) => (x, y) => {
  const k = artA.scale, cheek = Math.max(0, form) * 7 * k * (gauss(x, y, A_(476, 308), 38 * k) + gauss(x, y, A_(578, 300), 38 * k));
  const [mx, my] = A_(527, 349), jaw = open * 6 * k * Math.max(0, 1 - Math.abs(x - mx) / (70 * k)) * smooth((y - my) / (25 * k)) * (1 - smooth((y - A_(0, 412)[1]) / (16 * k)));
  return [0, -cheek + jaw];
} });
// skin and contour: the depth of the head as a rounded field (nose highest);
// looking down the chin also tucks up
// the depth falls to 0 at the face contour itself (art A: about 130 px to each
// side of the nose, 140 px down to the chin), so the cheeks and jaw move with
// the side hair beside them and no hidden skin opens up between them
const zSkin = (x, y) => { const nx = (x - A_(524, 0)[0]) / (130 * 0.551), ny = (y - A_(0, 290)[1]) / (140 * 0.551), r = Math.min(1, nx * nx + ny * ny); const nose = Math.exp(-(((x - A_(524, 0)[0]) / (26 * 0.551)) ** 2 + ((y - A_(0, 305)[1]) / (34 * 0.551)) ** 2)); return 30 * (1 - r) ** 0.7 + 14 * nose; };
b.warp('skin_turn', 'face_expr', [H.x, H.y, H.w, H.h], 22, 22, { params: ['AngleX', 'AngleY'], keys: [[-30, -15, 0, 15, 30], [-30, -15, 0, 15, 30]], fn: (ax, ay) => (x, y) => {
  return faceShift(x, y, ax, ay);
} });
// underlay under the whole head (contour depth): no background between moved parts
await aPart('head_under', 'head_turn', 79, { spacing: 10 });
await aPart('head_skin', 'skin_turn', 80);
// eyes, brows and mouth: moved as wholes by their depth (no stretching); the
// eye on the far side gets a little smaller, the near one a little larger
const rigid = (id, c, z) => b.rotation(id, 'face_expr', c, { params: ['AngleX', 'AngleY'], keys: [[-30, -15, 0, 15, 30], [-30, -15, 0, 15, 30]], fn: (ax, ay) => { const p = depthShift(z ?? zFace(c[0], c[1]), ax, ay); return { dx: p[0], dy: p[1], scale: -ax / 30 * TURN * ((c[0] - A_(524, 0)[0]) / (H.w / 2)) * 0.12 }; } });
// each feature at the depth of the face surface under its centre, so the skin
// around it (brow ends, eye corners) keeps its place against it
rigid('eye_R_turn', A_(475, 258)); rigid('eye_L_turn', A_(572, 252));
// the brows lie on the skin surface (they follow the skin warp, so the skin
// around them never shifts against them)
rigid('mouth_turn', A_(527, 350));
// expressions that the drawn features cannot make by themselves (the fringe
// hides the brows): the eyes open wide (surprise), the mouth purses into a
// round shape (with MouthOpen: an "o") and pulls to one side (thinking). Each
// moves the whole feature, so the lids, lashes, lips and the closed seam keep
// their fit.
b.param('EyeWide', 0, 1, 0, '目の見開き'); b.param('MouthPucker', 0, 1, 0, '口のすぼめ'); b.param('MouthShift', -1, 1, 0, '口の片寄せ');
// wide open (surprise): the upper lid rises most, the lower lid drops a little,
// so white shows above the iris; the iris itself is not stretched (it is a child
// of the turn, not of this warp, and is clipped by the widened white)
for (const [id, c] of [['R', [475, 258]], ['L', [572, 252]]]) {
  const p0 = A_(c[0] - 62, c[1] - 48), p1 = A_(c[0] + 62, c[1] + 44), cy = A_(0, c[1] + 2)[1];
  b.warp('eye_' + id + '_wide', 'eye_' + id + '_turn', [p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]], 4, 6, { params: ['EyeWide'], keys: [[0, 1]], fn: w => (x, y) => [0, (y - cy) * (0.32 + 0.18 * Math.tanh((cy - y) / (4 * artA.scale))) * w] });
}
{
  const p0 = A_(452, 312), p1 = A_(602, 410), [mx, my] = A_(527, 350), hw = 50 * artA.scale;
  b.warp('mouth_shape', 'mouth_turn', [p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]], 6, 4, { params: ['MouthPucker', 'MouthShift'], keys: [[0, 1], [-1, 0, 1]], fn: (p, h) => (x, y) => {
    const k = artA.scale, t = Math.max(-1.3, Math.min(1.3, (x - mx) / hw)), tt = Math.min(1, t * t);
    // pursing draws the corners in more than the middle (with MouthOpen a round
    // "o"): the upper lip comes down a little over the teeth, the lower lip
    // drops and rounds; the shift pulls the mouth to one side with that corner a little up
    const above = y < my ? 1 : 0;
    return [-(x - mx) * p * (0.2 + 0.3 * tt) + h * 9 * k * (1 - 0.3 * t * Math.sign(h)), (y - my) * (above ? 0.1 : 0.4) * p + 1.6 * k * p * above - h * 4.5 * k * t];
  } });
}
// the side hair is in front of the face in art A (its layer is the difference
// against the skin with the features on it), so it is drawn above them
await aPart('hair_side_R', 'side_sway_R', 92.5, { spacing: 9, tips: { spacing: 3.5, at: 0.92 } });
await aPart('hair_side_L', 'side_sway_L', 92.6, { spacing: 9, tips: { spacing: 3.5, at: 0.92 } });
await aPart('hair_front', 'fringe_sway', 94, { spacing: 7, tips: { spacing: 3, at: 0.9 } });
// face: art A features placed on the R3 head (similarity: eye and mouth centres)
await buildFace(b, { parent: 'face_expr', parents: { eyeR: 'eye_R_wide', eyeL: 'eye_L_wide', irisR: 'eye_R_turn', irisL: 'eye_L_turn', browR: 'skin_turn', browL: 'skin_turn', mouth: 'mouth_shape' }, z: 0, dir, r3, tf: { scale: 0.551, offset: [223.5, 6.4] } });

// ---- physics (inputs are normalised parameter values)
// Each group: inputs are the head and body angles (and arms), "follow" is how
// far it hangs back, frequency and damping set its weight: light hair and
// ribbons swing fast and settle quickly, the skirt and long drapes slower and
// longer, small charms dangle at the end of them. BodySwayX/Z: the upper body
// follows the head a little later (negative follow = same direction).
// "inputs" give the resting lean (a tilt lets the part hang against it), "kick"
// the motions whose speed throws it. Hair and ribbons are light: they swing
// fast and settle over 2-3 periods; the skirt and the long drapes are heavier
// and slower, the small charms dangle at the end of them.
const phys = (o, inputs, follow, frequency, damping, inertia, kick) => b.physics({ output: o, inputs, follow, frequency, damping, inertia, ...(kick ? { kick } : {}) });
// hair: a turn of the head (AngleX) or a nod does not lean the hair, it only
// throws it; a tilt (AngleZ, BodyAngleZ) leans it a little as well
phys('HairFront', [['AngleZ', 3 / 30], ['BodyAngleZ', 1 / 10]], 0.4, 1.5, 0.12, 4.5, [['AngleX', 3 / 30], ['AngleZ', 3 / 30], ['AngleY', 2.5 / 30], ['BodyAngleX', 1.5 / 10]]);
phys('HairSide', [['AngleZ', 4 / 30], ['BodyAngleZ', 2 / 10], ['BodyAngleX', 0.8 / 10]], 0.4, 1.1, 0.12, 5.0, [['AngleX', 3.6 / 30], ['AngleZ', 4 / 30], ['AngleY', 2 / 30], ['BodyAngleX', 2 / 10], ['BodySwayX', 0.8]]);
phys('HairBack', [['AngleZ', 3.6 / 30], ['BodyAngleZ', 2 / 10], ['BodyAngleX', 1 / 10], ['HairSide', 0.4]], 0.4, 0.85, 0.1, 5.0, [['AngleX', 3 / 30], ['AngleZ', 3.6 / 30], ['AngleY', 2 / 30], ['BodyAngleX', 2.4 / 10], ['HairSide', 0.5]]);
phys('FrillSway', [['BodyAngleX', 1 / 10], ['BodyAngleZ', 1 / 10], ['BodySwayX', 0.5], ['Breath', 0.2]], 0.7, 1.6, 0.14, 0.6);
phys('BowSway', [['BodyAngleX', 1.2 / 10], ['BodyAngleZ', 1 / 10], ['BodyAngleY', 0.5 / 10], ['BodySwayX', 0.6], ['Breath', 0.2]], 0.8, 1.4, 0.13, 0.8);
phys('HipBowSway', [['BodyAngleX', 1.2 / 10], ['BodyAngleZ', 1.2 / 10], ['BodySwayX', 0.4]], 0.8, 1.0, 0.13, 0.8);
phys('SkirtSway', [['BodyAngleX', 1.2 / 10], ['BodyAngleZ', 1.4 / 10], ['BodySwayX', 0.4]], 0.7, 0.95, 0.15, 0.8, [['BodyAngleX', 1.2 / 10], ['BodyAngleZ', 1.4 / 10], ['BodySwayX', 0.4], ['LowerAngleX', 0.6 / 10]]);
phys('SkirtSway2', [['SkirtSway', 0.8], ['BodyAngleZ', 0.8 / 10]], 0.8, 0.8, 0.13, 0.9);
phys('DrapeSway', [['BodyAngleX', 1.2 / 10], ['BodyAngleZ', 1.2 / 10], ['SkirtSway', 0.3]], 0.8, 0.6, 0.12, 0.9);
phys('CharmSway', [['DrapeSway', 1.2], ['BodyAngleZ', 1 / 10]], 1.0, 1.3, 0.1, 1.2);
phys('LegSway', [['BodyAngleX', 1.5 / 10], ['BodyAngleZ', 1.5 / 10], ['SkirtSway', 0.8]], 1.0, 1.5, 0.12, 0.8);
// sleeve ribbons, cuffs and frills: thrown by the arm's own motion (the stop of a gesture leaves them swinging)
for (const s of ['R', 'L']) phys('SleeveSway' + s, [['BodyAngleX', 1.5 / 10], ['BodyAngleZ', 1.5 / 10]], 1.0, 1.5, 0.12, 1.0, [['Shoulder' + s, 1 / 50], ['Elbow' + s, 1 / 70], ['Wrist' + s, 1 / 40], ['BodyAngleX', 1.5 / 10], ['BodyAngleZ', 1.5 / 10], ['AngleX', 0.6 / 30]]);
phys('BodySwayX', [['AngleX', 1 / 30]], -0.9, 0.9, 0.4, 0.05);
phys('BodySwayZ', [['AngleZ', 1 / 30], ['AngleX', 0.6 / 30]], -0.9, 0.9, 0.4, 0.05);

// ---- units: approved art A pixels, so the art A head is used at its native size
// and the R3 body is scaled up to it (old unit x = 223.5 + 0.551 * art A x)
// bust-up: from the top of the head to below the chest (as the Live2D samples frame it)
b.rig.views = { bust: [244, 4, 536, 520], face: [432, 56, 160, 190], full: [120, 0, 784, 1536] };
b.rig.headCenter = [511, 150];
b.rescale(1 / artA.scale, artA.offset, [Math.round(1024 / artA.scale), Math.round(1536 / artA.scale)]);
console.log(b.write('hibiki.rig.json'));
