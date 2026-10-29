// Hibiki V3 check page: the avatar package plus the page's own controls.
import { mountHibikiAvatar } from './hibiki-avatar.js';

const $ = s => document.querySelector(s);
const status = $('#status');
try {
  const stage = $('#stage'), box = $('#avatar');
  const avatar = await mountHibikiAvatar(box, { view: 'bust', viewToggle: true, rememberView: 'hibiki-view', scrollFade: { enabled: true, opacity: 0.35, restoreMs: 600 } });
  const { model, motion, renderer } = avatar;
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
  const pressed = (sel, el) => { for (const b of document.querySelectorAll(sel)) b.setAttribute('aria-pressed', String(b === el)); };
  $('#demo').addEventListener('click', () => setDemo(!demo));
  for (const el of document.querySelectorAll('[data-gesture]')) el.addEventListener('click', () => { setDemo(false); motion.gesture(el.dataset.gesture); if (el.dataset.talk) motion.talk(+el.dataset.talk); });
  for (const el of document.querySelectorAll('[data-expression]')) el.addEventListener('click', () => { setDemo(false); motion.setExpression(el.dataset.expression); pressed('[data-expression]', el); });
  $('#talk').addEventListener('click', () => { setDemo(false); motion.talk(3); });
  const syncView = () => pressed('[data-view]', document.querySelector(`[data-view="${avatar.view}"]`));
  for (const el of document.querySelectorAll('[data-view]')) el.addEventListener('click', () => { avatar.setView(el.dataset.view); syncView(); });
  box.addEventListener('click', e => { if (e.target.closest('.hv3-view-toggle')) syncView(); });
  syncView();
  for (const el of document.querySelectorAll('[data-place]')) el.addEventListener('click', () => { stage.dataset.place = el.dataset.place; pressed('[data-place]', el); renderer.app.resize(); });
  for (const el of document.querySelectorAll('[data-size]')) el.addEventListener('click', () => { stage.dataset.size = el.dataset.size; pressed('[data-size]', el); renderer.app.resize(); });
  $('#fade').addEventListener('change', e => avatar.setScrollFade({ enabled: e.target.checked }));
  $('#toggleBtn').addEventListener('change', e => avatar.setViewToggle(e.target.checked));
  renderer.app.ticker.add(() => {
    if (!demo) return;
    demoT += renderer.app.ticker.deltaMS / 1000;
    while (demoStep < DEMO.length && demoT >= DEMO[demoStep][0]) { const f = DEMO[demoStep][1]; if (f) f(); else { demoT = 0; demoStep = -1; } demoStep++; }
  });
  status.textContent = '';
  document.body.classList.add('ready');
  window.hv3 = { model, motion, renderer, avatar };
  window.hv3ready = true;
} catch (e) {
  status.textContent = '表示できませんでした：' + e.message;
  console.error(e);
}
