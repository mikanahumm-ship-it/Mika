'use strict';
document.documentElement.dir = 'rtl'; document.documentElement.lang = 'he';
/* ============================================================
   ENGINE: renderer, scene, lights, materials, static mesh merger
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
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 420);

/* warm "golden hour" sky like the reference */
(function sky() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#f0a94f'); gr.addColorStop(0.45, '#f5c679'); gr.addColorStop(0.75, '#f8daa2'); gr.addColorStop(1, '#f9e2b4');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
})();
scene.fog = new THREE.Fog(0xf7d8a4, 95, 260);

const hemi = new THREE.HemisphereLight(0xfff6ea, 0x8478b4, 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe6c2, 2.9);
const SUN_OFF = new THREE.Vector3(-45, 52, 26);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
const SH = LOW ? 38 : 48;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 220 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

/* ---------- materials ---------- */
const _mats = {};
function MAT(hex, extra) {
  const k = hex + (extra ? JSON.stringify(extra) : '');
  if (!_mats[k]) _mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.82, metalness: 0, flatShading: true }, extra || {}));
  return _mats[k];
}
const STATIC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });

/* ---------- geometry cache ---------- */
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: (seg) => GEO['cyl' + seg] || (GEO['cyl' + seg] = new THREE.CylinderGeometry(0.5, 0.5, 1, seg)),
  cone: (seg) => GEO['cone' + seg] || (GEO['cone' + seg] = new THREE.ConeGeometry(0.5, 1, seg)),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  sphere: new THREE.SphereGeometry(0.5, 8, 6),
};

/* ---------- static builder: merge thousands of parts into few meshes ---------- */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
class StaticBuilder {
  constructor(opts) { this.chunks = new Map(); this.cast = opts.cast; this.chunk = opts.chunk || 60; }
  add(geo, color, px, py, pz, sx, sy, sz, rx, ry, rz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e);
    _m4.compose(_v.set(px, py, pz), _q, _s.set(sx, sy, sz));
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(_m4);
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    const col = new Float32Array(pos.length);
    _c.set(color);
    for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
    const key = Math.floor(px / this.chunk) + ',' + Math.floor(pz / this.chunk);
    let ch = this.chunks.get(key); if (!ch) this.chunks.set(key, ch = []);
    ch.push({ pos, nor, col });
    g.dispose();
  }
  box(w, h, d, x, y, z, color, ry) { this.add(GEO.box, color, x, y, z, w, h, d, 0, ry || 0, 0); }
  cyl(r, h, x, y, z, color, seg, rTopScale) { this.add(GEO.cyl(seg || 8), color, x, y, z, r * 2, h, r * 2); }
  build(parent) {
    for (const [, parts] of this.chunks) {
      let n = 0; for (const p of parts) n += p.pos.length;
      const P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n);
      let o = 0; for (const p of parts) { P.set(p.pos, o); N.set(p.nor, o); C.set(p.col, o); o += p.pos.length; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, STATIC_MAT);
      m.castShadow = !!this.cast; m.receiveShadow = true; m.matrixAutoUpdate = false;
      parent.add(m);
    }
    this.chunks.clear();
  }
}

/* ---------- canvas text textures (Hebrew signs) ---------- */
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
function signMesh(text, w, h, opts) {
  const t = textTexture(text, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
  return m;
}

/* ---------- small math helpers ---------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function seeded(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
