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
//   look ([x, y] gaze cue or null)
export const EMOTIONS = Object.freeze({
  neutral: { smile: 0.2, form: 0.45, mouth: 0, browY: 0, browAngle: 0, eye: 1 },
  gentle: { smile: 0.45, form: 0.8, mouth: 0.2, browY: 0.05, browAngle: 0, eye: 0.97, lean: 0.5 },
  smile: { smile: 0.8, form: 1, mouth: 0.6, browY: 0.1, browAngle: 0, eye: 0.94, lean: 1 },
  joy: { smile: 1, form: 1, mouth: 0.75, browY: 0.3, browAngle: 0.1, eye: 0.9, lean: 2.5, roll: 1.5, tilt: 3, arms: 4, bounce: 1 },
  surprise: { smile: 0, form: 0, mouth: 0.45, browY: 1, browAngle: 0.3, eye: 1, lean: 3, pitch: 4, arms: 5, once: true },
  concern: { smile: 0, form: -0.45, mouth: 0, browY: -0.05, browAngle: 0.9, eye: 0.9, lean: -1.5, roll: -1.5, tilt: -5, arms: -3 },
  sadness: { smile: 0, form: -0.8, mouth: 0, browY: -0.2, browAngle: 1, eye: 0.8, lean: -3, pitch: -6, arms: -5, look: [0, 0.3] },
  thinking: { smile: 0, form: -0.2, mouth: 0, browY: 0.2, browAngle: -0.8, eye: 0.85, lean: -1, tilt: 6, look: [0.5, -0.4] },
  shy: { smile: 0.5, form: 0.7, mouth: 0.1, browY: 0.1, browAngle: 0.4, eye: 0.85, lean: -1, tilt: -4, pitch: -3, arms: -3, look: [-0.25, 0.25] },
  anger: { smile: 0, form: -0.3, mouth: 0, browY: -0.6, browAngle: -1, eye: 0.88, lean: -1, arms: 2 }
});
// names used elsewhere (HUB runtime states, Codex aliases)
const ALIASES = { happy: 'joy', confusion: 'concern', sad: 'sadness', blushing: 'shy', notify: 'surprise', error: 'concern', speaking: null };
const STATE_EMOTION = { idle: 'smile', attention: 'gentle', thinking: 'thinking', speaking: 'smile', happy: 'joy', notify: 'surprise', concern: 'concern', error: 'concern', sleep: 'neutral', wake: 'gentle' };
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
    const o = { name, state: this.state, phase: this.phase, speaking: this.state === 'speaking', smile: e.smile * a, form: e.form * a, mouth: e.mouth * a, browY: e.browY * a, browAngle: e.browAngle * a, eye: 1 + (e.eye - 1) * a,
      lean: (e.lean || 0) * a, roll: (e.roll || 0) * a, tilt: (e.tilt || 0) * a, pitch: (e.pitch || 0) * a, arms: (e.arms || 0) * a, look: e.look || null, bounce: e.bounce ? a : 0, breath: 1 };
    // a surprise is a one-shot recognition that settles, not a held startle
    if (e.once) { const s = Math.max(0.35, 1 - Math.max(0, age - 0.4) / 1.6); for (const k of ['browY', 'mouth', 'lean', 'pitch', 'arms']) o[k] *= s; }
    if (this.state === 'attention') { o.lean -= pulse * 3; o.pitch += pulse * 2; o.look = [0, 0]; }
    if (this.state === 'notify') { o.arms += pulse * 4; o.lean += pulse * 2; }
    if (this.state === 'thinking') o.breath = 0.6;
    if (this.state === 'sleep') { o.eye = 0; o.mouth = 0; o.pitch = -8; o.lean = -2; o.arms = -3; o.breath = 0.5; o.look = null; }
    if (this.state === 'wake') o.eye *= clamp(age / 0.76);
    return o;
  }
  snapshot() { return { state: this.state, phase: this.phase, emotion: this.emotion || STATE_EMOTION[this.state], emotionOverride: this.emotion, intensity: this.intensity, history: [...this.history], speaking: this.state === 'speaking' }; }
}
