// Hibiki V3 page: rig + motion + renderer + controls.
import { RigModel } from './rig-eval.js';
import { AvatarRenderer } from './renderer.js';
import { MotionController } from './motion.js';

const base = new URL('./', import.meta.url);
const $ = s => document.querySelector(s);
const status = $('#status');
try {
  const json = await (await fetch(new URL('hibiki.rig.json', base), { cache: 'no-cache' })).json();
  const model = new RigModel(json);
  const stage = $('#stage'), box = $('#avatar');
  const renderer = await new AvatarRenderer().init(box, model, base.href);
  const motion = new MotionController(model);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let demo = !reduce, demoT = 0, demoStep = 0;
  const DEMO = [
    [0, () => { motion.setExpression('smile'); motion.gesture('wave'); motion.talk(2.4); }],
    [3.6, () => { motion.setExpression('neutral'); motion.talk(3.2); motion.gesture('explain'); }],
    [7.6, () => { motion.gesture('nod'); }],
    [8.4, () => { motion.setExpression('think'); motion.gesture('chin'); }],
    [13, () => { motion.setExpression('surprise'); motion.gesture('both'); }],
    [16.8, () => { motion.setExpression('smile'); motion.gesture('chest'); motion.talk(1.6); }],
    [21, () => { motion.setExpression('neutral'); motion.gesture('reach'); motion.talk(2.2); }],
    [25.2, () => { motion.gesture('tilt'); }],
    [27.6, () => { motion.setExpression('neutral'); }],
    [30, null]
  ];
  const setDemo = on => { demo = on; demoT = 0; demoStep = 0; $('#demo').setAttribute('aria-pressed', String(on)); if (!on) motion.setExpression('neutral'); };
  setDemo(demo);
  $('#demo').addEventListener('click', () => setDemo(!demo));
  for (const el of document.querySelectorAll('[data-gesture]')) el.addEventListener('click', () => { setDemo(false); motion.gesture(el.dataset.gesture); if (el.dataset.talk) motion.talk(+el.dataset.talk); });
  for (const el of document.querySelectorAll('[data-expression]')) el.addEventListener('click', () => { setDemo(false); motion.setExpression(el.dataset.expression); for (const b of document.querySelectorAll('[data-expression]')) b.setAttribute('aria-pressed', String(b === el)); });
  $('#talk').addEventListener('click', () => { setDemo(false); motion.talk(3); });
  for (const el of document.querySelectorAll('[data-view]')) el.addEventListener('click', () => { renderer.setView(el.dataset.view); for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b === el)); });
  // Gaze: the pointer anywhere on the page (mouse) or a tap anywhere (touch) is
  // looked at; listeners are passive so scrolling and buttons work as usual.
  const faceOnScreen = () => {
    const r = renderer.app.canvas.getBoundingClientRect(), root = renderer.root;
    return [r.left + root.position.x + model.json.headCenter[0] * root.scale.x, r.top + root.position.y + model.json.headCenter[1] * root.scale.y];
  };
  const look = e => {
    if (e.type === 'pointermove' && e.pointerType !== 'mouse') return;
    const [fx, fy] = faceOnScreen();
    const sx = Math.max(240, innerWidth * 0.4), sy = Math.max(240, innerHeight * 0.4);
    motion.lookAt((e.clientX - fx) / sx, (e.clientY - fy) / sy, 3);
  };
  addEventListener('pointermove', look, { passive: true });
  addEventListener('pointerdown', look, { passive: true });
  // placement on the page decides the base orientation (re-read every frame, so
  // moving or resizing the avatar takes effect immediately)
  const facing = () => { const r = box.getBoundingClientRect(); return ((r.left + r.width / 2) - innerWidth / 2) / (innerWidth / 2); };
  for (const el of document.querySelectorAll('[data-place]')) el.addEventListener('click', () => {
    stage.dataset.place = el.dataset.place;
    for (const b of document.querySelectorAll('[data-place]')) b.setAttribute('aria-pressed', String(b === el));
    renderer.app.resize();
  });
  let last = performance.now();
  renderer.app.ticker.add(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (demo) {
      demoT += dt;
      while (demoStep < DEMO.length && demoT >= DEMO[demoStep][0]) { const f = DEMO[demoStep][1]; if (f) f(); else { demoT = 0; demoStep = -1; } demoStep++; }
    }
    motion.setFacing(facing());
    motion.update(reduce ? dt * 0.4 : dt);
    model.update(dt);
    renderer.sync();
  });
  status.textContent = '';
  document.body.classList.add('ready');
  window.hv3 = { model, motion, renderer };
  window.hv3ready = true;
} catch (e) {
  status.textContent = '表示できませんでした：' + e.message;
  console.error(e);
}
