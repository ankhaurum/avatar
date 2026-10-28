// Import ChatGPT's R3 parts (and the four extra hands) into hv3/parts/r3.
// R3 works in 4096x6144 px (4x the 1024x1536 source). The rig uses 1024x1536
// units; textures are stored at half the R3 size (2 texture px per unit).
// The R3 eyes, lids, lashes, brows and lips are not imported: the face features
// come from approved art A (see extract-face.cjs).
// Usage: node prepare-r3.mjs <R3 asset dir> <hand4 dir>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [r3, hand4] = process.argv.slice(2);
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '../parts/r3');
fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(r3, 'manifest.json')));
const diff = JSON.parse(fs.readFileSync(path.join(hand4, 'manifest_hand4.diff.json')));
// face features, head skin and hair come from art A; the bare forearm is fully
// covered by the glove sleeve
const skip = /^(eye_|eyelid_|eyelash_|brow_|lip_|forearm_|hair_|face_base|ear_)/;
const parts = [...manifest.parts.filter(p => !skip.test(p.id)), ...diff.parts_upsert_by_id.map(p => ({ ...p, src: hand4 }))];
const list = [];
for (const p of parts) {
  const src = path.join(p.src || r3, p.file);
  const w = Math.max(1, Math.round(p.width / 2)), h = Math.max(1, Math.round(p.height / 2));
  const file = p.id + '.png';
  await sharp(src).resize(w, h, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(path.join(out, file));
  list.push({
    id: p.id, file: 'r3/' + file, z: p.z, parent: p.parent, group: p.group, visible: p.visible !== false,
    x: p.x / 4, y: p.y / 4, w: p.width / 4, h: p.height / 4, pivot: p.pivot.map(v => v / 4),
    source: { file: p.file, sha256: crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') }
  });
}
const rig = Object.fromEntries(Object.entries(manifest.rig).map(([k, v]) => [k, { parent: v.parent, pivot: v.pivot.map(x => x / 4) }]));
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ source: 'R3 Hibiki_R3_Mesh_Mask_20261028 + Hand4_Registered_v2', units: '1024x1536 (R3 px / 4)', textureScale: 2, rig, parts: list }, null, 1));
console.log('parts', list.length);
