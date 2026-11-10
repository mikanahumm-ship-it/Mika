import * as THREE from 'three';

function curlGeometry() {
  // spiral ribbon -> soap shaving
  const segs = 40, pos = [], idx = [], nrm = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = t * Math.PI * 4, r = 0.055 * (1 - 0.6 * t);
    const cx = Math.cos(a) * r, cy = Math.sin(a) * r, z = t * 0.05;
    for (const w of [-0.035, 0.035]) { pos.push(cx, cy, z + w); nrm.push(Math.cos(a), Math.sin(a), 0); }
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx); g.center();
  return g;
}

const DEFS = {
  shave: { geo: () => curlGeometry(), mat: () => new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide }), size: [0.7, 1.3], g: 6, drag: 2.2, settle: 'rest', life: 30 },
  crumb: { geo: () => new THREE.IcosahedronGeometry(0.025, 0), mat: () => new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), size: [0.5, 1.6], g: 14, drag: 0.4, settle: 'rest', life: 25 },
  juice: { geo: () => new THREE.SphereGeometry(0.02, 8, 6), mat: () => new THREE.MeshPhysicalMaterial({ roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }), size: [0.5, 1.4], g: 14, drag: 0.3, settle: 'splat', life: 9 },
  jelly: { geo: () => new THREE.BoxGeometry(0.04, 0.04, 0.04), mat: () => new THREE.MeshPhysicalMaterial({ roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.8 }), size: [0.4, 1.2], g: 12, drag: 0.4, settle: 'rest', life: 12 },
  sand: { geo: () => new THREE.BoxGeometry(0.014, 0.014, 0.014), mat: () => new THREE.MeshStandardMaterial({ roughness: 1 }), size: [0.6, 1.4], g: 10, drag: 1.0, settle: 'rest', life: 25 },
  ice: { geo: () => new THREE.TetrahedronGeometry(0.03, 0), mat: () => new THREE.MeshPhysicalMaterial({ roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.6 }), size: [0.4, 1.4], g: 14, drag: 0.2, settle: 'rest', life: 12 },
  blob: { geo: () => new THREE.SphereGeometry(0.032, 12, 9), mat: () => new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 0.8 }), size: [0.6, 1.9], g: 14, drag: 0.35, settle: 'splat', life: 16 },
  glass: { geo: () => new THREE.TetrahedronGeometry(0.04, 0), mat: () => new THREE.MeshPhysicalMaterial({ roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.55, metalness: 0.1 }), size: [0.3, 1.5], g: 14, drag: 0.2, settle: 'rest', life: 20 },
  choc: { geo: () => new THREE.BoxGeometry(0.05, 0.008, 0.03), mat: () => new THREE.MeshStandardMaterial({ roughness: 0.4 }), size: [0.5, 1.3], g: 12, drag: 0.6, settle: 'rest', life: 25 },
};

const MAX = 420;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export class Particles {
  constructor(scene) {
    this.scene = scene; this.pools = {};
    for (const [k, d] of Object.entries(DEFS)) {
      const mesh = new THREE.InstancedMesh(d.geo(), d.mat(), MAX);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
      mesh.count = 0; mesh.castShadow = k === 'shave' || k === 'crumb'; mesh.frustumCulled = false;
      scene.add(mesh);
      this.pools[k] = { d, mesh, list: [], next: 0 };
    }
  }
  spawn(type, at, vel, color, opts = {}) {
    const P = this.pools[type]; if (!P) return;
    const d = P.d;
    let p;
    if (P.list.length < MAX) { p = {}; P.list.push(p); } else { p = P.list[P.next]; P.next = (P.next + 1) % MAX; }
    p.p = at.clone(); p.v = vel.clone(); p.r = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.w = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    p.s = (d.size[0] + Math.random() * (d.size[1] - d.size[0])) * (opts.scale || 1);
    p.age = 0; p.rest = false; p.c = color.clone(); p.flat = 1; p.floor = opts.floor ?? 0;
    p.dirty = true;
  }
  burst(type, center, n, colorFn, spread = 1, up = 1, opts) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.6 * spread, (0.6 + Math.random() * 1.6) * up, (Math.random() - 0.5) * 1.6 * spread);
      const at = center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, Math.random() * 0.05, (Math.random() - 0.5) * 0.15));
      this.spawn(type, at, v, colorFn(), opts);
    }
  }
  clear() { for (const P of Object.values(this.pools)) { P.list.length = 0; P.next = 0; P.mesh.count = 0; } }
  update(dt) {
    for (const P of Object.values(this.pools)) {
      const d = P.d, L = P.list; if (!L.length) { P.mesh.count = 0; continue; }
      let i = 0;
      for (const p of L) {
        p.age += dt;
        if (!p.rest) {
          p.v.y -= d.g * dt;
          p.v.multiplyScalar(Math.max(0, 1 - d.drag * dt));
          p.p.addScaledVector(p.v, dt);
          p.r.addScaledVector(p.w, dt);
          const fy = p.floor + 0.008 * p.s;
          if (p.p.y < fy) {
            p.p.y = fy;
            if (Math.abs(p.v.y) < 1.2 || d.settle === 'splat') { p.rest = true; if (d.settle === 'splat') p.flat = 0.25; if (d.settle === 'rest') { p.r.x = Math.round(p.r.x / Math.PI) * Math.PI + (Math.random() - .5) * .4; } }
            else { p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; p.w.multiplyScalar(0.5); }
          }
          p.dirty = true;
        }
        const fade = p.age > d.life ? Math.max(0, 1 - (p.age - d.life) / 2) : 1;
        if (p.dirty || fade < 1) {
          _q.setFromEuler(_e.set(p.r.x, p.r.y, p.r.z));
          const s = p.s * fade;
          _s.set(s * (p.flat < 1 ? 1.8 : 1), s * p.flat, s * (p.flat < 1 ? 1.8 : 1));
          if (p.flat < 1) _q.identity();
          _m.compose(p.p, _q, _s);
          P.mesh.setMatrixAt(i, _m);
          P.mesh.setColorAt(i, p.c);
          p.dirty = p.age > d.life;
        }
        i++;
      }
      P.mesh.count = i;
      P.mesh.instanceMatrix.needsUpdate = true;
      if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true;
      // drop fully faded
      if (L.length && L[0].age > d.life + 2) { P.list = L.filter(p => p.age <= d.life + 2); P.next = 0; for (const p of P.list) p.dirty = true; }
    }
  }
}
