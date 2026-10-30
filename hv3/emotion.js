// V2 input -> Hibiki V3 expression. The ten states, their timing and the chat
// lifecycle are taken unchanged from Twinow's companion
// (wordpress/themes/twinow-original/assets/aifate-companion.js, MotionEngine and
// chatLifecycle; conversation.js sends them); the emotion table follows Codex's
// study (studies/continuity/emotion.js, affect.js), re-made with Hibiki V3's own
// parameters (eyes, brows, mouth, smile and cheeks, head, body, shoulders, gaze).
// Everything is mesh deformation; no image is swapped.
export const STATES = Object.freeze(['idle', 'attention', 'thinking', 'speaking', 'happy', 'notify', 'concern', 'error', 'sleep', 'wake']);
// Hibiki V3 face and body per emotion:
//   smile (EyeSmile 0..1), form (MouthForm -1..1, the smile shape), mouth (rest
//   opening 0..1), browY / browAngle (-1..1, +angle = inner ends up), eye (open
//   0..1), lean (BodyAngleY: + back, - forward), roll (BodyAngleZ), tilt
//   (AngleZ), pitch (AngleY: + up), arms (shoulders in(-) / out(+), degrees),
//   look ([x, y] gaze cue or null), wide (eyes opened wide 0..1), pucker (mouth
//   pursed, with an opening a round "o" 0..1), shift (mouth pulled to a side
//   -1..1). The brows are mostly under the fringe, so the eyes, the mouth, the
//   head's tilt and the body carry the difference.
export const EMOTIONS = Object.freeze({
  neutral: { smile: 0.2, form: 0.45, mouth: 0, browY: 0, browAngle: 0, eye: 1 },
  gentle: { smile: 0.45, form: 0.8, mouth: 0.2, wide: 0.35, browY: 0.05, browAngle: 0, eye: 1, lean: 0.5 },
  // the eyes stay open in the resting smile (the lower lids rise a little; the
  // upper lids are not lowered), as in the reference smile
  smile: { smile: 0.55, form: 1, mouth: 0.52, browY: 0.1, browAngle: 0, eye: 1, lean: 1 },
  joy: { smile: 1, form: 1, mouth: 0.9, browY: 0.3, browAngle: 0.1, eye: 0.9, lean: 2.5, roll: 1.5, tilt: 3, arms: 4, bounce: 1 },
  // surprise: the fringe hides the brows, so it is carried by the eyes opened
  // wide (white above the iris), the mouth dropped into a small round "o" with
  // the corners flattened, and the first beat: the head snaps up and back and
  // the shoulders shrug, then it settles (once)
  surprise: { smile: 0, form: -0.5, mouth: 0.65, pucker: 1, wide: 1, browY: 1, browAngle: 0.3, eye: 1, lean: 3, pitch: 5, shrug: 1, once: true },
  concern: { smile: 0, form: -1, mouth: 0, browY: -0.05, browAngle: 0.9, eye: 0.8, lean: -2.5, roll: -3, tilt: -9, arms: -4 },
  sadness: { smile: 0, form: -0.9, mouth: 0, browY: -0.2, browAngle: 1, eye: 0.62, lean: -4, pitch: -10, arms: -8, look: [0, 0.6] },
  thinking: { smile: 0, form: -0.3, mouth: 0, pucker: 0.6, shift: 0.8, browY: 0.2, browAngle: -0.8, eye: 0.85, lean: 1.5, tilt: 7, look: [0.6, -0.5] },
  shy: { smile: 0.5, form: 0.7, mouth: 0.1, pucker: 0.25, browY: 0.1, browAngle: 0.4, eye: 0.85, lean: -1, tilt: -4, pitch: -3, arms: -3, look: [-0.25, 0.25] },
  anger: { smile: 0, form: -0.6, mouth: 0, pucker: 0.3, browY: -0.6, browAngle: -1, eye: 0.75, lean: -1, arms: 2 }
});
// names used elsewhere (HUB runtime states, Codex aliases)
const ALIASES = { happy: 'joy', confusion: 'concern', sad: 'sadness', blushing: 'shy', notify: 'surprise', error: 'sadness', speaking: null };
const STATE_EMOTION = { idle: 'smile', attention: 'gentle', thinking: 'thinking', speaking: 'smile', happy: 'joy', notify: 'surprise', concern: 'concern', error: 'sadness', sleep: 'neutral', wake: 'gentle' };
// Twinow MotionEngine.setState defaults (ms)
const DURATIONS = { attention: 920, happy: 1100, notify: 1500, error: 2300, wake: 760 };
const finite = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export class Performance {
  constructor(now = () => performance.now()) {
    Object.assign(this, { now, state: 'idle', phase: 'normal', started: now(), deadline: 0, next: 'idle', calmAt: 0, emotion: null, intensity: 1, history: [] });
  }
  // same rules as Twinow: unknown states are ignored (false), duration falls
  // back to the state's default, next defaults to idle, speaking turns calm
  // after 1.8 s and becomes happy 3.2 s later unless options.calm === false
  setState(state, options = {}) {
    if (!STATES.includes(state)) return false;
    if (!options || typeof options !== 'object') options = {};
    const at = this.now();
    this.state = state; this.phase = typeof options.phase === 'string' ? options.phase : 'normal'; this.started = at;
    this.history = [...this.history, { state, at }].slice(-14);
    const duration = options.duration === undefined ? (DURATIONS[state] || 0) : (finite(options.duration) && options.duration > 0 ? options.duration : 0);
    this.deadline = duration > 0 ? at + duration : 0;
    this.next = STATES.includes(options.next) ? options.next : 'idle';
    this.calmAt = state === 'speaking' && options.calm !== false ? at + 1800 : 0;
    return true;
  }
  // an emotion that overrides the state's own (null / 'auto' = follow the state)
  setEmotion(name, intensity = 1) {
    if (name === null || name === 'auto') { this.emotion = null; return true; }
    if (typeof name !== 'string') return false;
    name = name.toLowerCase(); // HUB's documented runtime states are upper case
    const n = Object.hasOwn(ALIASES, name) ? ALIASES[name] : name;
    if (n === null) { this.emotion = null; return true; }
    if (!Object.hasOwn(EMOTIONS, n)) return false;
    this.emotion = n; this.intensity = finite(intensity) ? clamp(intensity) : 1; return true;
  }
  tick() {
    const now = this.now();
    if (this.calmAt && now >= this.calmAt) { this.calmAt = 0; this.phase = 'calm'; this.deadline = now + 3200; this.next = 'happy'; }
    for (let i = 0; i < 3 && this.deadline && now >= this.deadline; i++) this.setState(this.next, {});
    return this.state;
  }
  // targets for the motion layer
  sample() {
    this.tick();
    const name = this.emotion || STATE_EMOTION[this.state], e = EMOTIONS[name], a = this.emotion ? this.intensity : 1;
    const age = (this.now() - this.started) / 1000, pulse = Math.sin(Math.min(age / 1.05, 1) * Math.PI);
    const o = { name, state: this.state, phase: this.phase, speaking: this.state === 'speaking', wide: (e.wide || 0) * a, pucker: (e.pucker || 0) * a, shift: (e.shift || 0) * a, smile: e.smile * a, form: e.form * a, mouth: e.mouth * a, browY: e.browY * a, browAngle: e.browAngle * a, eye: 1 + (e.eye - 1) * a,
      lean: (e.lean || 0) * a, roll: (e.roll || 0) * a, tilt: (e.tilt || 0) * a, pitch: (e.pitch || 0) * a, arms: (e.arms || 0) * a, shrug: (e.shrug || 0) * a, look: e.look || null, bounce: e.bounce ? a : 0, once: !!e.once, breath: 1 };
    // a surprise is a one-shot recognition that settles, not a held startle:
    // the face holds for half a second and eases to 0.4; the head and shoulders
    // start within a tenth of a second and come back over about a second
    if (e.once) {
      const s = Math.max(0.4, 1 - Math.max(0, age - 0.5) / 1.4), beat = age < 0.1 ? age / 0.1 : Math.max(0, 1 - (age - 0.1) / 1.0);
      for (const k of ['browY', 'mouth', 'wide', 'pucker']) o[k] *= s;
      for (const k of ['lean', 'pitch', 'arms', 'shrug']) o[k] *= beat;
      o.form *= Math.max(0.5, s);
    }
    if (this.state === 'attention') { o.lean -= pulse * 3; o.pitch += pulse * 2; o.look = [0, 0]; }
    if (this.state === 'thinking') o.breath = 0.6;
    if (this.state === 'sleep') { o.eye = 0; o.mouth = 0; o.wide = 0; o.pitch = -8; o.lean = -2; o.arms = -3; o.breath = 0.5; o.look = null; }
    if (this.state === 'wake') o.eye *= clamp(age / 0.76);
    return o;
  }
  snapshot() { return { state: this.state, phase: this.phase, emotion: this.emotion || STATE_EMOTION[this.state], emotionOverride: this.emotion, intensity: this.intensity, history: [...this.history], speaking: this.state === 'speaking' }; }
}
