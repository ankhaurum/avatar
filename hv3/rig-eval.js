// Hibiki V3 rig evaluator. Reads hibiki.rig.json and produces deformed vertex
// positions for every drawable each frame. Independent implementation: keyforms
// are blended multilinearly over their parameters, warp deformers map points
// through a bilinear control lattice, rotation deformers rotate around a pivot,
// and children are always expressed in the rest (art) space of the whole model
// so that every layer under one deformer shares the same continuous field.

function keyWeights(block, values) {
  // Multilinear weights over the parameter grid of one keyform block.
  let entries = [{ index: 0, weight: 1 }];
  let stride = 1;
  for (let a = 0; a < block.params.length; a++) {
    const keys = block.keys[a];
    const v = values[block.params[a]];
    let i = 0;
    while (i < keys.length - 2 && v > keys[i + 1]) i++;
    let t = keys.length === 1 ? 0 : (v - keys[i]) / (keys[i + 1] - keys[i]);
    t = Math.min(1, Math.max(0, t));
    const next = [];
    for (const e of entries) {
      if (1 - t > 1e-6) next.push({ index: e.index + i * stride, weight: e.weight * (1 - t) });
      if (t > 1e-6 && keys.length > 1) next.push({ index: e.index + (i + 1) * stride, weight: e.weight * t });
    }
    entries = next;
    stride *= keys.length;
  }
  return entries;
}

function blendArrays(block, values, out) {
  out.fill(0);
  for (const { index, weight } of keyWeights(block, values)) {
    const f = block.forms[index];
    for (let i = 0; i < out.length; i++) out[i] += f[i] * weight;
  }
  return out;
}

function blendScalars(block, values, fields) {
  const r = {};
  for (const k of fields) r[k] = 0;
  for (const { index, weight } of keyWeights(block, values)) {
    const f = block.forms[index];
    for (const k of fields) r[k] += (f[k] ?? 0) * weight;
  }
  return r;
}

class WarpDeformer {
  constructor(d, parent) {
    Object.assign(this, d);
    this.parentNode = parent;
    this.count = (d.cols + 1) * (d.rows + 1);
    this.rest = Float32Array.from(d.rest);
    if (d.keyforms) d.keyforms.forms = d.keyforms.forms.map(f => Float32Array.from(f));
    this.local = new Float32Array(this.count * 2);
    this.grid = new Float32Array(this.count * 2);
  }
  update(values) {
    if (this.keyforms) {
      blendArrays(this.keyforms, values, this.local);
      for (let i = 0; i < this.local.length; i++) this.local[i] += this.rest[i];
    } else this.local.set(this.rest);
    this.grid.set(this.local);
    if (this.parentNode) this.parentNode.apply(this.grid, this.grid);
  }
  apply(src, dst) {
    const [rx, ry, rw, rh] = this.rect, c = this.cols, r = this.rows, g = this.grid, W = c + 1;
    for (let k = 0; k < src.length; k += 2) {
      let u = (src[k] - rx) / rw * c, v = (src[k + 1] - ry) / rh * r;
      const i = Math.min(c - 1, Math.max(0, Math.floor(u))), j = Math.min(r - 1, Math.max(0, Math.floor(v)));
      u -= i; v -= j;
      const p00 = (j * W + i) * 2, p10 = p00 + 2, p01 = p00 + W * 2, p11 = p01 + 2;
      const a = (1 - u) * (1 - v), b = u * (1 - v), cc = (1 - u) * v, d = u * v;
      dst[k] = g[p00] * a + g[p10] * b + g[p01] * cc + g[p11] * d;
      dst[k + 1] = g[p00 + 1] * a + g[p10 + 1] * b + g[p01 + 1] * cc + g[p11 + 1] * d;
    }
    return dst;
  }
}

class RotationDeformer {
  constructor(d, parent) {
    Object.assign(this, d);
    this.parentNode = parent;
    this.state = { x: d.pivot[0], y: d.pivot[1], angle: 0, scale: 1 };
  }
  update(values) {
    const k = this.keyforms ? blendScalars(this.keyforms, values, ['dx', 'dy', 'angle', 'scale']) : { dx: 0, dy: 0, angle: 0, scale: 0 };
    this.state.x = this.pivot[0] + k.dx;
    this.state.y = this.pivot[1] + k.dy;
    this.state.angle = k.angle * Math.PI / 180;
    this.state.scale = 1 + k.scale;
  }
  apply(src, dst) {
    const { x, y, angle, scale } = this.state, px = this.pivot[0], py = this.pivot[1];
    const c = Math.cos(angle) * scale, s = Math.sin(angle) * scale;
    for (let k = 0; k < src.length; k += 2) {
      const ox = src[k] - px, oy = src[k + 1] - py;
      dst[k] = x + ox * c - oy * s;
      dst[k + 1] = y + ox * s + oy * c;
    }
    if (this.parentNode) this.parentNode.apply(dst, dst);
    return dst;
  }
}

export class Physics {
  // Damped springs driven by weighted parameter inputs. Each output follows a
  // lagged, inverted copy of its input so hair and fabric trail the motion.
  constructor(groups) {
    this.groups = groups.map(g => ({ ...g, x: 0, v: 0, prevInput: 0 }));
  }
  step(values, dt) {
    const h = Math.min(dt, 1 / 30);
    for (const g of this.groups) {
      let input = 0;
      for (const [id, w] of g.inputs) input += (values[id] ?? 0) * w;
      const vel = (input - g.prevInput) / Math.max(h, 1e-3);
      g.prevInput = input;
      const target = -input * g.follow;
      const w0 = 2 * Math.PI * g.frequency;
      const acc = -w0 * w0 * (g.x - target) - 2 * g.damping * w0 * g.v - vel * g.inertia;
      g.v += acc * h;
      g.x += g.v * h;
      g.x = Math.max(-1.5, Math.min(1.5, g.x));
      values[g.output] = g.x;
    }
  }
}

export class RigModel {
  constructor(json) {
    this.json = json;
    this.parameters = json.parameters;
    this.values = {};
    for (const p of json.parameters) this.values[p.id] = p.default ?? 0;
    this.nodes = new Map();
    for (const d of json.deformers) {
      const parent = d.parent ? this.nodes.get(d.parent) : null;
      if (d.parent && !parent) throw Error('Deformer parent must precede child: ' + d.id);
      this.nodes.set(d.id, d.type === 'warp' ? new WarpDeformer(d, parent) : new RotationDeformer(d, parent));
    }
    this.parts = json.parts.map(p => {
      const part = { ...p, rest: Float32Array.from(p.mesh.positions) };
      part.positions = new Float32Array(part.rest.length);
      part.parentNode = p.parent ? this.nodes.get(p.parent) : null;
      if (p.keyforms) {
        p.keyforms.forms = p.keyforms.forms.map(f => Float32Array.from(f));
        part.offset = new Float32Array(part.rest.length);
      }
      part.opacity = 1;
      return part;
    });
    this.physics = new Physics(json.physics || []);
  }
  set(id, v) {
    const p = this.parameters.find(q => q.id === id);
    this.values[id] = p ? Math.min(p.max, Math.max(p.min, v)) : v;
  }
  update(dt = 0) {
    if (dt > 0) this.physics.step(this.values, dt);
    for (const n of this.nodes.values()) n.update(this.values);
    for (const p of this.parts) {
      if (p.keyforms) {
        blendArrays(p.keyforms, this.values, p.offset);
        for (let i = 0; i < p.rest.length; i++) p.positions[i] = p.rest[i] + p.offset[i];
      } else p.positions.set(p.rest);
      if (p.parentNode) p.parentNode.apply(p.positions, p.positions);
      p.opacity = p.opacityKeys ? blendScalars(p.opacityKeys, this.values, ['o']).o : 1;
    }
  }
}
