import * as THREE from 'three';

// CPU port of the volumetric GLSL patterns in materials.js. Used to colour
// diced cubes with exactly the material found at the cube's position inside
// the object (meat vs fat, soap layers, fruit flesh/seeds ...).

const fract = (x) => x - Math.floor(x);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function h31(x, y, z) {
  x = fract(x * 0.3183099 + 0.1) * 17; y = fract(y * 0.3183099 + 0.1) * 17; z = fract(z * 0.3183099 + 0.1) * 17;
  return fract(x * y * z * (x + y + z));
}
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(h31(ix, iy, iz), h31(ix + 1, iy, iz), fx), L(h31(ix, iy + 1, iz), h31(ix + 1, iy + 1, iz), fx), fy),
    L(L(h31(ix, iy, iz + 1), h31(ix + 1, iy, iz + 1), fx), L(h31(ix, iy + 1, iz + 1), h31(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
function fbm(x, y, z) {
  let a = 0.5, s = 0;
  for (let i = 0; i < 3; i++) { s += a * vnoise(x, y, z); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1; a *= 0.5; }
  return s;
}

const cache = new WeakMap();
function prep(surf) {
  let c = cache.get(surf); if (c) return c;
  const C = (i) => new THREE.Color(surf.c[i] ?? surf.c[Math.min(i, surf.c.length - 1)] ?? surf.c[0]);
  const c1 = C(0), c2 = new THREE.Color(surf.c[1] ?? surf.c[0]), c3 = new THREE.Color(surf.c[2] ?? surf.c[1] ?? surf.c[0]), c4 = new THREE.Color(surf.c[3] ?? surf.c[2] ?? surf.c[0]);
  void C;
  const ax = new THREE.Vector3(...(surf.axis || [0, 1, 0])); if (ax.lengthSq() > 0) ax.normalize();
  c = { c1, c2, c3, c4, s: surf.s ?? 4, P: surf.p || [0.1, 0.5, 3, 0.15], ax, ce: new THREE.Vector3(...(surf.center || [0, 0, 0])), pat: surf.pat };
  cache.set(surf, c); return c;
}
function axr(c, x, y, z) {
  const qx = x - c.ce.x, qy = y - c.ce.y, qz = z - c.ce.z;
  if (c.ax.lengthSq() < 0.5) return Math.hypot(qx, qy, qz);
  const d = qx * c.ax.x + qy * c.ax.y + qz * c.ax.z;
  return Math.hypot(qx - d * c.ax.x, qy - d * c.ax.y, qz - d * c.ax.z);
}
const mix = (out, a, b, t) => out.setRGB(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);

// Returns a THREE.Color (linear) for material-space point (x,y,z).
export function patColor(surf, x, y, z, out = new THREE.Color()) {
  const c = prep(surf), { c1, c2, c3, c4, s, P } = c;
  out.copy(c1);
  switch (c.pat) {
    case 0: mix(out, c1, c2, sstep(0.25, 0.85, fbm(x * s, y * s, z * s))); break;
    case 1: {
      mix(out, c1, c2, sstep(0.3, 0.8, fbm(x * s * 0.6, y * s * 0.6, z * s * 0.6)));
      const v = Math.abs(fbm(x * s + 3.1, y * s * 1.6 + 3.1, z * s + 3.1) - 0.5);
      const fat = 1 - sstep(P[0] * 0.5, P[0], v);
      const blob = sstep(0.62, 0.7, fbm(x * s * 0.9 + 7, y * s * 0.9 + 7, z * s * 0.9 + 7));
      mix(out, out.clone(), c3, Math.max(fat, blob * P[1]));
      break;
    }
    case 2: {
      const t = (y - P[1]) * s + (fbm(x * 3, y * 3, z * 3) - 0.5) * P[0];
      const n = Math.max(P[2], 1), k = ((Math.floor(t) % n) + n) % n, e = fract(t), kk = (k + 1) % n;
      const pick = (k) => k < 0.5 ? c1 : k < 1.5 ? c2 : k < 2.5 ? c3 : c4;
      mix(out, pick(k), pick(kk), sstep(1 - P[3], 1, e));
      out.multiplyScalar(0.94 + 0.12 * fbm(x * 14, y * 14, z * 14));
      break;
    }
    case 3: {
      const s1 = Math.sin((x + y * 0.6 + z * 0.8) * s + fbm(x * 1.7, y * 1.7, z * 1.7) * P[0]);
      mix(out, c1, c2, sstep(-0.2, 0.2, s1));
      const s2 = Math.abs(Math.sin((x * 0.3 + y + z * 0.5) * s * 1.7 + fbm(x * 2.3 + 4, y * 2.3 + 4, z * 2.3 + 4) * P[0]));
      mix(out, out.clone(), c3, (1 - sstep(0, 0.08, s2)) * P[1]);
      break;
    }
    case 4: {
      mix(out, c1, c2, sstep(0.3, 0.8, fbm(x * s * 0.5, y * s * 0.5, z * s * 0.5)));
      mix(out, out.clone(), c3, sstep(P[0], P[0] + 0.04, vnoise(x * s * 3, y * s * 3, z * s * 3)) * P[1]);
      break;
    }
    case 5: {
      let r = axr(c, x, y, z) / P[3];
      r += (fbm(x * 6, y * 6, z * 6) - 0.5) * 0.04;
      out.copy(r > P[0] ? c1 : r > P[1] ? c2 : r > P[2] ? c3 : c4);
      if (r <= P[1] && r > P[2]) mix(out, out.clone(), c2, sstep(P[1] - 0.08, P[1], r) * 0.5);
      if (s >= 0.5) {
        const qx = x * 16, qy = y * 11, qz = z * 16, cx = Math.floor(qx), cy = Math.floor(qy), cz = Math.floor(qz);
        const ox = h31(cx, cy, cz) - 0.5, oy = h31(cx + 3, cy + 3, cz + 3) - 0.5, oz = h31(cx + 7, cy + 7, cz + 7) - 0.5;
        const d = Math.hypot(fract(qx) - 0.5 - ox * 0.6, (fract(qy) - 0.5 - oy * 0.6) * 0.6, fract(qz) - 0.5 - oz * 0.6);
        const ring = P[2] > 0 ? (r > P[2] && r < P[2] + 0.16) : (r > 0.35 && r < 0.78);
        if (ring && h31(cx + 13, cy + 13, cz + 13) > 0.35) mix(out, out.clone(), new THREE.Color(0.1, 0.07, 0.05), 1 - sstep(0.13, 0.17, d));
      }
      out.multiplyScalar(0.94 + 0.1 * fbm(x * 20, y * 20, z * 20));
      break;
    }
    case 6: {
      mix(out, c1, c2, fbm(x * s * 0.3, y * s * 0.3, z * s * 0.3));
      const hole = vnoise(x * s * 2, y * s * 2, z * s * 2) * vnoise(x * s * 4.7 + 3, y * s * 4.7 + 3, z * s * 4.7 + 3);
      mix(out, out.clone(), c3, sstep(P[0], P[0] + 0.08, hole));
      break;
    }
    case 7: {
      const fx = Math.floor(x * s * 30), fy = Math.floor(y * s * 30), fz = Math.floor(z * s * 30);
      mix(out, c1, c2, h31(fx, fy, fz));
      if (h31(fx + 5, fy + 5, fz + 5) >= 0.97) mix(out, out.clone(), c3, P[0]);
      out.multiplyScalar(0.9 + 0.2 * fbm(x * 4, y * 4, z * 4));
      break;
    }
    case 8: {
      const s1 = Math.sin((x * 0.8 + y * 0.5 + z * 0.2) * s + fbm(x * 2, y * 2, z * 2) * 2.5);
      mix(out, c1, c2, sstep(0.2, 0.5, fbm(x * 3, y * 3, z * 3)));
      mix(out, out.clone(), c3, sstep(1 - P[0], 1, s1));
      break;
    }
    case 9: {
      const h = fract((x + y * 0.35 + z * 0.2) * s + fbm(x * 2, y * 2, z * 2) * 0.3);
      const ch = (o) => Math.min(1, Math.max(0, Math.abs(fract(h + o) * 6 - 3) - 1));
      out.setRGB(P[1] * (1 + (ch(0) - 1) * P[0]), P[1] * (1 + (ch(2 / 3) - 1) * P[0]), P[1] * (1 + (ch(1 / 3) - 1) * P[0]));
      break;
    }
    case 10: {
      const t = fract(axr(c, x, y, z) * s + fbm(x * 2, y * 2, z * 2) * P[0]);
      mix(out, c1, c2, sstep(0.4, 0.55, t) * (1 - sstep(0.85, 1, t)));
      break;
    }
    case 11: mix(out, c1, c2, sstep(P[0], P[1], y + (fbm(x * 3, y * 3, z * 3) - 0.5) * P[2])); break;
    case 12: {
      const r = axr(c, x, y, z) / P[3];
      const q = new THREE.Vector3(x, y, z).sub(c.ce);
      const a1 = new THREE.Vector3().crossVectors(c.ax, Math.abs(c.ax.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const a2 = new THREE.Vector3().crossVectors(c.ax, a1);
      const seg = Math.abs(fract(Math.atan2(q.dot(a2), q.dot(a1)) / 6.2831 * s) - 0.5);
      if (r > P[0]) out.copy(c1); else if (r > P[1]) out.copy(c2); else out.copy(c4).multiplyScalar(0.9 + 0.15 * fbm(x * 30, y * 30, z * 30));
      if (r <= P[1]) mix(out, out.clone(), c3, Math.max(sstep(0.45, 0.49, seg), 1 - sstep(0, 0.07, r)));
      break;
    }
    case 13: {
      const cx = Math.floor(x * s), cy = Math.floor(y * s), cz = Math.floor(z * s);
      const d = Math.hypot(fract(x * s) - 0.5 - (h31(cx, cy, cz) - 0.5) * 0.5, fract(y * s) - 0.5 - (h31(cx + 3, cy + 3, cz + 3) - 0.5) * 0.5, fract(z * s) - 0.5 - (h31(cx + 7, cy + 7, cz + 7) - 0.5) * 0.5);
      const pick = h31(cx + 11, cy + 11, cz + 11);
      const dc = pick < 0.33 ? c2 : pick < 0.66 ? c3 : c4;
      mix(out, c1.clone().multiplyScalar(0.95 + 0.1 * fbm(x * 5, y * 5, z * 5)), dc, 1 - sstep(P[0], P[0] + 0.03, d));
      break;
    }
    case 14: {
      const ang = Math.atan2(z - c.ce.z, y - c.ce.y);
      mix(out, c1, c2, sstep(-P[0], P[0], Math.sin(ang * s + fbm(x * 2, y * 2, z * 2) * 2)));
      out.multiplyScalar(0.92 + 0.14 * fbm(x * 8, y * 8, z * 8));
      break;
    }
  }
  return out;
}
