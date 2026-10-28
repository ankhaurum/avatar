// Cut Hibiki's head skin and hair from approved art A at its native resolution.
// - Skin: the filled base from extract-face.cjs (eyes, brows and mouth already
//   filled); the forehead, temples and cheek edges hidden under the hair are
//   filled by harmonic interpolation from the visible skin. The neck fades out
//   above the collar so the R3 neck continues it.
// - Hair: blue pixels of art A. Over the skin the hair layer is the exact
//   difference against the filled skin, so the rest pose recomposes to art A.
//   It is split (with soft borders) into the fringe and the left/right sides.
// Inputs: env S (work dir with face/parts/face_base_full.png), A (avatar repo).
const sharp = require('sharp'); const fs = require('fs');
const S = process.env.S, A = process.env.A, W = 1024, H = 1536;
const poly = { // art A px
  skinHull: [[450,168],[480,160],[527,157],[575,160],[605,168],[625,198],[640,235],[652,270],[646,315],[632,340],[616,368],[596,392],[586,402],[590,428],[466,428],[470,402],[456,392],[438,366],[424,340],[398,318],[376,300],[374,250],[398,236],[428,198]],
  hairArea: [[290,20],[740,20],[760,300],[760,480],[640,482],[625,455],[590,440],[470,440],[430,455],[420,482],[280,480],[270,300]],
  fringe: [[440,112],[615,112],[628,170],[632,232],[618,268],[440,268],[424,232],[428,170]]
};
const svgMask = async (pts, blur) => { const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%"/><polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="#fff"/></svg>`; let im = sharp(Buffer.from(s)); if (blur) im = im.blur(blur); const { data } = await im.greyscale().raw().toBuffer({ resolveWithObject: true }); return Float32Array.from(data, v => v / 255); };
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
(async () => {
  const O = (await sharp(A + '/v3/artwork/hibiki-static-a.png').raw().toBuffer());
  const B = (await sharp(S + '/face/parts/face_base_full.png').raw().toBuffer());
  const hull = await svgMask(poly.skinHull, 0), hullSoft = await svgMask(poly.skinHull, 1.2), area = await svgMask(poly.hairArea, 1), fr = await svgMask(poly.fringe, 5);
  // hair amount: inside the skin hull, how far a pixel is from warm skin (blue or
  // grey strands); outside it every opaque pixel of the head is hair except skin
  const hair = new Float32Array(W * H), warm = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = O[i * 4], g = O[i * 4 + 1], b = O[i * 4 + 2], al = O[i * 4 + 3] / 255;
    warm[i] = smooth((r - b - 4) / 22);
    const blue = smooth((b - Math.max(r, g) - 10) / 50);
    hair[i] = (hull[i] > 0.5 ? Math.max(blue, 1 - warm[i]) : 1 - warm[i] * (1 - blue)) * al;
  }
  // skin: harmonic fill where hair covers the skin hull
  const F = new Float32Array(W * H * 3), fill = [];
  for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) F[i * 3 + c] = B[i * 4 + c]; if (hull[i] > 0.5 && (hair[i] > 0.03 || O[i * 4 + 3] < 250 || warm[i] < 0.97 || i < 236 * W)) fill.push(i); /* whole forehead */ }
  const inFill = new Uint8Array(W * H); for (const i of fill) inFill[i] = 1;
  const known = j => hull[j] > 0.5 && !inFill[j];
  // initialise with the mean visible skin, then relax (Jacobi, Neumann outside the hull)
  let m = [0, 0, 0], n = 0; for (let i = 0; i < W * H; i++) if (known(i)) { for (let c = 0; c < 3; c++) m[c] += F[i * 3 + c]; n++; }
  for (const i of fill) for (let c = 0; c < 3; c++) F[i * 3 + c] = m[c] / n;
  for (let it = 0; it < 4000; it++) for (const i of fill) for (let c = 0; c < 3; c++) { let t = 0, k = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (hull[j] > 0.5) { t += F[j * 3 + c]; k++; } if (k) F[i * 3 + c] = t / k; }
  const skin = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { if (hullSoft[i] <= 0.004) continue; const y = Math.floor(i / W); const neck = 1 - smooth((y - 404) / 22); for (let c = 0; c < 3; c++) skin[i * 4 + c] = Math.round(F[i * 3 + c]); skin[i * 4 + 3] = Math.round(255 * hullSoft[i] * neck); }
  // hair layers
  const layers = { hair_front: Buffer.alloc(W * H * 4), hair_side_R: Buffer.alloc(W * H * 4), hair_side_L: Buffer.alloc(W * H * 4) };
  for (let i = 0; i < W * H; i++) {
    // where the skin was filled, the hair layers carry whatever differs from art A
    const h = hair[i] * area[i]; if (h <= 0.01 && !inFill[i]) continue;
    const x = i % W, over = hull[i] > 0.5;
    let a, col = [O[i * 4], O[i * 4 + 1], O[i * 4 + 2]];
    if (over) { // difference against the filled skin, at least as opaque as the hair is blue
      const b = [F[i * 3], F[i * 3 + 1], F[i * 3 + 2]]; a = smooth((h - 0.03) / 0.5);
      for (let c = 0; c < 3; c++) { const o = col[c]; if (o < b[c]) a = Math.max(a, (b[c] - o) / Math.max(1, b[c])); else if (o > b[c]) a = Math.max(a, (o - b[c]) / Math.max(1, 255 - b[c])); }
      a = Math.min(1, a); col = col.map((o, c) => Math.max(0, Math.min(255, (o - (1 - a) * b[c]) / a)));
    } else a = h;
    if (a < 0.002) continue;
    const wf = fr[i], ws = smooth((x - 519) / 16); // soft split: fringe / viewer-left (R) / viewer-right (L)
    // layers drawn first stay opaque across a soft border, the layer drawn over
    // them fades in, so the rest pose has no translucent seam
    const parts = { hair_side_R: wf < 0.999 && ws < 0.999 ? 1 : 0, hair_side_L: wf < 0.999 ? ws : 0, hair_front: wf };
    for (const [k, w] of Object.entries(parts)) { if (w * a < 0.004) continue; const L = layers[k]; for (let c = 0; c < 3; c++) L[i * 4 + c] = Math.round(col[c]); L[i * 4 + 3] = Math.round(255 * a * w); }
  }
  const out = S + '/face/parts', meta = JSON.parse(fs.readFileSync(out + '/meta.json'));
  const save = async (name, buf) => {
    let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
    await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png({ compressionLevel: 9 }).toFile(out + '/' + name + '.png');
    meta[name] = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  await save('head_skin', skin); for (const [k, v] of Object.entries(layers)) await save(k, v);
  fs.writeFileSync(out + '/meta.json', JSON.stringify(meta, null, 1));
  console.log('head parts written', Object.keys(meta).filter(k => /head|hair/.test(k)).map(k => k + ':' + meta[k].w + 'x' + meta[k].h).join(' '));
})();
