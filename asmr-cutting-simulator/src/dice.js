import * as THREE from 'three';
import { patColor } from './patterns.js';

// ============================================================================
// Diced cubes: a lightweight rigid-body simulation for thousands of cubes.
//
// The dicer voxelises the material it removes into cubes (each coloured by the
// volumetric material at its exact position). Every cube then detaches
// immediately and is simulated: gravity, tumbling with real corner contact on
// the board, bounces, sliding friction, cube-vs-cube collisions through a
// spatial grid, and the blade pushing cubes in its way. Cubes that come to rest
// fall asleep (cost nothing) and wake up when something hits them.
//
// Materials behave differently: soap slides, jelly bounces and jiggles, meat
// tumbles and stops, kinetic sand crumbles on impact, ice and glass skate.
// ============================================================================

const MAX = 9000;
const G = 34;
let CELL = 0.1;                        // collision grid cell, sized to the biggest cube
const NB = 1 << 16;                    // hashed grid buckets
const hash = (cx, cy, cz) => ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) & (NB - 1);

// physical feel per material, chosen from the object's sound/fx tags
export function cubeMaterial(def) {
  const s = def.snd;
  const M = { fric: 0.55, rest: 0.22, tumble: 1, scatter: 1, jiggle: 0, crumble: 0, prof: s };
  if (s === 'soap' || s === 'wax') Object.assign(M, { fric: 0.12, rest: 0.12, tumble: 0.6, scatter: 1.15 });
  else if (s === 'jelly' || s === 'slime') Object.assign(M, { fric: 0.35, rest: 0.55, tumble: 0.8, scatter: 1.25, jiggle: 1 });
  else if (s === 'meat' || s === 'fish') Object.assign(M, { fric: 0.85, rest: 0.08, tumble: 1.4, scatter: 1.1 });
  else if (s === 'sand') Object.assign(M, { fric: 0.9, rest: 0.05, tumble: 0.7, scatter: 0.9, crumble: 0.75 });
  else if (s === 'bread' || s === 'cake' || s === 'foam') Object.assign(M, { fric: 0.75, rest: 0.1, tumble: 1.1, scatter: 0.95, crumble: 0.12 });
  else if (s === 'ice' || s === 'glass') Object.assign(M, { fric: 0.05, rest: 0.3, tumble: 0.7, scatter: 1.3 });
  else if (s === 'crunch' || s === 'crisp' || s === 'choc') Object.assign(M, { fric: 0.5, rest: 0.3, tumble: 1.3, scatter: 1.2 });
  else if (s === 'fruit') Object.assign(M, { fric: 0.6, rest: 0.15, tumble: 1.2, scatter: 1.15, jiggle: 0.3 });
  else if (s === 'clay') Object.assign(M, { fric: 0.9, rest: 0.03, tumble: 0.9, scatter: 0.85 });
  else if (s === 'cheese') Object.assign(M, { fric: 0.7, rest: 0.12, tumble: 1.1, scatter: 1 });
  return M;
}

export class Dice {
  constructor(scene, board) {
    this.board = board;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.p = new Float32Array(MAX * 3); this.v = new Float32Array(MAX * 3);
    this.q = new Float32Array(MAX * 4); this.w = new Float32Array(MAX * 3);
    this.s = new Float32Array(MAX); this.state = new Uint8Array(MAX);   // 0 dead, 1 awake, 2 asleep
    this.age = new Float32Array(MAX); this.maxS = 0.08;
    this.still = new Float32Array(MAX); this.jig = new Float32Array(MAX); this.jt = new Float32Array(MAX);
    this.mat = new Uint8Array(MAX); this.mats = [];
    this.hits = new Uint8Array(MAX);
    this.n = 0; this.awake = 0;
    this.cellStart = new Int32Array(NB + 1); this.cellItems = new Int32Array(MAX); this.cellOf = new Int32Array(MAX);
    this.impacts = [];
    this.lo = Infinity; this.hi = -1;
  }
  clear() { this.queue = []; this.n = 0; this.mesh.count = 0; this.awake = 0; this.mats = []; this.maxS = 0.08; }
  get count() { return this.n; }
  truncate(n) { this.queue = []; if (n < this.n) { this.n = n; this.mesh.count = n; } }
  matIndex(def) {
    let i = this.mats.findIndex(m => m.def === def);
    if (i < 0) { i = this.mats.length; this.mats.push({ def, ...cubeMaterial(def) }); }
    return Math.min(i, 255);
  }
  ground(x, z) { return Math.abs(x) <= this.board.hx && Math.abs(z) <= this.board.hz ? 0 : -this.board.h; }

  // Voxelise a removed convex part of `body`: one cube per grid cell whose
  // centre lies inside it. `push` = direction the cubes are flung toward.
  // Queue removed material for voxelising; a fast swipe spreads its cubes over
  // a few frames instead of creating thousands in one frame.
  queuePart(body, part, size, push, def) {
    (this.queue || (this.queue = [])).push({ part, size, push: push.clone(), def, m: body.mesh.matrixWorld.clone(), q: body.mesh.quaternion.clone() });
  }
  drainQueue(budget = 450) {
    let made = 0;
    while (this.queue && this.queue.length && made < budget) {
      const j = this.queue.shift();
      made += this.addFromPart({ mesh: { matrixWorld: j.m, quaternion: j.q } }, j.part, j.size, j.push, j.def);
    }
    return made;
  }
  addFromPart(body, part, size, push, def) {
    this.prof = def.snd;
    let planes = part._planes;
    if (!planes) {
      planes = [];
      for (const f of part.faces) {
        let n = f.plane ? f.plane.n : null;
        if (!n) {
          const p = f.pts, ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2], bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
          const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz);
          if (l < 1e-12) continue; n = [nx / l, ny / l, nz / l];
        }
        planes.push(n[0], n[1], n[2], n[0] * f.pts[0] + n[1] * f.pts[1] + n[2] * f.pts[2], f.type === 0 ? 1 : 0);
      }
      part._planes = planes;
    }
    const { mn, mx } = part.bounds();
    const m = body.mesh.matrixWorld, q = body.mesh.quaternion;
    const lp = new THREE.Vector3(), col = new THREE.Color();
    const mi = this.matIndex(def), M = this.mats[mi];
    const i0 = Math.ceil(mn[0] / size - 0.5), i1 = Math.floor(mx[0] / size - 0.5);
    const j0 = Math.ceil(mn[1] / size - 0.5), j1 = Math.floor(mx[1] / size - 0.5);
    const k0 = Math.ceil(mn[2] / size - 0.5), k1 = Math.floor(mx[2] / size - 0.5);
    const sizeK = Math.sqrt(0.07 / size); // smaller cubes fly further and spin faster
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
      // higher cubes are thrown harder: the top spills first
      const hk = 0.6 + Math.min(1, Math.max(0, lp.y) * 1.2);
      const sp = (0.9 + Math.random() * 1.6) * M.scatter * sizeK * hk;
      const side = (Math.random() - 0.5) * 2.2 * M.scatter * sizeK;
      this.spawn(lp, q, size, [push.x * sp - push.z * side, 0.6 + Math.random() * 2.2 * M.scatter, push.z * sp + push.x * side], col, mi, M);
      made++;
    }
    return made;
  }

  spawn(pos, quat, size, vel, col, mi, M) {
    const i = this.n++;
    this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
    this.v[i * 3] = vel[0]; this.v[i * 3 + 1] = vel[1]; this.v[i * 3 + 2] = vel[2];
    this.q[i * 4] = quat.x; this.q[i * 4 + 1] = quat.y; this.q[i * 4 + 2] = quat.z; this.q[i * 4 + 3] = quat.w;
    const t = 7 * M.tumble;
    this.w[i * 3] = (Math.random() - 0.5) * t * 2; this.w[i * 3 + 1] = (Math.random() - 0.5) * t; this.w[i * 3 + 2] = (Math.random() - 0.5) * t * 2;
    this.s[i] = size * 0.92; this.age[i] = 0;
    if (size * 0.92 > this.maxS) this.maxS = size * 0.92;
    this.state[i] = 1; this.still[i] = 0; this.jig[i] = 0; this.hits[i] = 0;
    this.mat[i] = mi;
    this.mesh.setColorAt(i, col);
    this.mesh.count = this.n;
    this.colorDirty = true;
  }
  wake(i) { if (this.state[i] === 2) { this.state[i] = 1; this.still[i] = 0; this.age[i] = Math.min(this.age[i], 2.5); } }
  kill(i) { this.state[i] = 0; this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); this.mark(i); }
  mark(i) { if (i < this.lo) this.lo = i; if (i > this.hi) this.hi = i; }

  cellIndex(x, y, z) { return hash(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL)); }
  // counting-sort every live cube into the hashed grid
  buildGrid() {
    CELL = Math.max(0.07, this.maxS * 1.02);
    const cs = this.cellStart; cs.fill(0);
    for (let i = 0; i < this.n; i++) {
      if (!this.state[i]) { this.cellOf[i] = -1; continue; }
      const c = this.cellIndex(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      this.cellOf[i] = c; cs[c + 1]++;
    }
    for (let c = 0; c < NB; c++) cs[c + 1] += cs[c];
    const fill = this.fillTmp || (this.fillTmp = new Int32Array(NB));
    fill.set(cs.subarray(0, NB));
    for (let i = 0; i < this.n; i++) { const c = this.cellOf[i]; if (c >= 0) this.cellItems[fill[c]++] = i; }
  }
  forNear(x, y, z, r, fn) {
    const ax = Math.floor((x - r) / CELL), bx = Math.floor((x + r) / CELL);
    const ay = Math.floor((y - r) / CELL), by = Math.floor((y + r) / CELL);
    const az = Math.floor((z - r) / CELL), bz = Math.floor((z + r) / CELL);
    for (let cy = ay; cy <= by; cy++) for (let cz = az; cz <= bz; cz++) for (let cx = ax; cx <= bx; cx++) {
      const c = hash(cx, cy, cz);
      for (let k = this.cellStart[c]; k < this.cellStart[c + 1]; k++) fn(this.cellItems[k]);
    }
  }

  // The blade pushes cubes out of its way. Segment A-B is the blade edge on
  // the board; `dir` is the push direction; `h` the blade height.
  pushBlade(A, B, dir, h, strength = 1) {
    if (!this.n) return 0;
    if (!this.gridFresh) { this.buildGrid(); this.gridFresh = true; }
    const ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1e-9;
    const steps = Math.max(1, Math.ceil(Math.sqrt(L2) / CELL));
    const seen = this.seenTmp || (this.seenTmp = new Set()); seen.clear();
    let pushed = 0;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, cx = A.x + ex * t, cz = A.z + ez * t;
      this.forNear(cx, h * 0.5, cz, Math.max(CELL, h * 0.5), (i) => {
        if (seen.has(i)) return; seen.add(i);
        const px = this.p[i * 3], py = this.p[i * 3 + 1], pz = this.p[i * 3 + 2];
        if (py > h + 0.05) return;
        const u = Math.max(0, Math.min(1, ((px - A.x) * ex + (pz - A.z) * ez) / L2));
        const dx = px - (A.x + ex * u), dz = pz - (A.z + ez * u), d = Math.hypot(dx, dz);
        if (d > this.s[i] * 0.6 + 0.035) return;
        const side = d > 1e-5 ? 1 / d : 0, kick = (1.6 + Math.random() * 1.4) * strength;
        this.v[i * 3] += dir.x * kick + dx * side * 0.8;
        this.v[i * 3 + 2] += dir.z * kick + dz * side * 0.8;
        this.v[i * 3 + 1] += 0.6 + Math.random() * 1.2;
        this.w[i * 3] += (Math.random() - 0.5) * 12; this.w[i * 3 + 2] += (Math.random() - 0.5) * 12;
        this.wake(i); pushed++;
      });
    }
    return pushed;
  }

  update(dt) {
    this.gridFresh = false;
    this.drainQueue();
    if (!this.n) return;
    let anyAwake = false;
    for (let i = 0; i < this.n; i++) if (this.state[i] === 1 || this.jig[i] > 0.002) { anyAwake = true; break; }
    if (!anyAwake && this.hi < 0) return;
    if (anyAwake) {
      this.buildGrid();
      const sub = dt > 0.034 ? 2 : 1, h = dt / sub;
      for (let k = 0; k < sub; k++) this.step(h, k === sub - 1);
    }
    if (this.hi >= 0) {
      const im = this.mesh.instanceMatrix;
      im.clearUpdateRanges(); im.addUpdateRange(this.lo * 16, (this.hi - this.lo + 1) * 16); im.needsUpdate = true;
      this.lo = Infinity; this.hi = -1;
    }
    if (this.colorDirty && this.mesh.instanceColor) { this.mesh.instanceColor.needsUpdate = true; this.colorDirty = false; }
  }

  step(dt, writeMatrices) {
    const P = this.p, V = this.v, Q = this.q, W = this.w, S = this.s;
    const CS = this.cellStart, CI = this.cellItems, ST = this.state;
    const _q = this._q || (this._q = new THREE.Quaternion()), _dq = this._dq || (this._dq = new THREE.Quaternion());
    const _m = this._m || (this._m = new THREE.Matrix4()), _p = this._p || (this._p = new THREE.Vector3()), _s = this._s || (this._s = new THREE.Vector3());
    const _e = this._e || (this._e = new THREE.Euler()), up = this._up || (this._up = new THREE.Vector3());
    const Y = this._Y || (this._Y = new THREE.Vector3(0, 1, 0)), I = this._I || (this._I = new THREE.Quaternion());
    let awake = 0;
    for (let i = 0; i < this.n; i++) {
      const st = this.state[i];
      if (st === 0) continue;
      if (st === 2) { if (writeMatrices && this.jig[i] > 0.002) this.writeMatrix(i, dt); continue; }
      awake++;
      const M = this.mats[this.mat[i]] || this.mats[0];
      const r = S[i] * 0.5;
      V[i * 3 + 1] -= G * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      _q.set(Q[i * 4], Q[i * 4 + 1], Q[i * 4 + 2], Q[i * 4 + 3]);
      _dq.setFromEuler(_e.set(W[i * 3] * dt, W[i * 3 + 1] * dt, W[i * 3 + 2] * dt));
      _q.premultiply(_dq).normalize();
      // half-height of the rotated cube along world up: corners touch first
      const te = _m.makeRotationFromQuaternion(_q).elements;
      const hy = r * (Math.abs(te[1]) + Math.abs(te[5]) + Math.abs(te[9]));
      const floor = this.ground(P[i * 3], P[i * 3 + 2]);
      let onGround = false;
      if (P[i * 3 + 1] - hy < floor) {
        P[i * 3 + 1] = floor + hy;
        const vn = -V[i * 3 + 1];
        if (vn > 0) {
          if (vn > 1.4 && this.hits[i] < 6) { this.impacts.push(M.prof, vn); this.hits[i]++; }
          if (M.crumble && vn > 2.2 && Math.random() < M.crumble) (this.crumbled || (this.crumbled = [])).push(i);
          V[i * 3 + 1] = vn > 0.9 ? vn * M.rest : 0;
          if (M.jiggle) { this.jig[i] = Math.min(0.35, vn * 0.07 * M.jiggle); this.jt[i] = 0; }
          // landing on an edge turns the fall into spin
          W[i * 3] += (Math.random() - 0.5) * vn * 4 * M.tumble; W[i * 3 + 2] += (Math.random() - 0.5) * vn * 4 * M.tumble;
        }
        onGround = true;
        const f = Math.max(0, 1 - M.fric * 9 * dt);
        V[i * 3] *= f; V[i * 3 + 2] *= f;
        // sliding feeds rolling/tumbling
        W[i * 3] = W[i * 3] * (1 - 3 * dt) + V[i * 3 + 2] / r * M.tumble * 0.08;
        W[i * 3 + 2] = W[i * 3 + 2] * (1 - 3 * dt) - V[i * 3] / r * M.tumble * 0.08;
        W[i * 3 + 1] *= 1 - 4 * dt;
      }
      // cube vs cube (inline grid walk over the 27 neighbouring cells)
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      let support = false;
      // with cells >= one cube across, only the 2x2x2 block on this cube's side can touch it
      const fx = px / CELL, fy = py / CELL, fz = pz / CELL;
      const bx0 = Math.floor(fx - 0.5), by0 = Math.floor(fy - 0.5), bz0 = Math.floor(fz - 0.5);
      for (let oy = 0; oy <= 1; oy++) {
        for (let oz = 0; oz <= 1; oz++) {
          for (let ox = 0; ox <= 1; ox++) {
            const c = hash(bx0 + ox, by0 + oy, bz0 + oz);
            for (let kk = CS[c], ke = CS[c + 1]; kk < ke; kk++) {
              const j = CI[kk];
              if (j === i) continue;
              const rr = (r + S[j] * 0.5) * 0.96;
              const dx = px - P[j * 3], dy = py - P[j * 3 + 1], dz = pz - P[j * 3 + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= rr * rr || d2 < 1e-12) continue;
              const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = rr - d;
              const jAsleep = ST[j] === 2, share = jAsleep ? 1 : 0.5;
              P[i * 3] += nx * pen * share; P[i * 3 + 1] += ny * pen * share; P[i * 3 + 2] += nz * pen * share;
              if (!jAsleep) { P[j * 3] -= nx * pen * 0.5; P[j * 3 + 1] -= ny * pen * 0.5; P[j * 3 + 2] -= nz * pen * 0.5; }
              const rvx = V[i * 3] - V[j * 3], rvy = V[i * 3 + 1] - V[j * 3 + 1], rvz = V[i * 3 + 2] - V[j * 3 + 2];
              const vn = rvx * nx + rvy * ny + rvz * nz;
              if (vn < 0) {
                const imp = -(1 + M.rest) * vn * (jAsleep ? 1 : 0.5);
                V[i * 3] += nx * imp; V[i * 3 + 1] += ny * imp; V[i * 3 + 2] += nz * imp;
                if (!jAsleep) { V[j * 3] -= nx * imp; V[j * 3 + 1] -= ny * imp; V[j * 3 + 2] -= nz * imp; }
                else if (-vn > 1.2) { this.wake(j); V[j * 3] -= nx * imp * 0.5; V[j * 3 + 2] -= nz * imp * 0.5; }
                if (-vn > 2 && this.hits[i] < 6) { this.impacts.push(M.prof, -vn * 0.6); this.hits[i]++; }
                const tf = M.fric * 0.25;
                V[i * 3] -= (rvx - vn * nx) * tf; V[i * 3 + 2] -= (rvz - vn * nz) * tf;
                W[i * 3] += (Math.random() - 0.5) * -vn * 3; W[i * 3 + 2] += (Math.random() - 0.5) * -vn * 3;
              }
              if (ny > 0.5) support = true;
            }
          }
        }
      }
      if (support) {
        const f = Math.max(0, 1 - M.fric * 7 * dt);
        V[i * 3] *= f; V[i * 3 + 2] *= f; W[i * 3] *= 1 - 3 * dt; W[i * 3 + 2] *= 1 - 3 * dt;
      }
      // resting: settle onto the nearest face (keeping a random yaw), then sleep
      const speed = Math.hypot(V[i * 3], V[i * 3 + 1], V[i * 3 + 2]), spin = Math.hypot(W[i * 3], W[i * 3 + 1], W[i * 3 + 2]);
      this.age[i] += dt;
      if ((onGround || support) && speed < 0.6 && spin < 5) {
        let best = 0, bv = 0;
        for (let a = 0; a < 3; a++) { const val = te[4 * a + 1]; if (Math.abs(val) > Math.abs(bv)) { bv = val; best = a; } }
        up.set(te[4 * best], te[4 * best + 1], te[4 * best + 2]).multiplyScalar(Math.sign(bv) || 1);
        _dq.setFromUnitVectors(up, Y);
        _q.premultiply(I.slerp(_dq, Math.min(1, dt * 10))).normalize();
        I.identity();
        W[i * 3] *= 1 - 8 * dt; W[i * 3 + 1] *= 1 - 8 * dt; W[i * 3 + 2] *= 1 - 8 * dt;
        this.still[i] += dt;
        if ((this.still[i] > (this.awake > 1500 ? 0.06 : 0.2) && speed < 0.35) || this.age[i] > (this.awake > 1500 ? 2 : 4)) { this.state[i] = 2; V[i * 3] = V[i * 3 + 1] = V[i * 3 + 2] = 0; W[i * 3] = W[i * 3 + 1] = W[i * 3 + 2] = 0; }
      } else this.still[i] = 0;
      if (P[i * 3 + 1] < -3) this.state[i] = 0;
      Q[i * 4] = _q.x; Q[i * 4 + 1] = _q.y; Q[i * 4 + 2] = _q.z; Q[i * 4 + 3] = _q.w;
      if (writeMatrices) this.writeMatrix(i, dt);
    }
    this.awake = awake;
    if (this.crumbled && this.crumbled.length) for (const i of this.crumbled) this.kill(i);
  }
  writeMatrix(i, dt) {
    const _m = this._wm || (this._wm = new THREE.Matrix4()), _q = this._wq || (this._wq = new THREE.Quaternion());
    const _p = this._wp || (this._wp = new THREE.Vector3()), _s = this._ws || (this._ws = new THREE.Vector3());
    if (this.state[i] === 0) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); this.mark(i); return; }
    _q.set(this.q[i * 4], this.q[i * 4 + 1], this.q[i * 4 + 2], this.q[i * 4 + 3]);
    _p.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
    const s = this.s[i];
    if (this.jig[i] > 0.002) { // jelly cubes squash & stretch after landing
      this.jt[i] += dt; this.jig[i] *= Math.pow(0.02, dt);
      const k = Math.sin(this.jt[i] * 32) * this.jig[i];
      _s.set(s * (1 - k * 0.5), s * (1 + k), s * (1 - k * 0.5));
    } else _s.setScalar(s);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(i, _m);
    this.mark(i);
  }
  takeImpacts() { const a = this.impacts; this.impacts = []; return a; }
  takeCrumbled() { const a = this.crumbled || []; this.crumbled = []; return a; }
}
