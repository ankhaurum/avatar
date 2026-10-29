// Motion layer: turns intentions (look here, talk, smile, wave) into rig
// parameter values. Gesture tracks carry the timing of a movement; every output
// also goes through a critically damped spring, so switching state never jumps; secondary motion (hair, fabric) is left to the
// rig physics, which reads the results.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

// smooth value noise for idle drift
function noise1(seed) {
  const r = i => { const x = Math.sin((i + seed * 101) * 127.1) * 43758.5453; return x - Math.floor(x); };
  return t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return (r(i) * (1 - u) + r(i + 1) * u) * 2 - 1; };
}

class Spring {
  constructor(v = 0, hz = 3) { this.x = v; this.v = 0; this.hz = hz; }
  step(target, dt, hz = this.hz) {
    const w = TAU * hz, h = Math.min(dt, 0.05);
    // exact step of a critically damped spring
    const e = Math.exp(-w * h), d = this.x - target, c = this.v + w * d;
    this.x = target + (d + c * h) * e;
    this.v = (this.v - c * w * h) * e;
    return this.x;
  }
}

export const EXPRESSIONS = {
  // default: a natural smile, lips parted a little so the upper teeth show
  neutral: { EyeSmile: 0.55, MouthForm: 1, BrowY: 0.1, BrowAngle: 0, eye: 1, mouth: 0.6 },
  smile: { EyeSmile: 0.75, MouthForm: 1, BrowY: 0.25, BrowAngle: 0.1, eye: 0.92, mouth: 0.55 },
  surprise: { EyeSmile: 0, MouthForm: 0, BrowY: 1, BrowAngle: 0.3, eye: 1, mouth: 0.45 },
  think: { EyeSmile: 0, MouthForm: -0.2, BrowY: 0.2, BrowAngle: -0.8, eye: 0.85, lookY: 0.6, lookX: -0.5 },
  sad: { EyeSmile: 0, MouthForm: -0.8, BrowY: -0.2, BrowAngle: 1, eye: 0.8 }
};

// Keyframes [time, value] joined with slow-in / slow-out.
function keys(t, list) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) if (t <= list[i][0]) { const [t0, a] = list[i - 1], [t1, b] = list[i]; return a + (b - a) * ease((t - t0) / (t1 - t0)); }
  return list[list.length - 1][1];
}
// One arm moved like a person's: the shoulder leads, the elbow follows 0.05 s
// later and the wrist 0.1 s later (drag); each joint list starts with a small
// counter-move (anticipation), overshoots a little where the motion stops and
// settles (follow-through). Lists are [time, angle] for Shoulder, Elbow, Wrist.
function arm(p, side, t, S, E, W) {
  p['Shoulder' + side] = keys(t, S);
  p['Elbow' + side] = keys(t - 0.05, E);
  p['Wrist' + side] = keys(t - 0.1, W);
}
// a beat that fades in and out inside [a, b]
const beat = (t, a, b, hz, phase = 0) => Math.sin((t - a) * TAU * hz - phase) * ease((t - a) / 0.2) * (1 - ease((t - b + 0.25) / 0.25));

// Gesture tracks: time (s) -> partial pose. Arm angles in degrees.
// Pose arms: no cross-fade. The everyday arms move (0.42 s) to the approach
// pose, the nearest their joints come to the drawn pose (the angles are fitted
// by tools/pose-enter.mjs and written into the rig as poseApproach). At 0.5 s
// they are replaced in one frame by the pose arms, deformed onto the same
// shoulders, elbows, wrists and hand directions (PoseEnter 0), which then
// unfold into the drawn pose over 0.3 s. On the way back the pose arms fold
// back onto the approach (0.3 s), the everyday arms take over in one frame and
// return to rest.
// A pose with an in-between drawing of the right arm (reach; the rig's
// poseStages is 2) takes two stages: at 0.5 s the right everyday arm is
// replaced by the in-between layer (PoseEnter 0 -> 0.5 over 0.3 s, unfolding
// to the drawing), which then deforms on toward the pose (0.5 -> 1 over
// 0.3 s); at PoseEnter 0.85 (MID_SWITCH) both arms are replaced in one frame
// by the pose layers, laid on the same joints. The left everyday arm, which
// has no in-between drawing, reaches its approach just before that switch.
// The way back is the reverse.
const SWITCH = 0.5, UNFOLD = 0.3, MID_SWITCH = 0.85;
const seg = (t, a, b, from, to) => from + (to - from) * ease((t - a) / (b - a));
function poseTrack(param, extra) {
  return function (t, p) {
    const d = this.duration, staged = this.stages === 2;
    const appr = this.approach || {};
    const set = (side, near) => { for (const [k, v] of Object.entries(appr)) if (k.endsWith(side)) p[k] = /Short/.test(k) ? 1 + (v - 1) * near : v * near; };
    if (!staged) {
      const out = d - 0.75, back = out + UNFOLD;
      const near = keys(t, [[0, 0], [0.12, -0.04], [0.42, 1], [back, 1], [back + 0.45, 0]]);
      set('R', near); set('L', near);
      const on = t >= SWITCH && t < back ? 1 : 0;
      p[param] = on; p.ArmsDefaultR = 1 - on; p.ArmsDefaultL = 1 - on;
      p.PoseEnter = on ? ease((t - SWITCH) / UNFOLD) * (1 - ease((t - out) / UNFOLD)) : 0;
      extra(ease(t / 0.5) * (1 - ease((t - out) / 0.6)), p);
      return;
    }
    // stage times on the way in: in-between shown from SWITCH; PoseEnter
    // 0 -> 0.5 by t1, 0.5 -> 1 by t2; the pose layers from PoseEnter MID_SWITCH (tm)
    const t1 = SWITCH + UNFOLD, t2 = t1 + UNFOLD, tm = t1 + UNFOLD * (MID_SWITCH - 0.5) / 0.5;
    // on the way out: PoseEnter 1 -> 0.5 by o1 (the pose layers until om), 0.5 -> 0 by o2, then the everyday arms return
    const out = d - (2 * UNFOLD + 0.45), o1 = out + UNFOLD, o2 = o1 + UNFOLD, om = out + UNFOLD * (1 - MID_SWITCH) / 0.5;
    set('R', keys(t, [[0, 0], [0.12, -0.04], [0.42, 1], [o2, 1], [o2 + 0.45, 0]]));
    set('L', keys(t, [[0, 0], [0.3, -0.04], [tm - 0.06, 1], [om, 1], [om + 0.45, 0]]));
    let pe = 0;
    if (t < SWITCH) pe = 0; else if (t < t1) pe = seg(t, SWITCH, t1, 0, 0.5); else if (t < t2) pe = seg(t, t1, t2, 0.5, 1); else if (t < out) pe = 1;
    else if (t < o1) pe = seg(t, out, o1, 1, 0.5); else if (t < o2) pe = seg(t, o1, o2, 0.5, 0); else pe = 0;
    const mid = (t >= SWITCH && t < tm) || (t >= om && t < o2), pose = t >= tm && t < om;
    p[param] = pose ? 1 : 0; p[param + 'Mid'] = mid ? 1 : 0;
    p.ArmsDefaultR = mid || pose ? 0 : 1; p.ArmsDefaultL = pose ? 0 : 1;
    p.PoseEnter = pe;
    extra(ease(t / 0.5) * (1 - ease((t - out) / 0.6)), p);
  };
}
// a hand shape held from a to b: the drawn hand is swapped in one frame (no
// cross-fade, no half-transparent overlap), at a point of the motion where
// the hand is moving
function handShape(p, side, shape, t, a, b) {
  if (t >= a && t < b) { p['Hand' + side] = shape; p['HandFade' + side] = 1; }
}

export const GESTURES = {
  // right hand (viewer left) raised beside the face, palm forward with the
  // thumb toward the body; the wave is a small to-and-fro of the forearm with
  // the wrist trailing it
  wave: { duration: 3.4, hand: 'R', track: (t, p) => {
    arm(p, 'R', t, [[0, 0], [0.18, -3], [0.6, 12], [0.75, 10], [2.6, 10], [3.05, -2], [3.35, 0]],
      [[0, 0], [0.2, -8], [0.66, 152], [0.82, 144], [2.6, 144], [3.1, -5], [3.4, 0]],
      [[0, 0], [0.22, 6], [0.7, -12], [0.88, 4], [1.0, 0], [2.6, 0], [3.12, 8], [3.4, 0]]);
    p.ElbowR += 4 * beat(t, 0.85, 2.55, 1.9); p.WristR += 15 * beat(t, 0.85, 2.55, 1.9, 1.0);
    handShape(p, 'R', 2, t, 0.42, 3.0);
    const up = keys(t - 0.1, [[0, 0], [0.7, 1], [2.7, 1], [3.3, 0]]);
    p.BodyAngleZ = -1.5 * up; p.AngleZ = -5 * up; p.AngleX = -4 * up; p.EyeSmileAdd = 0.5 * up;
  } },
  // left hand opens to the side, presenting, with a beat while talking
  explain: { duration: 3.8, hand: 'L', track: (t, p) => {
    arm(p, 'L', t, [[0, 0], [0.15, -3], [0.6, 24], [0.75, 22], [3.0, 22], [3.5, -2], [3.8, 0]],
      [[0, 0], [0.18, -6], [0.66, 52], [0.8, 48], [3.0, 48], [3.55, -4], [3.8, 0]],
      [[0, 0], [0.2, 5], [0.7, -20], [0.85, -14], [3.0, -15], [3.6, 4], [3.8, 0]]);
    p.ElbowL += 7 * beat(t, 0.8, 3.0, 0.9); p.WristL += 6 * beat(t, 0.8, 3.0, 0.9, 0.8);
    handShape(p, 'L', 1, t, 0.35, 3.4);
    const up = keys(t - 0.08, [[0, 0], [0.7, 1], [3.1, 1], [3.8, 0]]), b = beat(t, 0.8, 3.0, 0.9, 0.4);
    p.BodyAngleX = 3 * up; p.AngleX = 5 * up + 2 * b; p.AngleZ = 3 * up;
  } },
  // both hands brought together in front of the waist
  // both hands laid one over the other in front of the skirt, backs of the
  // hands to the front (pose arms from the drawn pose: the hand shapes needed
  // cannot be made by turning or mirroring the hand images)
  // the everyday hands reach the drawn place here (within a few px), so the change is nearly a morph
  both: { pose: 'hands', duration: 3.6, hand: 'both', track: poseTrack('PoseHands', (k, p) => { p.EyeSmileAdd = 0.4 * k; p.AngleY = -3 * k; p.AngleZ = 2 * k; }) },
  // left arm raised from the shoulder, index finger pointing outward
  point: { duration: 3.0, hand: 'L', track: (t, p) => {
    arm(p, 'L', t, [[0, 0], [0.2, -4], [0.7, 64], [0.85, 59], [2.3, 60], [2.8, -3], [3.0, 0]],
      [[0, 0], [0.22, -8], [0.72, 6], [0.9, 11], [2.3, 10], [2.85, -4], [3.0, 0]],
      [[0, 0], [0.25, 5], [0.78, -10], [0.95, -5], [2.3, -6], [2.9, 3], [3.0, 0]]);
    handShape(p, 'L', 3, t, 0.4, 2.6);
    const up = keys(t - 0.12, [[0, 0], [0.75, 1], [2.4, 1], [3.0, 0]]);
    p.BodyAngleX = 4 * up; p.AngleX = 12 * up; p.EyeBallXAdd = 0.6 * keys(t, [[0, 0], [0.3, 1], [2.3, 1], [2.7, 0]]);
  } },
  // pose arms from the drawn poses: the everyday arms move toward the body,
  // the pose arms are laid over them and then the everyday arms are hidden
  chest: { pose: 'chest', duration: 3.8, hand: 'both', track: poseTrack('PoseChest', (k, p) => { p.EyeSmileAdd = 0.6 * k; p.AngleY = -4 * k; p.BodyAngleY = -2 * k; }) },
  chin: { pose: 'chin', duration: 4.2, hand: 'both', track: poseTrack('PoseChin', (k, p) => { p.AngleZ = 4 * k; p.AngleY = 3 * k; p.HeadHold = k; p.LookX = -0.45 * k; p.LookY = 0.5 * k; }) },
  reach: { pose: 'reach', duration: 3.8, hand: 'both', track: poseTrack('PoseReach', (k, p) => { p.EyeSmileAdd = 0.5 * k; p.BodyAngleY = 3 * k; p.AngleY = 2 * k; p.AngleX = -4 * k; }) },
  // right hand loosely closed in front of the waist, head tilted
  think: { duration: 3.6, hand: 'R', track: (t, p) => {
    arm(p, 'R', t, [[0, 0], [0.18, -2], [0.7, 30], [0.85, 28], [2.9, 28], [3.35, -2], [3.6, 0]],
      [[0, 0], [0.2, 5], [0.72, -130], [0.88, -124], [2.9, -125], [3.4, 4], [3.6, 0]],
      [[0, 0], [0.25, -4], [0.78, 24], [0.95, 19], [2.9, 20], [3.45, -3], [3.6, 0]]);
    handShape(p, 'R', 4, t, 0.4, 3.2);
    const up = keys(t - 0.15, [[0, 0], [0.8, 1], [3.0, 1], [3.6, 0]]);
    p.AngleZ = 7 * up; p.AngleY = 4 * up;
  } },
  // nod twice: down quickly, a small bounce back, down again, then back up and settle; the eyes drop a little
  nod: { duration: 1.5, track: (t, p) => {
    const k = keys(t, [[0, 0], [0.06, 0.08], [0.22, -1], [0.36, -0.25], [0.52, -0.85], [0.78, 0.1], [0.98, -0.04], [1.2, 0]]);
    p.AngleY = 16 * k; p.BodyAngleY = 2.5 * k; p.EyeBallYAdd = 0.35 * Math.min(0, k);
  } },
  tilt: { duration: 2.2, track: (t, p) => { const k = ease(t / 0.5) * (1 - ease((t - 1.6) / 0.6)); p.AngleZ = 11 * k; p.AngleX = 6 * k; p.BodyAngleZ = 2 * k; } }
};

export class MotionController {
  constructor(model) {
    this.model = model;
    this.t = 0;
    this.springs = {};
    this.look = { x: 0, y: 0, until: 0 };
    this.facing = 0;
    this.auto = { x: 0, y: 0, next: 1 };
    this.blink = { next: 2, phase: -1, double: false, due: -1 };
    this.expression = 'neutral';
    this.talking = 0; this.talkUntil = 0;
    this.syll = { t: 0, len: 0.15, peak: 0, form: 0 };
    // speech runs in phrases with short pauses; a small nod marks the ends of phrases
    this.phrase = { t: 0, len: 0, pause: false, nodAt: -9, nodKind: 0, wasTalking: false };
    // breathing: a slow, slightly uneven cycle (the inhale shorter than the exhale)
    this.breath = { phase: 0, period: 3.6 };
    // idle: now and then the weight shifts to the other side (body roll, hips, the head stays level)
    this.shift = { next: 5, t0: -9, from: [0, 0], to: [0, 0] };
    this.lastLook = [0, 0];
    this.gestures = [];
    this.n = [1, 2, 3, 4, 5, 6, 7].map(noise1);
    this.has = id => model.parameters.some(p => p.id === id);
    // Motion size: 0 = shown large (amounts near Live2D's usual ones), 1 = shown
    // small (larger nods, gestures, glances and sway, crisper timing, so the
    // motion still reads). Set from the shown size; reduced motion keeps it calm.
    this.size = 0; this.calm = false;
  }
  // where the avatar sits on the screen (-1 left .. 1 right); the body and face
  // turn toward the screen centre from there
  setMotionSize(v, calm = false) { this.size = clamp(v, 0, 1); this.calm = calm; }
  setFacing(f) { this.facing = clamp(f, -1, 1); }
  lookAt(x, y, hold = 1.5) { this.look.x = clamp(x, -1, 1); this.look.y = clamp(y, -1, 1); this.look.until = this.t + hold; }
  setExpression(name) { if (EXPRESSIONS[name]) this.expression = name; }
  // V2 states and emotions (emotion.js Performance). When set, it decides the
  // face, the body's emotional posture and the speaking flag.
  setPerformance(perf) { this.perf = perf || null; }
  talk(seconds) { this.talkUntil = Math.max(this.talkUntil, this.t + seconds); }
  gesture(name) {
    const g = GESTURES[name]; if (!g) return;
    const clash = x => g.hand && x.g.hand && (x.g.hand === g.hand || g.hand === 'both' || x.g.hand === 'both');
    // a running pose-arm gesture finishes first (its arms must switch back);
    // other gestures for the same hand are replaced and the springs blend the change
    const pose = this.gestures.filter(x => clash(x) && x.g.pose);
    const start = pose.length ? Math.max(...pose.map(x => x.start + x.g.duration)) : this.t;
    this.gestures = this.gestures.filter(x => !clash(x) || x.g.pose);
    // the pose gestures take their approach angles from the rig
    if (g.pose && this.model.json?.poseApproach) { g.approach = this.model.json.poseApproach[g.pose]; g.stages = this.model.json.poseStages?.[g.pose] || 1; }
    this.gestures.push({ g, start });
  }
  spring(id, target, dt, hz) { if (!this.springs[id]) this.springs[id] = new Spring(target, hz); return this.springs[id].step(target, dt, hz); }
  update(dt) {
    const t = (this.t += dt), m = this.model, n = this.n;
    // face and posture targets: the V2 performance when there is one, else the page's expression
    const pf = this.perf ? this.perf.sample() : null;
    const ex = pf ? { EyeSmile: pf.smile, MouthForm: pf.form, BrowY: pf.browY, BrowAngle: pf.browAngle, eye: pf.eye, mouth: pf.mouth, wide: pf.wide, pucker: pf.pucker, shift: pf.shift, ...(pf.look ? { lookX: pf.look[0], lookY: pf.look[1] } : {}) } : EXPRESSIONS[this.expression];
    if (pf) { if (pf.speaking && !this.perfTalk) this.talkUntil = Infinity; if (!pf.speaking && this.perfTalk) this.talkUntil = t; this.perfTalk = pf.speaking; }
    // amounts by display size (g); reduced motion halves the idle motion
    // The face stays near the front at every size: the head's share does not grow
    // with g (follow, idle head drift, gesture head motion stay as on a large
    // display); the body turn, the body's idle sway, the gestures' body motion
    // and the swaying parts carry the extra motion of a small display.
    const g = this.calm ? 0 : this.size, calm = this.calm ? 0.5 : 1, idle = 0.9 * calm, bodyIdle = lerp(0.9, 2.2, g) * calm, accent = 1, bodyAccent = lerp(1, 1.8, g), snap = lerp(1, 1.3, g);
    // placement: the body carries the turn (to the full range when small), the head adds a little
    const placeBody = lerp(0.92, 1, g), placeHead = 0.2, follow = 0.33;
    const pose = {};
    for (const x of this.gestures) if (t >= x.start) x.g.track.call(x.g, t - x.start, pose);
    this.gestures = this.gestures.filter(x => t - x.start < x.g.duration);
    // gaze target: pointer if recent, otherwise idle glances
    if (t > this.auto.next) {
      const r = Math.random();
      this.auto.x = r < 0.45 ? 0 : (Math.random() * 2 - 1) * 0.7; this.auto.y = r < 0.45 ? 0 : (Math.random() * 2 - 1) * 0.35;
      this.auto.next = t + 1.2 + Math.random() * 2.8;
    }
    const pointer = t < this.look.until && !pose.LookX;
    // Placement: the body and head turn toward the screen centre and keep that
    // orientation (a placement at the side of the page, about 0.42 from the
    // centre, gives the full turn). As a Live2D modeller would, the body carries
// the orientation (BodyAngleX 10, the full range), the head only follows a
// little the same way (about 8 of 30, the face stays near the front) and the
// eyes look at the viewer.
    // The idle glances happen around it. Look targets are in screen terms
    // (-1 left .. 1 right, 0 = straight at the viewer).
    const place = this.spring('facing', clamp(-this.facing / 0.42, -1, 1), dt, 0.8 * snap);
    let lx = pointer ? this.look.x : this.auto.x * 0.35, ly = pointer ? this.look.y : this.auto.y * 0.8;
    if (ex.lookX !== undefined && !pointer) { lx = place * 0.5 + ex.lookX * 0.6; ly = ex.lookY; }
    if (pose.LookX) { lx = pose.LookX; ly = pose.LookY || 0; }
    // never past the front toward the outside of the page
    const keepSide = v => place < -0.05 ? Math.min(v, 0.1) : place > 0.05 ? Math.max(v, -0.1) : v;
    // a new look target: the eyes go first, the head follows about 0.1 s later
    // and the body after that (each target is passed down through a slower
    // spring); a large jump of the gaze brings a blink with it
    const jump = Math.hypot(lx - this.lastLook[0], ly - this.lastLook[1]);
    if (jump > 0.45 && this.blink.phase < 0 && this.blink.due < 0 && Math.random() < 0.7) this.blink.due = t + 0.05 + Math.random() * 0.1;
    this.lastLook = [lx, ly];
    const lxH = this.spring('lxHead', lx, dt, 5), lyH = this.spring('lyHead', ly, dt, 5);
    const lxB = this.spring('lxBody', lxH, dt, 2.5), lyB = this.spring('lyBody', lyH, dt, 2.5);
    // head: the placement turn plus part of the way to the target (slower);
    // body: most of the placement turn plus a little of the target (slowest);
    // eyes: whatever is left, so they look at the viewer or the pointer
    // looking down (a pointer below the face) the head takes a smaller share
    // than looking up, so the face is not left hanging and the eyes keep their
    // opening: at most about 6 deg down, 11 up
    const headX = this.spring('headX', keepSide(place * placeHead + (lxH - place * 0.3) * follow), dt, 2.4 * snap), headY = this.spring('headY', lyH * (lyH > 0 ? 0.25 : 0.45), dt, 2.4 * snap);
    const bodyX = this.spring('bodyX', keepSide(place * placeBody + (lxB - place * 0.3) * lerp(0.1, 0.35, g) * (1 - 0.6 * Math.abs(place))), dt, 0.8 * snap), bodyY = this.spring('bodyY', lyB * lerp(0.45, 0.9, g), dt, 0.8 * snap);
    const eyeX = this.spring('eyeX', clamp((lx - headX) * 1.1, -1, 1), dt, 7), eyeY = this.spring('eyeY', ly - headY * 0.6, dt, 7);
    // speech: phrases of 1.2-2.8 s with pauses of 0.25-0.5 s between them (the
    // lips together); inside a phrase, syllables with varied length, height and
    // lip shape. The end of a phrase, and the end of the speech, get a small nod.
    const talking = t < this.talkUntil, ph = this.phrase;
    let mouth = 0, formAdd = 0;
    if (talking) {
      if (!ph.wasTalking) { ph.t = 0; ph.len = 0.8 + Math.random() * 1.2; ph.pause = false; ph.nodKind = 1; ph.nodAt = t; }
      ph.t += dt;
      if (ph.t > ph.len) {
        ph.t = 0;
        if (ph.pause) { ph.pause = false; ph.len = 1.2 + Math.random() * 1.6; }
        else { ph.pause = true; ph.len = 0.25 + Math.random() * 0.25; ph.nodAt = t; ph.nodKind = Math.random() < 0.6 ? 1 : 2; if (this.blink.phase < 0 && this.blink.due < 0 && Math.random() < 0.5) this.blink.due = t + 0.1; }
      }
      if (!ph.pause) {
        const s = this.syll; s.t += dt;
        if (s.t > s.len) { s.t = 0; s.len = 0.09 + Math.random() * 0.16; s.peak = Math.random() < 0.15 ? 0.05 : 0.3 + Math.random() * 0.6; s.form = (Math.random() * 2 - 1) * 0.35; }
        // each syllable opens and shuts; the last 20 % of it the lips stay together
        mouth = s.peak * Math.sin(Math.PI * clamp(s.t / (s.len * 0.8), 0, 1)); formAdd = s.form * 0.5;
      }
    } else if (ph.wasTalking) { ph.nodAt = t; ph.nodKind = 2; if (this.blink.phase < 0 && this.blink.due < 0) this.blink.due = t + 0.15 + Math.random() * 0.2; }
    ph.wasTalking = talking;
    // the phrase nod: a quick dip (kind 1, 0.4 s) or a slower, slightly deeper one with a settle (kind 2, 0.6 s)
    const nt = t - ph.nodAt, talkNod = ph.nodKind === 1 ? keys(nt, [[0, 0], [0.08, 0.12], [0.22, -1], [0.4, 0]]) : keys(nt, [[0, 0], [0.1, 0.1], [0.3, -1], [0.48, 0.15], [0.62, 0]]);
    const talkAmt = this.spring('talkAmt', talking ? 1 : 0, dt, 2);
    // blinking: quick close, short hold, slower open; sometimes twice. The
    // intervals vary (2.5-7 s, shorter while thinking, with a slow drift of the
    // rate); a blink is also brought forward by a large gaze jump, the end of a
    // phrase or of the speech, and a change of state (set as "due").
    const b = this.blink; let lid = 1;
    if (pf && pf.state !== this.lastState) { if (b.phase < 0 && b.due < 0 && ['attention', 'notify', 'thinking', 'wake', 'happy'].includes(pf.state)) b.due = t + 0.12 + Math.random() * 0.1; this.lastState = pf.state; }
    if (b.phase < 0 && ((b.due >= 0 && t >= b.due) || t > b.next)) { b.phase = 0; b.due = -1; }
    if (b.phase >= 0) {
      b.phase += dt; const p = b.phase;
      lid = p < 0.07 ? 1 - ease(p / 0.07) : p < 0.11 ? 0 : 1 - ease(1 - (p - 0.11) / 0.13);
      if (p > 0.24) {
        b.phase = -1; b.double = !b.double && Math.random() < 0.18;
        const rate = (pf && pf.state === 'thinking') ? 0.7 : (talking ? 0.85 : 1);
        b.next = t + (b.double ? 0.18 : (2.5 + Math.random() * 2.5 + Math.random() * 2) * rate * (1 + 0.25 * n[6](t * 0.05)));
      }
    }
    const eyeOpen = this.spring('eyeOpen', ex.eye ?? 1, dt, 3) * lid;
    const smile = this.spring('eyeSmile', clamp((ex.EyeSmile ?? 0) + (pose.EyeSmileAdd || 0), 0, 1), dt, 2.5);
    // breathing: an uneven cycle (the inhale takes 42 %, the exhale 58 %), its
    // period drifting 3.2-4.2 s; faster and shallower when thinking (pf.breath)
    const br = this.breath; br.phase += dt / br.period;
    if (br.phase >= 1) { br.phase -= 1; br.period = 3.2 + Math.random() * 1.0; }
    const bp = br.phase, breath = (bp < 0.42 ? ease(bp / 0.42) : 1 - ease((bp - 0.42) / 0.58)) * (pf ? pf.breath : 1);
    // weight shift: every 5-12 s the body rolls a little to one side and turns
    // a touch (1.2 s, eased); the head counters it to stay level
    const sh = this.shift;
    if (t > sh.next && !this.gestures.length) { sh.from = sh.to; sh.to = [(Math.random() * 2 - 1) * 1.6, (Math.random() * 2 - 1) * 1.4]; sh.t0 = t; sh.next = t + 5 + Math.random() * 7; }
    const shK = ease((t - sh.t0) / 1.2), shiftZ = lerp(sh.from[0], sh.to[0], shK) * bodyIdle, shiftX = lerp(sh.from[1], sh.to[1], shK) * bodyIdle;
    // emotional posture: carried by the body and shoulders (larger when shown
    // small), the head only tilts and nods a little
    const em = pf || {}, emBody = lerp(1, 1.8, g), bounce = em.bounce ? Math.max(0, Math.sin(t * TAU * 1.6)) * em.bounce : 0;
    const eLean = this.spring('eLean', ((em.lean || 0) + bounce * 2) * emBody, dt, 2.2 * snap), eRoll = this.spring('eRoll', (em.roll || 0) * emBody, dt, 1.8 * snap);
    const eTilt = this.spring('eTilt', em.tilt || 0, dt, 1.8), ePitch = this.spring('ePitch', em.pitch || 0, dt, em.once ? 6 : 2), eArms = this.spring('eArms', (em.arms || 0) * emBody, dt, 2.2 * snap);
    const eShrug = this.spring('eShrug', clamp((em.shrug || 0) * lerp(1, 1.3, g), 0, 1), dt, 6);
    const out = {
      AngleX: clamp((headX * 30 + (n[0](t * 0.23) * 3 + talkAmt * n[3](t * 1.3) * 2) * idle) * (1 - 0.8 * (pose.HeadHold || 0)) + (pose.AngleX || 0) * accent, -24, 24),
      // the breath lifts the head a touch at the top of the inhale; the phrase nod dips it
      AngleY: clamp((-headY * 24 + (n[1](t * 0.19) * 2.5 + talkAmt * Math.max(0, n[4](t * 1.7)) * -2) * idle + breath * 0.7) * (1 - 0.8 * (pose.HeadHold || 0)) + (pose.AngleY || 0) * accent + ePitch + talkNod * lerp(4.5, 6.5, g) * (1 - 0.8 * (pose.HeadHold || 0)), -24, 24),
      AngleZ: clamp(n[2](t * 0.17) * 3 * idle + (pose.AngleZ || 0) * accent - headX * 2 + eTilt - shiftZ * 0.5, -20, 20),
      EyeBallX: clamp(eyeX + (pose.EyeBallXAdd || 0), -1, 1), EyeBallY: clamp(eyeY + (pose.EyeBallYAdd || 0) + talkNod * 0.12, -1, 1),
      BodyAngleX: clamp(bodyX * 10 + n[5](t * 0.13) * 1.2 * bodyIdle + shiftX + (pose.BodyAngleX || 0) * bodyAccent, -10, 10),
      BodyAngleY: clamp(n[6](t * 0.11) * 1.5 * bodyIdle + (pose.BodyAngleY || 0) * bodyAccent - bodyY * 12 + eLean + talkNod * 1.2, -10, 10),
      BodyAngleZ: clamp(n[5](t * 0.09 + 3) * 1.5 * bodyIdle + shiftZ + (pose.BodyAngleZ || 0) * bodyAccent - bodyX * 2.5 + eRoll, -10, 10),
      Breath: breath,
      ShoulderUp: eShrug,
      BrowY: (ex.BrowY ?? 0) + talkAmt * Math.max(0, n[3](t * 2.1)) * 0.3,
      BrowAngle: ex.BrowAngle ?? 0,
      MouthForm: clamp((ex.MouthForm ?? 0) + formAdd, -1, 1),
      // the eyes and mouth carry what the brows cannot (the fringe hides them);
      // pursing eases while speaking
      EyeWide: ex.wide || 0, MouthPucker: (ex.pucker || 0) * (1 - 0.6 * talkAmt), MouthShift: ex.shift || 0,
      ShoulderL: (pose.ShoulderL || 0) + (pose.ShoulderL === undefined ? eArms : 0), ElbowL: pose.ElbowL || 0, WristL: pose.WristL || 0, ForearmL: pose.ForearmL || 0,
      ShoulderR: (pose.ShoulderR || 0) + (pose.ShoulderR === undefined ? eArms : 0), ElbowR: pose.ElbowR || 0, WristR: pose.WristR || 0, ForearmR: pose.ForearmR || 0,
      UpperShortL: pose.UpperShortL ?? 1, ForeShortL: pose.ForeShortL ?? 1, UpperShortR: pose.UpperShortR ?? 1, ForeShortR: pose.ForeShortR ?? 1
    };
    const fast = { EyeBallX: 0, EyeBallY: 0 };
    // the arms settle quickly (10 Hz) while a pose gesture runs, so they are at the approach when the pose arms take over
    const armHz = this.gestures.some(x => x.g.pose) ? 10 : 6;
    for (const [k, v] of Object.entries(out)) if (this.has(k)) m.set(k, k in fast ? v : this.spring('p_' + k, v, dt, k.startsWith('Shoulder') || k.startsWith('Elbow') || k.startsWith('Wrist') || k.startsWith('Forearm') || k.endsWith('ShortL') || k.endsWith('ShortR') ? armHz : (k === 'AngleY' || k === 'EyeWide' ? 9 : 4) * snap));
    // the hips and skirt come round a little after the chest
    if (this.has('LowerAngleX')) m.set('LowerAngleX', this.spring('lowerX', m.values.BodyAngleX, dt, 2.2 * snap));
    // swaying parts: larger swings when shown small, calmer with reduced motion
    if (m.physics) m.physics.gain = lerp(0.9, 1.7, g) * (this.calm ? 0.6 : 1);
    m.set('EyeLOpen', eyeOpen); m.set('EyeROpen', eyeOpen); m.set('EyeSmile', smile);
    // pose arm cross-fading and arrival are set directly; their timing is in the gesture track
    if (this.has('ArmsDefault')) { m.set('ArmsDefault', 1); for (const s of ['R', 'L']) if (this.has('ArmsDefault' + s)) m.set('ArmsDefault' + s, pose['ArmsDefault' + s] ?? 1); for (const k of ['PoseChest', 'PoseChin', 'PoseReach', 'PoseHands', 'PoseReachMid']) if (this.has(k)) m.set(k, pose[k] || 0); }
    if (this.has('PoseEnter')) m.set('PoseEnter', pose.PoseEnter ?? 1);
    // while talking the syllables open and close the mouth from fully closed;
    // otherwise it rests at the expression's opening
    m.set('MouthOpen', clamp(this.spring('mouth', talking ? mouth : ex.mouth ?? 0, dt, talking ? 14 : 5), 0, 1));
    // hand shapes: the chosen shape, cross-faded with the resting hand by HandFade (timed in the track)
    for (const s of ['L', 'R']) if (this.has('Hand' + s)) { m.set('Hand' + s, pose['Hand' + s] || 0); if (this.has('HandFade' + s)) m.set('HandFade' + s, pose['HandFade' + s] ?? 1); }
  }
}
