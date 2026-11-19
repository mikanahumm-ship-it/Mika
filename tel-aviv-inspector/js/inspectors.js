'use strict';
/* ============================================================
   INSPECTORS: patrol → suspicion → stop call → chase → search
   ============================================================ */
const INSPECTORS = [];
const INSP_DEFS = [
  { name: 'אבי', pers: 'angry', g: 'm', speed: 9.0, route: [[11, -110], [11, 110]] },
  { name: 'מוטי', pers: 'cynic', g: 'm', speed: 8.4, route: [[11, 40], [22, 27], [40, 27], [50, 40], [40, 54], [22, 54]] },
  { name: 'נועה', pers: 'rookie', g: 'f', speed: 8.2, route: [[-95, -7], [90, -7]] },
  { name: 'ששון', pers: 'veteran', g: 'm', speed: 7.9, route: [[69.5, -110], [69.5, 110]] },
  { name: 'יוסי', pers: 'nice', g: 'm', speed: 8.3, route: [[-62.5, -110], [-62.5, 110], [-62.5, 73], [-5, 73], [-62.5, 73]] },
];
const VIOL_RATE = { sidewalk: 42, zone: 60, plate: 24 };

class Inspector {
  constructor(def, idx) {
    Object.assign(this, def); this.idx = idx;
    this.root = new THREE.Group(); scene.add(this.root);
    this.seg = makeSegway(); this.root.add(this.seg.g);
    this.p = makePerson({ shirt: 0x8fc1ea, pants: 0x26324f, cap: 0x1f2a44, female: def.g === 'f', hair: 0x2a1d16, shoes: 0x111111, sleeves: 'short', belly: def.pers === 'veteran' });
    // vest
    const vest = bx(this.p.hips, 0.5, 0.42, 0.44, 0, 0.5, 0, 0x1f3a7a);
    bx(this.p.hips, 0.52, 0.06, 0.46, 0, 0.42, 0, 0xf3c341);
    const tag = signMesh('פיקוח', 0.42, 0.14, { w: 256, h: 84, bg: '#1f3a7a', fg: '#f3c341', size: 60 });
    tag.position.set(0, 0.56, -0.231); tag.rotation.y = Math.PI; this.p.hips.add(tag);
    const tag2 = signMesh('פיקוח עירוני', 0.4, 0.1, { w: 300, h: 76, bg: '#1f3a7a', fg: '#ffffff', size: 44 });
    tag2.position.set(0, 0.6, 0.231); this.p.hips.add(tag2);
    this.p.root.position.y = 0.22; this.root.add(this.p.root);
    this.pos = this.root.position; this.pos.set(def.route[0][0], 0, def.route[0][1]);
    this.heading = 0; this.v = 0; this.wp = 1; this.wdir = 1; this.wait = 0;
    this.state = 'patrol'; this.sus = 0; this.susBy = {}; this.cool = 0; this.lostT = 0; this.last = new THREE.Vector3();
    this.stuck = 0; this.side = 0; this.sayCd = rand(5, 20); this.callT = 0; this.fled = false;
    resetPose(this.p);
  }
  canSee() {
    if (!PLAYER.active) return false;
    const dx = PLAYER.pos.x - this.pos.x, dz = PLAYER.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 40) return false;
    if (d > 9) { const f = (Math.sin(this.heading) * dx + Math.cos(this.heading) * dz) / d; if (f < 0.25 && this.state === 'patrol') return false; }
    return hasLOS(this.pos.x, this.pos.z, PLAYER.pos.x, PLAYER.pos.z);
  }
  moveTo(tx, tz, speed, dt) {
    let dx = tx - this.pos.x, dz = tz - this.pos.z; const d = Math.hypot(dx, dz);
    if (d < 0.05) { this.v = Math.max(0, this.v - 6 * dt); return d; }
    let want = Math.atan2(dx, dz);
    if (this.side > 0) { want += this.sideDir * 1.2; this.side -= dt; }
    this.heading += clamp(angDiff(this.heading, want), -4 * dt, 4 * dt);
    const target = Math.min(speed, d * 2);
    this.v += clamp(target - this.v, -10 * dt, 5 * dt);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += Math.sin(this.heading) * this.v * dt; this.pos.z += Math.cos(this.heading) * this.v * dt;
    collideStatic(this.pos, 0.45);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    if (this.v > 1 && moved < this.v * dt * 0.35) { this.stuck += dt; if (this.stuck > 0.3) { this.side = 0.9; this.sideDir = Math.random() < 0.5 ? 1 : -1; this.stuck = 0; } } else this.stuck = 0;
    return d;
  }
  shout(text, cls) { say(this.p.head, G(text), 2.4, cls || 'insp'); }
  update(dt, t) {
    const P = PLAYER, dP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    this.cool -= dt;
    switch (this.state) {
      case 'patrol': case 'return': {
        const w = this.route[this.wp];
        if (this.wait > 0) { this.wait -= dt; this.v = Math.max(0, this.v - 5 * dt); this.heading += Math.sin(t * 0.9 + this.idx) * dt * 0.8; }
        else {
          const d = this.moveTo(w[0], w[1], 2.6, dt);
          if (d < 0.8) {
            if (this.state === 'return') this.state = 'patrol';
            this.wait = rand(1, 3.5);
            if (this.route.length === 2) this.wp = 1 - this.wp; else this.wp = (this.wp + 1) % this.route.length;
          }
        }
        this.detect(dt, dP);
        // chat with colleague
        this.sayCd -= dt;
        if (this.sayCd < 0) { this.sayCd = rand(15, 40); for (const o of INSPECTORS) if (o !== this && o.pos.distanceTo(this.pos) < 9 && dP < 35) { this.shout(pick(LINES.inspChat)); break; } }
        break;
      }
      case 'call': { // shouted "stop!" — waiting to see if the player stops
        this.callT -= dt;
        this.moveTo(P.pos.x, P.pos.z, 4.5, dt);
        if (P.speed < 0.9 && dP < 30) { this.state = 'approach'; this.fled = false; }
        else if (this.callT < 0 || (dP > 16 && P.speed > 3)) this.startChase();
        break;
      }
      case 'approach': {
        this.moveTo(P.pos.x, P.pos.z, 5, dt);
        if (P.speed > 3.5) this.startChase();
        if (dP < 2.3) this.catchPlayer();
        break;
      }
      case 'chase': {
        if (this.stun > 0) { this.stun -= dt; this.v = 0; break; }
        const sees = this.canSee();
        if (sees) { this.last.copy(P.pos); this.lostT = 0; } else this.lostT += dt;
        const tx = sees ? P.pos.x : this.last.x, tz = sees ? P.pos.z : this.last.z;
        this.moveTo(tx, tz, this.speed * (P.crashed ? 0.7 : 1), dt);
        if (dP < 1.9 && sees) { this.catchPlayer(); break; }
        this.sayCd -= dt; if (this.sayCd < 0 && sees) { this.sayCd = rand(2.5, 5); this.shout(pick(LINES.chase)); }
        if (this.lostT > 4.2 || dP > 80) { this.state = 'search'; this.searchT = 7; this.shout(pick(LINES.lost)); }
        // radio colleagues
        if (sees) for (const o of INSPECTORS) if (o !== this && (o.state === 'patrol' || o.state === 'return') && o.cool <= 0 && o.pos.distanceTo(this.pos) < 70 && o.canSee()) { o.viol = this.viol; o.startChase(true); }
        break;
      }
      case 'search': {
        this.searchT -= dt;
        if (this.pos.distanceTo(this.last) > 1.5) this.moveTo(this.last.x, this.last.z, 4, dt);
        else { this.heading += dt * 1.6; this.v = 0; }
        if (this.canSee() && dP < 30) { this.startChase(); this.shout('הנה {{אתה|את}}!'); }
        if (this.searchT < 0) this.endChase(true);
        break;
      }
      case 'talk': break;
    }
    // visuals
    this.root.rotation.y = this.heading;
    this.seg.g.rotation.x = clamp(this.v * 0.02, 0, 0.18);
    for (const w of this.seg.wheels) w.rotation.x += this.v * dt / 0.2;
    if (this.state === 'talk') { poseIdle(this.p, t); poseTalk(this.p, t, 0.8 + GAME.dlgAnger * 0.01); }
    else {
      const p = this.p; resetPose(p);
      p.armL.rotation.x = -0.55; p.armR.rotation.x = -0.55; p.elbowL.rotation.x = -0.5; p.elbowR.rotation.x = -0.5;
      p.chest.rotation.x = clamp(this.v * 0.02, 0, 0.2);
      if (this.state === 'call') { p.armR.rotation.x = -2.6; p.elbowR.rotation.x = 0; p.armR.rotation.z = 0.3 + Math.sin(t * 12) * 0.2; }
      else if (this.wait > 0) { p.head.rotation.y = Math.sin(t * 1.2 + this.idx) * 0.6; }
    }
    this.pos.y = SURF_H[surfaceAt(this.pos.x, this.pos.z)] || 0;
  }
  detect(dt, dP) {
    if (this.cool > 0 || GAME.mode !== 'play' || !PLAYER.active) { this.sus = Math.max(0, this.sus - 15 * dt); return; }
    const V = PLAYER.viol;
    let seen = false;
    if (this.canSee()) {
      const add = (k, amt) => { this.sus += amt; this.susBy[k] = (this.susBy[k] || 0) + amt; seen = true; };
      if (V.sidewalk) add('sidewalk', VIOL_RATE.sidewalk * dt * (dP < 15 ? 1.6 : 1));
      if (V.zone) add('zone', VIOL_RATE.zone * dt);
      if (V.plate && dP < 14 && PLAYER.speed > 0.5) add('plate', VIOL_RATE.plate * dt);
      if (V.redT > 0) add('red', 130 * dt / 0.3);
      if (V.dangerT > 0) add('danger', 110 * dt / 0.3);
    }
    if (!seen) { this.sus = Math.max(0, this.sus - 9 * dt); for (const k in this.susBy) this.susBy[k] *= Math.max(0, 1 - dt * 0.15); }
    if (this.sus >= 100) {
      let best = 'sidewalk', bv = -1; for (const k in this.susBy) if (this.susBy[k] > bv) { bv = this.susBy[k]; best = k; }
      this.viol = best; this.state = 'call'; this.callT = 2.6; this.sus = 100;
      this.shout(pick(LINES.stop), 'insp big'); SFX.whistle();
      GAME.flash(G('הפקח קורא לך לעצור! ' + (IS_TOUCH ? 'עצור{{|י}} כדי לדבר — או תברח{{|י}}!' : 'עצור{{|י}} (Space) — או תברח{{|י}}!')));
    }
  }
  startChase(radio) {
    if (this.state === 'chase') return;
    this.state = 'chase'; this.fled = true; this.lostT = 0; this.last.copy(PLAYER.pos); this.sus = 100;
    if (!this.viol) this.viol = 'sidewalk';
    if (radio) this.shout('קיבלתי! אני בדרך!'); else { this.shout(pick(LINES.chase), 'insp big'); SFX.whistle(); }
    GAME.onChaseStart(this);
  }
  endChase(escaped) {
    this.state = 'return'; this.sus = 0; this.susBy = {}; this.cool = 6; this.fled = false;
    let best = 0, bd = 1e9; this.route.forEach((w, i) => { const d = Math.hypot(w[0] - this.pos.x, w[1] - this.pos.z); if (d < bd) { bd = d; best = i; } }); this.wp = best;
    if (escaped) GAME.onChaseCheck();
  }
  catchPlayer() {
    this.state = 'talk'; this.v = 0;
    for (const o of INSPECTORS) if (o !== this && (o.state === 'chase' || o.state === 'search' || o.state === 'call' || o.state === 'approach')) { o.state = 'return'; o.cool = 15; o.sus = 0; o.susBy = {}; }
    startDialogue(this, this.viol || 'sidewalk', { fled: this.fled });
  }
  release() { this.state = 'return'; this.cool = 22; this.sus = 0; this.susBy = {}; this.fled = false; this.viol = null; }
}
function spawnInspectors() { INSP_DEFS.forEach((d, i) => INSPECTORS.push(new Inspector(d, i))); }
