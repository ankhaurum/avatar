// Small authoring library used by build-rig.mjs. Keyforms are produced by
// evaluating displacement functions on the rest geometry, so the rig JSON holds
// plain arrays that the runtime only has to blend.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { autoMesh } from './automesh.mjs';

export class RigBuilder {
  constructor(outDir, width, height) {
    this.outDir = outDir;
    this.rig = { format: 'hibiki-rig', version: 1, canvas: { width, height }, parameters: [], deformers: [], parts: [], physics: [], textures: [] };
    this.restOf = new Map();
  }
  param(id, min, max, def = 0, label = id) { this.rig.parameters.push({ id, min, max, default: def, label }); }
  forms(block, count, evalForm) {
    const sizes = block.keys.map(k => k.length), forms = [];
    const total = sizes.reduce((a, b) => a * b, 1);
    for (let n = 0; n < total; n++) {
      let r = n; const vals = [];
      for (const s of sizes) { vals.push(r % s); r = Math.floor(r / s); }
      forms.push(evalForm(vals.map((i, a) => block.keys[a][i])));
    }
    return forms;
  }
  displacementForms(block, rest) {
    return this.forms(block, rest.length / 2, vals => {
      const f = block.fn(...vals), out = new Array(rest.length);
      for (let i = 0; i < rest.length; i += 2) { const [dx, dy] = f(rest[i], rest[i + 1]); out[i] = round(dx); out[i + 1] = round(dy); }
      return out;
    });
  }
  warp(id, parent, rect, cols, rows, block) {
    const rest = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) rest.push(rect[0] + rect[2] * i / cols, rect[1] + rect[3] * j / rows);
    const d = { id, type: 'warp', parent, rect, cols, rows, rest: rest.map(round) };
    if (block) d.keyforms = { params: block.params, keys: block.keys, forms: this.displacementForms(block, rest) };
    this.rig.deformers.push(d);
    return d;
  }
  rotation(id, parent, pivot, block) {
    const d = { id, type: 'rotation', parent, pivot };
    if (block) d.keyforms = { params: block.params, keys: block.keys, forms: this.forms(block, 0, vals => block.fn(...vals)) };
    this.rig.deformers.push(d);
    return d;
  }
  // Add a textured part. The texture file must already exist in outDir/parts.
  async part(id, o) {
    const file = path.join(this.outDir, 'parts', o.file);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = new Uint8Array(info.width * info.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    const s = o.texScale ?? 1, [ox, oy] = o.offset;
    let mesh;
    if (o.mesh) mesh = o.mesh(info.width, info.height);
    else {
      const zones = [...(o.detail || [])];
      // hair tips / fabric hems: finer vertices along the lower edge
      if (o.tips) { const n = 6; for (let i = 0; i <= n; i++) zones.push({ x: ox + (info.width / s) * i / n, y: oy + (info.height / s) * (o.tips.at ?? 0.92), r: o.tips.r ?? (info.width / s) / n, spacing: o.tips.spacing }); }
      const detail = zones.map(d => ({ x: (d.x - ox) * s, y: (d.y - oy) * s, r: d.r * s, spacing: d.spacing * s }));
      mesh = autoMesh(alpha, info.width, info.height, { spacing: (o.spacing ?? 16) * s, dilate: o.dilate ?? 2, detail, threshold: o.threshold });
    }
    const positions = [], uvs = [];
    for (let i = 0; i < mesh.positions.length; i += 2) {
      positions.push(round(ox + mesh.positions[i] / s), round(oy + mesh.positions[i + 1] / s));
      const uv = mesh.uvPositions || mesh.positions;
      uvs.push(+(uv[i] / info.width).toFixed(5), +(uv[i + 1] / info.height).toFixed(5));
    }
    const p = { id, texture: o.file, parent: o.parent, order: o.order, mesh: { positions, uvs, triangles: mesh.triangles } };
    if (o.mask) p.mask = o.mask;
    if (o.blend) { p.blend = { parent: o.blend.parent, weights: [] }; for (let i = 0; i < positions.length; i += 2) p.blend.weights.push(round(Math.min(1, Math.max(0, o.blend.weight(positions[i], positions[i + 1]))))); }
    if (o.maskOnly) p.maskOnly = true;
    if (o.orderSwitch) p.orderSwitch = o.orderSwitch;
    if (o.key) p.keyforms = { params: o.key.params, keys: o.key.keys, forms: this.displacementForms(o.key, positions) };
    if (o.opacity) p.opacityKeys = { params: o.opacity.params, keys: o.opacity.keys, forms: this.forms(o.opacity, 0, vals => ({ o: o.opacity.fn(...vals) })) };
    this.rig.parts.push(p);
    this.restOf.set(id, positions);
    return p;
  }
  physics(group) { this.rig.physics.push(group); }
  write(name) {
    fs.writeFileSync(path.join(this.outDir, name), JSON.stringify(this.rig));
    const v = this.rig.parts.reduce((a, p) => a + p.mesh.positions.length / 2, 0);
    return { parts: this.rig.parts.length, deformers: this.rig.deformers.length, vertices: v };
  }
}
export const round = v => Math.round(v * 100) / 100;
// polyline y at x (clamped at the ends)
export function curveY(pts, x) {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  if (x <= p[0][0]) return p[0][1];
  for (let i = 0; i < p.length - 1; i++) if (x <= p[i + 1][0]) return p[i][1] + (p[i + 1][1] - p[i][1]) * (x - p[i][0]) / (p[i + 1][0] - p[i][0]);
  return p[p.length - 1][1];
}
export const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
