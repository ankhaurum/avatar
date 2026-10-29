// Take the fringe strands out of the brow parts: blue pixels (hair over the
// brow ends in art A) were cut into the brows and moved with them. The hair
// layer, cut after this, carries those strands instead.
// Usage: node clean-brow.cjs <parts dir>   (rewrites brow_L.png, brow_R.png)
const sharp = require('sharp'); const fs = require('fs'); const path = require('path');
const dir = process.argv[2], smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
(async () => {
  for (const side of ['L', 'R']) {
    const file = path.join(dir, 'brow_' + side + '.png');
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let i = 0; i < info.width * info.height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], blue = smooth((b - Math.max(r, g) - 12) / 30);
      if (blue > 0 && data[i * 4 + 3]) { data[i * 4 + 3] = Math.round(data[i * 4 + 3] * (1 - blue)); n++; }
    }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(file + '.tmp'); fs.renameSync(file + '.tmp', file);
    console.log('brow_' + side, 'blue pixels', n);
  }
})();
