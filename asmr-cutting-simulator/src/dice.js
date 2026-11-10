import * as THREE from 'three';
import { patColor } from './patterns.js';

// ============================================================================
// Diced cubes.
//
// When the dicer blade sweeps through an object, the material it removes is
// voxelised: a cube is created at every grid cell (in the object's own frame)
// whose centre lies inside the removed convex volume. Each cube is coloured by
// the volumetric material at that exact point, so fat stays where the fat was.
//
// Tens of thousands of cubes can't each be a rigid body on a phone, so cubes
// use a light pile simulation: gravity, tumbling, a height field that builds up
// as cubes land, and an avalanche rule so piles spread naturally.
// ============================================================================

const MAX = 24000;
const CELL = 0.065;                 // pile height-field resolution
const HALF = 9;                     // field covers [-HALF, HALF] in x/z
const N = Math.ceil((HALF * 2) / CELL);
const G = 30;

export class Dice {
  constructor(scene, board) {
    this.board = board;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.count = 0; this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    // state
    this.p = new Float32Array(MAX * 3); this.v = new Float32Array(MAX * 3);
    this.q = new Float32Array(MAX * 4); this.w = new Float32Array(MAX * 3);
    this.s = new Float32Array(MAX); this.live = new Uint8Array(MAX); this.age = new Float32Array(MAX); this.slides = new Uint8Array(MAX);
    this.n = 0;
    this.H = new Float32Array(N * N);
    this.active = [];
    this.lo = Infinity; this.hi = -1;
    this.resetField();
  }
  resetField() {
    const { hx, hz, h } = this.board;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -HALF + (i + 0.5) * CELL, z = -HALF + (j + 0.5) * CELL;
      this.H[i * N + j] = Math.abs(x) <= hx && Math.abs(z) <= hz ? 0 : -h;
    }
  }
  clear() { this.n = 0; this.mesh.count = 0; this.active.length = 0; this.resetField(); if (this.hop) this.hop.tgt.fill(-1); }
  get count() { return this.n; }
  // Undo support: drop cubes created after a snapshot (and rebuild the piles).
  truncate(n) {
    if (n >= this.n) return;
    this.n = n; this.mesh.count = n;
    this.active = this.active.filter(i => i < n);
    this.resetField();
    for (let i = 0; i < n; i++) if (!this.live[i]) { const c = this.cell(this.p[i * 3], this.p[i * 3 + 2]); if (c >= 0) this.H[c] = Math.max(this.H[c], this.p[i * 3 + 1] + this.s[i] / 2); }
  }
  cell(x, z) {
    const i = Math.floor((x + HALF) / CELL), j = Math.floor((z + HALF) / CELL);
    return i < 0 || j < 0 || i >= N || j >= N ? -1 : i * N + j;
  }

  // Voxelise a removed convex part of `body` into cubes of size `size`.
  // `push` is the direction the cubes spill toward.
  addFromPart(body, part, size, push, def) {
    let planes = part._planes;
    if (!planes) {
      planes = [];
      for (const f of part.faces) {
        let n = f.plane ? f.plane.n : null, c;
        if (!n) {
          const p = f.pts, ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2], bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
          let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz);
          if (l < 1e-12) continue; n = [nx / l, ny / l, nz / l];
        }
        c = n[0] * f.pts[0] + n[1] * f.pts[1] + n[2] * f.pts[2];
        planes.push(n[0], n[1], n[2], c, f.type === 0 ? 1 : 0);
      }
      part._planes = planes;
    }
    const { mn, mx } = part.bounds();
    const m = body.mesh.matrixWorld, q = body.mesh.quaternion;
    const lp = new THREE.Vector3(), col = new THREE.Color();
    const i0 = Math.ceil(mn[0] / size - 0.5), i1 = Math.floor(mx[0] / size - 0.5);
    const j0 = Math.ceil(mn[1] / size - 0.5), j1 = Math.floor(mx[1] / size - 0.5);
    const k0 = Math.ceil(mn[2] / size - 0.5), k1 = Math.floor(mx[2] / size - 0.5);
    let made = 0;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
      const x = (i + 0.5) * size, y = (j + 0.5) * size, z = (k + 0.5) * size;
      let inside = true, nearOuter = false;
      for (let a = 0; a < planes.length; a += 5) {
        const d = planes[a] * x + planes[a + 1] * y + planes[a + 2] * z - planes[a + 3];
        if (d > 1e-6) { inside = false; break; }
        if (planes[a + 4] && d > -size * 0.5) nearOuter = true;
      }
      if (!inside || this.n >= MAX) continue;
      patColor(nearOuter ? def.out : def.in, x, y, z, col);
      lp.set(x, y, z).applyMatrix4(m);
      this.spawn(lp, q, size, push, col);
      made++;
    }
    return made;
  }

  spawn(pos, quat, size, push, col) {
    const i = this.n++;
    this.p.set([pos.x, pos.y, pos.z], i * 3);
    const r = Math.random;
    const sp = 0.25 + r() * 0.55;
    this.v.set([push.x * sp + (r() - 0.5) * 0.5, 0.15 + r() * 0.5, push.z * sp + (r() - 0.5) * 0.5], i * 3);
    this.q.set([quat.x, quat.y, quat.z, quat.w], i * 4);
    this.w.set([(r() - 0.5) * 9, (r() - 0.5) * 3, (r() - 0.5) * 9], i * 3);
    this.s[i] = size * 0.9; // small gap between cubes reads as distinct dice
    this.live[i] = 1; this.age[i] = 0; if (this.hop) this.hop.tgt[i] = -1;
    this.mesh.setColorAt(i, col);
    this.active.push(i);
    this.mesh.count = this.n;
    this.mark(i);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  mark(i) { if (i < this.lo) this.lo = i; if (i > this.hi) this.hi = i; }

  // Footprint helpers: a cube covers (2r+1)^2 height-field cells
  footR(s) { return Math.max(0, Math.round(s / CELL / 2 - 0.25)); }
  footTop(c, r) {
    const ci = Math.floor(c / N), cj = c % N; let top = -Infinity;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const cc = (ci + a) * N + cj + b; if (cc >= 0 && cc < this.H.length) top = Math.max(top, this.H[cc]); }
    return top;
  }
  claim(c, r, h) {
    const ci = Math.floor(c / N), cj = c % N;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const cc = (ci + a) * N + cj + b; if (cc >= 0 && cc < this.H.length) this.H[cc] = h; }
  }
  // Walk downhill from cell c until the slope is stable (angle of repose).
  restCell(c, s, r) {
    let cur = c, h = this.footTop(c, r);
    const step = (r * 2 + 1);
    for (let k = 0; k < 16; k++) {
      let best = -1, bh = h - s * 1.05;
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ci = Math.floor(cur / N) + da * step, cj = (cur % N) + db * step;
        if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue;
        const cc = ci * N + cj, hh = this.footTop(cc, r);
        if (hh < bh - (Math.random() * s * 0.3)) { bh = hh; best = cc; }
      }
      if (best < 0) break;
      cur = best; h = bh;
    }
    return cur;
  }
  cellX(c) { return -HALF + (Math.floor(c / N) + 0.5) * CELL; }
  cellZ(c) { return -HALF + ((c % N) + 0.5) * CELL; }

  update(dt) {
    if (!this.active.length && this.hi < 0) return;
    const P = this.p, V = this.v, Q = this.q, W = this.w;
    const T = this.hop || (this.hop = { tgt: new Int32Array(MAX).fill(-1), t: new Float32Array(MAX), dur: new Float32Array(MAX), s: new Float32Array(MAX * 3), y: new Float32Array(MAX) });
    const _q = this.__q || (this.__q = new THREE.Quaternion()), _dq = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _pos = new THREE.Vector3(), _sc = new THREE.Vector3();
    const still = [];
    const settle = (i) => {
      _e.setFromQuaternion(_q, 'YXZ');
      _e.x = Math.round(_e.x / (Math.PI / 2)) * (Math.PI / 2) + (Math.random() - 0.5) * 0.1;
      _e.z = Math.round(_e.z / (Math.PI / 2)) * (Math.PI / 2) + (Math.random() - 0.5) * 0.1;
      _e.y = Math.round(_e.y / (Math.PI / 2)) * (Math.PI / 2) + (Math.random() - 0.5) * 0.45;
      _q.setFromEuler(_e);
      this.live[i] = 0;
    };
    for (const i of this.active) {
      const s = this.s[i];
      this.age[i] += dt;
      _q.set(Q[i * 4], Q[i * 4 + 1], Q[i * 4 + 2], Q[i * 4 + 3]);
      if (T.tgt[i] >= 0) {
        // hopping to its reserved resting cell
        T.t[i] += dt;
        const u = Math.min(1, T.t[i] / T.dur[i]), c = T.tgt[i];
        P[i * 3] = T.s[i * 3] + (this.cellX(c) - T.s[i * 3]) * u;
        P[i * 3 + 2] = T.s[i * 3 + 2] + (this.cellZ(c) - T.s[i * 3 + 2]) * u;
        P[i * 3 + 1] = T.s[i * 3 + 1] + (T.y[i] - T.s[i * 3 + 1]) * u + 4 * 0.05 * u * (1 - u);
        _dq.setFromEuler(_e.set(W[i * 3] * dt, W[i * 3 + 1] * dt, W[i * 3 + 2] * dt)); _q.premultiply(_dq);
        if (u >= 1) { settle(i); T.tgt[i] = -1; }
      } else {
        V[i * 3 + 1] -= G * dt;
        P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
        _dq.setFromEuler(_e.set(W[i * 3] * dt, W[i * 3 + 1] * dt, W[i * 3 + 2] * dt)); _q.premultiply(_dq);
        const c = this.cell(P[i * 3], P[i * 3 + 2]);
        const r = this.footR(s);
        const floor = c >= 0 ? this.footTop(c, r) : -this.board.h;
        if (P[i * 3 + 1] - s / 2 <= floor) {
          if (Math.abs(V[i * 3 + 1]) > 2.4 && this.age[i] < 4) {
            P[i * 3 + 1] = floor + s / 2;
            V[i * 3 + 1] *= -0.22; V[i * 3] *= 0.5; V[i * 3 + 2] *= 0.5;
            W[i * 3] *= 0.5; W[i * 3 + 1] *= 0.5; W[i * 3 + 2] *= 0.5;
          } else if (c < 0) { P[i * 3 + 1] = floor + s / 2; settle(i); }
          else {
            // find where it comes to rest and reserve that spot right away
            const rc = this.restCell(c, s, r);
            const top = this.footTop(rc, r);
            this.claim(rc, r, top + s * 0.98);
            const dist = Math.hypot(this.cellX(rc) - P[i * 3], this.cellZ(rc) - P[i * 3 + 2]);
            if (dist < CELL * 0.6) {
              P[i * 3] = this.cellX(rc); P[i * 3 + 2] = this.cellZ(rc); P[i * 3 + 1] = top + s / 2; settle(i);
            } else {
              T.tgt[i] = rc; T.t[i] = 0; T.dur[i] = 0.12 + dist * 0.5; T.y[i] = top + s / 2;
              T.s.set([P[i * 3], Math.max(P[i * 3 + 1], floor + s / 2), P[i * 3 + 2]], i * 3);
              W[i * 3] = (Math.random() - 0.5) * 8; W[i * 3 + 2] = (Math.random() - 0.5) * 8;
            }
          }
        }
      }
      Q.set([_q.x, _q.y, _q.z, _q.w], i * 4);
      _pos.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      _m.compose(_pos, _q, _sc.setScalar(s));
      this.mesh.setMatrixAt(i, _m);
      this.mark(i);
      if (this.live[i]) still.push(i);
    }
    this.active = still;
    if (this.hi >= 0) {
      const im = this.mesh.instanceMatrix;
      im.clearUpdateRanges(); im.addUpdateRange(this.lo * 16, (this.hi - this.lo + 1) * 16); im.needsUpdate = true;
      this.lo = Infinity; this.hi = -1;
    }
  }
}
