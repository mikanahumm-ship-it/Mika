'use strict';
/* ============================================================
   POLICE: wanted level (stars), patrol cars with sirens, arrest
   ============================================================ */
const POLICE = {
  wanted: 0, cars: [], lostT: 0, crimes: { runover: 0, assault: 0, flee: 0, refuse: 0, insult: 0 }, seen: false, last: new THREE.Vector3(),
  add(n, msg) {
    if (!PLAYER.active || GAME.mode === 'legal') return;
    const before = this.wanted;
    this.wanted = Math.min(5, this.wanted + n); this.lostT = 0;
    if (msg) GAME.flash(msg);
    if (before === 0) { this.last.copy(PLAYER.pos); this.crimes.flee += 0; }
    this.ensure(); GAME.refreshHud(); SFX.alarm();
  },
  ensure() {
    const want = Math.min(4, 1 + Math.floor(this.wanted / 2));
    while (this.cars.filter((c) => !c.leaving).length < want) this.cars.push(new PoliceCar());
  },
  clear(keepCrimes) {
    for (const c of this.cars) scene.remove(c.mesh);
    this.cars = []; this.wanted = 0; this.lostT = 0;
    if (!keepCrimes) this.crimes = { runover: 0, assault: 0, flee: 0, refuse: 0, insult: 0 };
    GAME.refreshHud();
  },
  update(dt, t) {
    let anySee = false, nearest = 1e9;
    for (const c of this.cars) { c.update(dt, t); if (c.sees) anySee = true; nearest = Math.min(nearest, c.dist); }
    this.cars = this.cars.filter((c) => !c.gone);
    if (this.wanted > 0) {
      if (anySee) { this.lostT = 0; this.last.copy(PLAYER.pos); } else this.lostT += dt;
      const need = 10 + this.wanted * 2;
      GAME.policeLost = this.lostT / need;
      if (this.lostT > need) {
        const prize = 40 + this.wanted * 30;
        this.crimes.flee++;
        this.wanted = 0; for (const c of this.cars) c.leaving = true;
        SAVE.money += prize; SAVE.stats.copEscapes = (SAVE.stats.copEscapes || 0) + 1; saveGame();
        GAME.flash(G(`🚓💨 המשטרה איבדה אותך! +₪${prize}`)); GAME.achieve('ghost'); SFX.yay(); GAME.refreshHud();
      }
    }
    SFX.siren(this.cars.length ? clamp(1 - nearest / 90, 0, 1) : 0);
  },
};

/* spawn somewhere on a road 70–150 m away, preferably out of sight */
function policeSpawnPoint() {
  const P = PLAYER.pos;
  const cands = WORLD.intersections.filter((I) => { const d = Math.hypot(I.cx - P.x, I.cz - P.z); return d > 60 && d < 160; });
  shuffle(cands);
  for (const I of cands) if (!hasLOS(I.cx, I.cz, P.x, P.z)) return { x: I.cx, z: I.cz };
  if (cands.length) return { x: cands[0].cx, z: cands[0].cz };
  return { x: P.x + 80, z: P.z };
}

class PoliceCar {
  constructor() {
    const m = makeCarMesh('police'); this.mesh = m.g; this.lights = m.lights; scene.add(this.mesh);
    const sp = policeSpawnPoint();
    this.pos = this.mesh.position; this.pos.set(sp.x, 0, sp.z);
    this.heading = Math.atan2(PLAYER.pos.x - sp.x, PLAYER.pos.z - sp.z); this.v = 4;
    this.stuck = 0; this.rev = 0; this.arrestT = 0; this.sayCd = 1; this.sees = false; this.dist = 999; this.leaving = false; this.leaveT = 8;
  }
  update(dt, t) {
    const P = PLAYER;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z; this.dist = Math.hypot(dx, dz);
    // sirens
    const ph = Math.floor(t * 6) % 2;
    this.lights.a.material = ph ? this.lights.red : this.lights.off; this.lights.b.material = ph ? this.lights.off : this.lights.blue;
    if (this.leaving) {
      this.leaveT -= dt; this.drive(this.heading, 9, dt);
      if (this.leaveT < 0 || this.dist > 160) { scene.remove(this.mesh); this.gone = true; }
      return;
    }
    if (GAME.mode !== 'play') { this.v = 0; return; }
    this.sees = this.dist < 95 && hasLOS(this.pos.x, this.pos.z, P.pos.x, P.pos.z);
    let tx, tz;
    if (this.sees) { tx = P.pos.x + Math.sin(P.heading) * P.speed * 0.5; tz = P.pos.z + Math.cos(P.heading) * P.speed * 0.5; }
    else { tx = POLICE.last.x; tz = POLICE.last.z; }
    if (this.rev > 0) { this.rev -= dt; this.drive(this.heading + this.revTurn * dt, -5, dt); return; }
    const want = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    const top = 14 + POLICE.wanted * 1.1;
    const target = clamp(Math.hypot(tx - this.pos.x, tz - this.pos.z) * 1.4, 2, top);
    const turn = clamp(angDiff(this.heading, want), -2.4 * dt, 2.4 * dt);
    const ox = this.pos.x, oz = this.pos.z;
    this.v += clamp(target - this.v, -14 * dt, 7 * dt);
    this.drive(this.heading + turn, this.v, dt);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    if (this.v > 3 && moved < this.v * dt * 0.3) { this.stuck += dt; if (this.stuck > 0.5) { this.rev = 0.9; this.revTurn = Math.random() < 0.5 ? 2 : -2; this.stuck = 0; this.v = 0; } } else this.stuck = 0;
    // shouting
    this.sayCd -= dt;
    if (this.sees && this.dist < 30 && this.sayCd < 0) { this.sayCd = rand(3, 5); say(this.mesh, G(pick(LINES.police)), 2.2, 'cop', 2.3); }
    // ramming / arrest
    if (this.dist < 2.6 && this.v > 7 && P.crashed <= 0 && Math.abs(P.speed) < this.v) { crash('אאוץ׳! הניידת!'); }
    if (this.dist < 3.6 && (Math.abs(P.speed) < 3 || P.crashed > 0)) {
      this.arrestT += dt;
      if (this.arrestT > 0.25 && !this.warned) { this.warned = true; GAME.flash(G('השוטר יוצא מהניידת! {{תברח|תברחי}} עכשיו!')); }
      if (this.arrestT > 1.1) startArrest('police');
    } else { this.arrestT = Math.max(0, this.arrestT - dt); if (this.arrestT === 0) this.warned = false; }
  }
  drive(h, v, dt) {
    this.heading = h;
    this.pos.x += Math.sin(h) * v * dt; this.pos.z += Math.cos(h) * v * dt;
    const hit = collideStatic(this.pos, 1.15);
    if (hit) this.v *= Math.pow(0.2, dt);
    for (const c of TRAFFIC.cars) { // push out of civilian cars
      const [x0, z0, x1, z1] = c.aabb(), r = 1.1;
      if (this.pos.x > x0 - r && this.pos.x < x1 + r && this.pos.z > z0 - r && this.pos.z < z1 + r) {
        const pl = this.pos.x - (x0 - r), pr = (x1 + r) - this.pos.x, pt = this.pos.z - (z0 - r), pb = (z1 + r) - this.pos.z, m = Math.min(pl, pr, pt, pb);
        if (m === pl) this.pos.x = x0 - r; else if (m === pr) this.pos.x = x1 + r; else if (m === pt) this.pos.z = z0 - r; else this.pos.z = z1 + r;
        this.v *= 0.8;
      }
    }
    for (const o of POLICE.cars) if (o !== this) { const ddx = this.pos.x - o.pos.x, ddz = this.pos.z - o.pos.z, d = Math.hypot(ddx, ddz); if (d < 2.6 && d > 0.01) { this.pos.x += ddx / d * (2.6 - d) * 0.5; this.pos.z += ddz / d * (2.6 - d) * 0.5; } }
    this.pos.y = 0;
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = clamp(angDiff(this.mesh.userData.lh || h, h) * 3, -0.06, 0.06); this.mesh.userData.lh = h;
  }
}
