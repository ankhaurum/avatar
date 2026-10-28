// Cut Hibiki's head skin, neck and hair from approved art A at its native resolution.
// Layers, bottom to top: neck (under the R3 collar), head skin, the face features
// cut by extract-face.cjs (eyes, brows, lips), side hair, fringe.
// - Skin: the filled base from extract-face.cjs (eyes, brows and mouth already
//   filled); the forehead and the skin hidden under the hair are filled by
//   harmonic interpolation from the visible skin (the feature boxes keep the
//   filled base, which the features were cut against). The neck fades out above
//   the collar so the neck layer continues it.
// - Neck: art A's neck (skin and the hair's shadow) down to its shirt collar.
// - Hair: everything of the head outside the skin (hair, parting, ears) at art
//   A's own alpha; over the jacket only the bright blue strands, un-mixed from
//   the white cloth. Over the skin the hair layer is the exact difference
//   between art A and the skin with the features drawn on it, so the rest pose
//   recomposes to art A. Split with soft borders into the fringe and the sides.
// Inputs: env S (work dir with face/parts/face_base_full.png and the feature
// parts), A (avatar repo).
const sharp = require('sharp'); const fs = require('fs');
const S = process.env.S, A = process.env.A, W = 1024, H = 1536;
const poly = { // art A px
  skinHull: [[450,168],[480,160],[527,157],[575,160],[605,168],[625,198],[640,235],[652,270],[646,315],[632,340],[616,368],[596,392],[586,402],[590,428],[466,428],[470,402],[456,392],[438,366],[424,340],[398,318],[376,300],[374,250],[398,236],[428,198]],
  hairArea: [[290,20],[740,20],[760,300],[770,500],[290,500],[270,300]],
  neck: [[452,330],[600,330],[612,420],[640,470],[610,520],[440,520],[414,470],[444,420]],
  neckSide: [[440,380],[612,380],[628,420],[648,446],[640,484],[414,484],[404,446],[426,420]],
  fringe: [[440,112],[615,112],[628,170],[632,232],[618,268],[440,268],[424,232],[428,170]]
};
// face features in their draw order (the iris is clipped by the eye white)
const FEATURES = ['eye_white_L', 'eye_iris_L', 'eye_lash_lower_L', 'eye_lash_upper_L', 'eye_white_R', 'eye_iris_R', 'eye_lash_lower_R', 'eye_lash_upper_R', 'brow_L', 'brow_R', 'lip_lower', 'lip_upper'];
const svgMask = async (pts, blur) => { const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%"/><polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="#fff"/></svg>`; let im = sharp(Buffer.from(s)); if (blur) im = im.blur(blur); const { data } = await im.greyscale().raw().toBuffer({ resolveWithObject: true }); return Float32Array.from(data, v => v / 255); };
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
(async () => {
  const O = await sharp(A + '/v3/artwork/hibiki-static-a.png').raw().toBuffer();
  const B = await sharp(S + '/face/parts/face_base_full.png').raw().toBuffer();
  const out = S + '/face/parts', meta = JSON.parse(fs.readFileSync(out + '/meta.json'));
  const hull = await svgMask(poly.skinHull, 0), hullSoft = await svgMask(poly.skinHull, 1.2), area = await svgMask(poly.hairArea, 1), neckM = await svgMask(poly.neck, 8), neckSideM = await svgMask(poly.neckSide, 4), fr = await svgMask(poly.fringe, 5);
  const inFeature = new Uint8Array(W * H);
  for (const n of FEATURES) { const m = meta[n]; for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) inFeature[y * W + x] = 1; }
  // hair amount; inside the skin it is judged on the filled base, so the eyes and brows do not count as hair
  const hair = new Float32Array(W * H), warm = new Float32Array(W * H);
  // strands over the clothes: blue enough, bright enough (the jacket trim is a darker blue)
  // and connected to the hair above the collars; they fade out towards their tips
  const strand = new Float32Array(W * H), conn = new Uint8Array(W * H), q = [];
  for (let i = 415 * W; i < 520 * W; i++) { const r = O[i * 4], g = O[i * 4 + 1], b = O[i * 4 + 2]; strand[i] = smooth((b - Math.max(r, g) - 20) / 40) * smooth((b - 165) / 25) * (O[i * 4 + 3] / 255); }
  for (let i = 415 * W; i < 416 * W; i++) if (strand[i] > 0.3) { conn[i] = 1; q.push(i); }
  while (q.length) { const i = q.pop(), x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 415 * W && j < 520 * W && !conn[j] && strand[j] > 0.3) { conn[j] = 1; q.push(j); } }
  // soften the connected set by one pixel so strand edges keep their partial alpha
  const near = j => conn[j] || conn[j - 1] || conn[j + 1] || conn[j - W] || conn[j + W];
  for (let i = 0; i < W * H; i++) {
    const C = hull[i] > 0.5 ? B : O, r = C[i * 4], g = C[i * 4 + 1], b = C[i * 4 + 2], al = O[i * 4 + 3] / 255, y = Math.floor(i / W);
    warm[i] = smooth((r - b - 4) / 22);
    const blue = smooth((b - Math.max(r, g) - 10) / 50);
    if (hull[i] > 0.5) hair[i] = Math.max(blue, 1 - warm[i]) * al;
    else {
      // above the collars: the whole head at art A's alpha (minus the neck skin);
      // beside the neck only the blue strands (the skin and shirt there belong to
      // the neck layer); over the clothes: bright blue strands only (the jacket
      // trim is darker)
      const head = (1 - Math.max(neckM[i], neckSideM[i]) * (1 - blue)) * al, t = smooth((y - 422) / 10);
      const tip = y >= 415 && y < 520 && near(i) ? strand[i] * (1 - smooth((y - 450) / 22)) : 0;
      hair[i] = (1 - t) * head + t * tip;
    }
  }
  // skin: harmonic fill where hair covers the skin hull and on the whole forehead
  const F = new Float32Array(W * H * 3), fill = [];
  for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) F[i * 3 + c] = B[i * 4 + c]; if (hull[i] > 0.5 && !inFeature[i] && (hair[i] > 0.03 || O[i * 4 + 3] < 250 || warm[i] < 0.97 || i < 236 * W)) fill.push(i); }
  const inFill = new Uint8Array(W * H); for (const i of fill) inFill[i] = 1;
  const known = j => hull[j] > 0.5 && !inFill[j];
  let m = [0, 0, 0], n = 0; for (let i = 0; i < W * H; i++) if (known(i)) { for (let c = 0; c < 3; c++) m[c] += F[i * 3 + c]; n++; }
  for (const i of fill) for (let c = 0; c < 3; c++) F[i * 3 + c] = m[c] / n;
  for (let it = 0; it < 4000; it++) for (const i of fill) for (let c = 0; c < 3; c++) { let t = 0, k = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (hull[j] > 0.5) { t += F[j * 3 + c]; k++; } if (k) F[i * 3 + c] = t / k; }
  // what lies under the hair at rest: the skin with the features drawn on it
  const U = Float32Array.from(F);
  let whiteA = null;
  for (const name of FEATURES) {
    const f = meta[name], { data } = await sharp(out + '/' + name + '.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (/white/.test(name)) whiteA = { f, data };
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const k = (y * f.w + x) * 4; let a = data[k + 3] / 255;
      if (/iris/.test(name)) { const wx = f.x + x - whiteA.f.x, wy = f.y + y - whiteA.f.y; const inside = wx >= 0 && wy >= 0 && wx < whiteA.f.w && wy < whiteA.f.h && whiteA.data[(wy * whiteA.f.w + wx) * 4 + 3] >= 128; if (!inside) a = 0; }
      if (a <= 0) continue;
      const i = (f.y + y) * W + f.x + x; for (let c = 0; c < 3; c++) U[i * 3 + c] = data[k + c] * a + U[i * 3 + c] * (1 - a);
    }
  }
  const skin = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { if (hullSoft[i] <= 0.004) continue; const y = Math.floor(i / W); const neck = 1 - smooth((y - 404) / 22); for (let c = 0; c < 3; c++) skin[i * 4 + c] = Math.round(F[i * 3 + c]); skin[i * 4 + 3] = Math.round(255 * hullSoft[i] * neck); }
  // hair layers
  const layers = { hair_front: Buffer.alloc(W * H * 4), hair_side_R: Buffer.alloc(W * H * 4), hair_side_L: Buffer.alloc(W * H * 4) };
  for (let i = 0; i < W * H; i++) {
    const h = hair[i] * area[i], over = hull[i] > 0.5;
    if (h <= 0.01 && !(over && (inFill[i] || inFeature[i]))) continue;
    const x = i % W, y = Math.floor(i / W);
    let a, col = [O[i * 4], O[i * 4 + 1], O[i * 4 + 2]];
    if (over) { // exact difference against what lies under, at least as opaque as the hair is blue
      const b = [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]]; a = smooth((h - 0.03) / 0.5);
      for (let c = 0; c < 3; c++) { const o = col[c]; if (o < b[c]) a = Math.max(a, (b[c] - o) / Math.max(1, b[c])); else if (o > b[c]) a = Math.max(a, (o - b[c]) / Math.max(1, 255 - b[c])); }
      a = Math.min(1, a); if (a < 0.012) continue; col = col.map((o, c) => Math.max(0, Math.min(255, (o - (1 - a) * b[c]) / a)));
    } else {
      a = h;
      // strands over the white jacket: remove the cloth colour mixed into their edges
      const t = smooth((y - 422) / 10), al = O[i * 4 + 3] / 255, s = y >= 415 && y < 520 ? Math.min(1, strand[i] / Math.max(0.01, al)) : 1;
      if (t > 0 && s < 0.99) { const k = 1 - (1 - s) * t; col = col.map(o => Math.max(0, Math.min(255, (o - (1 - s) * t * 236) / Math.max(0.05, k)))); }
    }
    if (a < 0.002) continue;
    const wf = fr[i], ws = smooth((x - 519) / 16); // soft split: fringe / viewer-left (R) / viewer-right (L)
    // layers drawn first stay opaque across a soft border, the layer drawn over
    // them fades in, so the rest pose has no translucent seam
    const parts = { hair_side_R: wf < 0.999 && ws < 0.999 ? 1 : 0, hair_side_L: wf < 0.999 ? ws : 0, hair_front: wf };
    for (const [k, w] of Object.entries(parts)) { if (w * a < 0.004) continue; const L = layers[k]; for (let c = 0; c < 3; c++) L[i * 4 + c] = Math.round(col[c]); L[i * 4 + 3] = Math.round(255 * a * w); }
  }
  // neck under the R3 collar: art A's neck below the jaw (skin and the hair's
  // shadow on it). Where art A shows its shirt collar beside the neck (the R3
  // collar sits lower), the skin is filled harmonically from the neck, so the
  // gaps between the hair tips show skin instead of the background (only the
  // plain skin is interpolated, not the hair's shadow).
  const neckSide = neckSideM, neck = Buffer.alloc(W * H * 4), N = new Float32Array(W * H * 3), nf = [], keep = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = O[i * 4], g = O[i * 4 + 1], b = O[i * 4 + 2], blue = smooth((b - Math.max(r, g) - 10) / 50), shirt = smooth(((r + g + b) / 3 - 196) / 20) * (1 - warm[i]);
    // hair over the neck stays in this layer (no holes behind the hair tips); lower down, blue is the tie
    keep[i] = (1 - blue * smooth((Math.floor(i / W) - 445) / 10)) * (1 - shirt) * O[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) N[i * 3 + c] = O[i * 4 + c];
    if (neckSide[i] > 0.01 && !(neckM[i] > 0.5 && keep[i] >= 0.9)) nf.push(i);
  }
  const inN = new Uint8Array(W * H); for (const i of nf) inN[i] = 1;
  { const m = [0, 0, 0]; let n = 0; for (let i = 0; i < W * H; i++) if (neckM[i] > 0.5 && keep[i] >= 0.9 && warm[i] > 0.6) { for (let c = 0; c < 3; c++) m[c] += O[i * 4 + c]; n++; } for (const i of nf) for (let c = 0; c < 3; c++) N[i * 3 + c] = m[c] / n; }
  for (let it = 0; it < 3000; it++) for (const i of nf) for (let c = 0; c < 3; c++) { let t = 0, k = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (inN[j] || (neckM[j] > 0.5 && keep[j] >= 0.9 && warm[j] > 0.6)) { t += N[j * 3 + c]; k++; } if (k) N[i * 3 + c] = t / k; }
  // the filled skin stays under the hair (it shows only in the gaps and when the head turns)
  const hc = Buffer.alloc(W * H); for (let i = 0; i < W * H; i++) hc[i] = Math.round(255 * Math.min(1, hair[i] * area[i]));
  const cover = await sharp(hc, { raw: { width: W, height: H, channels: 1 } }).blur(4).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < W * H; i++) {
    const a = Math.max(neckM[i] * keep[i], neckSide[i] * (inN[i] ? smooth((cover[i] / 255 - 0.55) / 0.35) : 1)); if (a < 0.004) continue;
    const k = inN[i] ? 0 : 1; for (let c = 0; c < 3; c++) neck[i * 4 + c] = Math.round(k ? O[i * 4 + c] : N[i * 3 + c]); neck[i * 4 + 3] = Math.round(255 * Math.min(1, a));
  }
  const save = async (name, buf) => {
    let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
    await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png({ compressionLevel: 9 }).toFile(out + '/' + name + '.png');
    meta[name] = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  await save('neck_skin', neck); await save('head_skin', skin); for (const [k, v] of Object.entries(layers)) await save(k, v);
  fs.writeFileSync(out + '/meta.json', JSON.stringify(meta, null, 1));
  console.log('head parts written', Object.keys(meta).filter(k => /head|hair|neck/.test(k)).map(k => k + ':' + meta[k].w + 'x' + meta[k].h).join(' '));
})();
