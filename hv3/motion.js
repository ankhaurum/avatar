// Motion layer: turns intentions (look here, talk, smile, wave) into rig
// parameter values. Every output goes through a critically damped spring, so
// switching state never jumps; secondary motion (hair, fabric) is left to the
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
  neutral: { EyeSmile: 0, MouthForm: 0.35, BrowY: 0, BrowAngle: 0, eye: 1 },
  smile: { EyeSmile: 0.75, MouthForm: 1, BrowY: 0.25, BrowAngle: 0.1, eye: 0.92 },
  surprise: { EyeSmile: 0, MouthForm: 0, BrowY: 1, BrowAngle: 0.3, eye: 1, mouth: 0.45 },
  think: { EyeSmile: 0, MouthForm: -0.2, BrowY: 0.2, BrowAngle: -0.8, eye: 0.85, lookY: 0.6, lookX: -0.5 },
  sad: { EyeSmile: 0, MouthForm: -0.8, BrowY: -0.2, BrowAngle: 1, eye: 0.8 }
};

// Gesture tracks: time (s) -> partial pose. Arm angles in degrees.
export const GESTURES = {
  // right hand (viewer left) raised beside the face, waving from the wrist
  wave: { duration: 3.2, hand: 'R', track: (t, p) => {
    const up = ease(t / 0.6) * (1 - ease((t - 2.6) / 0.6));
    const sway = Math.sin((t - 0.5) * TAU * 2.2) * ease((t - 0.5) / 0.3) * (1 - ease((t - 2.4) / 0.4));
    p.ShoulderR = 10 * up; p.ElbowR = 146 * up + 5 * sway; p.WristR = 6 * up + 14 * sway;
    if (up > 0.45) p.HandR = 2;
    p.BodyAngleZ = -1.5 * up; p.AngleZ = -5 * up; p.AngleX = -4 * up; p.EyeSmileAdd = 0.5 * up;
  } },
  // left hand opens to the side, presenting, while talking
  explain: { duration: 3.8, hand: 'L', track: (t, p) => {
    const up = ease(t / 0.6) * (1 - ease((t - 3.1) / 0.7));
    const beat = Math.sin(t * TAU * 0.9) * up;
    p.ShoulderL = 22 * up; p.ElbowL = 48 * up + 8 * beat; p.WristL = -15 * up + 6 * beat;
    if (up > 0.4) p.HandL = 1;
    p.BodyAngleX = 3 * up; p.AngleX = 5 * up + 2 * beat; p.AngleZ = 3 * up;
  } },
  // both hands brought together in front of the waist
  both: { duration: 3.4, hand: 'both', track: (t, p) => {
    const up = ease(t / 0.6) * (1 - ease((t - 2.8) / 0.6));
    const beat = Math.sin(t * TAU * 1.1) * up;
    p.ShoulderR = 30 * up; p.ElbowR = -105 * up + 4 * beat; p.WristR = -10 * up;
    p.ShoulderL = 30 * up; p.ElbowL = -105 * up + 4 * beat; p.WristL = -10 * up;
    if (up > 0.4) { p.HandR = 1; p.HandL = 1; }
    p.BodyAngleY = 3 * up; p.AngleY = 5 * up;
  } },
  // left arm raised from the shoulder, index finger pointing outward
  point: { duration: 3.0, hand: 'L', track: (t, p) => {
    const up = ease(t / 0.7) * (1 - ease((t - 2.3) / 0.7));
    p.ShoulderL = 60 * up; p.ElbowL = 10 * up; p.WristL = -6 * up;
    if (up > 0.45) p.HandL = 3;
    p.BodyAngleX = 4 * up; p.AngleX = 12 * up; p.EyeBallXAdd = 0.6 * up;
  } },
  // right hand loosely closed in front of the waist, head tilted
  think: { duration: 3.6, hand: 'R', track: (t, p) => {
    const up = ease(t / 0.7) * (1 - ease((t - 2.9) / 0.7));
    p.ShoulderR = 28 * up; p.ElbowR = -125 * up; p.WristR = 20 * up;
    if (up > 0.4) p.HandR = 4;
    p.AngleZ = 7 * up; p.AngleY = 4 * up;
  } },
  nod: { duration: 1.4, track: (t, p) => { const k = Math.sin(clamp(t / 1.2, 0, 1) * TAU * 1.5) * (1 - ease(t / 1.3)); p.AngleY = -10 * Math.max(0, k); p.BodyAngleY = -2 * Math.max(0, k); } },
  tilt: { duration: 2.2, track: (t, p) => { const k = ease(t / 0.5) * (1 - ease((t - 1.6) / 0.6)); p.AngleZ = 11 * k; p.AngleX = 6 * k; p.BodyAngleZ = 2 * k; } }
};

export class MotionController {
  constructor(model) {
    this.model = model;
    this.t = 0;
    this.springs = {};
    this.look = { x: 0, y: 0, until: 0 };
    this.auto = { x: 0, y: 0, next: 1 };
    this.blink = { next: 2, phase: -1, double: false };
    this.expression = 'neutral';
    this.talking = 0; this.talkUntil = 0;
    this.syll = { t: 0, len: 0.15, peak: 0, form: 0 };
    this.gestures = [];
    this.n = [1, 2, 3, 4, 5, 6, 7].map(noise1);
    this.has = id => model.parameters.some(p => p.id === id);
  }
  lookAt(x, y, hold = 1.5) { this.look.x = clamp(x, -1, 1); this.look.y = clamp(y, -1, 1); this.look.until = this.t + hold; }
  setExpression(name) { if (EXPRESSIONS[name]) this.expression = name; }
  talk(seconds) { this.talkUntil = Math.max(this.talkUntil, this.t + seconds); }
  gesture(name) {
    const g = GESTURES[name]; if (!g) return;
    // a new gesture for the same hand replaces the old one smoothly (the springs blend it)
    this.gestures = this.gestures.filter(x => !(g.hand && x.g.hand && (x.g.hand === g.hand || g.hand === 'both' || x.g.hand === 'both')));
    this.gestures.push({ g, start: this.t });
  }
  spring(id, target, dt, hz) { if (!this.springs[id]) this.springs[id] = new Spring(target, hz); return this.springs[id].step(target, dt, hz); }
  update(dt) {
    const t = (this.t += dt), m = this.model, n = this.n, ex = EXPRESSIONS[this.expression];
    const pose = {};
    for (const x of this.gestures) x.g.track(t - x.start, pose);
    this.gestures = this.gestures.filter(x => t - x.start < x.g.duration);
    // gaze target: pointer if recent, otherwise idle glances
    if (t > this.auto.next) {
      const r = Math.random();
      this.auto.x = r < 0.45 ? 0 : (Math.random() * 2 - 1) * 0.7; this.auto.y = r < 0.45 ? 0 : (Math.random() * 2 - 1) * 0.35;
      this.auto.next = t + 1.2 + Math.random() * 2.8;
    }
    const pointer = t < this.look.until;
    let lx = pointer ? this.look.x : this.auto.x, ly = pointer ? this.look.y : this.auto.y;
    if (ex.lookX !== undefined && !pointer) { lx = ex.lookX; ly = ex.lookY; }
    const eyeX = this.spring('eyeX', lx, dt, 7), eyeY = this.spring('eyeY', ly, dt, 7);
    const headX = this.spring('headX', lx, dt, 1.6), headY = this.spring('headY', ly, dt, 1.6);
    const bodyX = this.spring('bodyX', lx, dt, 0.7);
    // speech: syllables with varied length, height and lip shape
    const talking = t < this.talkUntil;
    let mouth = 0, formAdd = 0;
    if (talking) {
      const s = this.syll; s.t += dt;
      if (s.t > s.len) { s.t = 0; s.len = 0.09 + Math.random() * 0.16; s.peak = Math.random() < 0.15 ? 0.05 : 0.3 + Math.random() * 0.6; s.form = (Math.random() * 2 - 1) * 0.35; }
      mouth = s.peak * Math.sin(Math.PI * clamp(s.t / s.len, 0, 1)); formAdd = s.form;
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
      AngleX: headX * 18 + n[0](t * 0.23) * 3 + (pose.AngleX || 0) + talkAmt * n[3](t * 1.3) * 2,
      AngleY: -headY * 14 + n[1](t * 0.19) * 2.5 + (pose.AngleY || 0) + talkAmt * Math.max(0, n[4](t * 1.7)) * -3,
      AngleZ: n[2](t * 0.17) * 3 + (pose.AngleZ || 0) - headX * 2,
      EyeBallX: clamp(eyeX + (pose.EyeBallXAdd || 0), -1, 1), EyeBallY: eyeY,
      BodyAngleX: bodyX * 5 + n[5](t * 0.13) * 2 + (pose.BodyAngleX || 0),
      BodyAngleY: n[6](t * 0.11) * 1.5 + (pose.BodyAngleY || 0) - headY * 1.5,
      BodyAngleZ: n[5](t * 0.09 + 3) * 1.5 + (pose.BodyAngleZ || 0),
      Breath: breath,
      BrowY: (ex.BrowY ?? 0) + talkAmt * Math.max(0, n[3](t * 2.1)) * 0.3,
      BrowAngle: ex.BrowAngle ?? 0,
      MouthForm: clamp((ex.MouthForm ?? 0) + formAdd, -1, 1),
      ShoulderL: pose.ShoulderL || 0, ElbowL: pose.ElbowL || 0, WristL: pose.WristL || 0, ForearmL: pose.ForearmL || 0,
      ShoulderR: pose.ShoulderR || 0, ElbowR: pose.ElbowR || 0, WristR: pose.WristR || 0, ForearmR: pose.ForearmR || 0
    };
    const fast = { EyeBallX: 0, EyeBallY: 0 };
    for (const [k, v] of Object.entries(out)) if (this.has(k)) m.set(k, k in fast ? v : this.spring('p_' + k, v, dt, k.startsWith('Shoulder') || k.startsWith('Elbow') || k.startsWith('Wrist') || k.startsWith('Forearm') ? 2.2 : 4));
    m.set('EyeLOpen', eyeOpen); m.set('EyeROpen', eyeOpen); m.set('EyeSmile', smile);
    m.set('MouthOpen', clamp(this.spring('mouth', Math.max(mouth, ex.mouth ?? 0), dt, 9), 0, 1));
    // hand shapes switch directly (one shape per hand is visible at a time)
    for (const s of ['L', 'R']) if (this.has('Hand' + s)) m.set('Hand' + s, pose['Hand' + s] || 0);
  }
}
