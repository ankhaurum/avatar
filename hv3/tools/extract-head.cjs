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
//   A's own alpha; the tips over art A's jacket are cut along their lower
//   contour, with the shirt between the strands filled from the hair around. Over the skin the hair layer is the exact difference
//   between art A and the skin with the features drawn on it, so the rest pose
//   recomposes to art A. Split with soft borders into the fringe and the sides.
// - Underlay: the skin continued about 30 px outward under the hair, cheeks,
//   jaw and ears, drawn below everything of the head, so that turning the head
//   never shows the background between the moved parts.
// Inputs: env S (work dir with face/parts/face_base_full.png and the feature
// parts), A (avatar repo).
const sharp = require('sharp'); const fs = require('fs');
const S = process.env.S, A = process.env.A, W = 1024, H = 1536;
const poly = { // art A px
  skinHull: [[450,168],[480,160],[527,157],[575,160],[605,168],[625,198],[640,235],[652,270],[646,315],[632,340],[616,368],[596,392],[586,402],[590,428],[466,428],[470,402],[456,392],[438,366],[424,340],[398,318],[376,300],[374,250],[398,236],[428,198]],
  hairArea: [[290,20],[740,20],[760,300],[770,500],[290,500],[270,300]],
  neck: [[452,330],[600,330],[612,420],[640,470],[610,520],[440,520],[414,470],[444,420]],
  tipsL: [[280,400],[455,400],[454,425],[446,446],[422,456],[400,459],[370,458],[332,452],[300,442],[282,420]],
  tipsR: [[570,400],[740,400],[738,420],[700,440],[674,448],[655,451],[636,455],[611,460],[590,453],[578,440],[572,422]],
  neckSide: [[444,380],[608,380],[620,416],[634,446],[628,484],[424,484],[414,446],[428,416]],
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
  const hull = await svgMask(poly.skinHull, 0), hullSoft = await svgMask(poly.skinHull, 1.2), hullWide = await svgMask(poly.skinHull, 7), area = await svgMask(poly.hairArea, 1), neckM = await svgMask(poly.neck, 8), neckSideM = await svgMask(poly.neckSide, 4), fr = await svgMask(poly.fringe, 5);
  const inFeature = new Uint8Array(W * H);
  for (const n of FEATURES) { const m = meta[n]; for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) inFeature[y * W + x] = 1; }
  // hair amount; inside the skin it is judged on the filled base, so the eyes and brows do not count as hair
  const hair = new Float32Array(W * H), warm = new Float32Array(W * H);
  // hair tips (below y 405, outside the skin): the hair masses down to the
  // tips' lower contour in art A. Inside them, pixels that are not hair (art
  // A's shirt between the strands) take the colour of the hair around them
  // (harmonic fill), so the tips read as hair over the R3 body, not as specks.
  const tipsM = Float32Array.from(await svgMask(poly.tipsL, 1.2), (v, i) => v), tipsR = await svgMask(poly.tipsR, 1.2);
  for (let i = 0; i < W * H; i++) tipsM[i] = Math.max(tipsM[i], tipsR[i]);
  const isHair = i => O[i * 4 + 2] - Math.max(O[i * 4], O[i * 4 + 1]) > 25 && O[i * 4 + 3] > 200;
  const Hc = new Float32Array(W * H * 3), inT = new Uint8Array(W * H), tf = [];
  for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) Hc[i * 3 + c] = O[i * 4 + c]; const y = Math.floor(i / W); if (y >= 405 && y < 480 && tipsM[i] > 0.01 && hull[i] <= 0.5 && !isHair(i)) { inT[i] = 1; tf.push(i); } }
  { const m = [0, 0, 0]; let n = 0; for (let i = 405 * W; i < 480 * W; i++) if (tipsM[i] > 0.5 && isHair(i)) { for (let c = 0; c < 3; c++) m[c] += O[i * 4 + c]; n++; } for (const i of tf) for (let c = 0; c < 3; c++) Hc[i * 3 + c] = m[c] / n; }
  for (let it = 0; it < 400; it++) for (const i of tf) for (let c = 0; c < 3; c++) { let t = 0, k = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (inT[j] || (tipsM[j] > 0.01 && isHair(j))) { t += Hc[j * 3 + c]; k++; } if (k) Hc[i * 3 + c] = t / k; }
  for (let i = 0; i < W * H; i++) {
    const C = hull[i] > 0.5 ? B : O, r = C[i * 4], g = C[i * 4 + 1], b = C[i * 4 + 2], al = O[i * 4 + 3] / 255, y = Math.floor(i / W);
    warm[i] = smooth((r - b - 4) / 22);
    const blue = smooth((b - Math.max(r, g) - 10) / 50);
    // bright, not blue pixels on the skin (the nose highlight) are skin, not hair
    const bright = smooth(((r + g + b) / 3 - 205) / 25) * (1 - blue);
    if (hull[i] > 0.5) hair[i] = Math.max(blue, (1 - warm[i]) * (1 - bright)) * al;
    else {
      // the whole head at art A's alpha, except beside the neck, where only the
      // blue strands count (the skin and shirt there belong to the neck layer);
      // lower down, the hair-tip masses
      const head = (1 - Math.max(neckM[i], neckSideM[i]) * (1 - smooth((b - Math.max(r, g) + 5) / 30))) * al, t = smooth((y - 405) / 8);
      hair[i] = (1 - t) * head + t * tipsM[i] * al;
    }
  }
  // skin: harmonic fill where hair covers the skin hull and on the whole forehead
  const F = new Float32Array(W * H * 3), fill = [];
  for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) F[i * 3 + c] = B[i * 4 + c]; if (hull[i] > 0.5 && !inFeature[i] && (hair[i] > 0.03 || O[i * 4 + 3] < 250 || (warm[i] < 0.97 && (B[i * 4] + B[i * 4 + 1] + B[i * 4 + 2]) / 3 < 225) || i < 236 * W)) fill.push(i); }
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
  const lashBox = i => { const x = i % W, y = (i - x) / W; for (const n of ['eye_lash_upper_L', 'eye_lash_upper_R', 'eye_lash_lower_L', 'eye_lash_lower_R']) { const m = meta[n]; if (x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h) return true; } return false; };
  // Hidden skin at the sides and the underlay: the colour of the nearest
  // visible skin (smoothed), darkened outward like art A's cheeks and jaw
  // (about 9 % darker 34 px out, as art A's cheek next to the hair), so turning the head shows a shaded side of
  // the face and no light band. Within 6 px of the visible skin it blends from
  // the harmonic fill, so there is no seam.
  const visible = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (hull[i] > 0.5 && !inFill[i] && warm[i] > 0.9 && O[i * 4 + 3] > 250) visible[i] = 1;
  const SD = new Float32Array(W * H).fill(255), SC = new Float32Array(W * H * 3);
  { let front = []; for (let i = 0; i < W * H; i++) if (visible[i]) { SD[i] = 0; for (let c = 0; c < 3; c++) SC[i * 3 + c] = F[i * 3 + c]; front.push(i); }
    for (let r = 1; r <= 60 && front.length; r++) { const next = []; for (const i of front) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && SD[j] === 255) { SD[j] = r; for (let c = 0; c < 3; c++) SC[j * 3 + c] = SC[i * 3 + c]; next.push(j); } } front = next; } }
  // smoothed only inside the reached area (premultiplied blur, divided by the blurred coverage)
  { const buf = Buffer.alloc(W * H * 4); for (let i = 0; i < W * H; i++) { const k = SD[i] < 255 ? 1 : 0; for (let c = 0; c < 3; c++) buf[i * 4 + c] = Math.round(SC[i * 3 + c] * k); buf[i * 4 + 3] = 255 * k; }
    const bl = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).blur(7).raw().toBuffer(); for (let i = 0; i < W * H; i++) if (bl[i * 4 + 3] > 8) for (let c = 0; c < 3; c++) SC[i * 3 + c] = bl[i * 4 + c] * 255 / bl[i * 4 + 3]; }
  const shadeAt = (i, base) => { const d = SD[i], k = 1 - 0.09 * smooth(d / 34), w = smooth(d / 6); return [0, 1, 2].map(c => base[c] * (1 - w) + SC[i * 3 + c] * k * w); };
  // the hidden skin at the sides (below the forehead) takes the shaded colour
  for (const i of fill) if (Math.floor(i / W) > 250) { const v = shadeAt(i, [F[i * 3], F[i * 3 + 1], F[i * 3 + 2]]); for (let c = 0; c < 3; c++) F[i * 3 + c] = v[c]; }
  const skin = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { if (hullSoft[i] <= 0.004) continue; const y = Math.floor(i / W); const neck = 1 - smooth((y - 404) / 22); for (let c = 0; c < 3; c++) skin[i * 4 + c] = Math.round(F[i * 3 + c]); skin[i * 4 + 3] = Math.round(255 * (SD[i] > 2 ? Math.min(hullSoft[i], smooth(hullWide[i] * 1.6 - 0.4)) : hullSoft[i]) * neck) /* hidden sides fade over ~7 px into the underlay */; }
  // hair layers
  const layers = { hair_front: Buffer.alloc(W * H * 4), hair_side_R: Buffer.alloc(W * H * 4), hair_side_L: Buffer.alloc(W * H * 4) };
  for (let i = 0; i < W * H; i++) {
    const h = hair[i] * area[i], over = hull[i] > 0.5;
    if (h <= 0.01 && !(over && (inFill[i] || inFeature[i]))) continue;
    const x = i % W, y = Math.floor(i / W);
    let a, col = [O[i * 4], O[i * 4 + 1], O[i * 4 + 2]];
    const onLash = lashBox(i);
    if (over && onLash) { // over the lashes: blue strands only, at their own alpha
      a = smooth((h - 0.05) / 0.6) * smooth((O[i * 4 + 2] - Math.max(O[i * 4], O[i * 4 + 1]) - 15) / 40); if (a < 0.012) continue;
    } else if (over) { // exact difference against what lies under, at least as opaque as the hair is blue
      const b = [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]]; a = smooth((h - 0.03) / 0.5);
      for (let c = 0; c < 3; c++) { const o = col[c]; if (o < b[c]) a = Math.max(a, (b[c] - o) / Math.max(1, b[c])); else if (o > b[c]) a = Math.max(a, (o - b[c]) / Math.max(1, 255 - b[c])); }
      a = Math.min(1, a); if (a < 0.012) continue; col = col.map((o, c) => Math.max(0, Math.min(255, (o - (1 - a) * b[c]) / a)));
    } else {
      a = h;
      if (inT[i]) col = [Hc[i * 3], Hc[i * 3 + 1], Hc[i * 3 + 2]];
    }
    if (a < 0.002) continue;
    const wf = fr[i], ws = smooth((x - 519) / 16); // soft split: fringe / viewer-left (R) / viewer-right (L)
    // layers drawn first stay opaque across a soft border, the layer drawn over
    // them fades in, so the rest pose has no translucent seam
    const parts = { hair_side_R: wf < 0.999 && ws < 0.999 ? 1 : 0, hair_side_L: wf < 0.999 ? ws : 0, hair_front: wf };
    for (const [k, w] of Object.entries(parts)) { if (w * a < 0.004) continue; const L = layers[k]; for (let c = 0; c < 3; c++) L[i * 4 + c] = Math.round(col[c]); L[i * 4 + 3] = Math.round(255 * a * w); }
  }
  // neck under the R3 collar: only skin. Art A's neck skin is kept; where art A
  // shows hair, the hair's shadow or its shirt collar on and beside the neck
  // (the R3 collar sits lower), the skin is filled harmonically from the visible
  // neck skin, so the gaps between the hair tips show neck, not specks.
  const neckSide = neckSideM, neck = Buffer.alloc(W * H * 4), N = new Float32Array(W * H * 3), nf = [], skinOK = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = O[i * 4], g = O[i * 4 + 1], b = O[i * 4 + 2], blue = smooth((b - Math.max(r, g) - 10) / 50), shirt = smooth(((r + g + b) / 3 - 196) / 20) * (1 - warm[i]);
    for (let c = 0; c < 3; c++) N[i * 3 + c] = O[i * 4 + c];
    skinOK[i] = neckM[i] > 0.5 && blue < 0.1 && shirt < 0.1 && warm[i] > 0.5 && O[i * 4 + 3] > 240 ? 1 : 0;
    if (Math.max(neckM[i], neckSide[i]) > 0.01 && !skinOK[i]) nf.push(i);
  }
  const inN = new Uint8Array(W * H); for (const i of nf) inN[i] = 1;
  { const m = [0, 0, 0]; let n = 0; for (let i = 0; i < W * H; i++) if (skinOK[i]) { for (let c = 0; c < 3; c++) m[c] += O[i * 4 + c]; n++; } for (const i of nf) for (let c = 0; c < 3; c++) N[i * 3 + c] = m[c] / n; }
  for (let it = 0; it < 3000; it++) for (const i of nf) for (let c = 0; c < 3; c++) { let t = 0, k = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (inN[j] || skinOK[j]) { t += N[j * 3 + c]; k++; } if (k) N[i * 3 + c] = t / k; }
  // the filled neck sides darken outward like the face sides (no light band beside the jaw)
  { const ND = new Uint8Array(W * H).fill(255); let front = []; for (let i = 0; i < W * H; i++) if (skinOK[i]) { ND[i] = 0; front.push(i); }
    for (let r = 1; r < 60 && front.length; r++) { const next = []; for (const i of front) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && ND[j] === 255) { ND[j] = r; next.push(j); } } front = next; }
    for (const i of nf) { const kk = 1 - 0.2 * smooth(ND[i] / 30); for (let c = 0; c < 3; c++) N[i * 3 + c] *= kk; } }
  // beside the neck the filled skin stays under the hair (it shows only in the gaps and when the head turns)
  const hc = Buffer.alloc(W * H); for (let i = 0; i < W * H; i++) hc[i] = Math.round(255 * Math.min(1, hair[i] * area[i]));
  const cover = await sharp(hc, { raw: { width: W, height: H, channels: 1 } }).blur(4).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < W * H; i++) {
    const a = Math.max(neckM[i], neckSide[i] * smooth((cover[i] / 255 - 0.2) / 0.3)); if (a < 0.004) continue;
    for (let c = 0; c < 3; c++) neck[i * 4 + c] = Math.round(N[i * 3 + c]); neck[i * 4 + 3] = Math.round(255 * Math.min(1, a));
  }
  // drop specks: pieces not connected to the layer's main body below y0
  const prune = (buf, y0, minArea) => {
    const lab = new Int32Array(W * H).fill(-1), sizes = [];
    for (let i = y0 * W; i < W * H; i++) {
      if (lab[i] >= 0 || buf[i * 4 + 3] < 26) continue;
      const id = sizes.length, q = [i]; lab[i] = id; let n = 0, reachesUp = false;
      while (q.length) { const j = q.pop(), x = j % W; n++; if (j < (y0 + 1) * W) reachesUp = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = j + dy * W + dx; if ((dx || dy) && x + dx >= 0 && x + dx < W && k >= y0 * W && k < W * H && lab[k] < 0 && buf[k * 4 + 3] >= 26) { lab[k] = id; q.push(k); } } }
      sizes.push(reachesUp || n >= minArea);
    }
    for (let i = y0 * W; i < W * H; i++) {
      // faint pixels go with a neighbouring kept piece, or with nothing
      let keep = lab[i] >= 0 ? sizes[lab[i]] : false;
      if (lab[i] < 0 && buf[i * 4 + 3]) for (const k of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) if (k >= y0 * W && k < W * H && lab[k] >= 0 && sizes[lab[k]]) { keep = true; break; }
      if (!keep) buf[i * 4 + 3] = 0;
    }
  };
  prune(layers.hair_side_R, 410, 400); prune(layers.hair_side_L, 410, 400); prune(neck, 380, 2000);
  const save = async (name, buf) => {
    let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
    await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png({ compressionLevel: 9 }).toFile(out + '/' + name + '.png');
    meta[name] = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  // (filled outward from the skin hull by repeated neighbour averaging, ~34 px wide)
  {
    const C = new Float32Array(W * H * 3), known = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (hull[i] > 0.5) { known[i] = 1; for (let c = 0; c < 3; c++) C[i * 3 + c] = F[i * 3 + c]; }
    let front = []; for (let i = 0; i < W * H; i++) if (known[i]) front.push(i);
    const dist = new Uint8Array(W * H);
    for (let r = 1; r <= 34; r++) {
      const next = [];
      for (const i of front) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && !known[j] && Math.floor(j / W) < 448) { known[j] = 2; next.push(j); } }
      for (const j of next) { const t = [0, 0, 0]; let k = 0; const x = j % W; for (const q of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) if (q >= 0 && known[q] === 1) { for (let c = 0; c < 3; c++) t[c] += C[q * 3 + c]; k++; } for (let c = 0; c < 3; c++) C[j * 3 + c] = t[c] / Math.max(1, k); known[j] = 1; dist[j] = r; }
      front = next;
    }
    const under = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) if (known[i] && SD[i] < 255) { const v = shadeAt(i, [C[i * 3], C[i * 3 + 1], C[i * 3 + 2]]); for (let c = 0; c < 3; c++) C[i * 3 + c] = v[c]; }
    for (let i = 0; i < W * H; i++) { if (!known[i]) continue; const a = hull[i] > 0.5 ? 1 : 1 - smooth((dist[i] - 26) / 8); if (a <= 0.004) continue; const y = Math.floor(i / W); for (let c = 0; c < 3; c++) under[i * 4 + c] = Math.round(C[i * 3 + c]); under[i * 4 + 3] = Math.round(255 * a * (1 - smooth((y - 432) / 14)) * (hull[i] > 0.5 ? 1 : 1 - neck[i * 4 + 3] / 255)); } // the neck layer shows its own skin there
    await save('head_under', under);
  }
  await save('neck_skin', neck); await save('head_skin', skin); for (const [k, v] of Object.entries(layers)) await save(k, v);
  fs.writeFileSync(out + '/meta.json', JSON.stringify(meta, null, 1));
  console.log('head parts written', Object.keys(meta).filter(k => /head|hair|neck/.test(k)).map(k => k + ':' + meta[k].w + 'x' + meta[k].h).join(' '));
})();
