// Take the iris outline out of the upper lash parts. The lashes were cut as the
// difference against the white and the iris drawn under them, so the dark rim
// of art A's iris where it meets the white (thin vertical strokes and the arc
// along the top of the iris) ended up in the lash layer and stayed on the white
// when the iris moved. Inside the iris circle (plus its rim), below the upper
// lid line, the lash layer is cleared; the lash and eyeliner along the lid stay.
// The iris part itself is a full disc (its hidden top was completed when it was
// cut), so it shows round wherever it moves.
// Usage: node clean-lash.cjs <parts dir>   (reads face-def.json next to this file)
const sharp = require('sharp'); const fs = require('fs'); const path = require('path');
const dir = process.argv[2], def = JSON.parse(fs.readFileSync(path.join(__dirname, 'face-def.json')));
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json')));
const curve = (pts, x) => { const p = [...pts].sort((a, b) => a[0] - b[0]); if (x <= p[0][0]) return p[0][1]; for (let i = 0; i < p.length - 1; i++) if (x <= p[i + 1][0]) return p[i][1] + (p[i + 1][1] - p[i][1]) * (x - p[i][0]) / (p[i + 1][0] - p[i][0]); return p[p.length - 1][1]; };
(async () => {
  for (const side of ['L', 'R']) {
    const e = def['eye' + side], [cx, cy, r] = e.iris, upper = e.open.slice(0, 12), name = 'eye_lash_upper_' + side, m = meta[name];
    const file = path.join(dir, name + '.png');
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const ax = m.x + x + 0.5, ay = m.y + y + 0.5, i = (y * info.width + x) * 4;
      if (!data[i + 3]) continue;
      const d = Math.hypot(ax - cx, ay - cy), below = ay - curve(upper, ax);
      // fade out from 1 px to 2.5 px below the lid line, only around the iris
      const k = d < r + 2.5 && below > 1 ? Math.max(0, 1 - (below - 1) / 1.5) : 1;
      if (k < 1) { data[i + 3] = Math.round(data[i + 3] * k); n++; }
    }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(file + '.tmp');
    fs.renameSync(file + '.tmp', file);
    console.log(name, 'pixels cleared', n);
  }
})();
