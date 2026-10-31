// Small authoring library used by build-rig.mjs. Keyforms are produced by
// evaluating displacement functions on the rest geometry, so the rig JSON holds
// plain arrays that the runtime only has to blend.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
    const d = { id, type: 'rotation', parent, pivot: [...pivot] };
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
  // Re-express the whole rig in another unit system: X = (x - origin) * k.
  // Used to make approved art A pixels the rig unit, so the head is native.
  rescale(k, origin, size) {
    const P = (a) => { for (let i = 0; i < a.length; i += 2) { a[i] = round((a[i] - origin[0]) * k); a[i + 1] = round((a[i + 1] - origin[1]) * k); } };
    const D = (a) => { for (let i = 0; i < a.length; i++) a[i] = round(a[i] * k); };
    const r = this.rig;
    r.canvas = { width: size[0], height: size[1] };
    for (const d of r.deformers) {
      if (d.type === 'warp') { P(d.rest); d.rect = [(d.rect[0] - origin[0]) * k, (d.rect[1] - origin[1]) * k, d.rect[2] * k, d.rect[3] * k].map(round); d.keyforms?.forms.forEach(D); }
      else { P(d.pivot); d.keyforms?.forms.forEach(f => { if (f.dx) f.dx = round(f.dx * k); if (f.dy) f.dy = round(f.dy * k); }); }
    }
    for (const p of r.parts) { P(p.mesh.positions); p.keyforms?.forms.forEach(D); }
    if (r.views) for (const v of Object.values(r.views)) { v[0] = round((v[0] - origin[0]) * k); v[1] = round((v[1] - origin[1]) * k); v[2] = round(v[2] * k); v[3] = round(v[3] * k); }
    if (r.headCenter) r.headCenter = [round((r.headCenter[0] - origin[0]) * k), round((r.headCenter[1] - origin[1]) * k)];
  }
  async write(name) {
    // the version of the textures (a hash of all of them), kept as the overall
    // version shown in the reports
    const used = [...new Set(this.rig.parts.map(p => p.texture))].sort();
    const h = crypto.createHash('sha256'); for (const t of used) h.update(fs.readFileSync(path.join(this.outDir, 'parts', t)));
    this.rig.textureVersion = h.digest('hex').slice(0, 12);
    // each texture's own version (a hash of the file): the renderer puts it on
    // that texture's URL, so a browser or a CDN that cached an older texture of
    // the same name fetches the new one, and only the changed textures are fetched
    this.rig.textureFiles = await webTextures(path.join(this.outDir, 'parts'), used);
    fs.writeFileSync(path.join(this.outDir, name), JSON.stringify(this.rig));
    const v = this.rig.parts.reduce((a, p) => a + p.mesh.positions.length / 2, 0);
    return { parts: this.rig.parts.length, deformers: this.rig.deformers.length, vertices: v };
  }
}
// The shipped textures: a lossless WebP next to each PNG (the PNG stays the
// source the tools edit, and the fallback for a browser without WebP). Lossless
// keeps every pixel the GPU receives (premultiplied RGBA) identical to the PNG at
// under half the size. parts/web.json records the PNG each WebP was made from,
// so only changed PNGs are encoded again.
const hash12 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
export async function webTextures(partsDir, files) {
  const listFile = path.join(partsDir, 'web.json');
  const old = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile)) : {};
  const list = {};
  await Promise.all(files.map(async f => {
    const png = fs.readFileSync(path.join(partsDir, f)), pngV = hash12(png);
    const webpFile = path.join(partsDir, f.replace(/\.png$/, '.webp'));
    let webp = fs.existsSync(webpFile) && old[f]?.png === pngV ? fs.readFileSync(webpFile) : null;
    if (!webp || hash12(webp) !== old[f].webp) {
      webp = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();
      const [a, b] = await Promise.all([png, webp].map(x => sharp(x).ensureAlpha().raw().toBuffer()));
      // compare as the GPU sees them: premultiplied (RGB under alpha 0 is dropped)
      for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 4; c++) {
        const pa = c === 3 ? a[i + 3] : Math.round(a[i + c] * a[i + 3] / 255), pb = c === 3 ? b[i + 3] : Math.round(b[i + c] * b[i + 3] / 255);
        if (pa !== pb) throw new Error('lossless WebP differs from ' + f);
      }
      fs.writeFileSync(webpFile, webp);
    }
    list[f] = { png: pngV, webp: hash12(webp) };
  }));
  const sorted = Object.fromEntries(files.map(f => [f, list[f]]));
  fs.writeFileSync(listFile, JSON.stringify(sorted, null, 1) + '\n');
  return sorted;
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
