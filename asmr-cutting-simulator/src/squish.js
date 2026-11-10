import * as THREE from 'three';
import { refineParts, faceNormal, Face, Part } from './geometry.js';
import { surfColor } from './materials.js';
import { patColor } from './patterns.js';

// ============================================================================
// Squish: press and hold to deform an object.
//
//  * plastic  – clay, sand, dough, cake, meat ...: the dent stays. On release
//               the deformation is baked into the real geometry, so you can
//               keep pressing, drag a groove, or cut through the dent.
//  * elastic  – jelly, stress balls, sponges: dents while held, then springs
//               back with a wobble.
//  * brittle  – chocolate, ice, soap, crunchy fruit: gives a little, then
//               cracks into real pieces along planes through your finger.
//
// While pressing, the dent is a vertex-shader deformation (smooth, no
// rebuilds); the same function (pressD) is used in JS to bake it.
// ============================================================================

export function squishBehavior(def) {
  const s = def.snd;
  let B = { style: 'plastic', speed: 3, max: 0.6, bulge: 0.7, fx: null };
  if (s === 'jelly') B = { style: 'elastic', speed: 7, max: 0.5, bulge: 0.9, spring: 17, damp: 3.2 };
  else if (s === 'slime') B = { style: 'plastic', speed: 5, max: 0.7, bulge: 1.0, wobble: 0.5 };
  else if (s === 'clay') B = { style: 'plastic', speed: 2.6, max: 0.7, bulge: 1.1 };
  else if (s === 'sand') B = { style: 'plastic', speed: 5, max: 0.8, bulge: 0.45, fx: 'sand' };
  else if (s === 'foam') B = { style: 'plastic', speed: 4, max: 0.7, bulge: 0.2, fx: 'crumb' };
  else if (s === 'cake' || s === 'bread') B = { style: 'plastic', speed: 4, max: 0.65, bulge: 0.4, fx: 'crumb' };
  else if (s === 'meat' || s === 'fish') B = { style: 'plastic', speed: 2.4, max: 0.45, bulge: 0.6, fx: 'juice' };
  else if (s === 'fruit') B = { style: 'plastic', speed: 3, max: 0.6, bulge: 0.75, fx: 'juice' };
  else if (s === 'cheese') B = { style: 'plastic', speed: 2, max: 0.5, bulge: 0.6 };
  else if (s === 'wax') B = { style: 'plastic', speed: 1.3, max: 0.4, bulge: 0.6 };
  else if (s === 'soap') B = { style: 'brittle', speed: 1.4, max: 0.3, bulge: 0.3, crack: 0.07 };
  else if (s === 'choc' || s === 'ice' || s === 'crunch' || s === 'crisp') B = { style: 'brittle', speed: 1.6, max: 0.3, bulge: 0.2, crack: 0.045 };
  else if (s === 'glass') B = { style: 'brittle', speed: 1.2, max: 0.2, bulge: 0.1, crack: 0.025, shards: 7 };
  // keep pressing past full depth and soft things splat
  B.splat = B.style !== 'brittle' && !['kitchensponge', 'stressball', 'memoryfoam', 'squishy'].includes(def.id);
  return Object.assign(B, def.squish || {});
}

// Same displacement as the GLSL pressD in materials.js. P = {c, R, h, u, base, bulge}
function pressD(p, P, out) {
  const u = P.u, c = P.c, R = P.R;
  const hp = p[0] * u[0] + p[1] * u[1] + p[2] * u[2] - P.base;
  const hc = Math.max(c[0] * u[0] + c[1] * u[1] + c[2] * u[2] - P.base, 0.02);
  const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
  const a = dx * u[0] + dy * u[1] + dz * u[2];
  const qx = dx - a * u[0], qy = dy - a * u[1], qz = dz - a * u[2];
  const r = Math.hypot(qx, qy, qz), x = r / R;
  const f = Math.min(1, Math.max(0, hp / hc));
  const w = Math.exp(-x * x * 1.6);
  const bul = P.h * P.bulge * x * Math.exp(-x * x * 0.9) * f * (1 - 0.5 * f);
  const ridge = P.h * P.bulge * 0.45 * Math.exp(-(((x - 1.35) * 2.2) ** 2)) * f;
  const k = r > 1e-5 ? bul / r : 0, up = -P.h * w * f + ridge;
  out[0] = qx * k + u[0] * up; out[1] = qy * k + u[1] * up; out[2] = qz * k + u[2] * up;
  return out;
}

// Bake a dent into parts (new Face objects: undo snapshots keep the old ones).
function bakeParts(parts, P) {
  const d = [0, 0, 0], d1 = [0, 0, 0], d2 = [0, 0, 0], e = 0.01;
  return parts.map(part => {
    const faces = part.faces.map(f => {
      if (f.type === 2) return f;
      const pts = f.pts.slice(), nrm = f.nrm ? f.nrm.slice() : null;
      for (let i = 0; i < pts.length; i += 3) {
        const p = [f.pts[i], f.pts[i + 1], f.pts[i + 2]];
        pressD(p, P, d);
        if (nrm) {
          // n' = normalize(n - J^T n), J by central differences
          const n = [nrm[i], nrm[i + 1], nrm[i + 2]], g = [0, 0, 0];
          for (let k = 0; k < 3; k++) {
            const pa = p.slice(), pb = p.slice(); pa[k] += e; pb[k] -= e;
            pressD(pa, P, d1); pressD(pb, P, d2);
            g[k] = ((d1[0] - d2[0]) * n[0] + (d1[1] - d2[1]) * n[1] + (d1[2] - d2[2]) * n[2]) / (2 * e);
          }
          const nn = [n[0] - g[0], n[1] - g[1], n[2] - g[2]], l = Math.hypot(...nn) || 1;
          nrm[i] = nn[0] / l; nrm[i + 1] = nn[1] / l; nrm[i + 2] = nn[2] / l;
        }
        pts[i] += d[0]; pts[i + 1] += d[1]; pts[i + 2] += d[2];
      }
      let plane = f.plane;
      if (!nrm && f.type !== 0) { const n = faceNormal(pts); plane = { n, c: n[0] * pts[0] + n[1] * pts[1] + n[2] * pts[2] }; }
      return new Face(pts, nrm, f.type, plane);
    });
    const np = new Part(faces); np.deformed = true;
    return np;
  });
}

export function installSquish(Game, helpers) {
  const { buildGeometry } = helpers;
  const P_ = Game.prototype;

  P_.squishBegin = function (e) {
    const hit = this.hitBody(e.clientX, e.clientY);
    this.knife.visible = true; this.knifeLift = 1;
    if (!hit) { this.sq = { b: null, holding: true, x: e.clientX, y: e.clientY }; return; }
    const b = hit.object.userData.body;
    this.sq = { b, holding: true, h: 0, x: e.clientX, y: e.clientY, beh: squishBehavior(b.def), snap: this.snapshot(), changed: false, t: 0 };
    if (this.settings.sound) this.audio.squishStart(b.def.snd);
    this.squishAt(hit.point);
  };

  // (Re)start the dent at world point W on the current body.
  P_.squishAt = function (W) {
    const q = this.sq, b = q.b;
    const inv = b.mesh.quaternion.clone().invert();
    const c = W.clone().sub(b.mesh.position).applyQuaternion(inv);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(inv).normalize();
    let base = Infinity;
    for (const p of b.parts) for (const f of p.faces) for (let i = 0; i < f.pts.length; i += 3) base = Math.min(base, f.pts[i] * u.x + f.pts[i + 1] * u.y + f.pts[i + 2] * u.z);
    const R = 0.2 * (this.ui.widthScale || 1);
    // subdivide the surface around the finger so it can bend smoothly
    const maxE = THREE.MathUtils.clamp(R * 0.24, 0.042, 0.07);
    b.parts = refineParts(b.parts, c.toArray(), u.toArray(), R * 2.1, maxE);
    this.squishRebuild(b);
    q.P = { c: c.toArray(), R, h: q.h || 0, u: u.toArray(), base, bulge: q.beh.bulge };
    const hc = c.dot(u) - base;
    q.maxH = Math.max(0.01, hc * q.beh.max);
    q.cw = W.clone();
    b.uni.press.value.set(c.x, c.y, c.z, R); b.uni.pressU.value.copy(u); b.uni.pressBase.value = base;
    b.uni.pressBulge.value = q.beh.bulge; b.uni.pressH.value = q.P.h;
  };

  P_.squishRebuild = function (b) {
    b.mesh.geometry.dispose();
    b.mesh.geometry = buildGeometry(b.parts);
    const bb = b.mesh.geometry.boundingBox; b.uni.base.value = bb.min.y; b.uni.height.value = bb.max.y - bb.min.y;
  };

  P_.squishMove = function (e) {
    const q = this.sq; if (!q) return;
    q.x = e.clientX; q.y = e.clientY; q.moved = true;
  };

  P_.squishUpdate = function (dt) {
    // springs of released elastic dents
    if (this.springs) for (const sp of [...this.springs]) {
      sp.t += dt;
      const h = sp.style === 'slow' ? sp.h0 * Math.exp(-sp.t * 1.1) : sp.h0 * Math.exp(-sp.t * sp.damp) * Math.cos(sp.t * sp.spring);
      if (this.bodies.includes(sp.b)) sp.b.uni.pressH.value = Math.max(-sp.h0 * 0.35, h);
      if (sp.t > 3) { if (this.bodies.includes(sp.b)) sp.b.uni.pressH.value = 0; this.springs.splice(this.springs.indexOf(sp), 1); }
    }
    const q = this.sq; if (!q || !q.holding) { this.squishPose(dt); return; }
    if (!q.b || !this.bodies.includes(q.b)) { this.squishPose(dt); return; }
    const b = q.b, beh = q.beh;
    q.t += dt;
    // finger slides: plastic leaves a groove (bake + continue), elastic dent follows
    const hit = q.moved ? this.hitBody(q.x, q.y) : null; q.moved = false;
    if (hit && hit.object.userData.body === b && hit.point.distanceTo(q.cw) > q.P.R * 0.6) {
      if (beh.style === 'plastic' && q.P.h > 0.004) { this.squishBake(); q.h *= 0.55; this.squishAt(hit.point); }
      else if (beh.style !== 'plastic') {
        const inv = b.mesh.quaternion.clone().invert();
        const c = hit.point.clone().sub(b.mesh.position).applyQuaternion(inv);
        q.P.c = c.toArray(); q.cw = hit.point.clone(); b.uni.press.value.set(c.x, c.y, c.z, q.P.R);
      }
    }
    // press deeper while held; harder materials give more slowly
    const prev = q.h;
    q.h += (q.maxH - q.h) * (1 - Math.exp(-beh.speed * dt * (this.slow ? 0.35 : 1)));
    q.P.h = q.h; b.uni.pressH.value = q.h;
    const rate = (q.h - prev) / Math.max(dt, 1e-3);
    if (q.h > 0.004) q.changed = true;
    if (beh.wobble || beh.style === 'elastic') b.wobV = Math.max(b.wobV, 0.15 + (beh.wobble || 0.2));
    // sound, haptics, particles
    if (this.settings.sound) this.audio.squishSet(Math.min(1, rate * 4 + 0.05), q.h / q.maxH);
    if (this.settings.haptics) { const now = performance.now(); if (now - (this.lastBuzz || 0) > 90 && rate > 0.02) { this.ui.buzz(5); this.lastBuzz = now; } }
    if (beh.fx && rate > 0.01 && Math.random() < 0.5) {
      const ang = Math.random() * Math.PI * 2, rr = q.P.R * (1 + Math.random() * 0.4);
      const at = q.cw.clone().add(new THREE.Vector3(Math.cos(ang) * rr, 0.02, Math.sin(ang) * rr));
      this.particles.spawn(beh.fx, at, new THREE.Vector3(Math.cos(ang) * 0.6, 0.6 + Math.random(), Math.sin(ang) * 0.6), surfColor(b.def.in), { scale: 0.7 });
    }
    // pressed all the way and still holding: SPLAT
    if (beh.splat && q.h >= q.maxH * 0.95) { q.over = (q.over || 0) + dt; if (q.over > (beh.style === 'elastic' ? 0.9 : 0.5)) { this.squishSplat(); this.squishPose(dt); return; } }
    // brittle things crack once pressed far enough
    if (beh.style === 'brittle' && q.h >= Math.min(q.maxH * 0.95, beh.crack)) this.squishCrack();
    this.squishPose(dt);
  };

  P_.squishBake = function (q = this.sq) {
    const b = q.b;
    if (!q.P || q.P.h < 0.002) return;
    b.parts = bakeParts(b.parts, q.P);
    b.uni.pressH.value = 0;
    this.squishRebuild(b);
    b.stale = true;
  };

  P_.squishCrack = function () {
    const q = this.sq, b = q.b, W = q.cw.clone();
    b.uni.pressH.value = 0;
    if (!q.pushed) { this.undoStack.push(q.snap); q.snap.curls = this.curls.length; q.snap.dice = this.dice.count; this.ui.onUndo(this.undoStack.length); q.pushed = true; }
    // a few cracks radiating from the finger, through the whole piece
    const k = (q.beh.shards || 3) + Math.floor(Math.random() * 2), a0 = Math.random() * Math.PI;
    const segs = [];
    for (let i = 0; i < k; i++) {
      const a = a0 + (i / k) * Math.PI + (Math.random() - 0.5) * 0.5;
      const n = new THREE.Vector3(Math.cos(a), (Math.random() - 0.5) * 0.35, Math.sin(a)).normalize();
      segs.push({ n: n.toArray(), c: n.dot(W), bounds: [] });
    }
    this.knifeCut(segs, { push: b.def.snd === 'glass' ? 1.3 : 0.7 });
    // crumbs where the finger pushed in
    const fx = b.def.snd === 'glass' ? 'glass' : b.def.fx === 'juice' ? 'juice' : b.def.fx === 'none' || b.def.fx === 'shave' ? 'crumb' : b.def.fx;
    this.particles.burst(fx, W, b.def.snd === 'glass' ? 40 : 14, () => surfColor(b.def.in), 1.2, 1.1, { scale: 0.8 });
    this.audio.squishStop();
    this.audio.crack(b.def.snd);
    this.shakeA = Math.max(this.shakeA || 0, 0.03);
    if (this.settings.haptics) this.ui.buzz([18, 30, 12]);
    q.holding = false; q.cracked = true; this.knifeLift = 0;
    this.stats.cuts++; this.savePrefs(); this.ui.onCut(this.stats.cuts);
  };

  // Squashed past the limit: soft/wet things burst into chunks that fly out,
  // doughy things flatten into a pancake and squirt blobs to the sides.
  P_.squishSplat = function () {
    const q = this.sq, b = q.b, def = b.def, W = q.cw.clone();
    b.uni.pressH.value = 0;
    if (!q.pushed) { this.undoStack.push(q.snap); q.snap.curls = this.curls.length; q.snap.dice = this.dice.count; this.ui.onUndo(this.undoStack.length); q.pushed = true; }
    const wet = ['jelly', 'slime', 'fruit'].includes(def.snd) || q.beh.style === 'elastic';
    // blobs coloured from the material near the finger
    const inv = b.mesh.quaternion.clone().invert();
    const cl = W.clone().sub(b.mesh.position).applyQuaternion(inv);
    const col = new THREE.Color();
    const n = wet ? 70 : 45;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * q.P.R * 1.2;
      patColor(def.in, cl.x + Math.cos(a) * r, Math.max(0.02, cl.y - Math.random() * q.h), cl.z + Math.sin(a) * r, col);
      const sp = 1.4 + Math.random() * 2.6;
      const v = new THREE.Vector3(Math.cos(a) * sp, 0.8 + Math.random() * 2.2, Math.sin(a) * sp);
      const at = W.clone().add(new THREE.Vector3(Math.cos(a) * r, -q.h * 0.6, Math.sin(a) * r));
      this.particles.spawn(def.snd === 'sand' ? 'sand' : 'blob', at, v, col.clone(), { scale: def.snd === 'sand' ? 1.6 : 1 });
    }
    if (def.fx === 'juice' || wet) this.particles.burst('juice', W, 25, () => surfColor(def.in), 2, 1.4, { scale: 1 });
    if (wet) {
      // burst: real chunks flying outward
      // chunky pieces: two cracks through the finger plus a few offset ones
      const segs = [], a0 = Math.random() * Math.PI;
      for (let i = 0; i < 5; i++) {
        const a = a0 + i * 1.1 + (Math.random() - 0.5) * 0.5;
        const nn = new THREE.Vector3(Math.cos(a), (Math.random() - 0.5) * 0.25, Math.sin(a)).normalize();
        const off = i < 2 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.25);
        segs.push({ n: nn.toArray(), c: nn.dot(W) + off, bounds: [] });
      }
      const hn = new THREE.Vector3(0, 1, 0); segs.push({ n: hn.toArray(), c: W.y - q.h - 0.08, bounds: [] });
      this.knifeCut(segs, { push: 2.6 });
      for (const nb of this.bodies) if (nb.def === def) nb.wobV = 1;
    } else {
      // flatten: an affine squash keeps every part convex and every face planar
      const P = q.P, u = P.u, ky = 0.42, kl = 1.32;
      const c = P.c, cu = c[0] * u[0] + c[1] * u[1] + c[2] * u[2];
      const mapP = (x, y, z) => {
        const hp = x * u[0] + y * u[1] + z * u[2];
        const lx = x - hp * u[0] - (c[0] - cu * u[0]), ly = y - hp * u[1] - (c[1] - cu * u[1]), lz = z - hp * u[2] - (c[2] - cu * u[2]);
        const nh = P.base + (hp - P.base) * ky;
        return [c[0] - cu * u[0] + lx * kl + nh * u[0], c[1] - cu * u[1] + ly * kl + nh * u[1], c[2] - cu * u[2] + lz * kl + nh * u[2]];
      };
      const mapN = (x, y, z) => { const a = x * u[0] + y * u[1] + z * u[2]; const v = [(x - a * u[0]) / kl + a * u[0] / ky, (y - a * u[1]) / kl + a * u[1] / ky, (z - a * u[2]) / kl + a * u[2] / ky]; const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
      b.parts = b.parts.map(part => {
        const np = new Part(part.faces.map(f => {
          const pts = [], nrm = f.nrm ? [] : null;
          for (let i = 0; i < f.pts.length; i += 3) { pts.push(...mapP(f.pts[i], f.pts[i + 1], f.pts[i + 2])); if (nrm) nrm.push(...mapN(f.nrm[i], f.nrm[i + 1], f.nrm[i + 2])); }
          let plane = null;
          if (f.plane) { const nn = mapN(...f.plane.n); plane = { n: nn, c: nn[0] * pts[0] + nn[1] * pts[1] + nn[2] * pts[2] }; }
          return new Face(pts, nrm, f.type, plane);
        }));
        np.deformed = part.deformed;
        return np;
      });
      this.squishRebuild(b);
      const lin = this.physics.vel(b.h), ang = this.physics.angvel(b.h);
      this.physics.remove(b.h);
      b.h = this.physics.create(b.parts, b.mesh.position, b.mesh.quaternion, lin, ang, b.def.mat.density || 1);
      b.wobV = 1;
    }
    this.audio.squishStop();
    this.audio.splat(def.snd);
    this.shakeA = Math.max(this.shakeA || 0, 0.05);
    if (this.settings.haptics) this.ui.buzz([30, 40, 20]);
    q.holding = false; q.cracked = true; this.knifeLift = 0;
    this.stats.cuts++; this.savePrefs(); this.ui.onCut(this.stats.cuts);
  };

  P_.squishEnd = function () {
    const q = this.sq; this.knifeLift = 0;
    this.audio.squishStop();
    if (!q) return;
    this.sq = null;
    if (!q.b || q.cracked || !this.bodies.includes(q.b)) return;
    const b = q.b, beh = q.beh;
    if (beh.style === 'plastic') {
      if (q.changed) {
        if (!q.pushed) { this.undoStack.push(q.snap); q.snap.curls = this.curls.length; q.snap.dice = this.dice.count; this.ui.onUndo(this.undoStack.length); }
        this.squishBake(q);
        const lin = this.physics.vel(b.h), ang = this.physics.angvel(b.h);
        this.physics.remove(b.h);
        b.h = this.physics.create(b.parts, b.mesh.position, b.mesh.quaternion, lin, ang, b.def.mat.density || 1);
        b.stale = false;
        this.stats.cuts++; this.savePrefs(); this.ui.onCut(this.stats.cuts);
        this.audio.squelch(this.audio.ctx ? this.audio.ctx.currentTime : 0, 0.18, 0);
      }
    } else {
      // elastic: spring back (geometry unchanged; only the subdivision was added)
      (this.springs ||= []).push({ b, t: 0, h0: q.h, style: b.def.id === 'memoryfoam' ? 'slow' : 'elastic', spring: beh.spring || 16, damp: beh.damp || 3.5 });
      b.wobV = Math.max(b.wobV, 0.9);
      if (this.audio.ok) for (let i = 0; i < 3; i++) this.audio.squelch(this.audio.ctx.currentTime + i * 0.07, 0.2 / (i + 1), 1);
    }
  };

  // the pressing pad follows the finger and sinks into the dent
  P_.squishPose = function (dt) {
    const k = this.knife; if (!k) return;
    const q = this.sq;
    let target;
    if (q && q.holding) {
      if (q.b && q.cw) {
        const up = new THREE.Vector3(0, 1, 0);
        target = q.cw.clone().addScaledVector(up, -q.h);
      } else {
        const p = this.projectH(q.x, q.y, this.workHeight());
        target = p || k.position.clone();
      }
    } else {
      target = k.position.clone(); target.y += 0.9 * dt * 4;
      this.knifeFade = (this.knifeFade || 0) + dt * 3;
      if (this.knifeFade > 1) { k.visible = false; this.knifeFade = 0; }
    }
    if (q && q.holding) this.knifeFade = 0;
    const R = 0.2 * (this.ui.widthScale || 1);
    k.scale.setScalar(R / 0.2);
    k.quaternion.identity();
    k.position.lerp(target, 1 - Math.pow(1e-5, dt));
  };
}
