// Motion layer: turns intentions (look here, talk, smile, wave) into rig
// parameter values. Gesture tracks carry the timing of a movement; every output
// also goes through a critically damped spring, so switching state never jumps; secondary motion (hair, fabric) is left to the
// rig physics, which reads the results.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
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
  neutral: { EyeSmile: 0.8, MouthForm: 1, BrowY: 0.1, BrowAngle: 0, eye: 0.94, mouth: 0.6 },
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
// Pose arms: the everyday arms move toward the drawn pose; at the moment they
// cover the same place the pose arms replace them in one frame, and the reverse
// on the way back.
function poseTrack(param, approach, extra) {
  return function (t, p) {
    const d = this.duration, out = d - 0.75;
    const near = keys(t, [[0, 0], [0.12, -0.04], [0.45, 1], [out + 0.15, 1], [out + 0.7, 0]]);
    for (const [k, v] of Object.entries(approach)) p[k] = v * near;
    const on = t >= 0.36 && t < out + 0.2 ? 1 : 0;
    p[param] = on;
    p.ArmsDefault = 1 - on;
    extra(ease(t / 0.5) * (1 - ease((t - out) / 0.6)), p);
  };
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
    if (t > 0.42 && t < 3.0) p.HandR = 2;
    const up = keys(t - 0.1, [[0, 0], [0.7, 1], [2.7, 1], [3.3, 0]]);
    p.BodyAngleZ = -1.5 * up; p.AngleZ = -5 * up; p.AngleX = -4 * up; p.EyeSmileAdd = 0.5 * up;
  } },
  // left hand opens to the side, presenting, with a beat while talking
  explain: { duration: 3.8, hand: 'L', track: (t, p) => {
    arm(p, 'L', t, [[0, 0], [0.15, -3], [0.6, 24], [0.75, 22], [3.0, 22], [3.5, -2], [3.8, 0]],
      [[0, 0], [0.18, -6], [0.66, 52], [0.8, 48], [3.0, 48], [3.55, -4], [3.8, 0]],
      [[0, 0], [0.2, 5], [0.7, -20], [0.85, -14], [3.0, -15], [3.6, 4], [3.8, 0]]);
    p.ElbowL += 7 * beat(t, 0.8, 3.0, 0.9); p.WristL += 6 * beat(t, 0.8, 3.0, 0.9, 0.8);
    if (t > 0.35 && t < 3.4) p.HandL = 1;
    const up = keys(t - 0.08, [[0, 0], [0.7, 1], [3.1, 1], [3.8, 0]]), b = beat(t, 0.8, 3.0, 0.9, 0.4);
    p.BodyAngleX = 3 * up; p.AngleX = 5 * up + 2 * b; p.AngleZ = 3 * up;
  } },
  // both hands brought together in front of the waist
  // both hands laid one over the other in front of the skirt, backs of the
  // hands to the front (pose arms from the drawn pose: the hand shapes needed
  // cannot be made by turning or mirroring the hand images)
  both: { pose: true, duration: 3.6, hand: 'both', track: poseTrack('PoseHands', { ShoulderR: 6, ElbowR: -28, ShoulderL: 6, ElbowL: -28 }, (k, p) => { p.EyeSmileAdd = 0.4 * k; p.AngleY = -3 * k; p.AngleZ = 2 * k; }) },
  // left arm raised from the shoulder, index finger pointing outward
  point: { duration: 3.0, hand: 'L', track: (t, p) => {
    arm(p, 'L', t, [[0, 0], [0.2, -4], [0.7, 64], [0.85, 59], [2.3, 60], [2.8, -3], [3.0, 0]],
      [[0, 0], [0.22, -8], [0.72, 6], [0.9, 11], [2.3, 10], [2.85, -4], [3.0, 0]],
      [[0, 0], [0.25, 5], [0.78, -10], [0.95, -5], [2.3, -6], [2.9, 3], [3.0, 0]]);
    if (t > 0.4 && t < 2.6) p.HandL = 3;
    const up = keys(t - 0.12, [[0, 0], [0.75, 1], [2.4, 1], [3.0, 0]]);
    p.BodyAngleX = 4 * up; p.AngleX = 12 * up; p.EyeBallXAdd = 0.6 * keys(t, [[0, 0], [0.3, 1], [2.3, 1], [2.7, 0]]);
  } },
  // pose arms from the drawn poses: the everyday arms move toward the body,
  // the pose arms are laid over them and then the everyday arms are hidden
  chest: { pose: true, duration: 3.8, hand: 'both', track: poseTrack('PoseChest', { ShoulderR: 30, ElbowR: -105, ShoulderL: 30, ElbowL: -105 }, (k, p) => { p.EyeSmileAdd = 0.6 * k; p.AngleY = -4 * k; p.BodyAngleY = -2 * k; }) },
  chin: { pose: true, duration: 4.2, hand: 'both', track: poseTrack('PoseChin', { ShoulderR: 28, ElbowR: -125, ShoulderL: 30, ElbowL: -105 }, (k, p) => { p.AngleZ = 4 * k; p.AngleY = 3 * k; p.HeadHold = k; p.LookX = -0.45 * k; p.LookY = 0.5 * k; }) },
  reach: { pose: true, duration: 3.8, hand: 'both', track: poseTrack('PoseReach', { ShoulderR: 22, ElbowR: -45, ShoulderL: 30, ElbowL: -110 }, (k, p) => { p.EyeSmileAdd = 0.5 * k; p.BodyAngleY = 3 * k; p.AngleY = 2 * k; p.AngleX = -4 * k; }) },
  // right hand loosely closed in front of the waist, head tilted
  think: { duration: 3.6, hand: 'R', track: (t, p) => {
    arm(p, 'R', t, [[0, 0], [0.18, -2], [0.7, 30], [0.85, 28], [2.9, 28], [3.35, -2], [3.6, 0]],
      [[0, 0], [0.2, 5], [0.72, -130], [0.88, -124], [2.9, -125], [3.4, 4], [3.6, 0]],
      [[0, 0], [0.25, -4], [0.78, 24], [0.95, 19], [2.9, 20], [3.45, -3], [3.6, 0]]);
    if (t > 0.4 && t < 3.2) p.HandR = 4;
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
    this.blink = { next: 2, phase: -1, double: false };
    this.expression = 'neutral';
    this.talking = 0; this.talkUntil = 0;
    this.syll = { t: 0, len: 0.15, peak: 0, form: 0 };
    this.gestures = [];
    this.n = [1, 2, 3, 4, 5, 6, 7].map(noise1);
    this.has = id => model.parameters.some(p => p.id === id);
  }
  // where the avatar sits on the screen (-1 left .. 1 right); the body and face
  // turn toward the screen centre from there
  setFacing(f) { this.facing = clamp(f, -1, 1); }
  lookAt(x, y, hold = 1.5) { this.look.x = clamp(x, -1, 1); this.look.y = clamp(y, -1, 1); this.look.until = this.t + hold; }
  setExpression(name) { if (EXPRESSIONS[name]) this.expression = name; }
  talk(seconds) { this.talkUntil = Math.max(this.talkUntil, this.t + seconds); }
  gesture(name) {
    const g = GESTURES[name]; if (!g) return;
    const clash = x => g.hand && x.g.hand && (x.g.hand === g.hand || g.hand === 'both' || x.g.hand === 'both');
    // a running pose-arm gesture finishes first (its arms must switch back);
    // other gestures for the same hand are replaced and the springs blend the change
    const pose = this.gestures.filter(x => clash(x) && x.g.pose);
    const start = pose.length ? Math.max(...pose.map(x => x.start + x.g.duration)) : this.t;
    this.gestures = this.gestures.filter(x => !clash(x) || x.g.pose);
    this.gestures.push({ g, start });
  }
  spring(id, target, dt, hz) { if (!this.springs[id]) this.springs[id] = new Spring(target, hz); return this.springs[id].step(target, dt, hz); }
  update(dt) {
    const t = (this.t += dt), m = this.model, n = this.n, ex = EXPRESSIONS[this.expression];
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
    const place = this.spring('facing', clamp(-this.facing / 0.42, -1, 1), dt, 0.8);
    let lx = pointer ? this.look.x : this.auto.x * 0.35, ly = pointer ? this.look.y : this.auto.y * 0.8;
    if (ex.lookX !== undefined && !pointer) { lx = place * 0.5 + ex.lookX * 0.6; ly = ex.lookY; }
    if (pose.LookX) { lx = pose.LookX; ly = pose.LookY || 0; }
    // never past the front toward the outside of the page
    const keepSide = v => place < -0.05 ? Math.min(v, 0.1) : place > 0.05 ? Math.max(v, -0.1) : v;
    // head: the placement turn plus part of the way to the target (slower);
    // body: most of the placement turn plus a little of the target (slowest);
    // eyes: whatever is left, so they look at the viewer or the pointer
    const headX = this.spring('headX', keepSide(place * 0.27 + (lx - place * 0.3) * 0.35), dt, 1.6), headY = this.spring('headY', ly * 0.5, dt, 1.6);
    const bodyX = this.spring('bodyX', keepSide(place * 1.0 + (lx - place * 0.3) * 0.1), dt, 0.6), bodyY = this.spring('bodyY', ly * 0.45, dt, 0.6);
    const eyeX = this.spring('eyeX', clamp((lx - headX) * 1.1, -1, 1), dt, 7), eyeY = this.spring('eyeY', ly - headY * 0.6, dt, 7);
    // speech: syllables with varied length, height and lip shape
    const talking = t < this.talkUntil;
    let mouth = 0, formAdd = 0;
    if (talking) {
      const s = this.syll; s.t += dt;
      if (s.t > s.len) { s.t = 0; s.len = 0.09 + Math.random() * 0.16; s.peak = Math.random() < 0.15 ? 0.05 : 0.3 + Math.random() * 0.6; s.form = (Math.random() * 2 - 1) * 0.35; }
      // each syllable opens and shuts; the last 20 % of it the lips stay together
      mouth = s.peak * Math.sin(Math.PI * clamp(s.t / (s.len * 0.8), 0, 1)); formAdd = s.form * 0.5;
    }
    const talkAmt = this.spring('talkAmt', talking ? 1 : 0, dt, 2);
    // blinking: quick close, short hold, slower open; sometimes twice
    const b = this.blink; let lid = 1;
    if (b.phase < 0 && t > b.next) b.phase = 0;
    if (b.phase >= 0) {
      b.phase += dt; const p = b.phase;
      lid = p < 0.07 ? 1 - ease(p / 0.07) : p < 0.11 ? 0 : 1 - ease(1 - (p - 0.11) / 0.13);
      if (p > 0.24) { b.phase = -1; b.double = !b.double && Math.random() < 0.18; b.next = t + (b.double ? 0.18 : 2.2 + Math.random() * 3.8); }
    }
    const eyeOpen = this.spring('eyeOpen', ex.eye ?? 1, dt, 3) * lid;
    const smile = this.spring('eyeSmile', clamp((ex.EyeSmile ?? 0) + (pose.EyeSmileAdd || 0), 0, 1), dt, 2.5);
    const breath = (Math.sin(t * TAU / 3.6) + 1) / 2;
    const out = {
      AngleX: clamp((headX * 30 + n[0](t * 0.23) * 3 + talkAmt * n[3](t * 1.3) * 2) * (1 - 0.8 * (pose.HeadHold || 0)) + (pose.AngleX || 0), -24, 24),
      AngleY: (-headY * 24 + n[1](t * 0.19) * 2.5 + talkAmt * Math.max(0, n[4](t * 1.7)) * -3) * (1 - 0.8 * (pose.HeadHold || 0)) + (pose.AngleY || 0),
      AngleZ: n[2](t * 0.17) * 3 + (pose.AngleZ || 0) - headX * 2,
      EyeBallX: clamp(eyeX + (pose.EyeBallXAdd || 0), -1, 1), EyeBallY: clamp(eyeY + (pose.EyeBallYAdd || 0), -1, 1),
      BodyAngleX: clamp(bodyX * 10 + n[5](t * 0.13) * 1.2 + (pose.BodyAngleX || 0), -10, 10),
      BodyAngleY: n[6](t * 0.11) * 1.5 + (pose.BodyAngleY || 0) - bodyY * 12,
      BodyAngleZ: n[5](t * 0.09 + 3) * 1.5 + (pose.BodyAngleZ || 0) - bodyX * 2.5,
      Breath: breath,
      BrowY: (ex.BrowY ?? 0) + talkAmt * Math.max(0, n[3](t * 2.1)) * 0.3,
      BrowAngle: ex.BrowAngle ?? 0,
      MouthForm: clamp((ex.MouthForm ?? 0) + formAdd, -1, 1),
      ShoulderL: pose.ShoulderL || 0, ElbowL: pose.ElbowL || 0, WristL: pose.WristL || 0, ForearmL: pose.ForearmL || 0,
      ShoulderR: pose.ShoulderR || 0, ElbowR: pose.ElbowR || 0, WristR: pose.WristR || 0, ForearmR: pose.ForearmR || 0
    };
    const fast = { EyeBallX: 0, EyeBallY: 0 };
    for (const [k, v] of Object.entries(out)) if (this.has(k)) m.set(k, k in fast ? v : this.spring('p_' + k, v, dt, k.startsWith('Shoulder') || k.startsWith('Elbow') || k.startsWith('Wrist') || k.startsWith('Forearm') ? 6 : k === 'AngleY' ? 9 : 4));
    m.set('EyeLOpen', eyeOpen); m.set('EyeROpen', eyeOpen); m.set('EyeSmile', smile);
    // pose arm switching is set directly; its timing is in the gesture track
    if (this.has('ArmsDefault')) { m.set('ArmsDefault', pose.ArmsDefault ?? 1); for (const k of ['PoseChest', 'PoseChin', 'PoseReach', 'PoseHands']) if (this.has(k)) m.set(k, pose[k] || 0); }
    // while talking the syllables open and close the mouth from fully closed;
    // otherwise it rests at the expression's opening
    m.set('MouthOpen', clamp(this.spring('mouth', talking ? mouth : ex.mouth ?? 0, dt, talking ? 14 : 5), 0, 1));
    // hand shapes switch directly (one shape per hand is visible at a time)
    for (const s of ['L', 'R']) if (this.has('Hand' + s)) m.set('Hand' + s, pose['Hand' + s] || 0);
  }
}
