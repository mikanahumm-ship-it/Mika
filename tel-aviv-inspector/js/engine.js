'use strict';
document.documentElement.dir = 'rtl'; document.documentElement.lang = 'he';
/* ============================================================
   ENGINE: renderer, scene, lights, procedural textures,
   static mesh merger (vertex colours + world/facade UVs)
   ============================================================ */
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
const LOW = IS_TOUCH;

const renderer = new THREE.WebGLRenderer({ antialias: !LOW || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 950);

/* warm "golden hour" sky like the reference */
(function sky() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#e99b45'); gr.addColorStop(0.4, '#f4bf6e'); gr.addColorStop(0.72, '#f8d89f'); gr.addColorStop(1, '#fae4b8');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
})();
scene.fog = new THREE.Fog(0xf7d8a4, 130, 600);

const hemi = new THREE.HemisphereLight(0xfff6ea, 0x8478b4, 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe6c2, 2.9);
const SUN_OFF = new THREE.Vector3(-45, 52, 26);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
const SH = LOW ? 40 : 55;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 240 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

/* sun disc + low-poly clouds (no fog so they read against the sky) */
(function skyDeco() {
  const dir = SUN_OFF.clone().normalize();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(26, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c8, fog: false, toneMapped: false }));
  disc.position.copy(dir.clone().multiplyScalar(820)); disc.position.y = 70; disc.lookAt(0, 0, 0); scene.add(disc);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false, transparent: true, opacity: 0.35, toneMapped: false }));
  halo.position.copy(disc.position).multiplyScalar(1.01); halo.lookAt(0, 0, 0); scene.add(halo);
  const cm = new THREE.MeshStandardMaterial({ color: 0xfff4e4, roughness: 1, flatShading: true, fog: false, emissive: 0xf2c48a, emissiveIntensity: 0.35 });
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const rng = (function (s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; })(77);
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, r = 520 + rng() * 260, g = new THREE.Group();
    g.position.set(Math.cos(a) * r, 110 + rng() * 90, Math.sin(a) * r);
    const n = 3 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(ico, cm); m.position.set((k - n / 2) * 14 + rng() * 6, rng() * 6, rng() * 10); m.scale.set(16 + rng() * 10, 8 + rng() * 6, 12 + rng() * 6); g.add(m); }
    g.lookAt(0, g.position.y, 0); scene.add(g);
  }
})();

/* ---------- materials ---------- */
const _mats = {};
function MAT(hex, extra) {
  const k = hex + (extra ? JSON.stringify(extra) : '');
  if (!_mats[k]) _mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.82, metalness: 0, flatShading: true }, extra || {}));
  return _mats[k];
}
const STATIC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });

/* ---------- procedural textures ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== false) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = LOW ? 2 : 8;
  return t;
}
function speckle(g, w, h, n, colors, rmax) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[i % colors.length]; const r = Math.random() * rmax + 0.4; g.fillRect(Math.random() * w, Math.random() * h, r, r); }
}
const TEX = {
  asphalt: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6c6582'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,36,58' : '140,132,160'},0.07)`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 50, 10 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill(); }
    speckle(g, w, h, 2600, ['#5c5574', '#7d7694', '#655e7c', '#837c98'], 1.6);
    g.strokeStyle = 'rgba(40,36,56,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  }),
  sidewalk: canvasTex(256, 256, (g, w, h) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 214 + Math.floor(Math.random() * 16) - 8; g.fillStyle = `rgb(${v + 6},${v - 2},${v - 10})`; g.fillRect(i * s, j * s, s, s); }
    speckle(g, w, h, 900, ['rgba(120,110,100,.25)', 'rgba(255,255,255,.25)'], 1.4);
    g.strokeStyle = '#ab9f95'; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(70,60,60,0.12)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 12, 0, 7); g.fill(); }
  }),
  bike: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c25e4c'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1800, ['#b0503f', '#d06c58', '#a94a3a'], 1.5);
  }),
  yard: canvasTex(256, 256, (g, w, h) => {
    const bw = 64, bh = 32;
    for (let y = 0; y < h; y += bh) for (let x = -bw; x < w; x += bw) {
      const o = (y / bh) % 2 ? bw / 2 : 0, v = 205 + Math.floor(Math.random() * 18);
      g.fillStyle = `rgb(${v + 12},${v},${v - 22})`; g.fillRect(x + o + 1, y + 1, bw - 2, bh - 2);
    }
    g.fillStyle = 'rgba(0,0,0,0)';
    speckle(g, w, h, 600, ['rgba(110,90,70,.25)'], 1.5);
  }),
  sand: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#ecd3a0'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, ['#e2c58d', '#f4dfb4', '#d9b97f'], 1.4); }),
  grass: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#86b955'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1400, ['#77a948', '#97c866', '#6c9c40'], 2); }),
};

/* facade textures: one tile = 4 m wide × 1 floor (3.1 m) */
function facadeTex(kind) {
  return canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 500, ['rgba(120,110,100,.10)', 'rgba(255,255,255,.4)'], 2);
    const grad = g.createLinearGradient(0, h * 0.7, 0, h); grad.addColorStop(0, 'rgba(90,80,70,0)'); grad.addColorStop(1, 'rgba(90,80,70,0.12)'); g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const glass = (x, y, ww, hh) => { const gg = g.createLinearGradient(x, y, x + ww, y + hh); gg.addColorStop(0, '#2f4a78'); gg.addColorStop(0.5, '#5d7fb0'); gg.addColorStop(0.55, '#3a5688'); gg.addColorStop(1, '#263d66'); g.fillStyle = gg; g.fillRect(x, y, ww, hh); };
    const stain = (x, y, ww) => { const s = g.createLinearGradient(0, y, 0, y + 40); s.addColorStop(0, 'rgba(80,70,60,.18)'); s.addColorStop(1, 'rgba(80,70,60,0)'); g.fillStyle = s; g.fillRect(x, y, ww, 40); };
    if (kind === 0) { // rolling shutters (trisim) + AC unit
      for (const x of [26, 142]) {
        g.fillStyle = '#d9d4cc'; g.fillRect(x - 6, 44, 100, 104);
        glass(x, 50, 88, 92);
        const sh = 30 + Math.random() * 40; g.fillStyle = '#8fa1b8'; g.fillRect(x, 50, 88, sh);
        g.strokeStyle = '#71839b'; g.lineWidth = 1; for (let y = 52; y < 50 + sh; y += 4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 88, y); g.stroke(); }
        g.fillStyle = '#c9c3b8'; g.fillRect(x - 8, 146, 104, 6); stain(x, 152, 88);
      }
      g.fillStyle = '#e9e9ea'; g.fillRect(150, 156, 46, 30); g.fillStyle = '#b5b7bb'; for (let k = 0; k < 6; k++) g.fillRect(154 + k * 7, 160, 3, 22);
    } else if (kind === 1) { // Bauhaus ribbon window
      g.fillStyle = '#d3cdc3'; g.fillRect(0, 56, w, 82); glass(0, 62, w, 70);
      g.fillStyle = '#ece8e1'; for (let x = 0; x < w; x += 64) g.fillRect(x, 62, 5, 70);
      g.fillStyle = '#efebe4'; g.fillRect(0, 150, w, 12); stain(0, 162, w);
    } else if (kind === 2) { // eclectic: shuttered balcony door + window
      g.fillStyle = '#e6dccf'; g.fillRect(36, 30, 74, 160); glass(44, 36, 58, 154);
      g.fillStyle = '#4f8a6a'; g.fillRect(16, 34, 24, 156); g.fillRect(106, 34, 24, 156);
      g.strokeStyle = '#3c6d53'; for (let y = 38; y < 188; y += 6) { g.beginPath(); g.moveTo(16, y); g.lineTo(40, y); g.moveTo(106, y); g.lineTo(130, y); g.stroke(); }
      g.fillStyle = '#d8cdbe'; g.fillRect(160, 58, 70, 84); glass(166, 64, 58, 72); g.fillStyle = '#ece5da'; g.fillRect(193, 64, 4, 72);
      g.fillStyle = '#c9bca9'; g.fillRect(156, 140, 78, 6); stain(166, 146, 58);
      g.strokeStyle = '#2b2b2b'; g.lineWidth = 3; g.beginPath(); for (let x = 36; x <= 110; x += 9) { g.moveTo(x, 140); g.lineTo(x, 190); } g.moveTo(32, 140); g.lineTo(114, 140); g.stroke();
    } else { // modern glass
      g.fillStyle = '#b8bcc4'; g.fillRect(0, 0, w, h);
      glass(6, 8, 118, 178); glass(132, 8, 118, 178);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(10, 180); g.lineTo(60, 10); g.lineTo(80, 10); g.lineTo(30, 180); g.fill();
      g.fillStyle = '#9fa4ad'; g.fillRect(0, 186, w, 14);
    }
  });
}
const FACADE_TEX = [facadeTex(0), facadeTex(1), facadeTex(2), facadeTex(3)];
const FACADE_MAT = FACADE_TEX.map((t) => new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.82, metalness: 0 }));
const GROUND_MAT = {};
for (const k of ['asphalt', 'sidewalk', 'bike', 'yard', 'sand', 'grass']) GROUND_MAT[k] = new THREE.MeshStandardMaterial({ map: TEX[k], vertexColors: true, roughness: 0.95, metalness: 0 });

/* ---------- geometry cache ---------- */
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: (seg) => GEO['cyl' + seg] || (GEO['cyl' + seg] = new THREE.CylinderGeometry(0.5, 0.5, 1, seg)),
  cone: (seg) => GEO['cone' + seg] || (GEO['cone' + seg] = new THREE.ConeGeometry(0.5, 1, seg)),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  ico1: new THREE.IcosahedronGeometry(0.5, 1),
  sphere: new THREE.SphereGeometry(0.5, 8, 6),
};

/* ---------- static builder: merge thousands of parts into few meshes ---------- */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
class StaticBuilder {
  constructor(opts) { this.chunks = new Map(); this.cast = opts.cast; this.chunk = opts.chunk || 60; this.mat = opts.mat || STATIC_MAT; this.uvScale = opts.uvScale || 0; this.hasUV = !!opts.uvScale || !!opts.uv; this.single = !!opts.single; }
  _bucket(px, pz) {
    const key = this.single ? 's' : Math.floor(px / this.chunk) + ',' + Math.floor(pz / this.chunk);
    let ch = this.chunks.get(key); if (!ch) this.chunks.set(key, ch = []); return ch;
  }
  add(geo, color, px, py, pz, sx, sy, sz, rx, ry, rz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e);
    _m4.compose(_v.set(px, py, pz), _q, _s.set(sx, sy, sz));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(_m4);
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    const col = new Float32Array(pos.length);
    _c.set(color);
    for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
    let uv = null;
    if (this.hasUV) {
      uv = new Float32Array(pos.length / 3 * 2); const s = this.uvScale || 1;
      for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) { uv[j] = pos[i] * s; uv[j + 1] = pos[i + 2] * s; }
    }
    this._bucket(px, pz).push({ pos, nor, col, uv });
    g.dispose();
  }
  /* explicit quad a,b,c,d (counter-clockwise seen from the front) */
  quad(a, b, c, d, n, uvs, color) {
    const pos = new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]);
    const nor = new Float32Array(18); for (let i = 0; i < 18; i += 3) { nor[i] = n[0]; nor[i + 1] = n[1]; nor[i + 2] = n[2]; }
    const col = new Float32Array(18); _c.set(color); for (let i = 0; i < 18; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
    const uv = new Float32Array([...uvs[0], ...uvs[1], ...uvs[2], ...uvs[0], ...uvs[2], ...uvs[3]]);
    this._bucket((a[0] + c[0]) / 2, (a[2] + c[2]) / 2).push({ pos, nor, col, uv });
  }
  box(w, h, d, x, y, z, color, ry) { this.add(GEO.box, color, x, y, z, w, h, d, 0, ry || 0, 0); }
  cyl(r, h, x, y, z, color, seg) { this.add(GEO.cyl(seg || 8), color, x, y, z, r * 2, h, r * 2); }
  build(parent) {
    for (const [, parts] of this.chunks) {
      let n = 0; for (const p of parts) n += p.pos.length;
      const P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n), U = this.hasUV ? new Float32Array(n / 3 * 2) : null;
      let o = 0, ou = 0; for (const p of parts) { P.set(p.pos, o); N.set(p.nor, o); C.set(p.col, o); if (U && p.uv) U.set(p.uv, ou); o += p.pos.length; ou += p.pos.length / 3 * 2; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      if (U) g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.mat);
      m.castShadow = !!this.cast; m.receiveShadow = true; m.matrixAutoUpdate = false;
      parent.add(m); this.last = m;
    }
    this.chunks.clear();
    return this.last;
  }
}

/* ---------- canvas text textures (Hebrew signs) ---------- */
function drawSign(g, X, Y, W, H, text, o) {
  g.save(); g.translate(X, Y);
  g.fillStyle = o.bg; g.fillRect(0, 0, W, H);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = H * 0.07; g.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12); }
  g.fillStyle = o.fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  let size = o.size * (H / o.h);
  g.font = `${o.weight} ${size}px "${o.font}", "Arial Hebrew", Arial, sans-serif`;
  while (g.measureText(text).width > W * 0.9 && size > 10) { size -= 2; g.font = `${o.weight} ${size}px "${o.font}", Arial, sans-serif`; }
  g.fillText(text, W / 2, o.sub ? H * 0.4 : H / 2 + size * 0.04);
  if (o.sub) { g.font = `600 ${Math.round(size * 0.42)}px "${o.font}", Arial, sans-serif`; g.fillText(o.sub, W / 2, H * 0.78); }
  g.restore();
}
/* sign atlases: many shop/street signs share a few textures → few draw calls */
const SIGNS = { atlases: [], slots: {}, n: 0, CW: 512, CH: 128, COLS: 4, ROWS: 16 };
function atlasSign(text, w, h, opts, x, y, z, ry) {
  const o = Object.assign({ w: 512, h: 128, bg: '#2b5fd9', fg: '#ffffff', size: 70, font: 'Rubik', weight: 800, border: null, sub: null }, opts || {});
  const key = text + '|' + o.bg + '|' + o.fg + '|' + o.border + '|' + o.size;
  let sl = SIGNS.slots[key];
  if (!sl) {
    const idx = SIGNS.n++, per = SIGNS.COLS * SIGNS.ROWS, ai = Math.floor(idx / per), cell = idx % per;
    if (!SIGNS.atlases[ai]) {
      const c = document.createElement('canvas'); c.width = SIGNS.CW * SIGNS.COLS; c.height = SIGNS.CH * SIGNS.ROWS;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.7 });
      SIGNS.atlases[ai] = { c, g: c.getContext('2d'), t, b: new StaticBuilder({ cast: false, chunk: 150, mat, uv: true }) };
    }
    const A = SIGNS.atlases[ai], cx = (cell % SIGNS.COLS) * SIGNS.CW, cy = Math.floor(cell / SIGNS.COLS) * SIGNS.CH;
    drawSign(A.g, cx, cy, SIGNS.CW, SIGNS.CH, text, o);
    const Wt = A.c.width, Ht = A.c.height, pad = 2;
    sl = SIGNS.slots[key] = { ai, u0: (cx + pad) / Wt, u1: (cx + SIGNS.CW - pad) / Wt, v1: 1 - (cy + pad) / Ht, v0: 1 - (cy + SIGNS.CH - pad) / Ht };
  }
  const B = SIGNS.atlases[sl.ai].b, c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hh = h / 2;
  const P = (lx, ly) => [x + lx * c, y + ly, z - lx * s];
  B.quad(P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh), [s, 0, c], [[sl.u0, sl.v0], [sl.u1, sl.v0], [sl.u1, sl.v1], [sl.u0, sl.v1]], 0xffffff);
}
function buildSigns(parent) { for (const A of SIGNS.atlases) { A.t.needsUpdate = true; A.b.build(parent); } }
const _tex = {};
function textTexture(text, o) {
  o = Object.assign({ w: 512, h: 128, bg: '#2b5fd9', fg: '#ffffff', size: 70, font: 'Rubik', weight: 800, border: null, sub: null }, o || {});
  const k = text + JSON.stringify(o);
  if (_tex[k]) return _tex[k];
  const c = document.createElement('canvas'); c.width = o.w; c.height = o.h;
  const g = c.getContext('2d');
  g.fillStyle = o.bg; g.fillRect(0, 0, o.w, o.h);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = o.h * 0.07; g.strokeRect(o.h * 0.06, o.h * 0.06, o.w - o.h * 0.12, o.h - o.h * 0.12); }
  g.fillStyle = o.fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  let size = o.size;
  g.font = `${o.weight} ${size}px "${o.font}", "Arial Hebrew", Arial, sans-serif`;
  while (g.measureText(text).width > o.w * 0.9 && size > 12) { size -= 2; g.font = `${o.weight} ${size}px "${o.font}", Arial, sans-serif`; }
  g.fillText(text, o.w / 2, o.sub ? o.h * 0.4 : o.h / 2 + size * 0.04);
  if (o.sub) { g.font = `600 ${Math.round(size * 0.42)}px "${o.font}", Arial, sans-serif`; g.fillText(o.sub, o.w / 2, o.h * 0.78); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (_tex[k] = t);
}
const _signMats = {};
function signMesh(text, w, h, opts) {
  const k = text + JSON.stringify(opts || {});
  if (!_signMats[k]) _signMats[k] = new THREE.MeshStandardMaterial({ map: textTexture(text, opts), roughness: 0.7 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), _signMats[k]);
}

/* ---------- small math helpers ---------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function seeded(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
