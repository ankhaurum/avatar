// Build hv3/hibiki.rig.json from the R3 body parts (hv3/parts/r3) and the face
// parts cut from approved art A (hv3/parts). Authored in 1024x1536 units (R3 px / 4)
// and written in approved art A pixels (see the end).
// Run: node hv3/tools/build-rig.mjs  (needs the npm packages sharp and cdt2d)
import fs from 'node:fs';
import sharp from 'sharp';
import path from 'node:path';
import { RigBuilder, smooth } from './rig-builder.mjs';
import { buildFace } from './face-rig.mjs';

const dir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const out = path.resolve(dir, '..');
const r3m = JSON.parse(fs.readFileSync(path.join(out, 'parts/r3/manifest.json')));
const r3 = new Map(r3m.parts.map(p => [p.id, p]));
const joint = id => r3m.rig[id].pivot;
const b = new RigBuilder(out, 1024, 1536);

// ---- parameters
for (const [id, lo, hi, label] of [['AngleX', -30, 30, '顔 左右'], ['AngleY', -30, 30, '顔 上下'], ['AngleZ', -30, 30, '顔 傾き'],
  ['BodyAngleX', -10, 10, '体 左右'], ['BodyAngleY', -10, 10, '体 前後'], ['BodyAngleZ', -10, 10, '体 傾き']]) b.param(id, lo, hi, 0, label);
b.param('Breath', 0, 1, 0, '呼吸');
for (const s of ['R', 'L']) {
  const ja = s === 'R' ? '右' : '左';
  b.param('Shoulder' + s, -20, 100, 0, ja + '肩（外へ上げる）');
  b.param('Elbow' + s, -120, 160, 0, ja + '肘（外へ＋／体の前へ−）');
  b.param('Wrist' + s, -40, 40, 0, ja + '手首');
  b.param('Hand' + s, 0, 4, 0, ja + '手の形');
}
// pose arm sets drawn from ChatGPT's pose images replace both everyday arms
b.param('ArmsDefault', 0, 1, 1, 'ふだんの腕の表示');
for (const [id, label] of [['PoseChest', '胸に手を当てる腕'], ['PoseChin', '顎に手を添える腕'], ['PoseReach', '手を前に差し出す腕']]) b.param(id, 0, 1, 0, label);
for (const [id, label] of [['HairFront', '前髪の揺れ'], ['HairSide', '横髪の揺れ'], ['BowSway', 'リボンの揺れ'], ['SkirtSway', 'スカートの揺れ'], ['DrapeSway', '垂れ布の揺れ'], ['SleeveSwayR', '右袖飾りの揺れ'], ['SleeveSwayL', '左袖飾りの揺れ']]) b.param(id, -1.5, 1.5, 0, label);

// ---- body
const hips = joint('hips');
b.rotation('body', null, hips, { params: ['BodyAngleZ', 'BodyAngleX'], keys: [[-10, 0, 10], [-10, 0, 10]], fn: (z, x) => ({ angle: z * 0.45, dx: x * 0.6 }) });
// torso: turning moves the chest centre more than its sides; breathing lifts the chest and shoulders
const T = { x: 260, y: 200, w: 504, h: 640 }, tc = [512, 360];
b.warp('torso', 'body', [T.x, T.y, T.w, T.h], 8, 8, {
  params: ['BodyAngleX', 'BodyAngleY', 'Breath'], keys: [[-10, 0, 10], [-10, 0, 10], [0, 1]], fn: (ax, ay, br) => (x, y) => {
    const nx = (x - tc[0]) / (T.w / 2), up = Math.max(0, Math.min(1, (hips[1] - y) / (hips[1] - T.y)));
    const z = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx)));
    const chest = Math.max(0, 1 - Math.abs(y - 330) / 150);
    return [ax / 10 * (3 + 7 * z) * up + br * nx * 1.6 * chest, -ay / 10 * 7 * up * up + ay / 10 * 2 * Math.abs(nx) * up - br * 2.2 * chest * (0.6 + 0.4 * up)];
  }
});
// ---- head and neck
const headPivot = joint('head');
b.rotation('head', 'torso', headPivot, { params: ['AngleZ'], keys: [[-30, 0, 30]], fn: zz => ({ angle: zz * 0.4 }) });
const H = { x: 372, y: 14, w: 280, h: 262 }, hc = [511, 152];
const turn = (a, bulge) => (ax, ay) => (x, y) => {
  const nx = (x - hc[0]) / (H.w / 2), ny = (y - hc[1]) / (H.h / 2);
  const z = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)));
  return [ax / 30 * (a + bulge * z), -ay / 30 * (a * 0.5 + bulge * 0.45 * z)];
};
b.warp('head_turn', 'head', [H.x, H.y, H.w, H.h], 8, 8, { params: ['AngleX', 'AngleY'], keys: [[-30, 0, 30], [-30, 0, 30]], fn: turn(5, 12) });
// hair sway: tips move most, roots stay
const sway = (y0, h, amp, lift = 0.25) => v => (x, y) => { const t = Math.max(0, Math.min(1, (y - y0) / h)); const k = Math.pow(t, 1.6); return [v * amp * k, Math.abs(v) * amp * lift * k * k]; };
const box = id => { const p = r3.get(id); return [p.x, p.y, p.w, p.h]; };
const pad = ([x, y, w, h], m) => [x - m, y - m, w + 2 * m, h + 2 * m];
// head skin and hair come from approved art A (native resolution), placed on the
// R3 head with the same similarity as the face features
const artA = { scale: 0.551, offset: [223.5, 6.4] };
const metaA = JSON.parse(fs.readFileSync(path.join(out, 'parts/meta.json')));
const aBox = n => { const m = metaA[n]; return [artA.offset[0] + m.x * artA.scale, artA.offset[1] + m.y * artA.scale, m.w * artA.scale, m.h * artA.scale]; };
const fr = pad(aBox('hair_front'), 6);
b.warp('fringe_sway', 'head_turn', fr, 6, 4, { params: ['HairFront'], keys: [[-1.5, 0, 1.5]], fn: sway(fr[1] + 10, fr[3] - 10, 4.5) });
const sideR = pad(aBox('hair_side_R'), 4), sideL = pad(aBox('hair_side_L'), 4);
b.warp('side_sway_R', 'head_turn', sideR, 4, 6, { params: ['HairSide'], keys: [[-1.5, 0, 1.5]], fn: sway(sideR[1] + 70, sideR[3] - 70, 7) });
b.warp('side_sway_L', 'head_turn', sideL, 4, 6, { params: ['HairSide'], keys: [[-1.5, 0, 1.5]], fn: sway(sideL[1] + 70, sideL[3] - 70, 7) });

// ---- arms (R = character's right = viewer left). Outward raise turns the
// right arm clockwise on screen and the left arm counter-clockwise.
for (const s of ['R', 'L']) {
  const dirn = s === 'R' ? 1 : -1;
  b.rotation('arm_' + s + '_upper', 'torso', joint('arm_' + s + '_upper'), { params: ['Shoulder' + s], keys: [[-20, 0, 100]], fn: v => ({ angle: v * dirn }) });
  b.rotation('arm_' + s + '_lower', 'arm_' + s + '_upper', joint('arm_' + s + '_lower'), { params: ['Elbow' + s], keys: [[-120, 0, 160]], fn: v => ({ angle: v * dirn }) });
  b.rotation('hand_' + s, 'arm_' + s + '_lower', joint('hand_' + s), { params: ['Wrist' + s], keys: [[-40, 0, 40]], fn: v => ({ angle: v * dirn }) });
  // sleeve decorations swing a little around their own knots
  for (const id of ['sleeve_bow_upper_', 'sleeve_elbow_frill_']) b.rotation(id + s + '_swing', 'arm_' + s + '_upper', r3.get(id + s).pivot, { params: ['SleeveSway' + s], keys: [[-1.5, 0, 1.5]], fn: v => ({ angle: v * 6 }) });
  for (const id of ['sleeve_bow_wrist_', 'sleeve_cuff_']) b.rotation(id + s + '_swing', 'arm_' + s + '_lower', r3.get(id + s).pivot, { params: ['SleeveSway' + s], keys: [[-1.5, 0, 1.5]], fn: v => ({ angle: v * 5 }) });
}
// ---- chest and hip ornaments, skirt, drapes
const bow = pad([395, 280, 230, 160], 6);
b.warp('chest_bow_sway', 'torso', bow, 4, 4, { params: ['BowSway'], keys: [[-1.5, 0, 1.5]], fn: sway(bow[1] + 40, bow[3] - 40, 4, 0.1) });
b.rotation('chest_charm_swing', 'torso', r3.get('chest_charm').pivot, { params: ['BowSway'], keys: [[-1.5, 0, 1.5]], fn: v => ({ angle: v * 7 }) });
const hipBow = pad([505, 515, 240, 345], 6);
b.warp('hip_bow_sway', 'body', hipBow, 4, 6, { params: ['BowSway'], keys: [[-1.5, 0, 1.5]], fn: sway(hipBow[1] + 40, hipBow[3] - 40, 6, 0.1) });
const skirt = pad([295, 527, 425, 300], 8);
b.warp('skirt_sway', 'body', skirt, 6, 4, { params: ['SkirtSway', 'BodyAngleX'], keys: [[-1.5, 0, 1.5], [-10, 0, 10]], fn: (v, ax) => (x, y) => {
  const t = Math.max(0, Math.min(1, (y - skirt[1] - 20) / (skirt[3] - 20))), k = t * t;
  const nx = (x - 512) / (skirt[2] / 2);
  return [v * 7 * k - ax / 10 * 3 * k, Math.abs(v) * 1.5 * k * (nx * Math.sign(v) > 0 ? 1 : -0.4)];
} });
for (const s of ['R', 'L']) b.rotation('drape_' + s + '_swing', 'body', joint('drape_' + s + '_root'), { params: ['DrapeSway', 'BodyAngleX'], keys: [[-1.5, 0, 1.5], [-10, 0, 10]], fn: (v, ax) => ({ angle: v * 4 - ax * 0.25 }) });

// ---- parts
const parentOf = p => {
  const id = p.id;
  if (/^(thigh|stocking|garter|boot)/.test(id)) return null;
  if (/^drape_/.test(id)) return 'drape_' + id.slice(-1) + '_swing';
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
    o.opacity = { params: ['Hand' + s, 'ArmsDefault'], keys: [[0, 1, 2, 3, 4], [0, 1]], fn: (v, d) => (v === k ? d : 0) };
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
  // waving hands: the drawn hand hangs with its thumb toward the body, so raised
  // past horizontal its thumb would point outward. Mirrored about the wrist, the
  // raised palm faces forward with the thumb toward the body, as a person waves.
  if (/_wave$/.test(p.id)) {
    const file = p.file.replace('.png', '_mirror.png');
    await sharp(path.join(out, 'parts', p.file)).flop().toFile(path.join(out, 'parts', file));
    const pv = r3m.rig['hand_' + p.id[5]].pivot;
    Object.assign(o, { file, offset: [2 * pv[0] - (p.x + p.w), p.y] });
  }
  await b.part(p.id, o);
}
// pose arms: upper (shoulder skin, puff sleeve) under the R3 shoulder frills,
// lower (forearm sleeve, cuff, hands) in front of the chest ribbons and the face
const poseM = JSON.parse(fs.readFileSync(path.join(out, 'parts/pose/manifest.json')));
const poseParam = { chest: 'PoseChest', chin: 'PoseChin', reach: 'PoseReach' };
for (const [name, pz] of Object.entries(poseM.poses)) for (const [layer, L] of Object.entries(pz.layers))
  await b.part('pose_' + name + '_' + layer, { file: L.file, offset: [L.x, L.y], texScale: 2, parent: 'torso', order: layer === 'upper' ? 56 : 92, spacing: 12, dilate: 2,
    opacity: { params: [poseParam[name]], keys: [[0, 1]], fn: v => v } });
// art A head: skin under the face features, side hair over the face edge, fringe over the brows
const aPart = (id, parent, order, o = {}) => b.part(id, { file: id + '.png', offset: [artA.offset[0] + metaA[id].x * artA.scale, artA.offset[1] + metaA[id].y * artA.scale], texScale: 1 / artA.scale, parent, order, spacing: 8, dilate: 2, ...o });
// neck: under the R3 collar; the top follows the head, the bottom stays with the torso
await aPart('neck_skin', 'head', 57.5, { spacing: 8, blend: { parent: 'torso', weight: (x, y) => smooth((y - 222) / 40) } });
await aPart('head_skin', 'head_turn', 80);
await aPart('hair_side_R', 'side_sway_R', 83, { spacing: 9, tips: { spacing: 3.5, at: 0.92 } });
await aPart('hair_side_L', 'side_sway_L', 83.1, { spacing: 9, tips: { spacing: 3.5, at: 0.92 } });
await aPart('hair_front', 'fringe_sway', 94, { spacing: 7, tips: { spacing: 3, at: 0.9 } });
// face: art A features placed on the R3 head (similarity: eye and mouth centres)
await buildFace(b, { parent: 'head_turn', z: 0, dir, r3, tf: { scale: 0.551, offset: [223.5, 6.4] } });

// ---- physics (inputs are normalised parameter values)
b.physics({ output: 'HairFront', inputs: [['AngleX', 1 / 30], ['AngleZ', 1 / 30], ['BodyAngleX', 1 / 10], ['BodyAngleZ', 0.5 / 10]], follow: 0.6, frequency: 1.6, damping: 0.22, inertia: 0.08 });
b.physics({ output: 'HairSide', inputs: [['AngleX', 1 / 30], ['AngleZ', 1.2 / 30], ['BodyAngleX', 1 / 10], ['BodyAngleZ', 0.6 / 10]], follow: 0.7, frequency: 1.2, damping: 0.2, inertia: 0.1 });
b.physics({ output: 'BowSway', inputs: [['BodyAngleX', 1 / 10], ['BodyAngleZ', 1 / 10], ['Breath', 0.15]], follow: 0.6, frequency: 1.4, damping: 0.18, inertia: 0.1 });
b.physics({ output: 'SkirtSway', inputs: [['BodyAngleX', 1 / 10], ['BodyAngleZ', 1.2 / 10]], follow: 0.5, frequency: 1.1, damping: 0.25, inertia: 0.12 });
b.physics({ output: 'DrapeSway', inputs: [['BodyAngleX', 1 / 10], ['BodyAngleZ', 1 / 10]], follow: 0.6, frequency: 0.7, damping: 0.2, inertia: 0.12 });
for (const s of ['R', 'L']) b.physics({ output: 'SleeveSway' + s, inputs: [['Shoulder' + s, 1 / 60], ['Elbow' + s, 1 / 90], ['BodyAngleZ', 0.5 / 10]], follow: 0.4, frequency: 1.5, damping: 0.2, inertia: 0.12 });

// ---- units: approved art A pixels, so the art A head is used at its native size
// and the R3 body is scaled up to it (old unit x = 223.5 + 0.551 * art A x)
b.rig.views = { bust: [236, 0, 552, 640], face: [432, 56, 160, 190], full: [120, 0, 784, 1536] };
b.rig.headCenter = [511, 150];
b.rescale(1 / artA.scale, artA.offset, [Math.round(1024 / artA.scale), Math.round(1536 / artA.scale)]);
console.log(b.write('hibiki.rig.json'));
