// The inside of the mouth (Codex's oral-cavity.png, copied by prepare-oral.mjs)
// is a flat mid pink-red: between the upper teeth and the lower lip it reads
// as a flat sheet, not as the dark of the mouth. Here it is shaded like the
// reference smile (studies/continuity/materials/smile-local.png: under the
// upper teeth a dark shadow, lighter only low down toward the tongue): a
// vertical gradient, 0.38 at the top to 0.8 at the bottom, with the saturation
// kept. Recorded in parts/oral/cavity.json (idempotent). Usage: node darken-cavity.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const file = path.resolve(here, '../parts/oral/oral-cavity.png'), log = path.resolve(here, '../parts/oral/cavity.json');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const done = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log)) : null;
if (done && done.after === sha(file)) { console.log('already shaded'); process.exit(0); }
const before = sha(file);
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, out = Buffer.from(data);
for (let y = 0; y < H; y++) { const t = y / (H - 1), k = 0.38 + (0.8 - 0.38) * t * t; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; for (let c = 0; c < 3; c++) out[i + c] = Math.round(data[i + c] * k); } }
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
fs.writeFileSync(log, JSON.stringify({ source: 'studies/continuity/materials/oral-cavity.png', before, after: sha(file), gradient: [0.38, 0.8] }, null, 1));
console.log('shaded', file);
