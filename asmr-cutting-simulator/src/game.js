import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { makeShape, makeParts, splitPart, components, Part } from './geometry.js';
import { makeMaterial, surfColor } from './materials.js';
import { OBJECTS, byId } from './catalog.js';
import { TOOLS, buildToolModel } from './tools.js';
import { Audio } from './audio.js';
import { Particles } from './particles.js';
import { installLive } from './live.js';
import { Dice } from './dice.js';
import { installSquish } from './squish.js';

const GRAVITY = 55;          // world units are ~10 cm; slightly dreamy gravity
const BOARD = { hx: 3.6, hz: 2.4, h: 0.28 };
const MIN_PART_VOL = 2e-5;

// ============================================================ physics wrapper
// Rapier (WASM) gives real rigid-body behaviour to every piece: slices topple,
// cubes tumble, pieces can be pushed around. If WASM is unavailable we fall
// back to a simple "separate and rest" mode so the game still works.
class Physics {
  async init() {
    try {
      const R = await import('../vendor/rapier.es.js');
      await R.init();
      this.R = R;
      const w = this.world = new R.World({ x: 0, y: -GRAVITY, z: 0 });
      w.timestep = 1 / 60;
      const fixed = (hx, hy, hz, x, y, z, fr = 0.9) => w.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(fr));
      fixed(BOARD.hx, BOARD.h / 2, BOARD.hz, 0, -BOARD.h / 2, 0, 1.0);
      fixed(30, 0.5, 30, 0, -BOARD.h - 0.5, 0, 0.8);
      for (const [x, z, hx, hz] of [[14, 0, 0.5, 14], [-14, 0, 0.5, 14], [0, 14, 14, 0.5], [0, -14, 14, 0.5]]) fixed(hx, 3, hz, x, 2, z);
      this.ok = true;
    } catch (e) {
      console.warn('Rapier unavailable, using simple physics', e);
      this.ok = false;
    }
  }
  create(parts, pos, quat, lin, ang, density = 1) {
    if (!this.ok) return { sim: true, pos: pos.clone(), quat: quat.clone(), vel: lin ? lin.clone() : new THREE.Vector3() };
    const R = this.R;
    const desc = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinearDamping(0.5).setAngularDamping(1.1);
    const rb = this.world.createRigidBody(desc);
    let n = 0;
    for (const p of parts) {
      const pts = hullPoints(p);
      if (pts.length < 12) continue;
      const cd = R.ColliderDesc.convexHull(pts);
      if (!cd) continue;
      cd.setFriction(1.0).setRestitution(0.02).setDensity(density);
      this.world.createCollider(cd, rb); n++;
    }
    if (!n) rb.setEnabled(false);
    if (lin) rb.setLinvel({ x: lin.x, y: lin.y, z: lin.z }, true);
    if (ang) rb.setAngvel({ x: ang.x, y: ang.y, z: ang.z }, true);
    return { rb };
  }
  createHull(points, pos) {
    if (!this.ok) return { sim: true, pos: pos.clone(), quat: new THREE.Quaternion(), vel: new THREE.Vector3() };
    const R = this.R;
    const rb = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinearDamping(0.4).setAngularDamping(1.5));
    const cd = R.ColliderDesc.convexHull(new Float32Array(points));
    if (cd) this.world.createCollider(cd.setFriction(0.9).setRestitution(0.05).setDensity(0.4), rb);
    else this.world.createCollider(R.ColliderDesc.ball(0.05).setDensity(0.4), rb);
    return { rb };
  }
  remove(h) { if (h.rb) this.world.removeRigidBody(h.rb); }
  read(h, pos, quat) {
    if (h.sim) { pos.copy(h.pos); quat.copy(h.quat); return; }
    const t = h.rb.translation(), r = h.rb.rotation(); pos.set(t.x, t.y, t.z); quat.set(r.x, r.y, r.z, r.w);
  }
  vel(h) { if (h.sim) return h.vel.clone(); const v = h.rb.linvel(); return new THREE.Vector3(v.x, v.y, v.z); }
  angvel(h) { if (h.sim) return new THREE.Vector3(); const v = h.rb.angvel(); return new THREE.Vector3(v.x, v.y, v.z); }
  setVel(h, v) { if (h.sim) h.vel.copy(v); else h.rb.setLinvel({ x: v.x, y: v.y, z: v.z }, true); }
  step(dt, scale) {
    if (!this.ok) return;
    this.acc = (this.acc || 0) + dt;
    const st = 1 / 60;
    this.world.timestep = st * scale;
    let n = 0;
    while (this.acc >= st && n < 3) { this.world.step(); this.acc -= st; n++; }
    if (n === 3) this.acc = 0;
  }
  simStep(h, dt) {
    if (!h.sim) return;
    h.pos.addScaledVector(h.vel, dt);
    h.vel.multiplyScalar(Math.max(0, 1 - 6 * dt));
  }
}

function hullPoints(part) {
  // Even spatial sampling: one vertex per grid cell, so dense regions (a
  // squished dent, a fine cut) don't crowd out the corners that support the
  // piece. Cut (cap) vertices are always kept so cut faces collide exactly.
  const { mn, mx } = part.bounds();
  const cs = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 9 || 1;
  const seen = new Set(), out = [];
  for (const f of part.faces) {
    const keepAll = f.type === 1 && !part.deformed;
    for (let i = 0; i < f.pts.length; i += 3) {
      const x = f.pts[i], y = f.pts[i + 1], z = f.pts[i + 2];
      const k = keepAll ? 'c' + Math.round(x * 500) + ',' + Math.round(y * 500) + ',' + Math.round(z * 500)
        : Math.floor((x - mn[0]) / cs) + ',' + Math.floor((y - mn[1]) / cs) + ',' + Math.floor((z - mn[2]) / cs);
      if (seen.has(k)) continue; seen.add(k); out.push(x, y, z);
    }
  }
  // extremes along the axes are always part of the hull
  for (let a = 0; a < 3; a++) for (const pick of [mn, mx]) {
    let best = null, bd = Infinity;
    for (const f of part.faces) for (let i = 0; i < f.pts.length; i += 3) { const d = Math.abs(f.pts[i + a] - pick[a]); if (d < bd) { bd = d; best = [f.pts[i], f.pts[i + 1], f.pts[i + 2]]; } }
    if (best) out.push(...best);
  }
  return new Float32Array(out);
}

// Groups: 0 = outer surface, 1 = knife/peel cut surface, 2 = internal glue
// faces (drawn with a depth offset so they never show as seams at the surface,
// but still render where they are exposed, e.g. the walls of a groove).
function buildGeometry(parts) {
  const P = [[], [], []], N = [[], [], []];
  for (const part of parts) for (const f of part.faces) {
    const g = f.type === 0 ? 0 : f.type === 1 ? 1 : 2;
    const p = f.pts, m = p.length / 3, nr = f.nrm;
    const fn = f.plane ? f.plane.n : null;
    for (let i = 1; i < m - 1; i++) for (const k of [0, i, i + 1]) {
      P[g].push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
      if (nr) N[g].push(nr[k * 3], nr[k * 3 + 1], nr[k * 3 + 2]);
      else if (fn) N[g].push(fn[0], fn[1], fn[2]);
      else N[g].push(0, 1, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  const total = P[0].length + P[1].length + P[2].length;
  const pos = new Float32Array(total), nrm = new Float32Array(total);
  let off = 0;
  for (let g = 0; g < 3; g++) {
    pos.set(P[g], off); nrm.set(N[g], off);
    geo.addGroup(off / 3, P[g].length / 3, g === 2 ? 2 : g);
    off += P[g].length;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion();

export function bodyMaterials(def, shared) {
  const glue = makeMaterial(def.in, def.mat, shared);
  glue.polygonOffset = true; glue.polygonOffsetFactor = 2; glue.polygonOffsetUnits = 2;
  return [makeMaterial(def.out, def.mat, shared), makeMaterial(def.in, def.mat, shared), glue];
}

// ============================================================ the game
export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas; this.ui = ui;
    this.bodies = [];
    this.curls = [];
    this.undoStack = [];
    this.audio = new Audio();
    this.time = { value: 0 };
    this.slow = false;
    this.mode = 'vertical'; // vertical | view
    this.tilt = 0;          // degrees
    this.guide = 'free';    // free | long | cross  (straight-line cutting guides)
    this.toolId = 'chef';
    this.finish = 'steel'; this.handle = 'walnut';
    this.grabMode = false;
    this.settings = { sound: true, haptics: true, quality: 'high' };
    this.stats = { cuts: 0 };
    this.stroke = null;
    this.pointers = new Map();
    this.cam = { theta: 0.0, phi: 0.78, r: 6.6, target: new THREE.Vector3(0, 0.35, 0) };
    this.camGoal = { ...this.cam, target: this.cam.target.clone() };
  }

  async init() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyQuality();
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#ece5dc');
    scene.fog = new THREE.Fog('#ece5dc', 16, 34);
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);

    const hemi = new THREE.HemisphereLight('#fff8f0', '#d8c8b8', 0.9); scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff4e6', 2.2);
    sun.position.set(3.5, 8, 4.5); sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 20 });
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#e8eeff', 0.5); fill.position.set(-5, 4, -3); scene.add(fill);

    this.buildBoard();
    this.particles = new Particles(scene);
    this.dice = new Dice(scene, BOARD);

    // stroke trail ribbon
    this.trail = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, depthTest: false }));
    this.trail.renderOrder = 10; this.trail.frustumCulled = false; scene.add(this.trail);

    this.physics = new Physics();
    await this.physics.init();

    this.raycaster = new THREE.Raycaster();
    this.loadPrefs();
    this.setTool(this.toolId);
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock();
    this.renderer.compile(this.scene, this.camera); // particles, cubes, board: no compile hitch later
    // particles and cubes start empty, so draw one of each once to finish their shaders
    const pools = Object.values(this.particles.pools).map(P => P.mesh);
    for (const m of [...pools, this.dice.mesh]) { m.count = 1; m.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, -2, 0)); m.instanceMatrix.needsUpdate = true; }
    this.warmDraw(new THREE.Group());
    for (const m of [...pools, this.dice.mesh]) m.count = 0;
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // Phones start at a modest resolution; the frame loop then adapts it to keep
  // the game smooth (see adaptQuality).
  applyQuality() {
    const hi = this.settings.quality === 'high';
    this.mobile = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
    // sharp by default: render at the screen's real density (up to 2x)
    this.prCap = Math.min(window.devicePixelRatio, hi ? 2 : 1.25);
    this.prMin = Math.min(this.prCap, hi ? 1.5 : 1);
    this.pr = this.prCap;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.shadowMap.enabled = true;
    if (this.sun) { this.sun.castShadow = true; this.sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024); }
  }
  adaptQuality(rdt) {
    this.ft = this.ft ? this.ft * 0.95 + rdt * 0.05 : rdt;
    this.qT = (this.qT || 0) + rdt;
    // resizing the canvas is expensive: only adapt every few seconds, and never mid-action
    if (this.qT < 3 || this.stroke || this.sq || (this.dice && this.dice.awake > 0)) return;
    this.qT = 0;
    let pr = this.pr;
    // only step down, at most twice: every resize costs a visible hitch
    // a small step down only if it is really struggling, never below prMin (keeps it sharp)
    if (this.ft > 1 / 30 && pr > this.prMin && (this.prSteps || 0) < 1) { pr = Math.max(this.prMin, pr - 0.25); this.prSteps = (this.prSteps || 0) + 1; }
    if (pr !== this.pr) { this.pr = pr; this.renderer.setPixelRatio(pr); this.resize(); }
    // Note: shadows are never switched at runtime: changing the light setup
    // makes every shader recompile, which freezes the game for a moment.
  }

  buildBoard() {
    // procedural maple board texture
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#d9b98d'); grd.addColorStop(1, '#cfae80');
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 140; i++) {
      const y = Math.random() * 512, a = 0.03 + Math.random() * 0.06;
      g.strokeStyle = Math.random() < 0.5 ? `rgba(140,95,55,${a})` : `rgba(255,240,215,${a})`;
      g.lineWidth = 0.6 + Math.random() * 2.2; g.beginPath();
      for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y + Math.sin(x / 140 + i) * 6 + Math.sin(x / 37 + i * 3) * 1.5);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const geo = new THREE.BoxGeometry(BOARD.hx * 2, BOARD.h, BOARD.hz * 2, 1, 1, 1);
    const board = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 }));
    board.position.y = -BOARD.h / 2; board.receiveShadow = true; board.castShadow = true;
    this.scene.add(board);
    // juice groove ring
    const groove = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 64), new THREE.MeshStandardMaterial({ color: '#b8956a', roughness: 0.8 }));
    groove.rotation.x = Math.PI / 2; groove.scale.set(BOARD.hx - 0.25, BOARD.hz - 0.25, 1); groove.position.y = 0.001; groove.visible = false;
    this.scene.add(groove);
    // linen table
    const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#e9e1d6', roughness: 0.95 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -BOARD.h; table.receiveShadow = true; this.scene.add(table);
  }

  // ---------------------------------------------------------- bodies
  addBody(def, parts, pos, quat, lin, ang) {
    const h = this.physics.create(parts, pos, quat, lin, ang, def.mat.density || 1);
    const geo = buildGeometry(parts);
    const uni = { wob: { value: 0 }, base: { value: geo.boundingBox.min.y }, height: { value: geo.boundingBox.max.y - geo.boundingBox.min.y },
      press: { value: new THREE.Vector4(0, 0, 0, 1) }, pressH: { value: 0 }, pressU: { value: new THREE.Vector3(0, 1, 0) }, pressBase: { value: 0 }, pressBulge: { value: 0.6 } };
    const shared = { wob: uni.wob, time: this.time, base: uni.base, height: uni.height, press: uni.press, pressH: uni.pressH, pressU: uni.pressU, pressBase: uni.pressBase, pressBulge: uni.pressBulge };
    const mats = bodyMaterials(def, shared);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    const b = { def, parts, h, mesh, uni, wobV: 0 };
    this.physics.read(h, mesh.position, mesh.quaternion);
    mesh.userData.body = b;
    this.bodies.push(b);
    return b;
  }
  removeBody(b) {
    this.physics.remove(b.h);
    this.scene.remove(b.mesh);
    b.mesh.geometry.dispose(); for (const m of b.mesh.material) m.dispose();
    this.bodies.splice(this.bodies.indexOf(b), 1);
  }
  clearAll() { while (this.bodies.length) this.removeBody(this.bodies[0]); while (this.curls.length) this.removeCurl(this.curls[0]); this.particles.clear(); if (this.dice) this.dice.clear(); }

  spawn(id, drop = true) {
    const def = byId[id] || OBJECTS[0];
    this.current = def;
    this.clearAll();
    this.undoStack = [];
    const parts = makeParts(def.shape), part = parts[0];
    this.addBody(def, parts, new THREE.Vector3(0, drop ? 0.35 : 0.002, 0), new THREE.Quaternion());
    this.prewarm(def);
    if (drop) setTimeout(() => { this.audio.tick(0.22); this.wobbleAll(0.5); }, 170);
    const bb = part.bounds(); const size = Math.max(bb.mx[0] - bb.mn[0], bb.mx[1] - bb.mn[1], bb.mx[2] - bb.mn[2]);
    this.audio.objPitch = THREE.MathUtils.clamp(2.2 / size, 0.8, 1.35);
    this.camGoal.target = new THREE.Vector3(0, 0.35, 0);
    this.ui.onObject(def, 1);
    this.savePrefs();
  }
  // Compile every shader variant this object can need (pieces, cut faces,
  // shavings, chunks) right away, so no cut ever waits for a shader compile.
  prewarm(def) {
    this.warm = this.warm || new Map();
    if (this.warm.has(def.id)) return;
    const shared = { wob: { value: 0 }, time: this.time, base: { value: 0 }, height: { value: 1 } };
    const mats = [...bodyMaterials(def, shared), makeMaterial(def.out, def.mat, shared, { mpos: true, double: true }), makeMaterial(def.in, def.mat, shared, { mpos: true, double: true })];
    const g = new THREE.Group(), geo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    geo.setAttribute('mpos', geo.attributes.position.clone());
    // both shadow-receiving variants (pieces receive shadows, shavings don't)
    for (const m of mats) for (const rs of [true, false]) { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = rs; g.add(mesh); }
    this.warmDraw(g);
    this.warm.set(def.id, mats); // keep them alive so their programs stay cached
    if (this.warm.size > 24) { const [k, ms] = this.warm.entries().next().value; ms.forEach(m => m.dispose()); this.warm.delete(k); }
  }
  // Really draw `obj` once into a tiny offscreen target (plus its shadow pass),
  // so drivers that compile shaders lazily do it now instead of mid-cut.
  warmDraw(obj, inPlace = false) {
    try {
      const r = this.renderer;
      const parent = obj.parent, pos = obj.position.clone();
      if (!inPlace) this.scene.add(obj);
      obj.position.copy(this.cam.target);
      // never let frustum culling skip the warm-up draw (e.g. before the camera is placed)
      const culled = [];
      obj.traverse(o => { if (o.isMesh) { culled.push([o, o.frustumCulled]); o.frustumCulled = false; } });
      this.camera.updateMatrixWorld();
      // draw into a single on-screen pixel (same output format as the real
      // frame, so it compiles exactly the shaders the game will use)
      const vp = r.getViewport(new THREE.Vector4()), sc = r.getScissor(new THREE.Vector4()), st = r.getScissorTest();
      r.setViewport(0, 0, 1, 1); r.setScissor(0, 0, 1, 1); r.setScissorTest(true);
      r.shadowMap.needsUpdate = true;
      r.render(this.scene, this.camera);
      r.setViewport(vp); r.setScissor(sc); r.setScissorTest(st);
      for (const [o, f] of culled) o.frustumCulled = f;
      obj.position.copy(pos);
      if (!inPlace) { this.scene.remove(obj); if (parent) parent.add(obj); }
    } catch { /* best effort */ }
  }
  reset() { if (this.current) { this.spawn(this.current.id); this.audio.ui(); } }

  snapshot() {
    return this.bodies.map(b => {
      const p = new THREE.Vector3(), q = new THREE.Quaternion(); this.physics.read(b.h, p, q);
      return { def: b.def, parts: b.parts, p, q };
    });
  }
  pushUndo() { this.undoStack.push(this.snapshot()); if (this.undoStack.length > 30) this.undoStack.shift(); this.ui.onUndo(this.undoStack.length); }
  undo() {
    const s = this.undoStack.pop(); if (!s) return;
    if (s.curls !== undefined) while (this.curls.length > s.curls) this.removeCurl(this.curls[this.curls.length - 1]);
    if (s.dice !== undefined) this.dice.truncate(s.dice);
    while (this.bodies.length) this.removeBody(this.bodies[0]);
    for (const e of s) this.addBody(e.def, e.parts, e.p, e.q);
    this.audio.ui(); this.ui.onUndo(this.undoStack.length);
  }

  wobbleAll(a) { for (const b of this.bodies) if (b.def.wob) b.wobV = Math.max(b.wobV, a * b.def.wob); }

  // ---------------------------------------------------------- cutting core
  // A segment: cut plane {n,c} and region bounds [{n,c}] (inside: n·x - c >= 0)
  localPlane(b, n, c) {
    const pos = b.mesh.position, q = b.mesh.quaternion;
    const ln = _v.set(n[0], n[1], n[2]).applyQuaternion(_q.copy(q).invert());
    return { n: [ln.x, ln.y, ln.z], c: c - (n[0] * pos.x + n[1] * pos.y + n[2] * pos.z) };
  }
  // Glue-split `part` down to the region; returns {inside, outside[]}
  clipRegion(part, planes) {
    // cheap reject: is the part's bounding box entirely outside one plane?
    const { mn, mx } = part.bounds();
    for (const pl of planes) {
      const n = pl.n;
      const hiB = (n[0] > 0 ? mx[0] : mn[0]) * n[0] + (n[1] > 0 ? mx[1] : mn[1]) * n[1] + (n[2] > 0 ? mx[2] : mn[2]) * n[2] - pl.c;
      if (hiB <= 2e-5) return { inside: null, outside: [part] };
    }
    for (const pl of planes) { const [, hi] = part.range(pl.n, pl.c); if (hi <= 2e-5) return { inside: null, outside: [part] }; }
    const outside = []; let cur = part;
    for (const pl of planes) {
      const r = splitPart(cur, pl.n, pl.c, 2);
      if (r.back) outside.push(r.back);
      cur = r.front; if (!cur) break;
    }
    return { inside: cur, outside };
  }

  knifeCut(segs, tool) {
    const touched = new Map();
    for (const seg of segs) {
      for (const b of this.bodies) {
        const cp = this.localPlane(b, seg.n, seg.c);
        const bounds = seg.bounds.map(p => this.localPlane(b, p.n, p.c));
        let parts = touched.get(b) || b.parts, changed = false;
        const next = [];
        for (const part of parts) {
          const [lo, hi] = part.range(cp.n, cp.c);
          if (!(lo < -2e-5 && hi > 2e-5)) { next.push(part); continue; }
          const { inside, outside } = this.clipRegion(part, bounds);
          next.push(...outside);
          if (!inside) continue;
          const r = splitPart(inside, cp.n, cp.c, 1);
          if (r.front) next.push(r.front); if (r.back) next.push(r.back);
          changed = true;
        }
        if (changed) touched.set(b, next);
      }
    }
    return this.applyChanges(touched, segs, tool);
  }

  // Shave / carve: remove a layer of given depth under the stroke within width.
  carveCut(path, tool) {
    const touched = new Map(); const removed = [];
    const up = new THREE.Vector3(0, 1, 0);
    const w = tool.width * (this.ui.widthScale || 1), depth = tool.depth * (this.ui.depthScale || 1);
    for (let i = 0; i < path.length - 1; i++) {
      const A = path[i], B = path[i + 1];
      const t = B.clone().sub(A); t.y = 0; if (t.lengthSq() < 1e-8) continue; t.normalize();
      const side = new THREE.Vector3().crossVectors(t, up).normalize();
      const tPrev = i > 0 ? path[i].clone().sub(path[i - 1]).setY(0).normalize() : t;
      const tNext = i < path.length - 2 ? path[i + 2].clone().sub(path[i + 1]).setY(0).normalize() : t;
      const ms = t.clone().add(tPrev).normalize(), me = t.clone().add(tNext).normalize();
      const planes = [
        { n: [side.x, side.y, side.z], c: side.dot(A) - w / 2 },
        { n: [-side.x, -side.y, -side.z], c: -side.dot(A) - w / 2 },
        { n: [ms.x, 0, ms.z], c: ms.x * A.x + ms.z * A.z },
        { n: [-me.x, 0, -me.z], c: -(me.x * B.x + me.z * B.z) },
      ];
      // phase 1: clip all parts to the region
      const inRegion = [];
      for (const b of this.bodies) {
        const lp = planes.map(p => this.localPlane(b, p.n, p.c));
        const parts = touched.get(b) || b.parts; const next = []; let changed = false;
        for (const part of parts) {
          const { inside, outside } = this.clipRegion(part, lp);
          if (!inside) { next.push(part); continue; }
          next.push(...outside, inside); inRegion.push({ b, part: inside }); changed = true;
        }
        if (changed) touched.set(b, next);
      }
      if (!inRegion.length) continue;
      // phase 2: top of material inside the region (world y)
      let top = -Infinity;
      for (const { b, part } of inRegion) {
        const m = b.mesh.matrixWorld.elements;
        for (const f of part.faces) for (let k = 0; k < f.pts.length; k += 3) {
          const y = m[1] * f.pts[k] + m[5] * f.pts[k + 1] + m[9] * f.pts[k + 2] + m[13];
          if (y > top) top = y;
        }
      }
      const floorY = Math.max(top - depth, 0.015);
      if (top - floorY < 0.004) continue;
      // phase 3: cut horizontally, remove the chip above
      for (const { b, part } of inRegion) {
        const lp = this.localPlane(b, [0, -1, 0], -floorY); // inside (front) = below floor
        const r = splitPart(part, lp.n, lp.c, 1);
        const list = touched.get(b); const idx = list.indexOf(part);
        if (r.back) { removed.push({ b, part: r.back, mid: A.clone().lerp(B, 0.5).setY(top), t }); }
        if (idx >= 0) { if (r.front) list[idx] = r.front; else list.splice(idx, 1); }
      }
    }
    const n = this.applyChanges(touched, null, tool, true);
    // spawn shavings for removed material, proportional to volume
    let vol = 0;
    for (const r of removed) {
      const V = r.part.massProps().V; vol += V;
      const cnt = Math.min(14, 1 + Math.round(V * 900));
      const def = r.b.def;
      for (let i = 0; i < cnt; i++) {
        const at = r.mid.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.04, (Math.random() - 0.5) * 0.25));
        const v = r.t.clone().multiplyScalar(0.6 + Math.random()).add(new THREE.Vector3((Math.random() - .5) * .8, 0.6 + Math.random() * 1.2, (Math.random() - .5) * .8));
        const col = Math.random() < 0.4 ? surfColor(def.out) : surfColor(def.in);
        this.particles.spawn(def.fx === 'none' || def.fx === 'juice' ? 'shave' : (def.fx === 'jelly' ? 'jelly' : def.fx), at, v, col, { scale: tool.kind === 'shave' ? 1 : 0.8 });
      }
    }
    return n + (removed.length ? 1 : 0);
  }

  // Rebuild touched bodies: find connected components, split into new bodies.
  applyChanges(touched, segs, tool, carve = false) {
    let pieces = 0;
    for (const [b, partsRaw] of touched) {
      const parts = partsRaw.filter(p => p.massProps().V > MIN_PART_VOL);
      const pos = b.mesh.position.clone(), quat = b.mesh.quaternion.clone();
      const lin = this.physics.vel(b.h), ang = this.physics.angvel(b.h);
      const def = b.def;
      this.removeBody(b);
      if (!parts.length) continue;
      const comps = components(parts);
      pieces += comps.length - 1;
      let VT = 0; const CT = new THREE.Vector3();
      for (const p of parts) { const mp = p.massProps(); VT += mp.V; CT.addScaledVector(_v.set(...mp.c), mp.V); }
      CT.divideScalar(Math.max(VT, 1e-9)).applyQuaternion(quat).add(pos);
      // separation direction: along the cut plane normal nearest each component
      for (const comp of comps) {
        let V = 0; const c = new THREE.Vector3();
        for (const p of comp) { const mp = p.massProps(); V += mp.V; c.addScaledVector(_v.set(...mp.c), mp.V); }
        if (V < 2e-4 && comps.length > 1) { // tiny crumb -> particle
          const wc = c.divideScalar(Math.max(V, 1e-9)).applyQuaternion(quat).add(pos);
          this.particles.spawn(def.fx === 'juice' || def.fx === 'none' ? 'crumb' : def.fx, wc, new THREE.Vector3(0, 0.5, 0), surfColor(def.in));
          continue;
        }
        c.divideScalar(V);
        const wc = c.clone().applyQuaternion(quat).add(pos);
        const v = lin.clone(), a = ang.clone();
        if (comps.length > 1 && segs) {
          // nearest segment plane -> push away from it
          let best = null, bd = Infinity;
          for (const s of segs) { const d = s.n[0] * wc.x + s.n[1] * wc.y + s.n[2] * wc.z - s.c; if (Math.abs(d) < bd) { bd = Math.abs(d); best = { s, d }; } }
          if (best) {
            const dir = new THREE.Vector3(best.s.n[0], 0, best.s.n[2]);
            if (dir.lengthSq() > 1e-6) {
              dir.normalize();
              // spread pieces outward from the object's centre along the cut normal,
              // farther pieces move more -> neighbours separate instead of colliding
              let dist = wc.clone().sub(CT).dot(dir);
              if (Math.abs(dist) < 0.02) dist = best.d;
              const sgn = dist >= 0 ? 1 : -1;
              dir.multiplyScalar(sgn);
              const k = (tool.push || 1) * (0.7 + Math.min(Math.abs(dist), 1.5) * 1.6);
              v.addScaledVector(dir, k);
              v.y += 0.6 * (tool.push || 1);
              // thin slices topple away from the cut, like real slices do
              let lo = Infinity, hi = -Infinity, ylo = Infinity, yhi = -Infinity;
              const e = new THREE.Vector3();
              for (const p of comp) for (const f of p.faces) for (let i = 0; i < f.pts.length; i += 9) {
                e.set(f.pts[i], f.pts[i + 1], f.pts[i + 2]).applyQuaternion(quat).add(pos);
                const d = e.dot(dir); if (d < lo) lo = d; if (d > hi) hi = d; if (e.y < ylo) ylo = e.y; if (e.y > yhi) yhi = e.y;
              }
              const thick = hi - lo, height = yhi - ylo;
              if (thick < height * 0.9) a.add(new THREE.Vector3(0, 1, 0).cross(dir).multiplyScalar(3.5 + 4 * (1 - thick / height)));
            }
          }
        }
        const nb = this.addBody(def, comp, pos, quat, v, a);
        if (def.wob) nb.wobV = Math.max(nb.wobV, 0.9 * def.wob);
        if (nb.h.sim && comps.length > 1) nb.h.vel.copy(v.setY(0)).multiplyScalar(0.5);
      }
    }
    if (touched.size) { this.stats.cuts++; this.savePrefs(); this.ui.onCut(this.stats.cuts); }
    return pieces;
  }

  // ---------------------------------------------------------- input
  bindInput() {
    const el = this.canvas;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => this.onDown(e));
    el.addEventListener('pointermove', e => this.onMove(e));
    el.addEventListener('pointerup', e => this.onUp(e));
    el.addEventListener('pointercancel', e => this.onUp(e, true));
    el.addEventListener('wheel', e => { e.preventDefault(); this.camGoal.r = THREE.MathUtils.clamp(this.camGoal.r * (1 + e.deltaY * 0.0012), 3, 14); }, { passive: false });
  }
  ndc(x, y) { const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); }
  ray(x, y) { this.raycaster.setFromCamera(this.ndc(x, y), this.camera); return this.raycaster.ray.clone(); }
  hitBody(x, y) {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const hits = this.raycaster.intersectObjects(this.bodies.map(b => b.mesh), false);
    return hits[0] || null;
  }
  onDown(e) {
    this.audio.unlock();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    this.ui.hideHint();
    const orbitBtn = e.pointerType === 'mouse' && (e.button === 2 || e.button === 1);
    if (this.pointers.size >= 2 || orbitBtn || this.ui.cameraMode) {
      if (this.stroke) this.cancelStroke();
      if (this.grab) this.endGrab();
      if (this.sq) this.squishEnd();
      this.gesture = { orbit: true }; return;
    }
    if (this.grabMode) { this.beginGrab(e); return; }
    for (const b of this.bodies) b.wbox = null;
    if (this.tool.kind === 'squish') { this.squishBegin(e); return; }
    if (this.liveActive()) this.liveBegin(e); else this.beginStroke(e);
  }
  onMove(e) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.gesture) {
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.gesture.d) this.camGoal.r = THREE.MathUtils.clamp(this.camGoal.r * this.gesture.d / d, 3, 14);
        this.gesture.d = d;
        this.camGoal.theta -= dx * 0.0045 / 2; this.camGoal.phi = THREE.MathUtils.clamp(this.camGoal.phi - dy * 0.004 / 2, 0.03, 1.38);
      } else {
        this.camGoal.theta -= dx * 0.006; this.camGoal.phi = THREE.MathUtils.clamp(this.camGoal.phi - dy * 0.005, 0.03, 1.38);
      }
      return;
    }
    if (this.grab) { this.moveGrab(e); return; }
    if (this.sq) { this.squishMove(e); return; }
    if (this.stroke) { if (this.stroke.live) this.liveMove(e); else this.moveStroke(e); }
  }
  onUp(e, cancel) {
    this.pointers.delete(e.pointerId);
    if (this.gesture) { if (this.pointers.size === 0) this.gesture = null; else this.gesture.d = 0; return; }
    if (this.grab) { this.endGrab(); return; }
    if (this.sq) { this.squishEnd(); return; }
    if (this.stroke) { if (this.stroke.live) this.liveEnd(); else if (cancel) this.cancelStroke(); else this.endStroke(); }
  }

  get tool() { return TOOLS.find(t => t.id === this.toolId); }

  // reference height for projecting the stroke onto the object's surface
  workHeight() {
    let h = 0.3;
    for (const b of this.bodies) { const bb = new THREE.Box3().setFromObject(b.mesh); if (Math.abs(bb.getCenter(_v).x) < 3) h = Math.max(h, bb.max.y); }
    return h;
  }
  projectH(x, y, h) {
    const r = this.ray(x, y); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -h);
    return r.intersectPlane(pl, new THREE.Vector3());
  }
  beginStroke(e) {
    const hit = this.hitBody(e.clientX, e.clientY);
    const h0 = hit && hit.face && hit.face.normal.y > 0.3 ? hit.point.y : this.workHeight();
    this.stroke = { pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }], h: h0, hits: [], lastT: performance.now(), inMat: null, speed: 0 };
    this.knife.visible = true; this.knifeLift = 1;
    this.moveStroke(e, true);
  }
  moveStroke(e, first) {
    const s = this.stroke, now = performance.now();
    const last = s.pts[s.pts.length - 1];
    const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    if (!first && dist < 2) return;
    const dt = Math.max(1, now - last.t) / 1000;
    if (!first) s.pts.push({ x: e.clientX, y: e.clientY, t: now });
    const pxs = dist / dt / Math.max(window.innerWidth, 400);
    s.speed = s.speed * 0.7 + pxs * 0.3;
    s.dirty = true;
    if (first) this.strokeTick();
  }
  // Raycast, feedback and trail run at most once per frame, however fast the finger moves.
  strokeTick() {
    const s = this.stroke; if (!s || !s.dirty) return;
    s.dirty = false;
    const now = performance.now();
    const pt = s.pts[s.pts.length - 1];
    const hit = this.hitBody(pt.x, pt.y);
    s.inMat = hit ? hit.object.userData.body : null;
    if (hit) {
      s.hits.push(hit.point.clone());
      if (hit.face && hit.face.normal.y > 0.3 && hit.point.y > s.h + 0.02 && this.mode === 'vertical') s.h = Math.max(s.h, hit.point.y);
      const b = s.inMat;
      if (b.def.fx !== 'none' && Math.random() < 0.18 * this.tool.weight) {
        const type = b.def.fx === 'shave' ? 'crumb' : b.def.fx;
        this.particles.spawn(type, hit.point, new THREE.Vector3((Math.random() - .5) * .6, .5 + Math.random(), (Math.random() - .5) * .6), surfColor(b.def.in), { scale: 0.6 });
      }
      if (this.settings.haptics && now - (this.lastBuzz || 0) > 70) { this.ui.buzz(b.def.snd === 'crunch' || b.def.snd === 'crisp' ? 8 : 4); this.lastBuzz = now; }
      if (b.def.wob && Math.random() < 0.2) b.wobV = Math.max(b.wobV, 0.25 * b.def.wob);
    }
    this.updateTrail();
  }
  cancelStroke() { this.stroke = null; this.trail.visible = false; this.knife.visible = false; }

  // screen polyline -> simplified, tool-modified screen polyline
  strokePath(s = this.stroke) {
    let P = rdp(s.pts.map(p => [p.x, p.y]), 5);
    const tool = this.tool;
    if (tool.path) {
      // pixels per world unit at current zoom
      const ppu = this.canvas.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.cam.r);
      const amp = 0.05 * ppu, wl = 0.2 * ppu;
      const out = []; let acc = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, ay] = P[i], [bx, by] = P[i + 1]; const L = Math.hypot(bx - ax, by - ay); if (L < 1) continue;
        const tx = (bx - ax) / L, ty = (by - ay) / L, nx = -ty, ny = tx;
        const step = tool.path === 'zigzag' ? wl / 2 : wl / 8;
        for (let d = 0; d < L; d += step) {
          const ph = (acc + d) / wl;
          const o = tool.path === 'zigzag' ? (Math.round(ph * 2) % 2 ? amp : -amp) : Math.sin(ph * Math.PI * 2) * amp;
          out.push([ax + tx * d + nx * o, ay + ty * d + ny * o]);
        }
        acc += L;
      }
      out.push(P[P.length - 1]); P = out;
    }
    if (P.length > 64) P = rdp(P, 2).slice(0, 64);
    return P;
  }

  // Lengthwise / across guides: the stroke is snapped to a perfectly straight line
  // along (or across) the long axis of the piece you are cutting. The line spans
  // the whole piece, so even a short swipe cuts all the way through it.
  guideActive() { return this.guide !== 'free' && (this.mode === 'vertical' || this.tool.kind !== 'knife'); }
  guidePath(s, hOff = 0) {
    const a = s.pts[0], z = s.pts[s.pts.length - 1];
    const A = this.projectH(a.x, a.y, s.h), Z = this.projectH(z.x, z.y, s.h);
    if (!A || !Z) return null;
    const mid = A.clone().add(Z).multiplyScalar(0.5);
    // target piece: the one under the stroke, else the nearest to its middle
    let body = s.inMat && this.bodies.includes(s.inMat) ? s.inMat : null;
    if (!body) { let bd = Infinity; for (const b of this.bodies) { const d = b.mesh.position.distanceToSquared(mid); if (d < bd) { bd = d; body = b; } } }
    let axis = new THREE.Vector3(1, 0, 0);
    if (body) {
      const bb = body.mesh.geometry.boundingBox;
      const local = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      const w = local.applyQuaternion(body.mesh.quaternion).setY(0);
      if (w.lengthSq() > 0.05) axis = w.normalize();
    }
    const dir = this.guide === 'long' ? axis : new THREE.Vector3(-axis.z, 0, axis.x);
    // extent: the swipe itself, widened to cover every piece the line crosses
    let lo = Math.min(A.clone().sub(mid).dot(dir), Z.clone().sub(mid).dot(dir)), hi = Math.max(A.clone().sub(mid).dot(dir), Z.clone().sub(mid).dot(dir));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (const b of this.bodies) {
      const box = new THREE.Box3().setFromObject(b.mesh);
      const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
      const off = c.clone().sub(mid);
      if (Math.abs(off.dot(side)) > r) continue;
      const t = off.dot(dir);
      if (t + r < lo - 0.3 || t - r > hi + 0.3) continue;
      lo = Math.min(lo, t - r); hi = Math.max(hi, t + r);
    }
    lo -= 0.15; hi += 0.15;
    const P0 = mid.clone().addScaledVector(dir, lo), P1 = mid.clone().addScaledVector(dir, hi);
    P0.y = P1.y = s.h + hOff;
    const tool = this.tool;
    if (!tool.path) return [P0, P1];
    const out = [], L = hi - lo, amp = 0.05, wl = 0.2, step = tool.path === 'zigzag' ? wl / 2 : wl / 8;
    for (let d = 0; d <= L + 1e-6; d += step) {
      const ph = d / wl, o = tool.path === 'zigzag' ? (Math.round(ph * 2) % 2 ? amp : -amp) : Math.sin(ph * Math.PI * 2) * amp;
      out.push(P0.clone().addScaledVector(dir, d).addScaledVector(side, o));
    }
    return out;
  }

  // Build world-space cut segments from the screen path.
  buildSegments(P, stroke, guided) {
    const segs = [];
    if (this.mode === 'view' && !guided) {
      const eye = this.camera.position.clone();
      const rays = P.map(([x, y]) => this.ray(x, y).direction);
      const nS = [], mS = [];
      for (let i = 0; i < P.length - 1; i++) {
        const n = new THREE.Vector3().crossVectors(rays[i], rays[i + 1]);
        if (n.lengthSq() < 1e-12) { nS.push(null); continue; }
        n.normalize(); nS.push(n);
      }
      const bound = (i, n, dirRef) => { const m = new THREE.Vector3().crossVectors(n, rays[i]).normalize(); if (m.dot(dirRef) < 0) m.negate(); return m; };
      for (let i = 0; i < P.length - 1; i++) {
        const n = nS[i]; if (!n) continue;
        const dir = rays[i + 1].clone().sub(rays[i]);
        let ms = bound(i, n, dir), me = bound(i + 1, n, dir);
        if (i > 0 && nS[i - 1]) { const pd = rays[i].clone().sub(rays[i - 1]); ms = ms.add(bound(i, nS[i - 1], pd)).normalize(); }
        if (i < P.length - 2 && nS[i + 1]) { const nd = rays[i + 2].clone().sub(rays[i + 1]); me = me.add(bound(i + 1, nS[i + 1], nd)).normalize(); }
        segs.push({ n: n.toArray(), c: n.dot(eye), bounds: [{ n: ms.toArray(), c: ms.dot(eye) }, { n: me.clone().negate().toArray(), c: -me.dot(eye) }] });
      }
      return segs;
    }
    const W = guided || P.map(([x, y]) => this.projectH(x, y, stroke.h)).filter(Boolean);
    const path = [];
    for (const w of W) if (!path.length || path[path.length - 1].distanceTo(w) > 0.01) path.push(w);
    if (path.length >= 2 && !guided) { // forgive near-misses: extend both ends by ~2 cm
      const a = path[0], a2 = path[1], z = path[path.length - 1], z2 = path[path.length - 2];
      a.add(a.clone().sub(a2).setY(0).setLength(0.2)); z.add(z.clone().sub(z2).setY(0).setLength(0.2));
    }
    this.lastWorldPath = path;
    const tiltR = THREE.MathUtils.degToRad(this.tilt);
    for (let i = 0; i < path.length - 1; i++) {
      const A = path[i], B = path[i + 1];
      const t = B.clone().sub(A).setY(0).normalize();
      const d = new THREE.Vector3(0, -1, 0).applyAxisAngle(t, tiltR);
      const n = new THREE.Vector3().crossVectors(t, d).normalize();
      const tp = i > 0 ? A.clone().sub(path[i - 1]).setY(0).normalize() : t;
      const tn = i < path.length - 2 ? path[i + 2].clone().sub(B).setY(0).normalize() : t;
      const ms = t.clone().add(tp).normalize(), me = t.clone().add(tn).normalize();
      segs.push({ n: n.toArray(), c: n.dot(A), bounds: [{ n: ms.toArray(), c: ms.dot(A) }, { n: me.clone().negate().toArray(), c: -me.dot(B) }] });
    }
    return segs;
  }

  endStroke() {
    this.strokeTick();
    const s = this.stroke; this.stroke = null;
    this.trailFade = 1;
    this.knifeLift = 0;
    const tool = this.tool;
    const moved = s.pts.length > 1 && Math.hypot(s.pts[s.pts.length - 1].x - s.pts[0].x, s.pts[s.pts.length - 1].y - s.pts[0].y) > 12;
    if (!moved) { // tap = poke
      this.knife.visible = false;
      const hit = this.hitBody(s.pts[0].x, s.pts[0].y);
      if (hit) { const b = hit.object.userData.body; b.wobV = Math.max(b.wobV, 0.8 * (b.def.wob || 0.1)); this.audio.finish(b.def.snd, { weight: 0.3 }, 0); }
      return;
    }
    const guided = this.guideActive() ? this.guidePath(s) : null;
    const P = this.strokePath(s);
    if (P.length < 2 && !guided) return;
    this.pushUndo();
    const before = this.bodies.length;
    let pieces = 0, prof = s.inMat ? s.inMat.def.snd : null;
    if (!prof && s.hits.length) { const hb = this.hitBody(s.pts[Math.floor(s.pts.length / 2)].x, s.pts[Math.floor(s.pts.length / 2)].y); if (hb) prof = hb.object.userData.body.def.snd; }
    if (tool.kind === 'knife') {
      const segs = this.buildSegments(P, s, guided);
      pieces = this.knifeCut(segs, tool);
    } else {
      const W = guided || P.map(([x, y]) => this.projectH(x, y, s.h)).filter(Boolean);
      pieces = this.carveCut(W, tool);
    }
    const changed = pieces > 0 || this.bodies.length !== before || this.lastChanged;
    // nothing actually cut -> drop the undo entry
    const snap = this.undoStack[this.undoStack.length - 1];
    if (snap && snap.length === this.bodies.length && snap.every((e, i) => this.bodies[i] && e.parts === this.bodies[i].parts)) { this.undoStack.pop(); this.ui.onUndo(this.undoStack.length); }
    if (s.hits.length) {
      const def = (s.inMat || this.bodies[0] || {}).def || this.current;
      this.audio.finish(prof || def.snd, tool, pieces);
      if (this.settings.haptics) this.ui.buzz(Math.round(10 + 14 * (tool.weight || 1)));
      // burst at a few points along the cut
      if (def.fx !== 'none' && tool.kind === 'knife') {
        const n = Math.min(4, s.hits.length);
        for (let i = 0; i < n; i++) {
          const hp = s.hits[Math.floor((i + 0.5) / n * s.hits.length)];
          this.particles.burst(def.fx === 'shave' ? 'crumb' : def.fx, hp, def.fx === 'juice' ? 4 : 3, () => surfColor(def.in), 0.8, 0.8, { scale: 0.8 });
        }
      }
    }
    void changed;
  }

  // ---------------------------------------------------------- grab tool
  beginGrab(e) {
    const hit = this.hitBody(e.clientX, e.clientY);
    if (!hit) return;
    const b = hit.object.userData.body;
    this.grab = { b, y: Math.max(hit.point.y, 0.3) + 0.25, off: hit.point.clone().sub(b.mesh.position).setY(0), target: hit.point.clone() };
    this.moveGrab(e);
  }
  moveGrab(e) {
    const g = this.grab; const p = this.projectH(e.clientX, e.clientY, g.y);
    if (p) { g.target.copy(p).sub(g.off); g.target.y = g.y - (g.b.mesh.position.y - g.b.mesh.position.y); }
  }
  endGrab() { this.grab = null; }
  stepGrab() {
    const g = this.grab; if (!g || !this.bodies.includes(g.b)) { this.grab = null; return; }
    const pos = g.b.mesh.position;
    const tgt = g.target.clone(); tgt.y = Math.max(0.35, pos.y < 0.4 ? 0.45 : pos.y);
    const v = tgt.sub(pos).multiplyScalar(9);
    v.y = (0.5 - pos.y) * 6;
    if (v.length() > 12) v.setLength(12);
    this.physics.setVel(g.b.h, v);
    if (g.b.def.wob) g.b.wobV = Math.max(g.b.wobV, 0.15 * g.b.def.wob);
  }

  // ---------------------------------------------------------- visuals
  setTool(id) {
    this.toolId = id;
    if (this.knife) this.scene.remove(this.knife);
    this.knife = buildToolModel(this.tool, this.finish, this.handle, { width: (this.tool.width || 0) * (this.ui.widthScale || 1), env: this.scene.environment });
    this.knife.visible = false; this.knife.traverse(o => { o.castShadow = true; });
    this.scene.add(this.knife);
    // compile the tool's shaders now, not on the first frame of the first cut
    this.knife.visible = true; this.warmDraw(this.knife, true); this.knife.visible = false;
    this.savePrefs();
  }
  updateTrail() {
    const s = this.stroke; if (!s) return;
    let P = s.pts.map(p => [p.x, p.y]);
    if (P.length > 2 && this.tool.path) P = this.strokePath(s);
    const guided = this.guideActive() && s.pts.length > 1 ? this.guidePath(s, 0.005) : null;
    const W = guided ? guided.slice() : [];
    if (!guided) for (const [x, y] of P) {
      let w;
      if (this.mode === 'view') { const r = this.ray(x, y); const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()).negate(), this.cam.target); w = r.intersectPlane(pl, new THREE.Vector3()); }
      else w = this.projectH(x, y, s.h + 0.005);
      if (w) W.push(w);
    }
    if (W.length < 2) { this.trail.visible = false; return; }
    const pos = [], up = new THREE.Vector3(0, 1, 0), half = 0.012;
    const camDir = this.camera.getWorldDirection(new THREE.Vector3());
    for (let i = 0; i < W.length - 1; i++) {
      const a = W[i], b = W[i + 1];
      const t = b.clone().sub(a); const side = new THREE.Vector3().crossVectors(t, this.mode === 'view' ? camDir : up).normalize().multiplyScalar(half);
      const a1 = a.clone().add(side), a2 = a.clone().sub(side), b1 = b.clone().add(side), b2 = b.clone().sub(side);
      pos.push(...a1.toArray(), ...b1.toArray(), ...a2.toArray(), ...a2.toArray(), ...b1.toArray(), ...b2.toArray());
    }
    this.trail.geometry.dispose();
    this.trail.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.trail.material.opacity = 0.55; this.trail.visible = true;
    // knife pose
    let tip = W[W.length - 1], prev = W[Math.max(0, W.length - 4)];
    if (guided) { // knife rides along the guide line under the finger, facing the swipe direction
      const a = guided[0], d = guided[guided.length - 1].clone().sub(a).normalize();
      const f = s.pts[s.pts.length - 1], f0 = s.pts[0];
      const fw = this.projectH(f.x, f.y, s.h), f0w = this.projectH(f0.x, f0.y, s.h);
      if (fw) tip = a.clone().addScaledVector(d, fw.clone().sub(a).dot(d));
      if (fw && f0w && fw.clone().sub(f0w).dot(d) < 0) d.negate();
      prev = tip.clone().sub(d);
    }
    const dir = tip.clone().sub(prev); if (this.mode !== 'view') dir.y = 0;
    if (dir.lengthSq() > 1e-6) this.knifeDir = dir.normalize();
    this.knifeTarget = tip.clone();
  }
  poseKnife(dt) {
    const k = this.knife; if (!k || !k.visible || !this.knifeTarget) return;
    const tool = this.tool;
    const dir = this.knifeDir || new THREE.Vector3(1, 0, 0);
    let target = this.knifeTarget.clone();
    if (this.mode === 'vertical') {
      const inMat = this.stroke && this.stroke.inMat;
      const sink = inMat ? Math.max(0.01, target.y - tool.h * 0.75) : target.y + 0.02;
      target.y = tool.kind === 'knife' ? sink : target.y - (tool.depth || 0) * 0.5;
    }
    if (this.knifeLift === 0) { target.y += 0.9; this.knifeFade = (this.knifeFade || 0) + dt * 3; if (this.knifeFade > 1) { k.visible = false; this.knifeFade = 0; return; } } else this.knifeFade = 0;
    k.position.lerp(target, 1 - Math.pow(0.0005, dt));
    if (tool.kind === 'dice' && this.knifeLift === 0) return; // lift straight up, keep the blade's orientation
    const up = this.mode === 'view' ? this.camera.getWorldDirection(new THREE.Vector3()).negate() : new THREE.Vector3(0, 1, 0).applyAxisAngle(dir, THREE.MathUtils.degToRad(-this.tilt));
    const z = new THREE.Vector3().crossVectors(dir, up).normalize();
    const y = new THREE.Vector3().crossVectors(z, dir).normalize();
    const m = new THREE.Matrix4().makeBasis(dir, y, z);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    k.quaternion.slerp(q, 1 - Math.pow(0.0001, dt));
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 48 : 36;
    this.camera.updateProjectionMatrix();
    this.portraitBoost = w < h ? 1.05 : 0.9;
  }
  setView(name) {
    const v = { top: [0.04, 6.4], angle: [0.78, 6.6], low: [1.22, 5.6] }[name];
    this.camGoal.phi = v[0]; this.camGoal.r = v[1];
  }

  frame() {
    const rdt = Math.min(this.clock.getDelta(), 0.05);
    this.adaptQuality(rdt);
    const scale = this.slow ? 0.25 : 1;
    const dt = rdt * scale;
    this.time.value += dt;
    this.audio.slow = scale;
    // camera smoothing
    const c = this.cam, g = this.camGoal, k = 1 - Math.pow(0.0008, rdt);
    c.theta += (g.theta - c.theta) * k; c.phi += (g.phi - c.phi) * k; c.r += (g.r - c.r) * k;
    if (g.target !== c.target) c.target.lerp(g.target, k * 0.8);
    const r = c.r * (this.portraitBoost || 1);
    this.camera.position.set(c.target.x + r * Math.sin(c.phi) * Math.sin(c.theta), c.target.y + r * Math.cos(c.phi), c.target.z + r * Math.sin(c.phi) * Math.cos(c.theta));
    this.camera.lookAt(c.target);
    if (this.shakeA > 0.0005) {
      const a = this.shakeA; this.shakeA *= Math.pow(0.002, rdt);
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a));
    }

    if (this.grab) this.stepGrab();
    if (this.stroke && this.stroke.live) this.liveUpdate(rdt); else this.strokeTick();
    this.squishUpdate(rdt);
    this.physics.step(rdt, scale);
    let landed = 0;
    for (const b of [...this.bodies]) {
      if (b.h.sim) this.physics.simStep(b.h, dt);
      this.physics.read(b.h, b.mesh.position, b.mesh.quaternion);
      if (b.mesh.position.y < -6) { this.removeBody(b); continue; }
      if (b.wobV > 0.0005) { b.wobV *= Math.pow(0.12, dt); b.uni.wob.value = b.wobV * 0.08; } else b.uni.wob.value = 0;
      // a piece that was falling and just stopped has landed: sound + a little squash
      if (!b.h.sim && this.settings.sound) {
        const vy = b.h.rb.linvel().y;
        if ((b.vyPrev || 0) < -1.6 && vy > -0.4 && landed < 3) {
          landed++;
          this.audio.land(Math.min(1, b.parts.reduce((a, p) => a + p.massProps().V, 0) * 1.5), b.def.snd);
          b.wobV = Math.max(b.wobV, 0.25 + (b.def.wob || 0));
        }
        b.vyPrev = vy;
      }
    }
    // cubes hitting the board and each other
    const imp = this.dice.takeImpacts();
    if (imp.length && this.settings.sound) this.audio.cubeHits(imp);
    for (const i of this.dice.takeCrumbled()) {
      const c = new THREE.Color().fromArray(this.dice.mesh.instanceColor.array, i * 3);
      const at = new THREE.Vector3(this.dice.p[i * 3], this.dice.p[i * 3 + 1], this.dice.p[i * 3 + 2]);
      for (let k = 0; k < 5; k++) this.particles.spawn('sand', at, new THREE.Vector3((Math.random() - .5) * 1.4, Math.random() * 0.9, (Math.random() - .5) * 1.4), c, { scale: 1.6 });
    }
    this.particles.update(dt);
    this.dice.update(dt);
    if (this.dice.count !== this._shownDice) { this._shownDice = this.dice.count; this.ui.onCubes && this.ui.onCubes(this.dice.count); }
    for (const c of this.curls) if (c.h) { this.physics.read(c.h, c.mesh.position, c.mesh.quaternion); }
    // continuous scraping sound while blade moves through material
    if (this.stroke && this.settings.sound) {
      const s = this.stroke; const idle = performance.now() - s.pts[s.pts.length - 1].t > 90;
      if (s.inMat && !idle) this.audio.scrape(s.inMat.def.snd, s.speed * 3, rdt, this.tool);
    }
    if (!(this.stroke && this.stroke.live) && this.tool.kind !== 'squish') this.poseKnife(rdt);
    if (!this.stroke && this.trail.visible) { this.trail.material.opacity *= Math.pow(0.02, rdt); if (this.trail.material.opacity < 0.02) this.trail.visible = false; }
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------- persistence
  loadPrefs() {
    try {
      const s = JSON.parse(localStorage.getItem('asmrcut') || '{}');
      if (s.settings) Object.assign(this.settings, s.settings);
      if (s.stats) Object.assign(this.stats, s.stats);
      if (s.toolId && TOOLS.find(t => t.id === s.toolId)) this.toolId = s.toolId;
      if (s.finish) this.finish = s.finish; if (s.handle) this.handle = s.handle;
      this.lastObject = s.object;
    } catch { /* storage unavailable */ }
    this.audio.enabled = this.settings.sound;
    this.applyQuality();
  }
  savePrefs() {
    try { localStorage.setItem('asmrcut', JSON.stringify({ settings: this.settings, stats: this.stats, toolId: this.toolId, finish: this.finish, handle: this.handle, object: this.current && this.current.id })); } catch { /* ignore */ }
  }
}

// Ramer–Douglas–Peucker polyline simplification
function rdp(P, eps) {
  if (P.length < 3) return P;
  const [ax, ay] = P[0], [bx, by] = P[P.length - 1];
  const L = Math.hypot(bx - ax, by - ay) || 1;
  let md = 0, mi = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((bx - ax) * (ay - P[i][1]) - (ax - P[i][0]) * (by - ay)) / L; if (d > md) { md = d; mi = i; } }
  if (md > eps) return rdp(P.slice(0, mi + 1), eps).slice(0, -1).concat(rdp(P.slice(mi), eps));
  return [P[0], P[P.length - 1]];
}

installLive(Game, { buildGeometry, bodyMaterials });
installSquish(Game, { buildGeometry });
export { Part };
