import * as THREE from 'three';
import { Game } from './game.js';
import { OBJECTS, CATEGORIES } from './catalog.js';
import { TOOLS, FINISHES, HANDLES, toolIcon } from './tools.js';
import { makeShape } from './geometry.js';
import { makeMaterial } from './materials.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ---------------------------------------------------------------- UI bridge
const ui = {
  widthScale: 1, depthScale: 1, cameraMode: false,
  onObject(def) { $('#objName').textContent = def.name; $$('.obj').forEach(e => e.classList.toggle('on', e.dataset.id === def.id)); },
  onUndo(n) { $('#undoBtn').disabled = n === 0; },
  onCut(n) {
    for (const t of TOOLS) if (t.unlock === n) toast(`Unlocked: ${t.name}`);
    for (const f of FINISHES) if (f.unlock === n) toast(`Unlocked: ${f.name} finish`);
    if (TOOLS.some(t => t.unlock === n)) renderToolbar();
  },
  hideHint() { $('#hint').classList.add('gone'); },
  buzz(ms) {
    if (!game.settings.haptics) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* ignore */ } return; }
    // iOS 18+: toggling a native switch produces a light haptic tick
    const now = performance.now();
    if (now - (ui._lastIos || 0) > 120) { ui._lastIos = now; try { $('#hapticLabel').click(); } catch { /* ignore */ } }
  },
};
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

const game = new Game($('#c'), ui);
window.game = game; // handy for debugging

// ---------------------------------------------------------------- tools
const unlocked = (t) => !t.unlock || game.stats.cuts >= t.unlock;
function renderToolbar() {
  const bar = $('#toolbar'); bar.innerHTML = '';
  for (const t of TOOLS.filter(unlocked)) {
    const b = document.createElement('button');
    b.className = 'tool glass' + (t.id === game.toolId ? ' on' : '');
    b.innerHTML = toolIcon(t) + `<span>${t.name}</span>`;
    b.onclick = () => selectTool(t.id);
    bar.appendChild(b);
  }
  const more = document.createElement('button');
  more.className = 'tool glass more';
  const locked = TOOLS.filter(t => !unlocked(t)).length;
  more.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Collection${locked ? ` · ${locked}🔒` : ''}</span>`;
  more.onclick = () => openSheet('#toolSheet');
  bar.appendChild(more);
}
function selectTool(id) {
  game.setTool(id); game.audio.ui(); renderToolbar(); renderToolSheet();
  const t = game.tool;
  $('#sizeWrap').classList.toggle('hidden', t.kind === 'knife');
  $('#tiltWrap').classList.toggle('hidden', t.kind !== 'knife' || game.mode !== 'vertical');
  $$('[data-mode]').forEach(b => b.classList.toggle('hidden', t.kind !== 'knife'));
}
function renderToolSheet() {
  $('#cutCount').textContent = `${game.stats.cuts} cuts`;
  const g = $('#toolGrid'); g.innerHTML = '';
  for (const t of TOOLS) {
    const ok = unlocked(t);
    const c = document.createElement('button');
    c.className = 'tcard' + (t.id === game.toolId ? ' on' : '') + (ok ? '' : ' locked');
    const kind = { knife: 'Slice', shave: 'Shave', carve: 'Carve' }[t.kind] + (t.path ? ` · ${t.path}` : '');
    c.innerHTML = toolIcon(t) + `<span>${t.name}</span><small>${ok ? kind : `🔒 ${t.unlock} cuts`}</small>`;
    c.onclick = () => { if (ok) selectTool(t.id); else toast(`Make ${t.unlock - game.stats.cuts} more cuts to unlock`); };
    g.appendChild(c);
  }
  const sw = (list, el, cur, set) => {
    el.innerHTML = '';
    for (const f of list) {
      const ok = !f.unlock || game.stats.cuts >= f.unlock;
      const b = document.createElement('button');
      b.className = 'sw' + (f.id === cur ? ' on' : '') + (ok ? '' : ' locked');
      b.style.background = f.pattern ? `repeating-linear-gradient(160deg, #6d727c 0 3px, #c8ccd4 3px 7px)` : f.color;
      b.title = f.name + (ok ? '' : ` (${f.unlock} cuts)`);
      b.onclick = () => { if (!ok) return toast(`${f.name} unlocks at ${f.unlock} cuts`); set(f.id); game.setTool(game.toolId); renderToolSheet(); game.audio.ui(); };
      el.appendChild(b);
    }
  };
  sw(FINISHES, $('#finishes'), game.finish, v => game.finish = v);
  sw(HANDLES, $('#handles'), game.handle, v => game.handle = v);
}

// ---------------------------------------------------------------- objects
let cat = 'featured';
function renderObjects() {
  const cats = $('#cats'); cats.innerHTML = '';
  for (const c of [{ id: 'featured', name: '★ Featured' }, { id: 'all', name: 'All' }, ...CATEGORIES]) {
    const b = document.createElement('button'); b.className = 'cat' + (c.id === cat ? ' on' : ''); b.textContent = c.name;
    b.onclick = () => { cat = c.id; renderObjects(); }; cats.appendChild(b);
  }
  const q = $('#search').value.trim().toLowerCase();
  const list = OBJECTS.filter(o => q ? o.name.toLowerCase().includes(q) : cat === 'all' ? true : cat === 'featured' ? o.star : o.cat === cat);
  const g = $('#objGrid'); g.innerHTML = '';
  for (const o of list) {
    const b = document.createElement('button'); b.className = 'obj' + (game.current && game.current.id === o.id ? ' on' : ''); b.dataset.id = o.id;
    const th = thumbs.get(o.id);
    b.innerHTML = `<div class="thumb">${th ? `<img src="${th}" alt="">` : `<i style="background:linear-gradient(135deg,${o.out.c[0]},${o.in.c[0]})"></i>`}</div><span>${o.name}</span>`;
    b.onclick = () => { game.spawn(o.id); closeSheets(); };
    g.appendChild(b);
  }
  queueThumbs(list);
}

// lazily rendered 3D thumbnails (own small renderer)
const thumbs = new Map();
let tr = null, tscene, tcam, tqueue = [], tbusy = false;
function queueThumbs(list) { tqueue = list.filter(o => !thumbs.has(o.id)); if (!tbusy) pumpThumbs(); }
function pumpThumbs() {
  if (!tqueue.length) { tbusy = false; return; }
  tbusy = true;
  try {
    if (!tr) {
      const c = document.createElement('canvas'); c.width = c.height = 144;
      tr = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      tr.outputColorSpace = THREE.SRGBColorSpace; tr.toneMapping = THREE.ACESFilmicToneMapping;
      tscene = new THREE.Scene();
      tscene.environment = new THREE.PMREMGenerator(tr).fromScene(new RoomEnvironment(), 0.04).texture; tscene.environmentIntensity = 0.6;
      tscene.add(new THREE.HemisphereLight('#fff', '#d8c8b8', 1.2));
      const d = new THREE.DirectionalLight('#fff', 2); d.position.set(3, 6, 4); tscene.add(d);
      tcam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    }
    const o = tqueue.shift();
    const part = makeShape({ ...o.shape, q: 0.6 });
    // show a pre-cut view so the inside is visible in the thumbnail
    const geo = buildThumbGeo(part);
    const shared = { wob: { value: 0 }, time: { value: 0 }, base: { value: 0 }, height: { value: 1 } };
    const mesh = new THREE.Mesh(geo, [makeMaterial(o.out, o.mat, shared), makeMaterial(o.in, o.mat, shared)]);
    tscene.add(mesh);
    const bb = new THREE.Box3().setFromObject(mesh), size = bb.getSize(new THREE.Vector3()).length();
    const ctr = bb.getCenter(new THREE.Vector3());
    tcam.position.set(ctr.x + size * 0.95, ctr.y + size * 0.85, ctr.z + size * 1.3); tcam.lookAt(ctr);
    tr.render(tscene, tcam);
    thumbs.set(o.id, tr.domElement.toDataURL('image/png'));
    tscene.remove(mesh); geo.dispose(); mesh.material.forEach(m => m.dispose());
    const el = document.querySelector(`.obj[data-id="${o.id}"] .thumb`);
    if (el) el.innerHTML = `<img src="${thumbs.get(o.id)}" alt="">`;
  } catch (e) { console.warn('thumb', e); tqueue = []; tbusy = false; return; }
  setTimeout(pumpThumbs, 16);
}
import { splitPart } from './geometry.js';
function buildThumbGeo(part) {
  const b = part.bounds();
  const r = splitPart(part, [0.94, 0, 0.34].map(v => v / Math.hypot(0.94, 0.34)), (b.mx[0] * 0.35) * 0.94, 1);
  const parts = [r.back || part];
  const P = [[], []], N = [[], []];
  for (const pt of parts) for (const f of pt.faces) {
    const g = f.type === 0 ? 0 : 1, p = f.pts, m = p.length / 3;
    for (let i = 1; i < m - 1; i++) for (const k of [0, i, i + 1]) {
      P[g].push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
      if (f.nrm) N[g].push(f.nrm[k * 3], f.nrm[k * 3 + 1], f.nrm[k * 3 + 2]); else N[g].push(...f.plane.n);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...P[0], ...P[1]], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([...N[0], ...N[1]], 3));
  geo.addGroup(0, P[0].length / 3, 0); geo.addGroup(P[0].length / 3, P[1].length / 3, 1);
  return geo;
}

// ---------------------------------------------------------------- sheets
function openSheet(id) { closeSheets(); $(id).classList.add('open'); game.audio.unlock(); if (id === '#objSheet') renderObjects(); if (id === '#toolSheet') renderToolSheet(); }
function closeSheets() { $$('.sheet').forEach(s => s.classList.remove('open')); }
$$('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-close]')) closeSheets(); }));
// swipe down to close
$$('.sheet-card').forEach(card => {
  let y0 = null;
  card.addEventListener('touchstart', e => { if (e.target.closest('.grid,.about,input')) return; y0 = e.touches[0].clientY; }, { passive: true });
  card.addEventListener('touchmove', e => { if (y0 != null && e.touches[0].clientY - y0 > 70) { closeSheets(); y0 = null; } }, { passive: true });
});

// ---------------------------------------------------------------- controls
$('#objBtn').onclick = () => openSheet('#objSheet');
$('#setBtn').onclick = () => openSheet('#setSheet');
$('#search').oninput = () => renderObjects();
$('#undoBtn').onclick = () => game.undo();
$('#resetBtn').onclick = () => game.reset();
$('#slowBtn').onclick = (e) => { game.slow = !game.slow; e.currentTarget.classList.toggle('on', game.slow); game.audio.ui(); toast(game.slow ? 'Slow motion on' : 'Slow motion off'); };
const views = ['angle', 'top', 'low']; let vi = 0;
$('#viewBtn').onclick = () => { vi = (vi + 1) % views.length; game.setView(views[vi]); game.audio.ui(); toast({ angle: 'Angled view', top: 'Top view', low: 'Low view' }[views[vi]]); };
$('#orbitBtn').onclick = (e) => { ui.cameraMode = !ui.cameraMode; e.currentTarget.classList.toggle('on', ui.cameraMode); if (ui.cameraMode) { game.grabMode = false; $('#grabBtn').classList.remove('on'); } toast(ui.cameraMode ? 'Drag to rotate camera' : 'Cutting'); };
$('#grabBtn').onclick = (e) => { game.grabMode = !game.grabMode; e.currentTarget.classList.toggle('on', game.grabMode); if (game.grabMode) { ui.cameraMode = false; $('#orbitBtn').classList.remove('on'); } toast(game.grabMode ? 'Drag pieces to move them' : 'Cutting'); };
$$('[data-mode]').forEach(b => b.onclick = () => {
  game.mode = b.dataset.mode; $$('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
  $('#tiltWrap').classList.toggle('hidden', game.mode !== 'vertical');
  if (game.mode === 'view') toast('Cuts follow the camera — try a low view');
});
$('#tilt').oninput = (e) => { game.tilt = +e.target.value; $('#tiltVal').textContent = `${game.tilt}°`; };
$('#size').oninput = (e) => { const v = +e.target.value / 100; ui.widthScale = v; ui.depthScale = Math.sqrt(v); $('#sizeVal').textContent = `${v.toFixed(1)}×`; };

const S = game.settings;
function bindSettings() {
  $('#optSound').checked = S.sound; $('#optHaptic').checked = S.haptics; $('#optQuality').checked = S.quality === 'high';
  $('#optSound').onchange = e => { S.sound = e.target.checked; game.audio.enabled = S.sound; game.savePrefs(); };
  $('#optHaptic').onchange = e => { S.haptics = e.target.checked; game.savePrefs(); if (S.haptics) ui.buzz(20); };
  $('#optQuality').onchange = e => { S.quality = e.target.checked ? 'high' : 'low'; game.applyQuality(); game.resize(); game.savePrefs(); };
  $('#optVol').oninput = e => { game.audio.volume = e.target.value / 100; if (game.audio.master) game.audio.master.gain.value = game.audio.volume; };
}

// ---------------------------------------------------------------- boot
(async () => {
  try {
    await game.init();
  } catch (e) {
    $('#loading').innerHTML = `<span>Sorry — WebGL could not start on this device.<br><small>${e.message}</small></span>`;
    throw e;
  }
  bindSettings();
  renderToolbar();
  selectTool(game.toolId);
  game.spawn(game.lastObject || 'steak');
  if (!game.physics.ok) setTimeout(() => toast('Simple physics mode (WASM unavailable)'), 800);
  $('#loading').classList.add('done');
  setTimeout(() => ui.hideHint(), 9000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) game.audio.unlock(); });
})();
