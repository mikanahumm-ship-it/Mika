import * as THREE from 'three';
import { makeShape } from './geometry.js';
import { byId } from './catalog.js';

// ============================================================================
// Salad mode: several objects on the board, a bowl beside it, and tossing.
//
//  * addObject() places another object next to what's already on the board.
//  * toggleBowl() brings in a bowl beside the board; every cut piece, curl and
//    diced cube flies into it in an arc. Tossing throws the contents up and
//    swirls them, so the mix is real physics, not an animation.
// ============================================================================

export const BOWL = { x: 5.5, z: 0, rTop: 1.75, rBot: 0.95, h: 1.05, t: 0.07 };

export function installBowl(Game, { BOARD }) {
  const P = Game.prototype;
  const floorY = () => -BOARD.h + 0.1;

  // ---------------------------------------------------------- several objects
  P.addObject = function (id) {
    const def = byId[id]; if (!def) return;
    if (!this.placed || !this.bodies.length) this.placed = [];
    const spots = [[0, 0], [-1.9, -0.9], [1.9, -0.9], [-1.9, 1.0], [1.9, 1.0], [0, 1.5], [0, -1.5], [-2.6, 0], [2.6, 0]];
    let spot = spots[0];
    for (const s of spots) {
      if (this.bodies.every(b => Math.hypot(b.mesh.position.x - s[0], b.mesh.position.z - s[1]) > 1.35)) { spot = s; break; }
    }
    const yaw = (Math.random() - 0.5) * 0.8;
    this.placed.push({ id, x: spot[0], z: spot[1], yaw });
    this.pushUndo();
    this.addBody(def, [makeShape(def.shape)], new THREE.Vector3(spot[0], 0.5, spot[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    setTimeout(() => this.audio.tick(0.2), 180);
    this.current = def;
    this.ui.onObject(def, this.placed.length);
  };

  // ---------------------------------------------------------- the bowl
  P.buildBowl = function () {
    const g = new THREE.Group();
    const pts = [];
    const { rTop, rBot, h, t } = BOWL;
    // outer wall up, rounded lip, inner wall down to the floor
    for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(rBot * 0.85 + (rTop - rBot * 0.85) * Math.pow(u, 0.8), u * h)); }
    pts.push(new THREE.Vector2(rTop + t * 0.2, h + t * 0.5), new THREE.Vector2(rTop - t, h));
    for (let i = 12; i >= 0; i--) { const u = i / 12; pts.push(new THREE.Vector2(Math.max(0.01, rBot * 0.85 - t + (rTop - rBot * 0.85) * Math.pow(u, 0.8)), t + u * (h - t))); }
    pts.push(new THREE.Vector2(0.001, t));
    const geo = new THREE.LatheGeometry(pts, 64);
    const mat = new THREE.MeshPhysicalMaterial({ color: '#f3efe9', roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    const band = new THREE.Mesh(new THREE.TorusGeometry(rTop + 0.01, 0.018, 8, 80), new THREE.MeshStandardMaterial({ color: '#c98f74', roughness: 0.4 }));
    band.rotation.x = Math.PI / 2; band.position.y = h * 0.82; band.scale.setScalar(0.93);
    g.add(band);
    g.position.set(BOWL.x, -BOARD.h, BOWL.z);
    return g;
  };

  P.bowlColliders = function (on) {
    const ph = this.physics; if (!ph.ok) return;
    if (!on) { for (const c of this.bowlCols || []) ph.world.removeCollider(c, true); this.bowlCols = []; return; }
    const R = ph.R, w = ph.world, cols = [];
    const y0 = -BOARD.h;
    // fit the colliders to the visible inside of the bowl
    const r0 = this.bowlRadiusAt(y0 + BOWL.t), r1 = this.bowlRadiusAt(y0 + BOWL.h);
    cols.push(w.createCollider(R.ColliderDesc.cylinder(0.05, r0 + 0.05).setTranslation(BOWL.x, y0 + 0.02, BOWL.z).setFriction(0.8)));
    const n = 24, slope = Math.atan2(r1 - r0, BOWL.h), len = Math.hypot(r1 - r0, BOWL.h) + 0.1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rm = (r0 + r1) / 2 + 0.06;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, -slope, 'YXZ')); // wall leans outward
      const seg = 2 * Math.PI * rm / n * 0.62;
      cols.push(w.createCollider(R.ColliderDesc.cuboid(0.06, len / 2, seg).setTranslation(BOWL.x + Math.cos(a) * rm, y0 + BOWL.h / 2, BOWL.z + Math.sin(a) * rm).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.6)));
    }
    this.bowlCols = cols;
  };

  // radius of the bowl's inside at height y (world)
  P.bowlRadiusAt = function (y) {
    const u = THREE.MathUtils.clamp((y + BOARD.h) / BOWL.h, 0, 1);
    return BOWL.rBot * 0.85 - BOWL.t + (BOWL.rTop - BOWL.rBot * 0.85) * Math.pow(u, 0.8);
  };

  P.toggleBowl = function () {
    if (this.bowl) {
      // back to the board; the bowl keeps its salad
      this.bowlView = false;
      this.camGoal.target = new THREE.Vector3(0, 0.35, 0); this.camGoal.r = 6.6; this.camGoal.phi = 0.78;
      this.ui.onBowl(false);
      return;
    }
    this.bowl = this.buildBowl(); this.scene.add(this.bowl);
    this.bowlColliders(true);
    this.dice.setBowl({ x: BOWL.x, z: BOWL.z, floor: floorY(), top: -BOARD.h + BOWL.h, radiusAt: (y) => this.bowlRadiusAt(y) });
    this.gatherIntoBowl();
  };

  P.showBowl = function () {
    this.bowlView = true;
    this.camGoal.target = new THREE.Vector3(BOWL.x - 0.4, 0.1, BOWL.z); this.camGoal.r = 6.4; this.camGoal.phi = 0.95;
    this.ui.onBowl(true);
  };

  // everything that was cut flies into the bowl in an arc
  P.gatherIntoBowl = function () {
    this.showBowl();
    const G = 55, T = 0.85;
    const target = () => { const a = Math.random() * Math.PI * 2, r = Math.random() * BOWL.rBot * 0.5; return new THREE.Vector3(BOWL.x + Math.cos(a) * r, -BOARD.h + 0.6 + Math.random() * 0.4, BOWL.z + Math.sin(a) * r); };
    const launch = (h, pos, delay) => setTimeout(() => {
      if (!h || h.sim) return;
      const p = h.rb.translation(), tg = target();
      const v = { x: (tg.x - p.x) / T, y: (tg.y - p.y) / T + 0.5 * G * T, z: (tg.z - p.z) / T };
      // true ballistic flight: no air drag, and no tunnelling through the bowl wall
      h.rb.setLinearDamping(0); h.rb.enableCcd(true);
      h.rb.setLinvel(v, true);
      setTimeout(() => { try { h.rb.setLinearDamping(0.5); h.rb.enableCcd(false); } catch { /* removed */ } }, T * 1000 + 600);
      h.rb.setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 }, true);
    }, delay);
    let k = 0;
    for (const b of this.bodies) if (b.mesh.position.distanceTo(new THREE.Vector3(BOWL.x, 0, BOWL.z)) > BOWL.rTop) launch(b.h, b.mesh.position, 60 * k++);
    for (const c of this.curls) if (c.h) launch(c.h, c.mesh.position, 60 * k++);
    this.dice.gather(0.9);
    if (this.settings.sound) for (let i = 0; i < Math.min(8, k); i++) setTimeout(() => this.audio.swish(1.5), 60 * i);
    setTimeout(() => this.ui.toast && this.ui.toast('Tap Mix to toss the salad'), 900);
  };

  // toss: throw the contents up and swirl them around
  P.tossBowl = function () {
    if (!this.bowl) return;
    const c = new THREE.Vector3(BOWL.x, 0, BOWL.z);
    for (const h of [...this.bodies.map(b => b.h), ...this.curls.map(x => x.h)]) {
      if (!h || h.sim) continue;
      const p = h.rb.translation();
      const dx = p.x - c.x, dz = p.z - c.z, r = Math.hypot(dx, dz);
      if (r > BOWL.rTop + 0.3) continue;
      const tx = -dz / (r || 1), tz = dx / (r || 1);
      h.rb.setLinvel({ x: tx * 2.2 - dx * 0.8 + (Math.random() - 0.5) * 1.2, y: 6 + Math.random() * 5, z: tz * 2.2 - dz * 0.8 + (Math.random() - 0.5) * 1.2 }, true);
      h.rb.setAngvel({ x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 12 }, true);
    }
    this.dice.toss();
    this.shakeA = Math.max(this.shakeA || 0, 0.015);
    if (this.settings.sound) { this.audio.swish(2.2); setTimeout(() => this.audio.pitter(30, 'crunch'), 380); }
    if (this.settings.haptics) this.ui.buzz(20);
  };

  P.removeBowl = function () {
    if (!this.bowl) return;
    this.scene.remove(this.bowl); this.bowl = null;
    this.bowlColliders(false);
    this.dice.setBowl(null);
    this.bowlView = false;
    this.ui.onBowl(false, true);
  };
}
