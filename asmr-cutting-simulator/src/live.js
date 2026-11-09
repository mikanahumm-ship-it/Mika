import * as THREE from 'three';
import { splitPart, components } from './geometry.js';
import { makeMaterial, surfColor } from './materials.js';

// ============================================================================
// Live (progressive) cutting.
//
// While your finger moves, the blade's real position advances along the path
// and the object's geometry is modified every frame under the blade:
//
//  * knife  – carves a thin slot (the blade's kerf) down through the object.
//             The slot follows your path; once it fully crosses a piece the
//             piece is disconnected and falls away under physics.
//  * peel   – removes a strip of material under the blade (width/thickness
//             adjustable). The removed strip becomes a growing curl, peel,
//             drape, chunk or crumbs depending on the material.
//
// The blade is posed exactly where material has been removed, so it never
// overlaps uncut material.
// ============================================================================

const STEP = 0.04;          // world units of blade travel per geometry update
const MAX_STEPS = 6;        // per frame
const UP = new THREE.Vector3(0, 1, 0);

// How each material reacts. Derived from the catalog's sound/fx tags so all
// 131 objects get sensible behaviour; individual objects can override with
// def.live = {...}.
export function behavior(def) {
  const s = def.snd;
  const B = { style: 'crumble', rate: 14, sink: 2.2, react: 0.04, rMin: 0.07, rMax: 0.2, brittle: 0, drift: 0.04 };
  if (s === 'soap') Object.assign(B, { style: 'curl', rate: 12, sink: 1.8, rMin: 0.045, rMax: 0.16, drift: 0.05 });
  else if (s === 'wax') Object.assign(B, { style: 'curl', rate: 10, sink: 1.6, rMin: 0.04, rMax: 0.13, drift: 0.035 });
  else if (s === 'choc') Object.assign(B, { style: 'curl', rate: 9, sink: 1.4, rMin: 0.035, rMax: 0.1, brittle: 0.55, drift: 0.02 });
  else if (s === 'cheese') Object.assign(B, { style: 'curl', rate: 11, sink: 2, rMin: 0.07, rMax: 0.22, brittle: 0.45 });
  else if (s === 'meat' || s === 'fish') Object.assign(B, { style: 'drape', rate: 13, sink: 2.4, react: 0.06, rMin: 0.08, rMax: 0.1 });
  else if (s === 'fruit' || s === 'crisp' || s === 'crunch') Object.assign(B, { style: 'peel', rate: 13, sink: 2, react: 0.03, rMin: 0.09, rMax: 0.26, drift: 0.06 });
  else if (s === 'jelly' || s === 'slime') Object.assign(B, { style: 'chunk', rate: 24, sink: 3.5, react: 0.45 });
  else if (s === 'clay') Object.assign(B, { style: 'chunk', rate: 11, sink: 1.8, react: 0.12 });
  else if (s === 'ice') Object.assign(B, { style: 'crumble', rate: 7, sink: 1.2, react: 0 });
  else if (s === 'sand') Object.assign(B, { style: 'crumble', rate: 20, sink: 3, react: 0.02 });
  else if (s === 'cake' || s === 'bread' || s === 'foam') Object.assign(B, { style: 'crumble', rate: 16, sink: 2.6, react: 0.08 });
  return Object.assign(B, def.live || {});
}

// ---------------------------------------------------------------- curl strip
// A curl is the actual strip that was removed. Every sample remembers the
// material-space position it came from, so the curl is coloured with exactly
// the layers/skin/marbling of the material it was shaved from.
class Curl {
  constructor(game, def, beh, outerFirst) {
    this.game = game; this.def = def; this.beh = beh;
    this.samples = [];   // {top, bot, side (material space), w, th, outer}
    this.outer = outerFirst;
    const shared = { wob: { value: 0 }, time: game.time, base: { value: 0 }, height: { value: 1 } };
    const surfTop = outerFirst ? def.out : def.in;
    this.mats = [makeMaterial(surfTop, def.mat, shared, { mpos: true, double: true }), makeMaterial(def.in, def.mat, shared, { mpos: true, double: true })];
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mats);
    this.mesh.castShadow = true; this.mesh.receiveShadow = false; this.mesh.frustumCulled = false;
    game.scene.add(this.mesh);
    this.length = 0;
  }
  add(sample) { this.samples.push(sample); this.length = (this.samples.length - 1) * STEP_S; }
  // Build world geometry: spine starts at the blade contact C and winds back.
  layout(C, t, side) {
    const n = this.samples.length; if (n < 2) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const beh = this.beh;
    const back = t.clone(), up = UP;
    const P = new Array(n), Nn = new Array(n), Sd = new Array(n);
    let pos = C.clone(), phi = beh.style === 'drape' ? 0.9 : 0.5; // rides up the blade's rake face first
    let lat = 0;
    for (let k = 0; k < n; k++) {
      const i = n - 1 - k; // newest sample sits at the blade
      const u = k * STEP_S, sm = this.samples[i];
      const dir = back.clone().multiplyScalar(Math.cos(phi)).addScaledVector(up, Math.sin(phi));
      const nrm = back.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(up, Math.cos(phi)); // outward (top face)
      P[i] = pos.clone().addScaledVector(side, lat); Nn[i] = nrm; Sd[i] = sm;
      // curvature: gentle at the blade, tightening into a spiral
      let R;
      if (beh.style === 'drape') R = phi < 2.9 ? beh.rMax : 1e6;
      else {
        const plate = 0.14; // straight while sliding up the blade plate
        R = u < plate ? 1e4 : beh.rMin + (beh.rMax - beh.rMin) * Math.exp(-(u - plate) / 0.1);
        if (phi > 5.5) R *= Math.max(0.5, 1 - (phi - 5.5) * 0.06);
      }
      R *= 1 + sm.th * 6;
      phi += STEP_S / R;
      pos.addScaledVector(dir, STEP_S);
      if (beh.style === 'drape' && pos.y < C.y - 0.02) pos.y = C.y - 0.02;
      lat += STEP_S * beh.drift * (phi > 3 ? 1 : 0.2);
    }
    // ribbon: top face, bottom face, two edges
    const posA = [], mpA = [], nA = [], idx0 = [], idx1 = [];
    let curN = null;
    const push = (p, m) => { posA.push(p.x, p.y, p.z); mpA.push(m.x, m.y, m.z); nA.push(curN.x, curN.y, curN.z); return posA.length / 3 - 1; };
    const negSide = side.clone().negate();
    const V = [];
    for (let i = 0; i < n; i++) {
      const s = this.samples[i], c = P[i], nr = Nn[i];
      const hw = s.w / 2, ht = s.th / 2;
      const tl = c.clone().addScaledVector(nr, ht).addScaledVector(side, -hw), tr = c.clone().addScaledVector(nr, ht).addScaledVector(side, hw);
      const bl = c.clone().addScaledVector(nr, -ht).addScaledVector(side, -hw), br = c.clone().addScaledVector(nr, -ht).addScaledVector(side, hw);
      const mtl = s.top.clone().addScaledVector(s.side, -hw), mtr = s.top.clone().addScaledVector(s.side, hw);
      const mbl = s.bot.clone().addScaledVector(s.side, -hw), mbr = s.bot.clone().addScaledVector(s.side, hw);
      const v = [];
      curN = nr; v.push(push(tl, mtl), push(tr, mtr));
      curN = nr.clone().negate(); v.push(push(bl, mbl), push(br, mbr));
      curN = negSide; v.push(push(tl, mtl.clone().lerp(mbl, .5)), push(bl, mtl.clone().lerp(mbl, .5)));
      curN = side; v.push(push(tr, mtr.clone().lerp(mbr, .5)), push(br, mtr.clone().lerp(mbr, .5)));
      V.push(v);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = V[i], b = V[i + 1];
      idx0.push(a[0], b[0], a[1], a[1], b[0], b[1]);           // top
      idx1.push(a[2], a[3], b[2], a[3], b[3], b[2]);           // bottom
      idx1.push(a[4], a[5], b[4], a[5], b[5], b[4]);           // left edge
      idx1.push(a[6], b[6], a[7], a[7], b[6], b[7]);           // right edge
    }
    const g = this.mesh.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
    g.setAttribute('mpos', new THREE.Float32BufferAttribute(mpA, 3));
    g.setIndex(idx0.concat(idx1));
    g.clearGroups(); g.addGroup(0, idx0.length, 0); g.addGroup(idx0.length, idx1.length, 1);
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nA, 3));
  }
  // Hand the curl over to physics: it drops and rolls on the board.
  detach() {
    const g = this.mesh.geometry; if (!g.attributes.position) { this.dispose(); return null; }
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    this.mesh.position.copy(c);
    const h = this.game.physics.createHull(g.attributes.position.array, c);
    return { mesh: this.mesh, h, mats: this.mats };
  }
  dispose() { this.game.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mats.forEach(m => m.dispose()); }
}
const STEP_S = 0.02; // curl sample spacing (world units of strip length)

// ============================================================================
export function installLive(Game, helpers) {
  const { buildGeometry, bodyMaterials } = helpers;
  const P = Game.prototype;

  P.liveActive = function () { return this.mode === 'vertical' || this.tool.kind !== 'knife'; };

  P.liveBegin = function (e) {
    const tool = this.tool;
    const hit = this.hitBody(e.clientX, e.clientY);
    const h = hit && hit.face && hit.face.normal.y > 0.3 ? hit.point.y : this.workHeight();
    const F = this.projectH(e.clientX, e.clientY, h);
    if (!F) return;
    this.stroke = {
      live: true, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }], h, hits: [], inMat: null, speed: 0,
      K: F.clone(), last: F.clone(), dir: null, travel: 0, fingerS: 0, tip: h + 0.05, changed: false,
      snap: this.snapshot(), segs: [], psegs: [], orig: new Map(this.bodies.map(b => [b, { parts: b.parts, seg0: 0, pseg0: 0 }])), curl: null, chunk: null, contactBody: null, guide: null, crumbAcc: 0,
    };
    this.knife.visible = true; this.knifeLift = 1;
    this.knifeTarget = F.clone(); this.knife.position.copy(F).add(new THREE.Vector3(0, 0.25, 0));
    this.knifeScale = 1;
    void tool;
  };

  P.liveMove = function (e) {
    const s = this.stroke, now = performance.now();
    const last = s.pts[s.pts.length - 1];
    const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    if (dist < 1.5) return;
    s.pts.push({ x: e.clientX, y: e.clientY, t: now });
  };

  // finger -> target point on the work plane (with guides / path patterns)
  P.liveTarget = function (s) {
    const f = s.pts[s.pts.length - 1];
    let F = this.projectH(f.x, f.y, s.h);
    if (!F) return null;
    if (this.guide !== 'free') {
      if (!s.guide && F.distanceTo(s.last) > 0.08) s.guide = this.guideLine(s, F);
      if (s.guide) { const g = s.guide; F = g.o.clone().addScaledVector(g.d, F.clone().sub(g.o).dot(g.d)); F.y = s.h; }
      else return s.K.clone();
    }
    const tool = this.tool;
    if (tool.path && s.dir) {
      const side = new THREE.Vector3(-s.dir.z, 0, s.dir.x);
      const along = s.fingerS + F.distanceTo(s.K);
      const wl = 0.2, amp = 0.05, ph = along / wl;
      const o = tool.path === 'zigzag' ? (Math.abs(((ph % 1) + 1) % 1 - 0.5) * 4 - 1) * amp : Math.sin(ph * Math.PI * 2) * amp;
      F.addScaledVector(side, o);
    }
    return F;
  };

  P.guideLine = function (s, F) {
    const mid = s.last.clone();
    let body = null, bd = Infinity;
    for (const b of this.bodies) { const d = b.mesh.position.distanceToSquared(mid); if (d < bd) { bd = d; body = b; } }
    let axis = new THREE.Vector3(1, 0, 0);
    if (body) {
      const bb = body.mesh.geometry.boundingBox;
      const local = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      const w = local.applyQuaternion(body.mesh.quaternion).setY(0);
      if (w.lengthSq() > 0.05) axis = w.normalize();
    }
    const d = this.guide === 'long' ? axis : new THREE.Vector3(-axis.z, 0, axis.x);
    if (F.clone().sub(mid).dot(d) < 0) d.negate();
    return { o: mid, d };
  };

  // ------------------------------------------------------------- per frame
  P.liveUpdate = function (dt) {
    const s = this.stroke; if (!s || !s.live) return;
    const tool = this.tool;
    const F = this.liveTarget(s);
    const beh = s.contactBody ? behavior(s.contactBody.def) : { rate: 18, sink: 3 };
    if (F) {
      // the blade follows the finger with material-dependent resistance
      const k = 1 - Math.exp(-beh.rate * (s.contactBody ? 1 : 1.8) * dt * (this.slow ? 0.35 : 1));
      const prevK = s.K.clone();
      s.K.lerp(F, k);
      const mv = s.K.distanceTo(prevK);
      s.speed = s.speed * 0.8 + (mv / Math.max(dt, 1e-3)) * 0.2 * 0.25;
    }
    // advance the cut in fixed steps along the blade's path
    let steps = 0;
    while (steps < MAX_STEPS) {
      const d = s.K.clone().sub(s.last); d.y = 0;
      const L = d.length();
      if (L < STEP) break;
      d.normalize();
      // keep one direction for a straight run; start a new run only when the
      // blade's path leaves the current line by more than ~2 cm
      // direction measured over a long baseline (toward the finger) so pixel noise doesn't tilt it
      const est = () => { const g = (F || s.K).clone().sub(s.last); g.y = 0; return g.length() > 0.12 ? g.normalize() : d.clone(); };
      if (!s.dir) { s.dir = est(); s.runA = s.last.clone(); }
      else {
        const nrm = new THREE.Vector3(-s.dir.z, 0, s.dir.x);
        const off = s.K.clone().sub(s.runA).dot(nrm);
        if (Math.abs(off) > 0.03 || s.dir.dot(d) < 0) { s.dir = est(); s.runA = s.last.clone(); }
      }
      const B = s.last.clone().addScaledVector(d, STEP); // follow the real path; side planes come from the run
      this.liveSegment(s, s.last.clone(), B, s.dir.clone(), tool, s.runA);
      s.fingerS += STEP; s.travel += STEP; s.last.copy(B);
      steps++;
    }
    if (steps) this.liveCommitVisuals(s, tool);
    this.livePose(s, tool, dt);
    // curl / chunk follow the blade
    if (s.curl) s.curl.layout(this.curlAnchor(s), s.dir || new THREE.Vector3(1, 0, 0), new THREE.Vector3(-(s.dir || UP).z, 0, (s.dir || UP).x).normalize());
    if (s.chunk) this.chunkLayout(s);
  };

  // One step of real material removal between A and B.
  P.liveSegment = function (s, A, B, t, tool, anchor = A) {
    const isKnife = tool.kind === 'knife';
    const ui = this.ui;
    const width = isKnife ? (tool.kerf || 0.034) : tool.width * (ui.widthScale || 1);
    const depth = isKnife ? Infinity : tool.depth * (ui.depthScale || 1);
    const tiltR = isKnife ? THREE.MathUtils.degToRad(this.tilt) : 0;
    const dn = new THREE.Vector3(0, -1, 0).applyAxisAngle(t, tiltR);
    const n = new THREE.Vector3().crossVectors(t, dn).normalize();
    const ov = isKnife ? width + 0.012 : Math.min(width * 0.35, 0.05);
    const planes = [
      { n: n.toArray(), c: n.dot(anchor) - width / 2 },
      { n: n.clone().negate().toArray(), c: -n.dot(anchor) - width / 2 },
      { n: t.toArray(), c: t.dot(A) - ov },
      { n: t.clone().negate().toArray(), c: -t.dot(B) },
    ];
    const inRegion = [];
    for (const b of this.bodies) {
      if (b.ghost) continue;
      const bb = b.wbox || (b.wbox = new THREE.Box3().setFromObject(b.mesh));
      if (bb.distanceToPoint(A) > 0.6 && bb.distanceToPoint(B) > 0.6) continue;
      const lp = planes.map(p => this.localPlane(b, p.n, p.c));
      let next = null;
      for (let i = 0; i < b.parts.length; i++) {
        const part = b.parts[i];
        const { inside, outside } = this.clipRegion(part, lp);
        if (!inside) { if (next) next.push(part); continue; }
        if (!next) next = b.parts.slice(0, i);
        next.push(...outside, inside); inRegion.push({ b, part: inside });
      }
      if (next) b.parts = next;
    }
    if (!inRegion.length) { s.inMat = null; if (!s.contactBody) s.tip = -0.01; return; } // blade slid in from the side at board level
    // top of material under the blade
    let top = -Infinity;
    for (const { b, part } of inRegion) {
      const m = b.mesh.matrixWorld.elements;
      for (const f of part.faces) for (let k = 0; k < f.pts.length; k += 3) {
        const y = m[1] * f.pts[k] + m[5] * f.pts[k + 1] + m[9] * f.pts[k + 2] + m[13];
        if (y > top) top = y;
      }
    }
    const body0 = inRegion[0].b;
    s.contactBody = body0; s.inMat = body0; s.top = top;
    const beh = behavior(body0.def);
    // knife: the slot is as deep as the blade tip has pressed in
    let floorY;
    if (isKnife) {
      s.tip = Math.min(s.tip, top);
      s.tip = Math.max(-0.01, s.tip - STEP * beh.sink);
      floorY = s.tip <= 0.002 ? -1 : s.tip;
      s.segs.push({ A: A.clone(), B: B.clone(), t: t.clone(), anchor: anchor.clone(), partial: floorY > -1, floorY, tilt: this.tilt, width });
    } else {
      floorY = Math.max(top - depth, 0.012);
      if (top - floorY < 0.004) return;
      s.psegs.push({ A: A.clone(), B: B.clone(), t: t.clone(), anchor: anchor.clone(), floorY, width, tilt: 0 });
    }
    const removed = [];
    for (const { b, part } of inRegion) {
      let keep = null, cut = part;
      if (floorY > -1) {
        const lp = this.localPlane(b, [0, -1, 0], -floorY);
        const r = splitPart(part, lp.n, lp.c, 1);
        keep = r.front; cut = r.back;
      }
      const idx = b.parts.indexOf(part);
      const list = b.parts.slice();
      if (keep) list[idx] = keep; else list.splice(idx, 1);
      b.parts = list; b.dirtyLive = true;
      if (cut) removed.push({ b, part: cut });
    }
    if (!removed.length) return;
    s.changed = true;
    if (!s.pushedUndo) { this.undoStack.push(s.snap); s.snap.curls = this.curls.length; if (this.undoStack.length > 30) this.undoStack.shift(); this.ui.onUndo(this.undoStack.length); s.pushedUndo = true; }
    // material reaction while cutting
    if (beh.react) body0.wobV = Math.max(body0.wobV, beh.react);
    const vol = removed.reduce((a, r) => a + r.part.massProps().V, 0);
    s.removedRate = (s.removedRate || 0) * 0.7 + vol * 0.3;
    if (isKnife) this.knifeSpray(s, B, top, body0, vol);
    else this.peelMaterial(s, A, B, t, n, top, floorY, removed, beh);
  };

  // tiny dust / juice at the blade while slicing
  P.knifeSpray = function (s, B, top, b, vol) {
    const fx = b.def.fx;
    s.crumbAcc += 0.35 + vol * 300;
    if (s.crumbAcc < 1 || fx === 'none') return;
    s.crumbAcc = 0;
    const type = fx === 'shave' ? 'crumb' : fx;
    const at = B.clone(); at.y = top + 0.01;
    this.particles.spawn(type, at, new THREE.Vector3((Math.random() - .5) * .5, .4 + Math.random() * .7, (Math.random() - .5) * .5), surfColor(b.def.in), { scale: type === 'juice' ? 0.7 : 0.5 });
  };

  // What happens to peeled material depends on the material.
  P.peelMaterial = function (s, A, B, t, n, top, floorY, removed, beh) {
    const b = removed[0].b, def = b.def;
    if (beh.style === 'curl' || beh.style === 'peel' || beh.style === 'drape') {
      if (!s.curl) {
        // was the top of this strip the original surface (skin/crust) ?
        let outerA = 0, total = 0;
        for (const r of removed) for (const f of r.part.faces) if (f.type !== 1 || true) {
          const fn = f.nrm ? [f.nrm[1]] : f.plane ? [f.plane.n[1]] : [0];
          if (fn[0] > 0.5) { total++; if (f.type === 0) outerA++; }
        }
        s.curl = new Curl(this, def, beh, total > 0 && outerA / total > 0.4);
      }
      const inv = b.mesh.quaternion.clone().invert();
      const toL = (p) => p.clone().sub(b.mesh.position).applyQuaternion(inv);
      const width = this.tool.width * (this.ui.widthScale || 1);
      const th = Math.max(0.006, top - floorY);
      const sideL = n.clone().applyQuaternion(inv).normalize();
      const k = Math.max(1, Math.round(STEP / STEP_S));
      for (let i = 0; i < k; i++) {
        const p = A.clone().lerp(B, (i + 1) / k);
        const tp = p.clone(); tp.y = top - 0.002; const bt = p.clone(); bt.y = floorY + 0.002;
        s.curl.add({ top: toL(tp), bot: toL(bt), side: sideL, w: width, th });
      }
      if (beh.brittle && s.curl.length > beh.brittle) this.dropCurl(s, true);
    } else if (beh.style === 'chunk') {
      if (!s.chunk) s.chunk = { def, src: b, parts: [], mesh: null, lift: 0 };
      for (const r of removed) s.chunk.parts.push(r.part);
      s.chunk.dirty = true;
    } else {
      // crumble: removed volume turns into crumbs / sand / shards
      const vol = removed.reduce((a, r) => a + r.part.massProps().V, 0);
      const cnt = Math.min(10, Math.round(vol * 2500) + 1);
      const fx = def.fx === 'none' || def.fx === 'juice' ? 'crumb' : def.fx;
      for (let i = 0; i < cnt; i++) {
        const at = B.clone(); at.y = (top + floorY) / 2;
        at.addScaledVector(n, (Math.random() - 0.5) * this.tool.width * (this.ui.widthScale || 1));
        this.particles.spawn(fx, at, t.clone().multiplyScalar(0.4 + Math.random() * 0.6).add(new THREE.Vector3((Math.random() - .5) * .6, .3 + Math.random() * .8, (Math.random() - .5) * .6)), Math.random() < 0.3 ? surfColor(def.out) : surfColor(def.in));
      }
    }
  };

  P.curlAnchor = function (s) {
    const c = s.last.clone();
    c.y = (s.floorVis ?? s.h) + 0.004;
    return c;
  };

  P.dropCurl = function (s, brittle) {
    if (!s.curl) return;
    const c = s.curl; s.curl = null;
    if (c.samples.length < 3) { c.dispose(); return; }
    const d = c.detach();
    if (d) {
      if (d.h && !d.h.sim) {
        const tt = s.dir || new THREE.Vector3(1, 0, 0);
        d.h.rb.setLinvel({ x: -tt.x * 0.4 + (Math.random() - .5) * .4, y: brittle ? 0.6 : 0.3, z: -tt.z * 0.4 + (Math.random() - .5) * .4 }, true);
        d.h.rb.setAngvel({ x: (Math.random() - .5) * 3, y: (Math.random() - .5) * 2, z: (Math.random() - .5) * 3 }, true);
      }
      this.curls.push(d);
      if (brittle) this.audio.finish('choc', { weight: 0.2 }, 0);
      while (this.curls.length > 40) this.removeCurl(this.curls[0]);
    }
  };
  P.removeCurl = function (c) {
    if (c.h) this.physics.remove(c.h);
    this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mats.forEach(m => m.dispose());
    this.curls.splice(this.curls.indexOf(c), 1);
  };

  P.chunkLayout = function (s) {
    const ch = s.chunk; if (!ch) return;
    if (ch.dirty) {
      if (!ch.mesh) {
        const shared = { wob: { value: 0.02 }, time: this.time, base: { value: 0 }, height: { value: 1 } };
        ch.uni = shared;
        ch.mesh = new THREE.Mesh(new THREE.BufferGeometry(), bodyMaterials(ch.def, shared));
        ch.mesh.castShadow = true; this.scene.add(ch.mesh);
      }
      ch.mesh.geometry.dispose(); ch.mesh.geometry = buildGeometry(ch.parts);
      const bb = ch.mesh.geometry.boundingBox; ch.uni.base.value = bb.min.y; ch.uni.height.value = bb.max.y - bb.min.y;
      ch.dirty = false;
    }
    ch.lift = Math.min(0.12, ch.lift + 0.004);
    const src = ch.src;
    ch.mesh.position.copy(src.mesh.position).add(new THREE.Vector3(0, ch.lift, 0));
    ch.mesh.quaternion.copy(src.mesh.quaternion);
  };

  // After this frame's steps: separate disconnected pieces, refresh meshes.
  P.liveCommitVisuals = function (s, tool) {
    for (const b of [...this.bodies]) {
      if (!b.dirtyLive) continue;
      b.dirtyLive = false; b.wbox = null;
      let clean = null;
      if (s.orig.has(b)) {
        const res = this.rebakeBody(s, b, tool.kind === 'knife', true);
        if (res) { clean = res.parts; if (s.chunk && s.chunk.src === b) { s.chunk.parts = res.removed; s.chunk.dirty = true; } }
      }
      const parts = (clean || b.parts).filter(p => p.massProps().V > 2e-6);
      let comps = tool.kind === 'knife' ? components(parts) : [parts];
      if (comps.length > 1) {
        const t = s.dir || new THREE.Vector3(1, 0, 0);
        const n = new THREE.Vector3(-t.z, 0, t.x);
        const use = parts;
        const before = new Set(this.bodies);
        this.applyChanges(new Map([[b, use]]), [{ n: n.toArray(), c: n.dot(s.last) }], { ...tool, push: (tool.push || 1) * 0.45 });
        for (const nb of this.bodies) if (!before.has(nb)) s.orig.set(nb, { parts: nb.parts, seg0: s.segs.length, pseg0: s.psegs.length });
        this.audio.finish(b.def.snd, tool, 1);
        if (this.settings.haptics) this.ui.buzz(Math.round(12 + 10 * (tool.weight || 1)));
        s.separated = true;
      } else {
        b.parts = parts;
        b.mesh.geometry.dispose();
        b.mesh.geometry = buildGeometry(parts);
        const bb = b.mesh.geometry.boundingBox; b.uni.base.value = bb.min.y; b.uni.height.value = bb.max.y - bb.min.y;
        b.stale = true;
      }
    }
    if (this.settings.haptics && s.inMat) {
      const now = performance.now();
      if (now - (this.lastBuzz || 0) > 75) { this.ui.buzz(s.inMat.def.snd === 'crunch' || s.inMat.def.snd === 'crisp' ? 8 : 4); this.lastBuzz = now; }
    }
  };

  // Blade pose: tip leads at the cut front, edge exactly at the cut floor.
  P.livePose = function (s, tool, dt) {
    const k = this.knife; if (!k) return;
    const t = s.dir || this.knifeDir || new THREE.Vector3(1, 0, 0);
    this.knifeDir = t.clone();
    const front = s.last.clone();
    if (tool.kind === 'knife') {
      const top = s.top ?? s.h;
      const edgeY = s.inMat || s.tip < top - 0.01 ? Math.max(0.003, s.tip) : top + 0.004;
      s.floorVis = edgeY;
      // scale the knife so its spine stays above the object
      const want = THREE.MathUtils.clamp((top + 0.08) / tool.h, 1, 1.7);
      this.knifeScale += (want - this.knifeScale) * Math.min(1, dt * 6);
      k.scale.setScalar(this.knifeScale);
      // place the blade so its tip is at the cut front; the edge rises behind it
      const L = tool.len * this.knifeScale;
      const pitch = THREE.MathUtils.degToRad(tool.kind === 'knife' ? 10 : 0);
      const tiltR = THREE.MathUtils.degToRad(-this.tilt);
      const upv = UP.clone().applyAxisAngle(t, tiltR);
      const z = new THREE.Vector3().crossVectors(t, upv).normalize();
      const x = t.clone().applyAxisAngle(z, pitch);
      const y = new THREE.Vector3().crossVectors(z, x).normalize();
      k.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      const tipOffset = L * 0.45; // model tip sits at +0.45L
      const target = front.clone(); target.y = edgeY;
      target.addScaledVector(x, -tipOffset);
      k.position.lerp(target, 1 - Math.pow(1e-6, dt));
      this.knifeTarget = target.clone();
    } else {
      // peeler: edge rides exactly on the groove floor, plate rising ahead of it
      const floor = s.top !== undefined ? Math.max((s.top ?? s.h) - this.tool.depth * (this.ui.depthScale || 1), 0.012) : s.h;
      s.floorVis = floor;
      const z = new THREE.Vector3().crossVectors(t, UP).normalize();
      k.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, UP, z));
      const target = front.clone(); target.y = floor;
      k.scale.setScalar(1);
      k.position.lerp(target, 1 - Math.pow(1e-6, dt));
      this.knifeTarget = target.clone();
    }
  };

  // Live peeling updates geometry in many small steps. On release the same
  // removal is recomputed from the original shape with merged straight runs,
  // giving identical results with far fewer convex parts (and no seams).
  // Rebuild a body from its original shape + the simplified path cut so far.
  // Called every frame while cutting: same result as the live steps, but the
  // body stays a handful of clean convex parts (no seams, no slowdown).
  P.rebakeBody = function (s, b, isKnife, collect = false) {
    const o = s.orig.get(b); if (!o) return null;
    const segs = isKnife ? s.segs.slice(o.seg0) : s.psegs.slice(o.pseg0);
    if (!segs.length) return null;
    // 1) continuous chains (same tilt/width, connected) -> one simplified line each
    // 2) every straight line is split only by depth, so all its sections share
    //    exactly the same side planes (their internal faces line up perfectly)
    const chain = (p, g) => p.B.distanceTo(g.A) < 1e-4 && g.tilt === p.tilt && Math.abs(g.width - p.width) < 1e-6;
    const sameFloor = (p, g) => (g.floorY <= -1 && p.floorY <= -1) || (g.floorY > -1 && p.floorY > -1 && Math.abs(g.floorY - p.floorY) < (isKnife ? 0.05 : 0.004));
    const runs = [];
    const flush = (grp) => {
      const pts = [grp[0].A, ...grp.map(g => g.B)];
      const idx = rdpIdx(pts, isKnife ? 0.004 : 0.008);
      for (let i = 0; i < idx.length - 1; i++) {
        const A = pts[idx[i]], B = pts[idx[i + 1]], t = B.clone().sub(A).setY(0);
        if (t.lengthSq() < 1e-8) continue;
        t.normalize();
        // sections of this line with the same depth
        let k0 = idx[i];
        for (let k = idx[i] + 1; k <= idx[i + 1]; k++) {
          if (k === idx[i + 1] || !sameFloor(grp[k0], grp[k])) {
            const sec = grp.slice(k0, k);
            const sa = A.clone().addScaledVector(t, pts[k0].clone().sub(A).dot(t));
            const sb = A.clone().addScaledVector(t, pts[k].clone().sub(A).dot(t));
            runs.push({ A: sa, B: sb, anchor: A, t, tilt: grp[0].tilt || 0, width: grp[0].width, floorY: Math.min(...sec.map(g => g.floorY)) });
            k0 = k;
          }
        }
      }
    };
    let grp = [segs[0]];
    for (let i = 1; i < segs.length; i++) { if (chain(segs[i - 1], segs[i])) grp.push(segs[i]); else { flush(grp); grp = [segs[i]]; } }
    flush(grp);
    let parts = o.parts; const removed = [];
    for (const r of runs) {
      const dn = new THREE.Vector3(0, -1, 0).applyAxisAngle(r.t, THREE.MathUtils.degToRad(r.tilt));
      const n = new THREE.Vector3().crossVectors(r.t, dn).normalize();
      const ov = isKnife ? r.width + 0.012 : Math.min(r.width * 0.35, 0.05);
      const lp = [
        { n: n.toArray(), c: n.dot(r.anchor) - r.width / 2 },
        { n: n.clone().negate().toArray(), c: -n.dot(r.anchor) - r.width / 2 },
        { n: r.t.toArray(), c: r.t.dot(r.A) - (r.A.equals(r.anchor) ? ov : 0) },
        { n: r.t.clone().negate().toArray(), c: -r.t.dot(r.B) },
      ].map(p => this.localPlane(b, p.n, p.c));
      const fl = r.floorY > -1 ? this.localPlane(b, [0, -1, 0], -r.floorY) : null;
      const next = [];
      for (const part of parts) {
        const { inside, outside } = this.clipRegion(part, lp);
        next.push(...outside);
        if (inside && fl) { const sp = splitPart(inside, fl.n, fl.c, 1); if (sp.front) next.push(sp.front); if (sp.back) removed.push(sp.back); }
        else if (inside) removed.push(inside);
      }
      parts = next;
    }
    const out = parts.filter(p => p.massProps().V > 2e-6);
    return collect ? { parts: out, removed: removed.filter(p => p.massProps().V > 2e-6) } : out;
  };

  P.liveEnd = function () {
    const s = this.stroke; this.stroke = null;
    this.knifeLift = 0;
    const tool = this.tool;
    const moved = s.pts.length > 1 && Math.hypot(s.pts[s.pts.length - 1].x - s.pts[0].x, s.pts[s.pts.length - 1].y - s.pts[0].y) > 12;
    if (!moved && !s.changed) { // tap = poke
      this.knife.visible = false;
      const hit = this.hitBody(s.pts[0].x, s.pts[0].y);
      if (hit) { const b = hit.object.userData.body; b.wobV = Math.max(b.wobV, 0.8 * (b.def.wob || 0.1)); this.audio.finish(b.def.snd, { weight: 0.3 }, 0); }
      return;
    }
    if (tool.kind === 'knife' && s.dir) {
      // finish the stroke: follow through a little (or across the whole piece with a guide)
      let extra = s.inMat ? 0.25 : 0.06;
      if (s.guide) extra = 3;
      const end = s.K.clone().addScaledVector(s.dir, extra);
      let guard = 0;
      while (s.last.distanceTo(end) >= STEP && guard++ < 200) {
        const B = s.last.clone().addScaledVector(s.dir, STEP);
        s.tip = -1; // the blade is pushed through
        this.liveSegment(s, s.last.clone(), B, s.dir.clone(), tool, s.runA);
        s.last.copy(B);
      }
      // with a guide, the straight line also runs back through the piece behind the start
      if (s.guide) {
        const back = s.guide.d.clone().negate();
        s.last.copy(s.guide.o); s.runA = s.guide.o.clone();
        const endB = s.guide.o.clone().addScaledVector(back, 3);
        let g2 = 0;
        while (s.last.distanceTo(endB) >= STEP && g2++ < 200) {
          const B = s.last.clone().addScaledVector(back, STEP);
          s.tip = -1;
          this.liveSegment(s, s.last.clone(), B, back.clone(), tool, s.runA);
          s.last.copy(B);
        }
      }
      // press the blade down through any part of the slot that was still shallow
      // press the blade down through any part of the slot that was still shallow
      if (s.segs.some(g => g.partial)) {
        for (const sg of s.segs) if (sg.partial) { sg.partial = false; sg.floorY = -1; }
        for (const bb of this.bodies) if (s.orig.has(bb)) bb.dirtyLive = true;
      }
      this.liveCommitVisuals(s, tool);
    } else if (s.changed) {
      // peel: check whether the groove split anything apart
      for (const b of [...this.bodies]) if (b.stale) {
        const comps = components(b.parts);
        if (comps.length > 1) { b.stale = false; this.applyChanges(new Map([[b, b.parts]]), null, tool); }
      }
    }
    // the curl / chunk lets go of the blade
    if (s.curl) this.dropCurl(s, false);
    if (s.chunk && s.chunk.parts.length) {
      const ch = s.chunk, src = ch.src;
      const pos = ch.mesh.position.clone(), quat = ch.mesh.quaternion.clone();
      const t = s.dir || new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1);
      this.scene.remove(ch.mesh); ch.mesh.geometry.dispose();
      const nb = this.addBody(ch.def, ch.parts, pos, quat, side.multiplyScalar(0.9).add(new THREE.Vector3(0, 1.4, 0)), new THREE.Vector3((Math.random() - .5) * 2, 0, (Math.random() - .5) * 2));
      nb.wobV = 1;
      void src;
    }
    // stale colliders -> rebuild once at the end of the stroke
    for (const b of this.bodies) if (b.stale) {
      b.stale = false;
      const lin = this.physics.vel(b.h), ang = this.physics.angvel(b.h);
      this.physics.remove(b.h);
      b.h = this.physics.create(b.parts, b.mesh.position, b.mesh.quaternion, lin, ang, b.def.mat.density || 1);
    }
    if (s.changed) {
      this.stats.cuts++; this.savePrefs(); this.ui.onCut(this.stats.cuts);
      const def = (s.contactBody || {}).def;
      if (def && !s.separated) this.audio.finish(def.snd, { ...tool, weight: (tool.weight || 1) * 0.5 }, 0);
    }
    this.trail.visible = false;
  };
}

// Ramer–Douglas–Peucker on x/z of Vector3 points
function rdp3(P, eps) {
  if (P.length < 3) return P.map(p => p.clone());
  const A = P[0], B = P[P.length - 1];
  const ab = B.clone().sub(A).setY(0), L = ab.length() || 1e-9;
  let md = 0, mi = 0;
  for (let i = 1; i < P.length - 1; i++) {
    const ap = P[i].clone().sub(A).setY(0);
    const d = Math.abs(ab.x * ap.z - ab.z * ap.x) / L;
    if (d > md) { md = d; mi = i; }
  }
  if (md > eps) return rdp3(P.slice(0, mi + 1), eps).slice(0, -1).concat(rdp3(P.slice(mi), eps));
  return [A.clone(), B.clone()];
}

// RDP returning the indices of the kept points
function rdpIdx(P, eps, lo = 0, hi = P.length - 1, out = null) {
  const top = !out; out = out || [lo];
  if (hi - lo >= 2) {
    const A = P[lo], B = P[hi], ab = B.clone().sub(A).setY(0), L = ab.length() || 1e-9;
    let md = 0, mi = -1;
    for (let i = lo + 1; i < hi; i++) { const ap = P[i].clone().sub(A).setY(0); const d = Math.abs(ab.x * ap.z - ab.z * ap.x) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { rdpIdx(P, eps, lo, mi, out); rdpIdx(P, eps, mi, hi, out); return out; }
  }
  out.push(hi);
  return top ? out : out;
}
