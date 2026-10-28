// Build hv3/hibiki.rig.json from the part textures in hv3/parts.
// Run: node hv3/tools/build-rig.mjs  (needs the npm packages sharp and cdt2d)
import path from 'node:path';
import { RigBuilder, smooth } from './rig-builder.mjs';
import { buildFace } from './face-rig.mjs';

const dir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const out = path.resolve(dir, '..');
const b = new RigBuilder(out, 1024, 1536);

b.param('AngleX', -30, 30, 0, '顔 左右');
b.param('AngleY', -30, 30, 0, '顔 上下');
b.param('AngleZ', -30, 30, 0, '顔 傾き');

// Head: tilt around the neck, then a turn warp over the head
const head = { x: 300, y: 30, w: 430, h: 440 }, hc = [527, 300];
b.rotation('head_tilt', null, [522, 410], { params: ['AngleZ'], keys: [[-30, 0, 30]], fn: z => ({ angle: z * 0.33 }) });
// Turning: points move along a sphere around the face centre; nearer points move more.
const turn = (depth) => (ax, ay) => (x, y) => {
  const nx = (x - hc[0]) / (head.w / 2), ny = (y - hc[1]) / (head.h / 2);
  const r2 = Math.min(1, nx * nx + ny * ny), z = Math.sqrt(1 - r2) * depth; // bulge toward the viewer
  const yaw = ax / 30, pitch = ay / 30;
  return [yaw * (8 + 16 * z), -pitch * (5 + 9 * z)];
};
b.warp('head_turn', 'head_tilt', [head.x, head.y, head.w, head.h], 8, 8, { params: ['AngleX', 'AngleY'], keys: [[-30, 0, 30], [-30, 0, 30]], fn: turn(1) });
b.warp('face_parts', 'head_turn', [430, 200, 200, 190], 4, 4, { params: ['AngleX', 'AngleY'], keys: [[-30, 0, 30], [-30, 0, 30]], fn: (ax, ay) => () => [ax / 30 * 1, -ay / 30 * 0.6] });

await b.part('face_base', { file: 'face_base_full.png', offset: [0, 0], parent: 'head_turn', order: 0, spacing: 40,
  detail: [{ x: 480, y: 258, r: 40, spacing: 6 }, { x: 576, y: 252, r: 40, spacing: 6 }, { x: 527, y: 350, r: 45, spacing: 6 }] });
const face = await buildFace(b, { parent: 'face_parts', order: 10, dir });

console.log(b.write('hibiki.rig.json'));
