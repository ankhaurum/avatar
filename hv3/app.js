// Hibiki V3 check page: the avatar package plus the page's own controls.
import { mountHibikiAvatar } from './hibiki-avatar.js';

const $ = s => document.querySelector(s);
const status = $('#status');
try {
  const stage = $('#stage'), box = $('#avatar');
  const avatar = await mountHibikiAvatar(box, { view: 'bust', viewToggle: true, rememberView: 'hibiki-view', scrollFade: { enabled: true, opacity: 0.35, restoreMs: 600 }, facing: 0 });
  const { model, motion, renderer } = avatar;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let demo = !reduce, demoT = 0, demoStep = 0;
  const DEMO = [
    [0, () => { avatar.setEmotion('joy'); motion.gesture('wave'); motion.talk(2.4); }],
    [3.6, () => { avatar.setEmotion('auto'); motion.talk(3.2); motion.gesture('explain'); }],
    [7.6, () => { motion.gesture('nod'); }],
    [8.4, () => { avatar.setEmotion('thinking'); motion.gesture('chin'); }],
    [13, () => { avatar.setEmotion('surprise'); motion.gesture('both'); }],
    [16.8, () => { avatar.setEmotion('joy'); motion.gesture('chest'); motion.talk(1.6); }],
    [21, () => { avatar.setEmotion('auto'); motion.gesture('reach'); motion.talk(2.2); }],
    [25.2, () => { motion.gesture('tilt'); }],
    [27.6, () => { avatar.setEmotion('auto'); }],
    [30, null]
  ];
  const setDemo = on => { demo = on; demoT = 0; demoStep = 0; $('#demo').setAttribute('aria-pressed', String(on)); if (!on) avatar.setEmotion('auto'); };
  setDemo(demo);
  const pressed = (sel, el) => { for (const b of document.querySelectorAll(sel)) b.setAttribute('aria-pressed', String(b === el)); };
  $('#demo').addEventListener('click', () => setDemo(!demo));
  for (const el of document.querySelectorAll('[data-gesture]')) el.addEventListener('click', () => { setDemo(false); motion.gesture(el.dataset.gesture); if (el.dataset.talk) motion.talk(+el.dataset.talk); });
  for (const el of document.querySelectorAll('[data-emotion]')) el.addEventListener('click', () => { setDemo(false); avatar.setEmotion(el.dataset.emotion); pressed('[data-emotion]', el); });
  // V2 states are sent the way Twinow's conversation.js sends them: as the window event
  for (const el of document.querySelectorAll('[data-state]')) el.addEventListener('click', () => { setDemo(false); avatar.setEmotion('auto'); pressed('[data-emotion]', document.querySelector('[data-emotion="auto"]')); dispatchEvent(new CustomEvent('aifate:companion-state', { detail: { state: el.dataset.state, options: {} } })); });
  // chat flow, as conversation.js runs it: send -> thinking -> reply (speaking) -> complete with the emotion -> idle
  const lifecycle = (phase, emotion = 'speaking') => dispatchEvent(new CustomEvent('aifate:companion-chat-lifecycle', { detail: { phase, anchor: null, emotion } }));
  const companionState = (state, options = {}) => dispatchEvent(new CustomEvent('aifate:companion-state', { detail: { state, options } }));
  $('#chatFlow').addEventListener('click', () => {
    setDemo(false); avatar.setEmotion('auto'); const emotion = $('#chatEmotion').value;
    companionState('thinking', { duration: 0 }); lifecycle('thinking');
    setTimeout(() => { companionState('speaking', { duration: 0 }); lifecycle('speaking', emotion); }, 1800);
    setTimeout(() => lifecycle('complete', emotion), 4600);
  });
  const stateLabel = $('#stateNow');
  renderer.app.ticker.add(() => { const s = avatar.getSnapshot(); const t = s.state + (s.emotionOverride ? ' ／ 感情 ' + s.emotionOverride : ''); if (stateLabel.textContent !== t) stateLabel.textContent = t; });
  $('#talk').addEventListener('click', () => { setDemo(false); motion.talk(3); });
  const syncView = () => pressed('[data-view]', document.querySelector(`[data-view="${avatar.view}"]`));
  for (const el of document.querySelectorAll('[data-view]')) el.addEventListener('click', () => { avatar.setView(el.dataset.view); syncView(); });
  box.addEventListener('click', e => { if (e.target.closest('.hv3-view-toggle')) syncView(); });
  syncView();
  for (const el of document.querySelectorAll('[data-place]')) el.addEventListener('click', () => { stage.dataset.place = el.dataset.place; pressed('[data-place]', el); avatar.setFacing({ left: -1, center: 0, right: 1 }[el.dataset.place]); renderer.app.resize(); });
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
