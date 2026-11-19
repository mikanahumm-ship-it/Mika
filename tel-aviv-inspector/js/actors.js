'use strict';
/* ============================================================
   ACTORS: low-poly people, vehicles, traffic, pedestrians, cats
   ============================================================ */
const SKINS = [0xe0ac86, 0xd09a72, 0xb97f5a, 0x8d5a3b, 0xf0c3a0, 0x6e4430];
const HAIRS = [0x2a1d16, 0x3b2a1e, 0x14100e, 0x6b4a2b, 0xc9a25b, 0x8c8c8c];
const SHIRTS = [0xffffff, 0xf2a81d, 0x2b5fd9, 0xe2463b, 0x1f9b6b, 0xf4e3c3, 0x7a4fd6, 0x9fd3e8, 0xf6c6d6, 0x2e2f3a, 0xff8a65, 0x4db6ac];
const PANTS = [0xf3f1ec, 0x2b3a5c, 0x3a3a40, 0xc8b08a, 0x5b6b8a, 0xf3f1ec, 0x8d6e63];

const _pg = {
  torso: new THREE.CylinderGeometry(0.23, 0.2, 0.6, 8),
  belly: new THREE.CylinderGeometry(0.27, 0.25, 0.6, 8),
  pelvis: new THREE.CylinderGeometry(0.2, 0.19, 0.22, 8),
  skirt: new THREE.CylinderGeometry(0.2, 0.32, 0.6, 8),
  head: new THREE.IcosahedronGeometry(0.155, 1),
  hairTop: new THREE.SphereGeometry(0.165, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5),
  limbU: new THREE.CylinderGeometry(0.072, 0.064, 0.3, 6),
  limbF: new THREE.CylinderGeometry(0.062, 0.055, 0.28, 6),
  thigh: new THREE.CylinderGeometry(0.1, 0.085, 0.47, 7),
  shin: new THREE.CylinderGeometry(0.084, 0.07, 0.44, 7),
  hand: new THREE.IcosahedronGeometry(0.07, 0),
  foot: new THREE.BoxGeometry(0.13, 0.07, 0.27),
  chain: new THREE.TorusGeometry(0.15, 0.018, 4, 12),
  brim: new THREE.BoxGeometry(0.26, 0.025, 0.2),
  eye: new THREE.BoxGeometry(0.03, 0.035, 0.02),
  pony: new THREE.CylinderGeometry(0.05, 0.03, 0.3, 5),
  hatBrim: new THREE.CylinderGeometry(0.27, 0.27, 0.025, 12),
  hatTop: new THREE.CylinderGeometry(0.15, 0.17, 0.2, 10),
  kippa: new THREE.SphereGeometry(0.09, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.35),
  beard: new THREE.BoxGeometry(0.22, 0.16, 0.12),
  pack: new THREE.BoxGeometry(0.38, 0.46, 0.22),
};
function pm(geo, color, parent, x, y, z) {
  const m = new THREE.Mesh(geo, MAT(color)); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; parent.add(m); return m;
}

function makePerson(o) {
  o = Object.assign({ skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: 0x2a2a2a, hair: pick(HAIRS), hairStyle: 'short', cap: null, chain: false, female: false, shirtless: false, belly: false, sleeves: 'short', scale: 1 }, o);
  const mk = () => new StaticBuilder({ single: true, cast: true });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const torsoCol = o.shirtless ? o.skin : o.shirt;
  const Hb = mk();
  Hb.add(_pg.pelvis, o.pants, 0, 0.05, 0, 1, 1, 1);
  Hb.add(o.belly ? _pg.belly : _pg.torso, torsoCol, 0, 0.42, 0, 1, 1, 1);
  if (o.dress) Hb.add(_pg.skirt, o.shirt, 0, -0.18, 0, 1, 1, 1);
  Hb.build(hips);
  const chest = new THREE.Group(); chest.position.y = 0.66; hips.add(chest);
  const Cb = mk();
  Cb.add(_pg.limbF, o.skin, 0, 0.06, 0, 1, 0.5, 1);
  if (o.chain) Cb.add(_pg.chain, 0xf2c230, 0, 0.02, 0.02, 1, 1, 1, Math.PI / 2 - 0.25, 0, 0);
  if (o.pack) Cb.add(_pg.pack, o.pack, 0, -0.2, -0.25, 1, 1, 1);
  Cb.build(chest);
  const head = new THREE.Group(); head.position.y = 0.24; chest.add(head);
  const Hd = mk();
  Hd.add(_pg.head, o.skin, 0, 0, 0, 1, 1.08, 1.02);
  Hd.add(_pg.eye, 0x1b1b1b, -0.055, 0.02, 0.145, 1, 1, 1); Hd.add(_pg.eye, 0x1b1b1b, 0.055, 0.02, 0.145, 1, 1, 1);
  Hd.add(_pg.hand, o.skin, 0, -0.02, 0.16, 0.35, 0.45, 0.4);
  if (o.beard) Hd.add(_pg.beard, o.hair, 0, -0.1, 0.07, 1, 1, 1);
  if (o.hat === 'fedora') { Hd.add(_pg.hatBrim, 0x111111, 0, 0.12, 0, 1, 1, 1); Hd.add(_pg.hatTop, 0x111111, 0, 0.22, 0, 1, 1, 1); }
  else if (o.cap) { Hd.add(_pg.hairTop, o.cap, 0, 0.03, 0, 1, 1, 1); Hd.add(_pg.brim, o.cap, 0, 0.05, 0.15, 1, 1, 1); }
  else if (o.hairStyle !== 'bald') {
    Hd.add(_pg.hairTop, o.hair, 0, 0.02, -0.01, 1, o.hairStyle === 'curly' ? 1.25 : 1, 1);
    if (o.female) { Hd.add(_pg.pony, o.hair, 0, -0.05, -0.17, 1, 1, 1, 0.5, 0, 0); Hd.add(_pg.hairTop, o.hair, 0, -0.04, -0.03, 1.02, 0.7, 1.02, Math.PI, 0, 0); }
  }
  if (o.kippa) Hd.add(_pg.kippa, o.kippa, 0, 0.14, -0.03, 1, 1, 1);
  Hd.build(head);
  const sleeveCol = o.shirtless ? o.skin : o.sleeves === 'none' ? o.skin : o.shirt;
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.3, -0.02, 0); chest.add(sh);
    const U = mk(); U.add(_pg.limbU, sleeveCol, 0, -0.15, 0, 1, 1, 1); U.build(sh);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const F = mk(); F.add(_pg.limbF, o.sleeves === 'long' ? o.shirt : o.skin, 0, -0.14, 0, 1, 1, 1); F.add(_pg.hand, o.skin, 0, -0.3, 0, 1, 1, 1); F.build(el);
    return [sh, el];
  };
  const [armL, elbowL] = arm(-1), [armR, elbowR] = arm(1);
  const leg = (side) => {
    const hp = new THREE.Group(); hp.position.set(side * 0.11, 0, 0); hips.add(hp);
    const T = mk(); T.add(_pg.thigh, o.pants, 0, -0.235, 0, 1, 1, 1); T.build(hp);
    const kn = new THREE.Group(); kn.position.y = -0.47; hp.add(kn);
    const S = mk(); S.add(_pg.shin, o.shorts || o.dress ? o.skin : o.pants, 0, -0.22, 0, 1, 1, 1); S.add(_pg.foot, o.shoes, 0, -0.45, 0.05, 1, 1, 1); S.build(kn);
    return [hp, kn];
  };
  const [legL, kneeL] = leg(-1), [legR, kneeR] = leg(1);
  root.scale.setScalar(o.scale);
  return { root, body, hips, chest, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR, phase: Math.random() * 6, o };
}

function resetPose(p) {
  for (const k of ['armL', 'armR', 'elbowL', 'elbowR', 'legL', 'legR', 'kneeL', 'kneeR', 'head', 'chest']) p[k].rotation.set(0, 0, 0);
  p.body.rotation.set(0, 0, 0); p.body.position.set(0, 0, 0); p.hips.rotation.set(0, 0, 0);
  p.armL.rotation.z = -0.08; p.armR.rotation.z = 0.08;
}
function poseWalk(p, speed, dt) {
  p.phase += dt * (2.2 + speed * 3.0);
  const s = Math.sin(p.phase), amp = Math.min(0.75, 0.2 + speed * 0.26);
  p.legL.rotation.x = s * amp; p.legR.rotation.x = -s * amp;
  p.kneeL.rotation.x = Math.max(0, -Math.cos(p.phase)) * amp * 1.3; p.kneeR.rotation.x = Math.max(0, Math.cos(p.phase)) * amp * 1.3;
  p.armL.rotation.x = -s * amp * 0.8; p.armR.rotation.x = s * amp * 0.8;
  p.elbowL.rotation.x = speed > 2.2 ? -1.3 : -0.25; p.elbowR.rotation.x = speed > 2.2 ? -1.3 : -0.25;
  p.armL.rotation.z = -0.08; p.armR.rotation.z = 0.08;
  p.body.position.y = Math.abs(Math.cos(p.phase)) * 0.04 * (speed > 0.1 ? 1 : 0);
  p.chest.rotation.x = speed > 2.2 ? 0.15 : 0;
}
function poseIdle(p, t) {
  p.legL.rotation.x = 0; p.legR.rotation.x = 0; p.kneeL.rotation.x = 0; p.kneeR.rotation.x = 0;
  p.armL.rotation.x = Math.sin(t * 1.3 + p.phase) * 0.05; p.armR.rotation.x = -Math.sin(t * 1.3 + p.phase) * 0.05;
  p.elbowL.rotation.x = -0.15; p.elbowR.rotation.x = -0.15; p.armL.rotation.z = -0.1; p.armR.rotation.z = 0.1;
  p.chest.rotation.x = Math.sin(t * 1.1 + p.phase) * 0.02; p.body.position.y = 0;
}
function poseSit(p, t) {
  p.body.position.y = -0.47;
  p.legL.rotation.x = -1.5; p.legR.rotation.x = -1.45; p.kneeL.rotation.x = 1.45; p.kneeR.rotation.x = 1.5;
  p.legL.rotation.z = -0.12; p.legR.rotation.z = 0.12;
  p.armL.rotation.x = -0.5; p.armR.rotation.x = -0.45; p.elbowL.rotation.x = -0.7; p.elbowR.rotation.x = -0.75;
  p.head.rotation.y = Math.sin(t * 0.4 + p.phase) * 0.5;
  p.chest.rotation.x = -0.08;
}
function poseTalk(p, t, intensity) {
  intensity = intensity || 1;
  p.armL.rotation.x = -0.5 - Math.abs(Math.sin(t * 3.1)) * 0.6 * intensity; p.elbowL.rotation.x = -0.9 - Math.sin(t * 4.3) * 0.3;
  p.armR.rotation.x = -0.3 - Math.abs(Math.sin(t * 2.3 + 1)) * 0.5 * intensity; p.elbowR.rotation.x = -0.8;
  p.armL.rotation.z = -0.3; p.armR.rotation.z = 0.25;
  p.head.rotation.x = Math.sin(t * 5) * 0.06 * intensity; p.head.rotation.y = Math.sin(t * 1.3) * 0.2;
  p.chest.rotation.y = Math.sin(t * 1.7) * 0.08;
}
function poseScooter(p, lean, t, speed, boosting) {
  p.legL.rotation.x = -0.18; p.kneeL.rotation.x = 0.28; p.legR.rotation.x = 0.28; p.kneeR.rotation.x = 0.32;
  p.armL.rotation.x = -0.65; p.armR.rotation.x = -0.65; p.elbowL.rotation.x = -0.45; p.elbowR.rotation.x = -0.45;
  p.armL.rotation.z = 0.12; p.armR.rotation.z = -0.12;
  p.chest.rotation.x = 0.1 + (boosting ? 0.2 : 0) + Math.min(speed, 12) * 0.008;
  p.body.position.y = Math.sin(t * 13) * 0.006 * Math.min(1, speed);
  p.head.rotation.x = -0.1 - (boosting ? 0.15 : 0);
}
function poseBike(p, t, cad, speed, boosting) {
  p.body.position.y = -0.02;
  p.legL.rotation.x = -0.95 + Math.sin(cad) * 0.42; p.kneeL.rotation.x = 1.2 + Math.cos(cad) * 0.38;
  p.legR.rotation.x = -0.95 - Math.sin(cad) * 0.42; p.kneeR.rotation.x = 1.2 - Math.cos(cad) * 0.38;
  p.chest.rotation.x = 0.35 + (boosting ? 0.15 : 0);
  p.armL.rotation.x = -1.05; p.armR.rotation.x = -1.05; p.elbowL.rotation.x = -0.2; p.elbowR.rotation.x = -0.2;
  p.armL.rotation.z = 0.15; p.armR.rotation.z = -0.15;
  p.head.rotation.x = -0.35;
}
function poseCuffed(p) { // hands behind the back
  p.armL.rotation.x = 0.5; p.armR.rotation.x = 0.5; p.armL.rotation.z = 0.25; p.armR.rotation.z = -0.25; p.elbowL.rotation.x = -0.6; p.elbowR.rotation.x = -0.6;
  p.head.rotation.x = 0.2;
}

/* ---------- vehicles ---------- */
const _vg = {
  wheelS: new THREE.CylinderGeometry(0.11, 0.11, 0.07, 10),
  wheelB: new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12),
  wheelC: new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10),
  wheelSeg: new THREE.CylinderGeometry(0.2, 0.2, 0.09, 10),
};
function bx(parent, w, h, d, x, y, z, c, opts) { const m = new THREE.Mesh(GEO.box, MAT(c, opts)); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
function wheel(parent, geo, x, y, z) { const w = new THREE.Mesh(geo, MAT(0x1d1e22)); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); w.castShadow = true; parent.add(w); return w; }

function makeScooter(accent) {
  const g = new THREE.Group();
  bx(g, 0.2, 0.06, 0.9, 0, 0.13, 0, 0x2a2d35);
  bx(g, 0.18, 0.01, 0.7, 0, 0.165, -0.03, 0x111111);
  const wf = wheel(g, _vg.wheelS, 0, 0.11, 0.43), wr = wheel(g, _vg.wheelS, 0, 0.11, -0.43);
  const stem = bx(g, 0.06, 1.08, 0.06, 0, 0.7, 0.47, accent); stem.rotation.x = -0.12;
  bx(g, 0.58, 0.045, 0.045, 0, 1.23, 0.53, 0x2a2d35);
  bx(g, 0.1, 0.06, 0.06, -0.3, 1.23, 0.53, 0x111111); bx(g, 0.1, 0.06, 0.06, 0.3, 1.23, 0.53, 0x111111);
  bx(g, 0.1, 0.06, 0.04, 0, 1.05, 0.56, 0xfff6c8, { emissive: 0xfff2a8, emissiveIntensity: 0.6 });
  bx(g, 0.18, 0.03, 0.22, 0, 0.21, -0.45, 0x2a2d35);
  const plate = bx(g, 0.2, 0.12, 0.012, 0, 0.27, -0.56, 0xf6d02f); plate.rotation.x = 0.2;
  return { g, wheels: [wf, wr], plate, riderY: 0.165, riderZ: -0.06, pose: 'scooter', wheelR: 0.11 };
}
function makeEbike(accent) {
  const g = new THREE.Group();
  const wf = wheel(g, _vg.wheelB, 0, 0.34, 0.56), wr = wheel(g, _vg.wheelB, 0, 0.34, -0.56);
  const t1 = bx(g, 0.07, 0.07, 0.95, 0, 0.72, 0.05, accent); t1.rotation.x = 0.1;
  const t2 = bx(g, 0.08, 0.08, 0.85, 0, 0.5, 0.18, accent); t2.rotation.x = -0.75;
  const t3 = bx(g, 0.07, 0.62, 0.07, 0, 0.6, -0.22, accent); t3.rotation.x = -0.25;
  bx(g, 0.05, 0.08, 0.6, -0.05, 0.38, -0.3, accent);
  bx(g, 0.14, 0.18, 0.4, 0, 0.53, 0.2, 0x22252c);
  const fork = bx(g, 0.06, 0.75, 0.06, 0, 0.72, 0.5, 0x22252c); fork.rotation.x = 0.25;
  bx(g, 0.6, 0.045, 0.045, 0, 1.14, 0.42, 0x22252c);
  bx(g, 0.2, 0.06, 0.3, 0, 0.93, -0.3, 0x1b1b1b);
  bx(g, 0.1, 0.07, 0.05, 0, 0.95, 0.62, 0xfff6c8, { emissive: 0xfff2a8, emissiveIntensity: 0.6 });
  const plate = bx(g, 0.2, 0.12, 0.012, 0, 0.62, -0.88, 0xf6d02f); plate.rotation.x = 0.2;
  bx(g, 0.18, 0.03, 0.4, 0, 0.7, -0.6, 0x22252c);
  return { g, wheels: [wf, wr], plate, riderY: -0.02, riderZ: -0.3, pose: 'bike', wheelR: 0.34 };
}
function makeSegway() {
  const g = new THREE.Group();
  bx(g, 0.5, 0.08, 0.32, 0, 0.18, 0, 0xffffff);
  const w1 = wheel(g, _vg.wheelSeg, -0.32, 0.2, 0), w2 = wheel(g, _vg.wheelSeg, 0.32, 0.2, 0);
  bx(g, 0.06, 0.95, 0.06, 0, 0.68, 0.18, 0x2b58c9);
  bx(g, 0.5, 0.05, 0.05, 0, 1.15, 0.2, 0x2b58c9);
  bx(g, 0.22, 0.1, 0.04, 0, 0.95, 0.23, 0xffffff);
  return { g, wheels: [w1, w2] };
}
function makeCarMesh(kind, color) {
  const g = new THREE.Group(), M = new StaticBuilder({ single: true, cast: true });
  const bx = (_g, w, h, d, x, y, z, c) => M.box(w, h, d, x, y, z, c);
  const wheel = (_g, geo, x, y, z) => { M.add(geo, 0x1d1e22, x, y, z, 1, 1, 1, 0, 0, Math.PI / 2); return { scale: { set() {} } }; };
  if (kind === 'bus') {
    bx(g, 2.5, 2.4, 11, 0, 1.6, 0, 0xf4f4f6);
    bx(g, 2.52, 0.9, 10.4, 0, 2.15, 0.1, 0x2e4260);
    bx(g, 2.54, 0.25, 11.02, 0, 1.05, 0, 0x2b58c9);
    bx(g, 2.3, 0.15, 10.6, 0, 2.85, 0, 0xdedfe6);
    const s = signMesh(pick(['5 — דיזנגוף', '18 — רכבת מרכז', '61 — רדינג', '25 — ת. מרכזית']), 1.8, 0.35, { w: 360, h: 72, bg: '#111', fg: '#ffcc33', size: 44 }); s.position.set(0, 2.55, 5.52); g.add(s);
    for (const z of [-3.8, 3.8]) for (const x of [-1.15, 1.15]) M.add(_vg.wheelC, 0x1d1e22, x, 0.45, z, 1.3, 1, 1.3, 0, 0, Math.PI / 2);
    M.build(g); return { g, len: 11, wid: 2.6 };
  }
  const body = kind === 'police' ? 0xf7f7f9 : color;
  bx(g, 1.82, 0.62, 4.1, 0, 0.62, 0, body);
  bx(g, 1.84, 0.18, 4.12, 0, 0.36, 0, 0x2d2f36);
  bx(g, 1.6, 0.56, 2.1, 0, 1.2, -0.25, 0x2c3e5a);
  bx(g, 1.62, 0.08, 1.9, 0, 1.5, -0.3, body);
  bx(g, 0.3, 0.12, 0.04, -0.6, 0.72, 2.06, 0xfff6c8);
  bx(g, 0.3, 0.12, 0.04, 0.6, 0.72, 2.06, 0xfff6c8);
  bx(g, 0.3, 0.12, 0.04, -0.6, 0.72, -2.06, 0xd83a2e); bx(g, 0.3, 0.12, 0.04, 0.6, 0.72, -2.06, 0xd83a2e);
  bx(g, 1.84, 0.1, 0.3, 0, 0.42, 2.0, 0x2d2f36);
  let lights = null;
  if (kind === 'taxi') { const s = signMesh('מונית', 0.7, 0.22, { w: 200, h: 64, bg: '#111', fg: '#ffd400', size: 44 }); s.position.set(0, 1.68, -0.3); g.add(s); const s2 = s.clone(); s2.rotation.y = Math.PI; g.add(s2); M.box(0.72, 0.24, 0.12, 0, 1.66, -0.3, 0x111111); }
  if (kind === 'police') {
    bx(g, 1.86, 0.2, 4.14, 0, 0.75, 0, 0x1f4fb8);
    for (const side of [-1, 1]) { const s = signMesh('משטרה', 1.4, 0.3, { w: 300, h: 64, bg: '#1f4fa8', fg: '#ffffff', size: 46 }); s.position.set(side * 0.935, 0.75, 0); s.rotation.y = side * Math.PI / 2; g.add(s); }
    const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false }), blue = new THREE.MeshBasicMaterial({ color: 0x2a6bff, toneMapped: false }), off = MAT(0x444444);
    const a = new THREE.Mesh(GEO.box, red); a.scale.set(0.5, 0.16, 0.3); a.position.set(-0.32, 1.62, -0.3); g.add(a);
    const b = new THREE.Mesh(GEO.box, blue); b.scale.set(0.5, 0.16, 0.3); b.position.set(0.32, 1.62, -0.3); g.add(b);
    lights = { a, b, red, blue, off };
  }
  for (const z of [-1.35, 1.35]) for (const x of [-0.85, 0.85]) wheel(g, _vg.wheelC, x, 0.34, z);
  M.build(g); return { g, len: 4.1, wid: 1.9, lights };
}

/* ---------- traffic ---------- */
const CAR_COLORS = [0xe2463b, 0xf4f4f6, 0x2b5fd9, 0x9fd3e8, 0x30323a, 0xf2a81d, 0x8fbf5a, 0xc9c9cf, 0xd94f8a, 0xffffff, 0x1d2840];
const LANES = [];
for (const s of NS) {
  for (const l of s.lanes) LANES.push({ axis: 'ns', c: s.x + l.off, dir: l.dir, street: s, kind: 'car', a0: NS_Z0, a1: NS_Z1 });
  for (const l of s.bikeLanes || []) LANES.push({ axis: 'ns', c: s.x + l.off, dir: l.dir, street: s, kind: 'bike', a0: s.tayelet ? -230 : NS_Z0, a1: s.tayelet ? 230 : NS_Z1 });
}
for (const e of EW) for (const l of e.lanes) LANES.push({ axis: 'ew', c: e.z + l.off, dir: l.dir, street: e, kind: 'car', a0: e.x0 - 12, a1: e.x1 + 3 });

/* pick an along-lane coordinate near the player but out of sight-ish */
function laneSpot(L, minD, maxD) {
  const P = PLAYER.pos, along = L.axis === 'ns' ? P.z : P.x, across = L.axis === 'ns' ? P.x : P.z;
  if (Math.abs(across - L.c) > maxD) return null;
  for (let k = 0; k < 4; k++) {
    const a = clamp(along + (Math.random() < 0.5 ? -1 : 1) * rand(minD, maxD), L.a0 + 2, L.a1 - 2);
    const x = L.axis === 'ns' ? L.c : a, z = L.axis === 'ns' ? a : L.c;
    if (Math.hypot(x - P.x, z - P.z) > minD * 0.8) return a;
  }
  return null;
}

class Car {
  constructor(lane, a, kind) {
    this.lane = lane; this.a = a; this.kind = kind;
    const m = makeCarMesh(kind, kind === 'taxi' ? 0xf6d02f : pick(CAR_COLORS));
    this.mesh = m.g; this.len = m.len; this.wid = m.wid;
    this.max = kind === 'bus' ? 9 : rand(10, 14); this.v = this.max * 0.7; this.blocked = 0; this.honkCd = 0;
    this.orient(); scene.add(this.mesh); this.place();
  }
  orient() { const L = this.lane; this.mesh.rotation.y = L.axis === 'ns' ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
  get x() { return this.lane.axis === 'ns' ? this.lane.c : this.a; }
  get z() { return this.lane.axis === 'ns' ? this.a : this.lane.c; }
  place() { this.mesh.position.set(this.x, 0, this.z); }
  aabb() { const hl = this.len / 2, hw = this.wid / 2; return this.lane.axis === 'ns' ? [this.x - hw, this.z - hl, this.x + hw, this.z + hl] : [this.x - hl, this.z - hw, this.x + hl, this.z + hw]; }
  recycle() {
    const lanes = shuffle(LANES.filter((l) => l.kind === 'car' && (this.kind !== 'bus' || l.street.bus)));
    for (const L of lanes) {
      const a = laneSpot(L, 70, 140); if (a == null) continue;
      if (TRAFFIC.cars.some((c) => c !== this && c.lane === L && Math.abs(c.a - a) < 14)) continue;
      this.lane = L; this.a = a; this.v = this.max * 0.6; this.orient(); this.place(); return;
    }
  }
  update(dt) {
    const L = this.lane, d = L.dir, front = this.a + d * this.len / 2;
    let limit = 1e9, byPlayer = false;
    for (const I of WORLD.intersections) {
      if (L.axis === 'ns' ? I.ns !== L.street : I.ew !== L.street) continue;
      const stop = L.axis === 'ns' ? (d < 0 ? I.ew.z + EWS + 0.8 : I.ew.z - EWS - 0.8) : (d > 0 ? I.sx0 - 0.6 : I.sx1 + 0.6);
      const dist = (stop - front) * d;
      if (dist < -0.5 || dist > 40) continue;
      const st = lightState(I, L.axis);
      if (st === 'red' || (st === 'yellow' && dist > 6)) limit = Math.min(limit, dist);
    }
    const check = (ox, oz, half, lat, isP) => {
      const along = (L.axis === 'ns' ? oz : ox), side = (L.axis === 'ns' ? ox : oz);
      if (Math.abs(side - L.c) > lat) return;
      const dist = (along - this.a) * d - this.len / 2 - half;
      if (dist > -1.5 && dist < limit) { limit = Math.max(0, dist); byPlayer = isP; }
    };
    for (const c of TRAFFIC.cars) if (c !== this && c.lane === L) check(c.x, c.z, c.len / 2 + 1.2, 1, false);
    if (PLAYER.active) check(PLAYER.pos.x, PLAYER.pos.z, 0.8, this.wid / 2 + 0.6, true);
    for (const p of TRAFFIC.peds) if (p.root.visible) check(p.root.position.x, p.root.position.z, 0.5, this.wid / 2 + 0.4, false);
    for (const ins of INSPECTORS) check(ins.pos.x, ins.pos.z, 0.6, this.wid / 2 + 0.5, false);
    for (const pc of POLICE.cars) check(pc.pos.x, pc.pos.z, 2.2, this.wid / 2 + 1, false);
    const target = limit < 1e8 ? clamp((limit - 1.2) * 1.1, 0, this.max) : this.max;
    const acc = target > this.v ? 3.2 : 10;
    this.v += clamp(target - this.v, -acc * dt, acc * dt);
    this.a += d * this.v * dt;
    if (byPlayer && this.v < 0.5) { this.blocked += dt; if (this.blocked > 1.3 && this.honkCd <= 0) { this.honkCd = 5; this.blocked = 0; say(this.mesh, pick(LINES.honk), 2.2, 'honk', 2.4); SFX.honk(this.mesh.position); } }
    else this.blocked = 0;
    this.honkCd -= dt;
    if (this.a > L.a1) this.a = L.a0 + 1; if (this.a < L.a0) this.a = L.a1 - 1;
    this.place();
  }
}
class Rider {
  constructor(lane, a) {
    this.lane = lane; this.a = a; this.max = rand(6.5, 9); this.v = this.max;
    this.root = new THREE.Group(); scene.add(this.root);
    const sc = makeScooter(pick([0x1f9b6b, 0x2b9bd9, 0xf26a1d])); this.root.add(sc.g); this.veh = sc;
    this.p = makePerson({ shirt: pick([0x2b9bd9, 0x1f9b6b, 0xf26a1d]), cap: pick([0x2b9bd9, 0x1f9b6b, null]) });
    this.p.root.position.set(0, sc.riderY, sc.riderZ); this.root.add(this.p.root);
    bx(this.p.chest, 0.5, 0.5, 0.36, 0, 0.0, -0.34, pick([0x2b9bd9, 0x1f9b6b, 0xf26a1d]));
    resetPose(this.p);
    this.orient();
    this.sayCd = rand(4, 20);
  }
  orient() { const L = this.lane; this.root.rotation.y = L.axis === 'ns' ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
  get x() { return this.lane.axis === 'ns' ? this.lane.c : this.a; }
  get z() { return this.lane.axis === 'ns' ? this.a : this.lane.c; }
  update(dt, t) {
    const L = this.lane, d = L.dir;
    let limit = 1e9;
    const check = (ox, oz, lat) => { if (Math.abs((L.axis === 'ns' ? ox : oz) - L.c) > lat) return; const dist = ((L.axis === 'ns' ? oz : ox) - this.a) * d - 1.2; if (dist > -0.8 && dist < limit) limit = Math.max(0, dist); };
    if (PLAYER.active) check(PLAYER.pos.x, PLAYER.pos.z, 1.0);
    for (const p of TRAFFIC.peds) if (p.root.visible) check(p.root.position.x, p.root.position.z, 0.8);
    const target = limit < 1e8 ? clamp(limit * 1.2, 0, this.max) : this.max;
    this.v += clamp(target - this.v, -8 * dt, 3 * dt);
    this.a += d * this.v * dt;
    if (this.a > L.a1) this.a = L.a0 + 1; if (this.a < L.a0) this.a = L.a1 - 1;
    if (Math.hypot(this.x - PLAYER.pos.x, this.z - PLAYER.pos.z) > 180) { const a = laneSpot(L, 60, 130); if (a != null) this.a = a; }
    this.root.position.set(this.x, SURF_H.bike, this.z);
    poseScooter(this.p, 0, t, this.v, false);
    for (const w of this.veh.wheels) w.rotation.x += this.v * dt / 0.11;
    this.sayCd -= dt; if (this.sayCd < 0) { this.sayCd = rand(12, 30); if (this.root.position.distanceTo(PLAYER.pos) < 30) say(this.p.head, pick(LINES.riders), 2.2); }
  }
}

/* ---------- pedestrians ---------- */
const PED_PATHS = [];
for (const s of NS) {
  const sw = s.strips.filter((q) => q[2] === 'sidewalk');
  for (const q of sw) PED_PATHS.push({ axis: 'ns', c: s.x + (q[0] + q[1]) / 2, half: (q[1] - q[0]) / 2 - 0.6, a0: -200, a1: 200, street: s, q });
}
for (const e of EW) for (const q of e.strips.filter((q) => q[2] === 'sidewalk')) PED_PATHS.push({ axis: 'ew', c: e.z + (q[0] + q[1]) / 2, half: (q[1] - q[0]) / 2 - 0.6, a0: -98, a1: 172, street: e, q });

const PED_TYPES = [
  ['regular', 50], ['tourist', 9], ['soldier', 9], ['religious', 7], ['grandma', 8], ['jogger', 8], ['kippa', 5], ['hipster', 4],
];
function pickType() { let r = Math.random() * 100; for (const [t, w] of PED_TYPES) { if ((r -= w) < 0) return t; } return 'regular'; }
function personFor(type) {
  const female = Math.random() < 0.5;
  switch (type) {
    case 'tourist': return makePerson({ female, cap: 0xf4f1e6, shorts: true, shirt: pick([0xff8a65, 0x9fd3e8, 0xffffff]), skin: pick([0xf0c3a0, 0xe0ac86]), pack: 0x3a6d8c });
    case 'soldier': return makePerson({ female, shirt: 0x5b6b3a, pants: 0x5b6b3a, shoes: 0x2a2a2a, pack: 0x4d5a31, sleeves: 'long', hair: pick(HAIRS) });
    case 'religious': return makePerson({ shirt: 0xffffff, pants: 0x151515, hat: 'fedora', beard: true, hair: 0x14100e, sleeves: 'long', shoes: 0x111111 });
    case 'grandma': return makePerson({ female: true, hair: 0xc8c8c8, shirt: pick([0x7a4fd6, 0xd94f8a, 0x4db6ac, 0x8d6e63]), dress: true, pants: 0x333333, shoes: 0x5a4a3a, belly: true, sleeves: 'long' });
    case 'jogger': return makePerson({ female, shirt: pick([0xff3d7f, 0x2bd96b, 0x2b9bd9]), sleeves: 'none', shorts: true, pants: 0x222222, shoes: 0xffffff });
    case 'kippa': return makePerson({ kippa: pick([0x2b58c9, 0xffffff, 0x111111]), shirt: pick([0xffffff, 0x9fd3e8]), pants: 0x3a3a40 });
    case 'hipster': return makePerson({ beard: true, shirt: pick([0x2e2f3a, 0x8d6e63]), pants: 0x2b3a5c, cap: Math.random() < 0.5 ? 0x8d6e63 : null, pack: 0x8d6e63 });
    default: return makePerson({ female, cap: Math.random() < 0.15 ? pick([0x2b5fd9, 0x2e2f3a, 0xe2463b]) : null, shirtless: !female && Math.random() < 0.08, chain: !female && Math.random() < 0.2, shorts: Math.random() < 0.35, belly: Math.random() < 0.15, sleeves: Math.random() < 0.3 ? 'none' : 'short', dress: female && Math.random() < 0.2 });
  }
}

class Ped {
  constructor(path, type) {
    this.path = path; this.type = type || pickType(); this.tourist = this.type === 'tourist';
    this.p = personFor(this.type);
    this.root = this.p.root; scene.add(this.root);
    this.a = rand(path.a0, path.a1); this.off = rand(-path.half, path.half); this.dir = Math.random() < 0.5 ? 1 : -1;
    this.speed = this.type === 'jogger' ? rand(2.8, 3.4) : this.type === 'grandma' ? rand(0.6, 0.8) : this.tourist ? rand(0.7, 1.0) : rand(1.1, 1.6);
    this.state = 'walk'; this.timer = rand(3, 12); this.fall = 0;
    this.cross = null; this.sayCd = rand(5, 40);
    if (Math.random() < 0.13 && this.type === 'regular') this.dog = makeDog();
    if (this.type === 'grandma') { this.cart = new THREE.Group(); bx(this.cart, 0.35, 0.5, 0.3, 0, 0.45, 0, pick([0x2b58c9, 0xe2463b, 0x7a4fd6])); bx(this.cart, 0.03, 0.5, 0.03, 0, 0.9, -0.15, 0x555555); wheel(this.cart, _vg.wheelS, 0, 0.12, 0.05); this.cart.position.set(0.32, 0, 0.45); this.root.add(this.cart); }
    this.place();
  }
  place() {
    const P = this.path;
    let x, z;
    if (this.cross) { x = this.cross.x; z = this.cross.z; }
    else if (P.axis === 'ns') { x = P.c + this.off; z = this.a; } else { x = this.a; z = P.c + this.off; }
    this.root.position.set(x, SURF_H[surfaceAt(x, z)] || 0, z);
  }
  /* knocked down; fast hits send people flying (cartoon style) */
  hit(dir, speed) {
    if (this.state === 'fallen' || this.state === 'fly') return false;
    this.fallDir = Math.atan2(dir.x, dir.z); this.cross = null;
    if (speed > 6) {
      this.state = 'fly'; this.vel = new THREE.Vector3(dir.x * speed * 0.75, 3.5 + speed * 0.3, dir.z * speed * 0.75); this.spin = rand(6, 12) * (Math.random() < 0.5 ? -1 : 1);
      say(this.p.head, pick(['אאאאאא!', 'אמאל׳ה!!!', 'וואייייי!']), 1.6, 'angry');
    } else { this.state = 'fallen'; this.fall = 0; say(this.p.head, G(pick(LINES.pedHit)), 2.4, 'angry'); }
    return true;
  }
  syncPathFromPos() {
    const P = this.path, x = this.root.position.x, z = this.root.position.z;
    if (P.axis === 'ns') { this.a = clamp(z, P.a0, P.a1); this.off = clamp(x - P.c, -P.half - 3, P.half + 3); } else { this.a = clamp(x, P.a0, P.a1); this.off = clamp(z - P.c, -P.half - 3, P.half + 3); }
  }
  respawnNear() {
    const P = PLAYER.pos;
    for (let k = 0; k < 6; k++) {
      const path = pick(PED_PATHS), across = path.axis === 'ns' ? P.x : P.z, along = path.axis === 'ns' ? P.z : P.x;
      if (Math.abs(across - path.c) > 80) continue;
      const a = clamp(along + (Math.random() < 0.5 ? -1 : 1) * rand(40, 85), path.a0, path.a1);
      const x = path.axis === 'ns' ? path.c : a, z = path.axis === 'ns' ? a : path.c;
      if (Math.hypot(x - P.x, z - P.z) < 35) continue;
      this.path = path; this.a = a; this.off = rand(-path.half, path.half); this.cross = null; this.state = 'walk'; this.p.body.rotation.x = 0; this.place();
      if (this.dog) this.dog.g.position.copy(this.root.position);
      return;
    }
  }
  update(dt, t) {
    const P = this.path, p = this.p;
    if (this.state === 'fly') {
      const pos = this.root.position; this.vel.y -= 22 * dt;
      pos.addScaledVector(this.vel, dt);
      collideStatic(pos, 0.3);
      this.root.rotation.y = this.fallDir; p.body.rotation.x += this.spin * dt;
      const gy = SURF_H[surfaceAt(pos.x, pos.z)] || 0;
      if (pos.y <= gy && this.vel.y < 0) { pos.y = gy; this.state = 'fallen'; this.fall = 0.35; this.downFor = 5; SFX.bump(); this.syncPathFromPos(); }
      return;
    }
    if (this.state === 'fallen') {
      this.fall += dt;
      const down = this.downFor || 2.2;
      const k = this.fall < 0.35 ? this.fall / 0.35 : this.fall < down ? 1 : Math.max(0, 1 - (this.fall - down) / 0.5);
      this.root.rotation.set(0, this.fallDir, 0); p.body.rotation.x = -k * 1.45; p.body.position.y = k * 0.15;
      if (this.fall > down + 0.5) { this.state = 'walk'; p.body.rotation.x = 0; this.timer = rand(2, 6); this.downFor = 0; if (Math.random() < 0.5) say(p.head, pick(['אני בסדר... אני בסדר', 'אני אתבע אותך!', 'וואו... איפה אני?']), 2.2); }
      return;
    }
    this.timer -= dt; this.sayCd -= dt;
    if (this.state === 'walk' || this.state === 'flee') {
      if (this.cross) {
        const c = this.cross, dx = c.tx - c.x, dz = c.tz - c.z, dd = Math.hypot(dx, dz);
        if (dd < 0.2) { this.path = c.to; this.a = c.toA; this.off = 0; this.cross = null; }
        else { const v = this.speed * 1.2 * dt; c.x += dx / dd * v; c.z += dz / dd * v; this.root.rotation.y = Math.atan2(dx, dz); }
      } else {
        const sp = this.state === 'flee' ? 3.6 : this.speed;
        this.a += this.dir * sp * dt;
        if (this.a > P.a1 || this.a < P.a0) { this.dir *= -1; this.a = clamp(this.a, P.a0, P.a1); }
        this.off = clamp(this.off, -P.half, P.half);
        this.root.rotation.y = P.axis === 'ns' ? (this.dir > 0 ? 0 : Math.PI) : (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      poseWalk(p, this.state === 'flee' ? 3.6 : this.speed, dt);
      if (this.state === 'flee' && this.timer < 0) { this.state = 'walk'; this.timer = rand(4, 10); }
      if (this.state === 'walk' && this.timer < 0 && !this.cross) {
        const r = Math.random();
        if (r < 0.32 && this.type !== 'jogger') { this.state = 'idle'; this.timer = this.tourist ? rand(3, 7) : rand(1.5, 4); }
        else if (r < 0.47) { this.dir *= -1; this.timer = rand(4, 12); }
        else if (r < 0.6 && P.axis === 'ns' && !P.street.tayelet && !EW.some((e) => Math.abs(this.a - e.z) < 13)) {
          const other = PED_PATHS.find((q) => q.street === P.street && q !== P && Math.abs(q.c - P.c) > 8);
          if (other) { const x = P.c + this.off; this.cross = { x, z: this.a, tx: other.c, tz: this.a + rand(-2, 2), to: other, toA: this.a }; }
          this.timer = rand(5, 12);
        } else this.timer = rand(3, 10);
      }
    } else {
      poseIdle(p, t);
      if (this.tourist) { p.armL.rotation.x = -1.4; p.armR.rotation.x = -1.4; p.elbowL.rotation.x = -0.6; p.elbowR.rotation.x = -0.6; }
      if (this.timer < 0) { this.state = 'walk'; this.timer = rand(4, 12); }
      if (this.sayCd < 0) {
        this.sayCd = rand(14, 40);
        if (this.root.position.distanceToSquared(PLAYER.pos) < 400) say(p.head, this.tourist ? pick(LINES.tourist) : pick(LINES.typeLines[this.type] || LINES.pedIdle), 2.6);
      }
    }
    this.place();
    if (this.dog) {
      const d = this.dog, back = 0.9;
      const tx = this.root.position.x - Math.sin(this.root.rotation.y) * back + 0.4, tz = this.root.position.z - Math.cos(this.root.rotation.y) * back;
      const dx = tx - d.g.position.x, dz = tz - d.g.position.z, dd = Math.hypot(dx, dz);
      if (dd > 0.05) { d.g.position.x += dx * Math.min(1, dt * 4); d.g.position.z += dz * Math.min(1, dt * 4); d.g.rotation.y = Math.atan2(dx, dz); }
      d.g.position.y = this.root.position.y;
      const sw = Math.sin(t * 14) * Math.min(1, dd * 2) * 0.5; d.legs.forEach((l, i) => (l.rotation.x = i % 2 ? sw : -sw)); d.tail.rotation.z = Math.sin(t * 12) * 0.5;
    }
  }
}
function makeDog() {
  const g = new THREE.Group(); scene.add(g);
  const c = pick([0xc8a06a, 0x3b2a1e, 0xf4f1e6, 0x8c6a4a]);
  bx(g, 0.22, 0.2, 0.5, 0, 0.32, 0, c); bx(g, 0.18, 0.18, 0.2, 0, 0.45, 0.3, c); bx(g, 0.1, 0.08, 0.1, 0, 0.42, 0.42, 0x222222);
  const legs = []; for (const [x, z] of [[-0.07, 0.18], [0.07, 0.18], [-0.07, -0.18], [0.07, -0.18]]) { const l = new THREE.Group(); l.position.set(x, 0.24, z); g.add(l); bx(l, 0.06, 0.24, 0.06, 0, -0.12, 0, c); legs.push(l); }
  const tail = new THREE.Group(); tail.position.set(0, 0.4, -0.25); g.add(tail); bx(tail, 0.04, 0.2, 0.04, 0, 0.1, 0, c);
  return { g, legs, tail };
}

/* ---------- street cats (very Tel Aviv) ---------- */
const CATS_LIST = [];
class Cat {
  constructor(x, z) {
    const g = new THREE.Group(); scene.add(g); this.g = g;
    const c = pick([0xe08a3c, 0x9a9a9a, 0x1f1f1f, 0xf4f1e6, 0xc9a06a]), M = new StaticBuilder({ single: true, cast: true });
    M.box(0.16, 0.16, 0.4, 0, 0.2, 0, c); M.box(0.15, 0.14, 0.14, 0, 0.32, 0.22, c);
    M.box(0.04, 0.07, 0.03, -0.045, 0.42, 0.22, c); M.box(0.04, 0.07, 0.03, 0.045, 0.42, 0.22, c);
    for (const [lx, lz] of [[-0.05, 0.13], [0.05, 0.13], [-0.05, -0.13], [0.05, -0.13]]) M.box(0.04, 0.12, 0.04, lx, 0.06, lz, c);
    M.build(g);
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.25, -0.2); g.add(this.tail); bx(this.tail, 0.03, 0.3, 0.03, 0, 0.15, 0, c);
    g.position.set(x, 0.16, z); g.rotation.y = rand(0, 6); this.home = { x, z }; this.run = 0; this.cd = rand(5, 30);
  }
  update(dt, t) {
    const P = PLAYER.pos, dx = this.g.position.x - P.x, dz = this.g.position.z - P.z, d = Math.hypot(dx, dz);
    if (d > 60) return;
    if (d < 4 && Math.abs(PLAYER.speed) > 2 && this.run <= 0) { this.run = 1.4; this.dir = Math.atan2(dx, dz) + rand(-0.6, 0.6); if (Math.random() < 0.4) say(this.g, pick(['מיאו!', 'חחחחח', 'מררר!']), 1.2, '', 0.6); }
    if (this.run > 0) {
      this.run -= dt; this.g.rotation.y = this.dir;
      this.g.position.x += Math.sin(this.dir) * 6 * dt; this.g.position.z += Math.cos(this.dir) * 6 * dt; collideStatic(this.g.position, 0.2);
      this.g.position.y = (SURF_H[surfaceAt(this.g.position.x, this.g.position.z)] || 0) + Math.abs(Math.sin(t * 20)) * 0.05;
    } else { this.tail.rotation.z = Math.sin(t * 2 + this.home.x) * 0.4; this.cd -= dt; if (this.cd < 0 && d < 15) { this.cd = rand(15, 40); say(this.g, 'מיאו', 1.2, '', 0.6); } }
  }
}

/* ---------- static characters (kiosk guys, sellers, matkot, protesters) ---------- */
const EXTRAS = [];
function spawnExtras() {
  const K = WORLD.kiosk;
  const chair = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, SURF_H.sidewalk, z); g.rotation.y = ry; scene.add(g);
    const W = 0xf2f2f6; bx(g, 0.48, 0.05, 0.46, 0, 0.45, 0, W);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) bx(g, 0.04, 0.45, 0.04, lx, 0.22, lz, W);
    for (let i = 0; i < 4; i++) bx(g, 0.04, 0.5, 0.03, -0.15 + i * 0.1, 0.72, -0.22, W);
    bx(g, 0.48, 0.05, 0.04, 0, 0.98, -0.22, W);
    return g;
  };
  const seats = [[K.x + 1.6, K.z + 1.2, -2.2], [K.x + 2.2, K.z + 2.9, -1.4], [K.x - 0.2, K.z + 4.4, Math.PI + 0.3]];
  seats.forEach(([x, z, ry], i) => {
    chair(x, z, ry);
    const p = makePerson({ shirtless: i !== 1, chain: true, pants: 0xf3f1ec, cap: i === 2 ? 0x1b1b1b : null, skin: pick([0xd09a72, 0xb97f5a, 0x8d5a3b]), shoes: 0x1b1b1b });
    p.root.position.set(x, SURF_H.sidewalk, z); p.root.rotation.y = ry; scene.add(p.root);
    EXTRAS.push({ p, kind: 'sit', lines: LINES.kiosk, cd: rand(3, 15) });
  });
  { const p = makePerson({ shirtless: true, chain: true, pants: 0xf3f1ec, cap: 0x5a4a3a });
    p.root.position.set(K.x + 0.6, SURF_H.sidewalk, K.z + 2.2); p.root.rotation.y = -2.4; scene.add(p.root);
    EXTRAS.push({ p, kind: 'talk', lines: LINES.kiosk, cd: rand(5, 12) }); }
  for (let x = MARKET.x0 + 4.5; x < MARKET.x1 - 2; x += 9.2) {
    const p = makePerson({ shirt: pick(SHIRTS), cap: pick([0xe2463b, 0x2b5fd9, null]), belly: true });
    p.root.position.set(x, SURF_H.sidewalk, 87.4); p.root.rotation.y = Math.PI; scene.add(p.root);
    EXTRAS.push({ p, kind: 'talk', lines: LINES.market, cd: rand(2, 8), loud: true });
  }
  // housing protest on Rothschild
  if (WORLD.protest) for (let i = 0; i < (LOW ? 5 : 8); i++) {
    const p = makePerson({ female: Math.random() < 0.5, shirt: pick([0xffffff, 0xe2463b, 0x2b5fd9]) });
    const x = WORLD.protest.x + rand(-1.6, 1.6), z = WORLD.protest.z + rand(-16, 16);
    p.root.position.set(x, SURF_H.bike, z); p.root.rotation.y = rand(0, 6); scene.add(p.root);
    if (i % 2 === 0) { const s = signMesh(pick(['דיור!', 'צדק חברתי', 'די ליוקר!', 'מחאה!']), 0.9, 0.5, { w: 256, h: 140, bg: '#ffffff', fg: '#c62828', size: 64, border: '#1b1d2a' }); s.position.set(0, 0.55, 0.15); p.armR.add(s); s.rotation.x = Math.PI; }
    addCircle(x, z, 0.3);
    EXTRAS.push({ p, kind: 'protest', lines: LINES.protest, cd: rand(2, 10), loud: true });
  }
  for (const z of [-40, 55, 150]) {
    const a = makePerson({ shirtless: true, shorts: true, pants: pick([0xe2463b, 0x2b5fd9]), shoes: 0xd09a72 });
    const b = makePerson({ female: true, shorts: true, shirt: 0xf6c6d6, shoes: 0xd09a72 });
    a.root.position.set(-128, 0.05, z); b.root.position.set(-128, 0.05, z + 7); a.root.rotation.y = 0; b.root.rotation.y = Math.PI;
    scene.add(a.root); scene.add(b.root);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), MAT(0xffffff)); scene.add(ball);
    EXTRAS.push({ kind: 'matkot', a, b, ball, z, t: Math.random() * 2, cd: 4 });
  }
  for (let i = 0; i < 9; i++) {
    const p = makePerson({ shirtless: Math.random() < 0.5, shorts: true });
    p.root.position.set(rand(-140, -120), 0.05, rand(-190, 190)); p.root.rotation.y = rand(0, 6); scene.add(p.root);
    EXTRAS.push({ p, kind: 'sit', lines: null, cd: 99 });
  }
}
function updateExtras(dt, t) {
  for (const e of EXTRAS) {
    if (e.kind === 'matkot') {
      if (e.a.root.position.distanceToSquared(PLAYER.pos) > 3600) continue;
      e.t += dt; const ph = (e.t % 1.6) / 1.6, toB = Math.floor(e.t / 1.6) % 2 === 0;
      const z0 = toB ? e.z + 0.5 : e.z + 6.5, z1 = toB ? e.z + 6.5 : e.z + 0.5;
      e.ball.position.set(-128 + 0.3, 1.3 + Math.sin(ph * Math.PI) * 1.2, lerp(z0, z1, ph));
      const hitter = toB ? e.a : e.b, other = toB ? e.b : e.a;
      resetPose(hitter); resetPose(other);
      hitter.armR.rotation.x = -1.2 + Math.max(0, 0.6 - ph * 3) * -1.5; hitter.armR.rotation.z = 0.4;
      other.armR.rotation.x = -0.6 - ph * 0.8; other.armR.rotation.z = 0.4;
      e.cd -= dt; if (e.cd < 0) { e.cd = rand(5, 12); if (e.a.root.position.distanceToSquared(PLAYER.pos) < 900) say(e.a.head, pick(LINES.matkot), 1.2); }
      continue;
    }
    const near = e.p.root.position.distanceToSquared(PLAYER.pos) < 2500;
    if (!near) continue;
    if (e.kind === 'sit') poseSit(e.p, t);
    else if (e.kind === 'protest') { poseIdle(e.p, t); e.p.armR.rotation.x = -2.8 + Math.sin(t * 4 + e.p.phase) * 0.25; e.p.armL.rotation.x = -0.4 - Math.abs(Math.sin(t * 4 + e.p.phase)) * 0.8; e.p.body.position.y = Math.abs(Math.sin(t * 4 + e.p.phase)) * 0.06; }
    else { poseIdle(e.p, t); poseTalk(e.p, t, e.loud ? 1 : 0.5); }
    if (e.lines) { e.cd -= dt; if (e.cd < 0) { e.cd = rand(8, 22); if (e.p.root.position.distanceToSquared(PLAYER.pos) < 600) say(e.p.head, G(pick(e.lines)), 2.6, e.loud ? 'loud' : ''); } }
  }
}

const TRAFFIC = { cars: [], riders: [], peds: [] };
function spawnTraffic() {
  const carLanes = LANES.filter((l) => l.kind === 'car');
  const nCars = LOW ? 22 : 34;
  let buses = 0;
  for (let i = 0; i < nCars; i++) {
    const L = carLanes[i % carLanes.length];
    const kind = L.street.bus && buses < 4 && Math.random() < 0.5 ? (buses++, 'bus') : Math.random() < 0.18 ? 'taxi' : 'car';
    TRAFFIC.cars.push(new Car(L, rand(L.a0 + 10, L.a1 - 10), kind));
  }
  for (const L of LANES.filter((l) => l.kind === 'bike')) TRAFFIC.riders.push(new Rider(L, rand(L.a0 + 10, L.a1 - 10)));
  const nPeds = LOW ? 32 : 54;
  for (let i = 0; i < nPeds; i++) TRAFFIC.peds.push(new Ped(PED_PATHS[i % PED_PATHS.length]));
  const bins = shuffle(WORLD.bins.slice()).slice(0, LOW ? 14 : 24);
  for (const b of bins) CATS_LIST.push(new Cat(b.x + rand(-0.5, 0.5), b.z + rand(-0.6, 0.6)));
}
function updateTraffic(dt, t) {
  const px = PLAYER.pos.x, pz = PLAYER.pos.z, far = LOW ? 70 : 95;
  for (const c of TRAFFIC.cars) {
    if (Math.hypot(c.x - px, c.z - pz) > 175) c.recycle();
    c.update(dt);
  }
  for (const r of TRAFFIC.riders) r.update(dt, t);
  for (const p of TRAFFIC.peds) {
    const dx = p.root.position.x - px, dz = p.root.position.z - pz;
    if (dx * dx + dz * dz > far * far && p.state !== 'fly' && p.state !== 'fallen') { p.respawnNear(); }
    const vis = (p.root.position.x - px) ** 2 + (p.root.position.z - pz) ** 2 < far * far;
    p.root.visible = vis; if (p.dog) p.dog.g.visible = vis;
    if (!vis) continue;
    p.update(dt, t);
  }
  for (const c of CATS_LIST) c.update(dt, t);
}
