// Hibiki V3 avatar package: one call mounts the avatar in a host element with
// gaze following, placement orientation, display-size motion scaling, the
// scroll fade and the full / bust-up toggle. Shared by every site that shows
// Hibiki; sites only pass options and may restyle through CSS variables.
//
//   import { mountHibikiAvatar } from './hv3/hibiki-avatar.js';
//   const avatar = await mountHibikiAvatar(document.querySelector('#avatar'), {
//     view: 'bust',                 // 'bust' | 'full' | 'face' (first view)
//     chat: false,                  // true: fixed to bust-up, no toggle button
//     viewToggle: true,             // show the full / bust-up button
//     rememberView: 'hibiki-view',  // localStorage key (false: do not remember)
//     scrollFade: { enabled: true, opacity: 0.35, restoreMs: 600 },
//     motionSize: 'auto',           // 'auto' (from the shown size) or 0 (large) .. 1 (small)
//     autoplay: true,               // false: nothing moves until step(dt) is called
//     facing: 'auto'                // 'auto' (from the place on the page) or -1 (left) .. 1 (right)
//   });
//   avatar.motion.gesture('wave'); avatar.setView('full'); avatar.destroy();
//
// CSS variables (set on the host or any ancestor to override):
//   --hv3-scroll-opacity      opacity while the page scrolls (default: option)
//   --hv3-fade-out            fade-out duration (default 0.18s)
//   --hv3-fade-in             fade-in duration (default 0.35s)
//   --hv3-toggle-*            the toggle button: -bg, -fg, -border, -radius,
//                             -font-size, -inset (corner offset)
import { RigModel } from './rig-eval.js';
import { AvatarRenderer } from './renderer.js';
import { MotionController } from './motion.js';

const STYLE_ID = 'hv3-avatar-style';
const CSS = `
:where(.hv3-avatar){position:relative;transition:opacity var(--hv3-fade-in,.35s) ease}
:where(.hv3-avatar) canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
:where(.hv3-avatar.hv3-scrolling){opacity:var(--hv3-scroll-opacity,.35);transition-duration:var(--hv3-fade-out,.18s)}
:where(.hv3-view-toggle){position:absolute;top:var(--hv3-toggle-inset,8px);right:var(--hv3-toggle-inset,8px);z-index:2;
 font:inherit;font-size:var(--hv3-toggle-font-size,13px);line-height:1;padding:7px 11px;min-height:32px;cursor:pointer;
 color:var(--hv3-toggle-fg,#16233a);background:var(--hv3-toggle-bg,#ffffffd9);border:1px solid var(--hv3-toggle-border,#c8d3e4);border-radius:var(--hv3-toggle-radius,999px)}
:where(.hv3-view-toggle[data-corner="left"]){right:auto;left:var(--hv3-toggle-inset,8px)}
:where(.hv3-view-toggle[data-corner="bottom-right"]){top:auto;bottom:var(--hv3-toggle-inset,8px)}
:where(.hv3-view-toggle[data-corner="bottom-left"]){top:auto;bottom:var(--hv3-toggle-inset,8px);right:auto;left:var(--hv3-toggle-inset,8px)}
:where(.hv3-view-toggle):focus-visible{outline:3px solid #e9a72a;outline-offset:2px}`;
const LABEL = { bust: '全身', full: 'バストアップ' }; // the button names the view it switches to

const storage = {
  get(key) { try { return key ? localStorage.getItem(key) : null; } catch { return null; } },
  set(key, v) { try { if (key) localStorage.setItem(key, v); } catch { /* not available: keep the view for this visit only */ } }
};

export async function mountHibikiAvatar(host, options = {}) {
  const o = { view: 'bust', chat: false, viewToggle: true, rememberView: 'hibiki-view', motionSize: 'auto', facing: 'auto', baseURL: new URL('./', import.meta.url).href, ...options };
  o.scrollFade = { enabled: false, opacity: 0.35, restoreMs: 600, ...(options.scrollFade || {}) };
  if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.prepend(st); }
  host.classList.add('hv3-avatar');
  // option values as low-priority defaults: a site's own CSS wins
  const id = 'hv3-' + Math.random().toString(36).slice(2, 8); host.dataset.hv3 = id;
  const local = document.createElement('style');
  local.textContent = `:where([data-hv3="${id}"]){--hv3-scroll-opacity:${+o.scrollFade.opacity}}`;
  document.head.prepend(local);

  const json = await (await fetch(new URL('hibiki.rig.json', o.baseURL), { cache: 'no-cache' })).json();
  const model = new RigModel(json);
  const renderer = await new AvatarRenderer().init(host, model, o.baseURL);
  const motion = new MotionController(model);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // view: chat is always bust-up; otherwise the remembered or the first view
  let view = o.chat ? 'bust' : (o.rememberView && storage.get(o.rememberView)) || o.view;
  if (!(view in json.views)) view = 'bust';
  let button = null, cornerKey = '';
  const setView = v => {
    if (o.chat) v = 'bust';
    view = v; renderer.setView(v); cornerKey = '';
    if (button) { const next = v === 'full' ? 'bust' : 'full'; button.textContent = LABEL[v === 'full' ? 'full' : 'bust']; button.dataset.next = next; button.setAttribute('aria-label', (next === 'full' ? '全身' : 'バストアップ') + 'に切り替える'); }
    if (!o.chat && o.rememberView) storage.set(o.rememberView, v);
  };
  if (!o.chat && o.viewToggle) {
    button = document.createElement('button'); button.type = 'button'; button.className = 'hv3-view-toggle';
    button.addEventListener('click', () => setView(button.dataset.next));
    host.appendChild(button);
  }
  setView(view);

  // gaze: the pointer anywhere on the page (mouse) or a tap anywhere (touch);
  // passive listeners, so scrolling and buttons work as usual
  const faceOnScreen = () => {
    const r = renderer.app.canvas.getBoundingClientRect(), root = renderer.root;
    return [r.left + root.position.x + json.headCenter[0] * root.scale.x, r.top + root.position.y + json.headCenter[1] * root.scale.y];
  };
  const look = e => {
    if (e.type === 'pointermove' && e.pointerType !== 'mouse') return;
    const [fx, fy] = faceOnScreen(), sx = Math.max(240, innerWidth * 0.4), sy = Math.max(240, innerHeight * 0.4);
    motion.lookAt((e.clientX - fx) / sx, (e.clientY - fy) / sy, 3);
  };
  addEventListener('pointermove', look, { passive: true });
  addEventListener('pointerdown', look, { passive: true });

  // scroll fade (window and any scrolling ancestor)
  let fadeTimer = 0;
  const onScroll = () => {
    if (!o.scrollFade.enabled) return;
    host.classList.add('hv3-scrolling');
    clearTimeout(fadeTimer); fadeTimer = setTimeout(() => host.classList.remove('hv3-scrolling'), o.scrollFade.restoreMs);
  };
  addEventListener('scroll', onScroll, { passive: true, capture: true });

  // placement orientation: where the avatar sits on the page, re-read every frame
  const facing = () => { const r = host.getBoundingClientRect(); return ((r.left + r.width / 2) - innerWidth / 2) / (innerWidth / 2); };
  // display size -> motion size: how tall the avatar is drawn on the page (the
  // shown view, bust-up or full body). 200 CSS px or less moves the most, 520 px
  // or more (a chat bust-up, the full-body check page) moves like a usual Live2D model
  const autoSize = () => { const px = renderer.root.scale.y * renderer.view[3]; return Math.min(1, Math.max(0, (520 - px) / 320)); };
  let last = performance.now();
  // The button goes in a corner of the host that the avatar does not cover:
  // each corner is tested against the drawn parts (their bounding boxes on the
  // page, with a margin) and the first free one is used (top corners first,
  // the one toward the page centre first). Re-checked when the view, the
  // placement or the size changes.
  const placeButton = () => {
    if (!button || button.hidden) return;
    const hr = host.getBoundingClientRect(), br = button.getBoundingClientRect(), root = renderer.root, s = root.scale.x;
    const key = [view, Math.round(hr.left), Math.round(hr.width), Math.round(hr.height), Math.round(s * 1000)].join();
    if (key === cornerKey) return; cornerKey = key;
    const boxes = [];
    for (const it of renderer.items) {
      if (!it.mesh.visible || it.part.maskOnly) continue;
      const q = it.part.positions; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < q.length; i += 2) { x0 = Math.min(x0, q[i]); x1 = Math.max(x1, q[i]); y0 = Math.min(y0, q[i + 1]); y1 = Math.max(y1, q[i + 1]); }
      boxes.push([root.position.x + x0 * s, root.position.y + y0 * s, root.position.x + x1 * s, root.position.y + y1 * s]);
    }
    const inset = 8, w = br.width || 90, h = br.height || 32, m = 6, W = hr.width, H = hr.height;
    const rect = c => { const l = c.includes('left') ? inset : W - inset - w, t = c.startsWith('bottom') ? H - inset - h : inset; return [l - m, t - m, l + w + m, t + h + m]; };
    const free = r => !boxes.some(b => b[0] < r[2] && b[2] > r[0] && b[1] < r[3] && b[3] > r[1]);
    const inward = ((hr.left + hr.width / 2) > innerWidth / 2) ? 'left' : 'right';
    const order = [inward === 'left' ? 'left' : 'right', inward === 'left' ? 'right' : 'left', 'bottom-' + inward, 'bottom-' + (inward === 'left' ? 'right' : 'left')];
    const c = order.find(c => free(rect(c))) || order[0];
    button.dataset.corner = c;
  };
  const tick = fixed => {
    const now = performance.now(), dt = typeof fixed === 'number' ? fixed : Math.min(0.05, (now - last) / 1000); last = now;
    motion.setFacing(o.facing === 'auto' ? facing() : +o.facing);
    motion.setMotionSize(o.motionSize === 'auto' ? autoSize() : +o.motionSize, reduce.matches);
    motion.update(reduce.matches ? dt * 0.6 : dt);
    model.update(dt);
    renderer.sync();
    placeButton();
  };
  if (o.autoplay !== false) renderer.app.ticker.add(tick); else renderer.app.ticker.stop();

  return {
    model, motion, renderer,
    get view() { return view; },
    setView,
    // advance by a fixed time and draw (with autoplay: false, for tests and recordings)
    step(dt) { tick(dt); renderer.app.render(); },
    setScrollFade(cfg) { Object.assign(o.scrollFade, cfg); local.textContent = `:where([data-hv3="${id}"]){--hv3-scroll-opacity:${+o.scrollFade.opacity}}`; if (!o.scrollFade.enabled) host.classList.remove('hv3-scrolling'); },
    setViewToggle(show) { if (button) { button.hidden = !show; cornerKey = ''; } },
    destroy() {
      removeEventListener('pointermove', look); removeEventListener('pointerdown', look); removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(fadeTimer); renderer.app.ticker.remove(tick); renderer.app.destroy(true); button?.remove(); local.remove();
      host.classList.remove('hv3-avatar', 'hv3-scrolling'); delete host.dataset.hv3;
    }
  };
}
