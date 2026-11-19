'use strict';
/* ============================================================
   WORLD: a small Tel-Aviv-inspired district
   x = east, z = south (north = -z)
   ============================================================ */
const MAPB = { xMin: -144, xMax: 93, zMin: -126, zMax: 126 };
const NS = [
  { name: 'הטיילת', x: -100, strips: [[-12, -7, 'sidewalk'], [-7, -4, 'bike'], [-4, 0, 'sidewalk']], lanes: [], bikeLanes: [{ off: -6.2, dir: 1 }, { off: -4.8, dir: -1 }], tayelet: true },
  { name: 'בן יהודה', x: -55, strips: [[-10, -5, 'sidewalk'], [-5, 5, 'road'], [5, 10, 'sidewalk']], lanes: [{ off: 2.5, dir: -1 }, { off: -2.5, dir: 1 }] },
  { name: 'דיזנגוף', x: 0, strips: [[-11, -6, 'sidewalk'], [-6, 6, 'road'], [6, 8.5, 'bike'], [8.5, 13.5, 'sidewalk']], lanes: [{ off: 3, dir: -1 }, { off: -3, dir: 1 }], bikeLanes: [{ off: 6.7, dir: -1 }, { off: 7.8, dir: 1 }], bus: true },
  { name: 'שדרות רוטשילד', x: 65, strips: [[-17, -13, 'sidewalk'], [-13, -7, 'road'], [-7, -2, 'sidewalk'], [-2, 2, 'bike'], [2, 7, 'sidewalk'], [7, 13, 'road'], [13, 17, 'sidewalk']], lanes: [{ off: -10, dir: 1 }, { off: 10, dir: -1 }], bikeLanes: [{ off: -1, dir: 1 }, { off: 1, dir: -1 }], boulevard: true },
];
const EW = [{ name: 'פרישמן', z: -80 }, { name: 'גורדון', z: 0 }, { name: 'אלנבי', z: 80 }].map((s) =>
  Object.assign(s, { strips: [[-9, -5, 'sidewalk'], [-5, 5, 'road'], [5, 9, 'sidewalk']], lanes: [{ off: 2.5, dir: 1 }, { off: -2.5, dir: -1 }], x0: -100, x1: 100 }));
const NS_Z0 = -175, NS_Z1 = 175;
const PLAZA = { x: 31, z: 40, r: 14 };
const MARKET = { x0: -45, x1: -11, z0: 84, z1: 90 };
const PRI = { road: 4, bike: 3, sidewalk: 2 };
const SURF_H = { road: 0, bike: 0.03, sidewalk: 0.16, plaza: 0.22, yard: 0.08, sand: 0.05, sea: 0 };

function surfaceAt(x, z) {
  if (x < -112) return x < -146 ? 'sea' : 'sand';
  let best = null, bp = 0;
  for (let i = 0; i < NS.length; i++) {
    const s = NS[i], dx = x - s.x;
    if (dx < s.strips[0][0] || dx >= s.strips[s.strips.length - 1][1]) continue;
    for (const st of s.strips) if (dx >= st[0] && dx < st[1]) { const p = PRI[st[2]]; if (p > bp) { bp = p; best = st[2]; } }
  }
  if (x >= -100) for (let i = 0; i < EW.length; i++) {
    const s = EW[i], dz = z - s.z;
    if (dz < -9 || dz >= 9) continue;
    for (const st of s.strips) if (dz >= st[0] && dz < st[1]) { const p = PRI[st[2]]; if (p > bp) { bp = p; best = st[2]; } }
  }
  if (best) return best;
  const dx = x - PLAZA.x, dz = z - PLAZA.z;
  if (dx * dx + dz * dz < PLAZA.r * PLAZA.r) return 'plaza';
  return 'yard';
}

function areaName(x, z) {
  if (x < -112) return 'החוף';
  if (x < -100) return 'הטיילת';
  const s = surfaceAt(x, z);
  if (s === 'plaza') return 'כיכר דיזנגוף (בערך)';
  if (x > MARKET.x0 && x < MARKET.x1 && z > 76 && z < 92) return 'שוק הכרמל (כמעט)';
  for (const n of NS) { if (n.tayelet) continue; const dx = x - n.x; if (dx >= n.strips[0][0] && dx < n.strips[n.strips.length - 1][1]) return n.name; }
  for (const e of EW) if (Math.abs(z - e.z) < 9) return 'רחוב ' + e.name;
  if (x > 13 && x < 48 && z > 9 && z < 71) return 'כיכר דיזנגוף (בערך)';
  return 'סמטה';
}

const WORLD = {
  buildings: [], circles: [], intersections: [], shops: [], bikeShop: null, lampMeshes: [],
  grid: new Map(), dyn: new THREE.Group(), animated: [],
};
scene.add(WORLD.dyn);

/* ---------- spatial grid for collisions ---------- */
const GC = 10;
function gridAdd(obj, x0, z0, x1, z1) {
  for (let gx = Math.floor(x0 / GC); gx <= Math.floor(x1 / GC); gx++)
    for (let gz = Math.floor(z0 / GC); gz <= Math.floor(z1 / GC); gz++) {
      const k = gx + ',' + gz; let c = WORLD.grid.get(k); if (!c) WORLD.grid.set(k, c = []); c.push(obj);
    }
}
function addBox(x0, z0, x1, z1, h, kind) { const b = { t: 'b', x0, z0, x1, z1, h: h || 10, kind }; WORLD.buildings.push(b); gridAdd(b, x0, z0, x1, z1); return b; }
function addCircle(x, z, r) { const c = { t: 'c', x, z, r }; WORLD.circles.push(c); gridAdd(c, x - r, z - r, x + r, z + r); return c; }

/* push a circle out of static obstacles. returns hit normal or null */
function collideStatic(p, r) {
  const k = Math.floor(p.x / GC) + ',' + Math.floor(p.z / GC);
  let hit = null;
  for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
    const cell = WORLD.grid.get((Math.floor(p.x / GC) + gx) + ',' + (Math.floor(p.z / GC) + gz));
    if (!cell) continue;
    for (const o of cell) {
      if (o.t === 'b') {
        const cx = clamp(p.x, o.x0, o.x1), cz = clamp(p.z, o.z0, o.z1);
        let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 1e-6) { // inside: push to nearest edge
            const l = p.x - o.x0, rr = o.x1 - p.x, t = p.z - o.z0, b = o.z1 - p.z; const m = Math.min(l, rr, t, b);
            if (m === l) { p.x = o.x0 - r; hit = { x: -1, z: 0 }; } else if (m === rr) { p.x = o.x1 + r; hit = { x: 1, z: 0 }; }
            else if (m === t) { p.z = o.z0 - r; hit = { x: 0, z: -1 }; } else { p.z = o.z1 + r; hit = { x: 0, z: 1 }; }
          } else { const d = Math.sqrt(d2); dx /= d; dz /= d; p.x = cx + dx * r; p.z = cz + dz * r; hit = { x: dx, z: dz }; }
        }
      } else {
        let dx = p.x - o.x, dz = p.z - o.z; const d2 = dx * dx + dz * dz, rr = r + o.r;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); dx /= d; dz /= d; p.x = o.x + dx * rr; p.z = o.z + dz * rr; hit = { x: dx, z: dz }; }
      }
    }
  }
  return hit;
}
/* line of sight (buildings only) */
function hasLOS(x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  for (const b of WORLD.buildings) {
    if (b.kind === 'low') continue;
    let t0 = 0, t1 = 1;
    const ps = [-dx, dx, -dz, dz], qs = [x1 - b.x0, b.x1 - x1, z1 - b.z0, b.z1 - z1];
    let ok = true;
    for (let i = 0; i < 4; i++) {
      if (Math.abs(ps[i]) < 1e-9) { if (qs[i] < 0) { ok = false; break; } }
      else { const t = qs[i] / ps[i]; if (ps[i] < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; } else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; } }
    }
    if (ok && t0 <= t1) return false;
  }
  return true;
}

/* ---------- traffic lights ---------- */
function lightState(I, axis) {
  const t = ((GAME.time + I.offset) % 25 + 25) % 25;
  if (axis === 'ns') return t < 9 ? 'green' : t < 11.5 ? 'yellow' : 'red';
  return t >= 12.5 && t < 21.5 ? 'green' : t >= 21.5 && t < 24 ? 'yellow' : 'red';
}

/* ============================================================ BUILD */
const SHOP_NAMES = [
  ['קפה קטן', 1], ['פלאפל הזקן', 1], ['מיץ טבעי', 1], ['פיצה בלי סוף', 1], ['מכולת 24/7', 0], ['ספרים ישנים', 0], ['בורקס של סבתא', 1],
  ['חומוס אליהו', 1], ['סושי בר', 1], ['גלידה', 1], ['שווארמה', 1], ['מספרה', 0], ['פרחים', 0], ['בייגל', 1], ['קפה שחור', 1], ['יין וגבינות', 0], ['סלולר', 0], ['מאפייה', 1],
];
const SIGN_COLORS = ['#2b5fd9', '#e2463b', '#1f9b6b', '#f2a81d', '#7a4fd6', '#16324f', '#d94f8a'];
const BLD_COLORS = [0xf7f4ee, 0xf4efe6, 0xffffff, 0xf3e6d3, 0xf0d9c8, 0xe9eef2, 0xf6e7b8, 0xf2f0f4];
const AWNING = [0x2b5fd9, 0xe2463b, 0x1f9b6b, 0xf2a81d, 0x2e2f6b, 0xd94f8a, 0x3aa0c8];

function buildWorld() {
  const rng = seeded(1909); // the year Tel Aviv was founded
  const R = (a, b) => a + rng() * (b - a);
  const SB = new StaticBuilder({ cast: true, chunk: 50 });
  const GB = new StaticBuilder({ cast: false, chunk: 80 });

  /* ground */
  GB.box(700, 0.2, 500, -50, -0.1, 0, 0x6c6680);      // asphalt everywhere
  GB.box(34, 0.2, 500, -129, -0.05, 0, 0xecd3a0);     // sand
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 600, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2f9fc9, roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-346, 0.02, 0); sea.receiveShadow = true; scene.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 600), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(-146, 0.07, 0); scene.add(foam);
  WORLD.animated.push((t) => { foam.position.x = -146.5 + Math.sin(t * 0.8) * 1.2; foam.material.opacity = 0.45 + Math.sin(t * 0.8) * 0.2; });

  const nsRoadIntervals = []; // x-intervals where NS road/bike (for EW strip clipping)
  for (const s of NS) for (const st of s.strips) if (st[2] !== 'sidewalk') nsRoadIntervals.push([s.x + st[0], s.x + st[1]]);
  const ewRoadIntervals = EW.map((e) => [e.z - 5, e.z + 5]);
  const complement = (a0, a1, ints) => {
    const out = []; let c = a0; const sorted = ints.slice().sort((p, q) => p[0] - q[0]);
    for (const [i0, i1] of sorted) { if (i1 <= c || i0 >= a1) continue; if (i0 > c) out.push([c, i0]); c = Math.max(c, i1); }
    if (c < a1) out.push([c, a1]); return out;
  };
  const stripColor = { sidewalk: 0xd7cdc4, bike: 0xc2604e };

  /* NS streets */
  for (const s of NS) {
    for (const st of s.strips) {
      if (st[2] === 'road') continue;
      const h = SURF_H[st[2]], segs = s.tayelet ? [[NS_Z0, NS_Z1]] : complement(NS_Z0, NS_Z1, ewRoadIntervals);
      for (const [z0, z1] of segs) GB.box(st[1] - st[0], h + 0.1, z1 - z0, s.x + (st[0] + st[1]) / 2, h / 2 - 0.05 + 0.0, (z0 + z1) / 2, stripColor[st[2]]);
    }
    // curbs + center dashes
    for (const st of s.strips) if (st[2] === 'road') {
      const segs = complement(NS_Z0, NS_Z1, EW.map((e) => [e.z - 9.5, e.z + 9.5]));
      for (const [z0, z1] of segs) {
        for (const side of [st[0], st[1]]) {
          const xx = s.x + side;
          const sideStrip = s.strips.find((q) => (side === st[0] ? q[1] === side : q[0] === side));
          if (!sideStrip || sideStrip[2] !== 'sidewalk') continue;
          GB.box(0.3, 0.19, z1 - z0, xx + (side === st[0] ? 0.15 : -0.15), 0.095, (z0 + z1) / 2, 0xf4f1ea);
          const cc = (Math.abs(xx) + z0) % 3 < 1.5 ? 0x2b5fd9 : 0xd8392e;
          for (let z = z0; z < z1 - 2; z += 4) GB.box(0.32, 0.2, 2, xx + (side === st[0] ? 0.15 : -0.15), 0.1, z + 1, cc);
        }
        if (!s.boulevard) for (let z = z0 + 2; z < z1 - 3; z += 7) GB.box(0.18, 0.02, 3, s.x + (st[0] + st[1]) / 2, 0.01, z + 1.5, 0xf6f2e6);
      }
    }
  }
  /* EW streets */
  for (const e of EW) {
    for (const st of e.strips) {
      if (st[2] === 'road') continue;
      for (const [x0, x1] of complement(e.x0, e.x1, nsRoadIntervals))
        GB.box(x1 - x0, SURF_H.sidewalk + 0.1, st[1] - st[0], (x0 + x1) / 2, SURF_H.sidewalk / 2 - 0.05, e.z + (st[0] + st[1]) / 2, stripColor.sidewalk);
    }
    const nsSpans = NS.map((s) => [s.x + s.strips[0][0] - 0.5, s.x + s.strips[s.strips.length - 1][1] + 0.5]);
    for (const [x0, x1] of complement(e.x0, e.x1, nsSpans)) {
      for (const side of [-5, 5]) {
        GB.box(x1 - x0, 0.19, 0.3, (x0 + x1) / 2, 0.095, e.z + side + (side < 0 ? 0.15 : -0.15), 0xf4f1ea);
        for (let x = x0; x < x1 - 2; x += 4) GB.box(2, 0.2, 0.32, x + 1, 0.1, e.z + side + (side < 0 ? 0.15 : -0.15), side < 0 ? 0xd8392e : 0x2b5fd9);
      }
      for (let x = x0 + 2; x < x1 - 3; x += 7) GB.box(3, 0.02, 0.18, x + 1.5, 0.01, e.z, 0xf6f2e6);
    }
  }

  /* intersections, crosswalks, traffic lights */
  const lampGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const LAMP = { red: new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }), yellow: new THREE.MeshBasicMaterial({ color: 0xffc400, toneMapped: false }), green: new THREE.MeshBasicMaterial({ color: 0x2bff7a, toneMapped: false }) };
  WORLD.LAMP = LAMP;
  let io = 0;
  for (const s of NS) {
    if (s.tayelet) continue;
    const rs = s.strips.filter((q) => q[2] !== 'sidewalk' || s.boulevard).filter((q) => q !== s.strips[0] && q !== s.strips[s.strips.length - 1]);
    const bx0 = s.x + Math.min(...rs.map((q) => q[0])), bx1 = s.x + Math.max(...rs.map((q) => q[1]));
    for (const e of EW) {
      const I = { x0: bx0, x1: bx1, z0: e.z - 5, z1: e.z + 5, ns: s, ew: e, offset: (io++ * 7.3) % 25, cx: (bx0 + bx1) / 2, cz: e.z };
      WORLD.intersections.push(I);
      // zebra on NS roads
      for (const st of s.strips) if (st[2] === 'road' || st[2] === 'bike') {
        for (const zc of [e.z - 7, e.z + 7]) for (let x = s.x + st[0] + 0.5; x < s.x + st[1] - 0.3; x += 1.2) GB.box(0.6, 0.03, 3.4, x + 0.3, 0.02, zc, 0xf7f3ea);
        for (const zc of [e.z - 9.2, e.z + 9.2]) GB.box(st[1] - st[0], 0.03, 0.4, s.x + (st[0] + st[1]) / 2, 0.02, zc, 0xf7f3ea);
      }
      // zebra on EW road (across NS sidewalks)
      for (const st of s.strips) if (st[2] === 'sidewalk' && (st === s.strips[0] || st === s.strips[s.strips.length - 1])) {
        const xc = s.x + (st[0] + st[1]) / 2;
        for (let z = e.z - 4.5; z < e.z + 4.5; z += 1.2) GB.box(st[1] - st[0] - 1, 0.03, 0.6, xc, 0.02, z + 0.3, 0xf7f3ea);
      }
      // two light poles (NE / SW corners)
      const poles = [[bx1 + 1.2, e.z - 6.2], [bx0 - 1.2, e.z + 6.2]];
      I.lamps = [];
      for (const [px, pz] of poles) {
        SB.cyl(0.09, 3.6, px, 1.8, pz, 0x30333d, 6);
        SB.box(0.36, 1.0, 0.22, px, 3.3, pz + 0.0, 0x24262e);      // NS head
        SB.box(0.22, 1.0, 0.36, px + 0.45, 3.3, pz, 0x24262e);     // EW head
        SB.box(0.5, 0.08, 0.08, px + 0.22, 3.0, pz, 0x30333d);
        addCircle(px, pz, 0.25);
        const ln = new THREE.Mesh(lampGeo, LAMP.red); ln.position.set(px, 3.3, pz); WORLD.dyn.add(ln);
        const le = new THREE.Mesh(lampGeo, LAMP.red); le.position.set(px + 0.45, 3.3, pz); WORLD.dyn.add(le);
        I.lamps.push({ m: ln, axis: 'ns', y: 3.3 }, { m: le, axis: 'ew', y: 3.3 });
      }
      // street name sign (Israeli blue)
      const sg = signMesh(e.name, 1.6, 0.42, { w: 384, h: 100, bg: '#1f4fa8', size: 60, border: '#ffffff' });
      sg.position.set(bx0 - 1.2, 2.6, e.z + 6.2 - 0.14); sg.rotation.y = Math.PI; WORLD.dyn.add(sg);
      const sg2 = signMesh(s.name, 1.6, 0.42, { w: 384, h: 100, bg: '#1f4fa8', size: 60, border: '#ffffff' });
      sg2.position.set(bx1 + 1.2 + 0.14, 2.6, e.z - 6.2); sg2.rotation.y = Math.PI / 2; WORLD.dyn.add(sg2);
    }
  }

  /* ---------- blocks & buildings ---------- */
  const xSpans = NS.map((s) => [s.x + s.strips[0][0], s.x + s.strips[s.strips.length - 1][1]]);
  const xBlocks = complement(-100, 100, xSpans);
  const zBlocks = complement(-165, 165, EW.map((e) => [e.z - 9, e.z + 9]));
  let shopIdx = 0;
  const facadeBox = (B, face, along, y, out, w, h, d, color) => {
    // along: offset along facade from its center; out: distance outward from facade
    if (face === 'N') SB.box(w, h, d, B.cx + along, y, B.z0 - out, color);
    else if (face === 'S') SB.box(w, h, d, B.cx - along, y, B.z1 + out, color);
    else if (face === 'W') SB.box(d, h, w, B.x0 - out, y, B.cz - along, color);
    else SB.box(d, h, w, B.x1 + out, y, B.cz + along, color);
  };
  const facadePos = (B, face, along, out) => {
    if (face === 'N') return [B.cx + along, B.z0 - out, Math.PI];
    if (face === 'S') return [B.cx - along, B.z1 + out, 0];
    if (face === 'W') return [B.x0 - out, B.cz - along, -Math.PI / 2];
    return [B.x1 + out, B.cz + along, Math.PI / 2];
  };
  function makeBuilding(x0, z0, x1, z1, face, opts) {
    opts = opts || {};
    const floors = opts.floors || Math.floor(R(2, 5.99));
    const H = 4.2 + floors * 3.1;
    const col = BLD_COLORS[Math.floor(rng() * BLD_COLORS.length)];
    const B = { x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
    const W = face === 'N' || face === 'S' ? x1 - x0 : z1 - z0;
    SB.box(x1 - x0, H, z1 - z0, B.cx, H / 2, B.cz, col);
    addBox(x0, z0, x1, z1, H);
    // ground floor
    facadeBox(B, face, 0, 1.75, 0.06, W * 0.82, 2.7, 0.14, 0x34507e);
    facadeBox(B, face, 0, 3.55, 0.12, W, 0.4, 0.26, 0x2b58c9);
    facadeBox(B, face, 0, 3.3, 0.14, W, 0.09, 0.3, 0xf3c341);
    let shop = null;
    const hasShop = opts.sign || rng() < 0.75;
    if (hasShop) {
      const awn = AWNING[Math.floor(rng() * AWNING.length)];
      if (rng() < 0.7) facadeBox(B, face, 0, 3.0, 0.75, W * 0.7, 0.12, 1.5, awn);
      const nm = opts.sign || SHOP_NAMES[shopIdx++ % SHOP_NAMES.length];
      const sc = opts.signColor || SIGN_COLORS[Math.floor(rng() * SIGN_COLORS.length)];
      const sw = Math.min(W * 0.7, 5.5);
      const sg = signMesh(nm[0], sw, 0.85, { w: 512, h: 128, bg: sc, size: 76 });
      const [sx, sz, ry] = facadePos(B, face, 0, 0.27);
      sg.position.set(sx, 4.2, sz); sg.rotation.y = ry; WORLD.dyn.add(sg);
      const [fx, fz] = facadePos(B, face, 0, 2.6);
      shop = { name: nm[0], food: !!nm[1], x: fx, z: fz, face };
      WORLD.shops.push(shop);
      // cafe chairs on the sidewalk
      if (nm[1] && rng() < 0.5) for (let k = -1; k <= 1; k += 2) {
        const [tx, tz] = facadePos(B, face, k * W * 0.25, 1.2);
        SB.cyl(0.35, 0.05, tx, 0.95, tz, 0xffffff, 8); SB.cyl(0.05, 0.8, tx, 0.55, tz, 0x555555, 5);
        addCircle(tx, tz, 0.4);
      }
    }
    // upper floors: Bauhaus ribbon windows & balconies
    const balc = rng() < 0.6;
    for (let f = 0; f < floors; f++) {
      const y = 4.2 + f * 3.1;
      facadeBox(B, face, 0, y + 1.6, 0.05, W * (balc ? 0.6 : 0.78), 1.25, 0.1, 0x3b5683);
      if (balc) {
        facadeBox(B, face, 0, y + 0.1, 0.55, W * 0.66, 0.18, 1.1, col);
        facadeBox(B, face, 0, y + 0.55, 1.05, W * 0.66, 0.75, 0.12, col);
      } else if (rng() < 0.5) facadeBox(B, face, W * 0.3, y + 1.0, 0.25, 0.8, 0.5, 0.45, 0xdedede); // AC unit
      if (rng() < 0.25) facadeBox(B, face, -W * 0.36, y + 1.4, 0.3, 0.5, 2.0, 0.4, 0x8fa6c9);       // shutters
    }
    // roof: solar water heaters ("dud shemesh") + parapet
    SB.box(x1 - x0, 0.5, 0.3, B.cx, H + 0.25, z0 + 0.15, col); SB.box(x1 - x0, 0.5, 0.3, B.cx, H + 0.25, z1 - 0.15, col);
    const nH = Math.floor(R(1, 3.99));
    for (let k = 0; k < nH; k++) {
      const hx = R(x0 + 1.5, x1 - 1.5), hz = R(z0 + 1.5, z1 - 1.5);
      SB.add(GEO.cyl(8), 0xf4f4f6, hx, H + 1.25, hz, 0.75, 1.6, 0.75, 0, 0, Math.PI / 2);
      SB.box(0.1, 0.9, 0.1, hx - 0.5, H + 0.45, hz, 0x777777); SB.box(0.1, 0.9, 0.1, hx + 0.5, H + 0.45, hz, 0x777777);
      SB.add(GEO.box, 0x2c4aa0, hx, H + 0.6, hz + 1.3, 1.8, 0.08, 1.2, -0.5, 0, 0);
    }
    if (rng() < 0.3) SB.box(1.4, 0.5, 2.0, R(x0 + 2, x1 - 2), H + 0.25, R(z0 + 2, z1 - 2), 0xd0d0d0);
    return shop;
  }
  function genEdge(face, a0, a1, fixed, D, blockX0, blockX1) {
    let c = a0;
    while (c < a1 - 5) {
      let w = R(9, 16); if (c + w > a1 - 4) w = a1 - c;
      if (face === 'N') makeBuilding(c, fixed, c + w, fixed + D, 'N');
      else if (face === 'S') makeBuilding(c, fixed - D, c + w, fixed, 'S');
      else if (face === 'W') makeBuilding(fixed, c, fixed + D, c + w, 'W');
      else makeBuilding(fixed - D, c, fixed, c + w, 'E');
      c += w;
      if (rng() < 0.16 && c < a1 - 12) c += R(4, 6); // alley
    }
  }
  for (const [bx0, bx1] of xBlocks) for (const [bz0, bz1] of zBlocks) {
    // yard pavement
    GB.box(bx1 - bx0, 0.16, bz1 - bz0, (bx0 + bx1) / 2, 0.0, (bz0 + bz1) / 2, 0xd9cbb4);
    const isPlaza = bx0 > 10 && bx1 < 50 && bz0 > 0 && bz1 < 75;
    const D = Math.min(13, (bx1 - bx0) / 2 - 1, (bz1 - bz0) / 2 - 1);
    if (isPlaza) {
      genEdge('N', bx0, bx1, bz0, 9);
      genEdge('S', bx0, bx1, bz1, 9);
      continue;
    }
    if (bx1 - bx0 < 20) { genEdge('W', bz0, bz1, bx0, bx1 - bx0); continue; }
    genEdge('N', bx0, bx1, bz0, D); genEdge('S', bx0, bx1, bz1, D);
    genEdge('W', bz0 + D, bz1 - D, bx0, D); genEdge('E', bz0 + D, bz1 - D, bx1, D);
    // yard: grass & a tree
    if (rng() < 0.8) {
      const gx = (bx0 + bx1) / 2, gz = (bz0 + bz1) / 2;
      GB.box(Math.max(2, bx1 - bx0 - 2 * D - 6), 0.2, Math.max(2, bz1 - bz0 - 2 * D - 6), gx, 0.1, gz, 0x8fbf5a);
      ficus(SB, gx, gz, 1.2);
    }
  }

  /* bike shop: pick the Dizengoff-facing shop nearest z=-40 on the west side */
  let bs = null, bd = 1e9;
  for (const sh of WORLD.shops) if (sh.face === 'E' && Math.abs(sh.x - (-8.4)) < 1 && Math.abs(sh.z + 40) < bd) { bd = Math.abs(sh.z + 40); bs = sh; }
  if (bs) {
    bs.food = false; bs.name = 'אופני העיר'; WORLD.bikeShop = bs;
    const g = signMesh('אופני העיר — מוסך ושדרוגים', 5.2, 0.85, { w: 640, h: 128, bg: '#f2a81d', fg: '#1b1b1b', size: 64 });
    g.position.set(-10.7, 4.2, bs.z); g.rotation.y = Math.PI / 2; WORLD.dyn.add(g);
    // wrench pillar
    SB.box(0.6, 2.2, 0.6, -10.2, 1.1, bs.z + 2.6, 0xf2a81d);
  }

  /* ---------- trees, lamps, benches ---------- */
  for (const s of NS) {
    for (let z = -160; z < 160; z += s.tayelet ? 13 : 15) {
      if (!s.tayelet && EW.some((e) => Math.abs(z - e.z) < 12)) continue;
      if (s.tayelet) { palm(SB, s.x - 11.2, z + 3); continue; }
      const L = s.strips[0], Rr = s.strips[s.strips.length - 1];
      const xl = s.x + L[1] - 0.9, xr = s.x + Rr[0] + 0.9;
      if (s.boulevard) {
        if (Math.abs(z - 36) > 9) { ficus(SB, s.x - 6.2, z, 1); ficus(SB, s.x + 6.2, z + 7, 1); }
        if (Math.abs(z % 30) < 1) { bench(SB, s.x - 3.2, z + 3, Math.PI / 2); }
        continue;
      }
      if ((z / 15) % 2 === 0) { ficus(SB, xl, z, 0.9); palm(SB, xr, z + 7); } else { palm(SB, xl, z); ficus(SB, xr, z + 7, 0.9); }
      if (Math.abs(z % 30) < 1) { streetLamp(SB, xl, z + 3.5); streetLamp(SB, xr, z + 10.5); }
    }
  }
  for (const e of EW) for (let x = -96; x < 96; x += 16) {
    if (NS.some((s) => x > s.x + s.strips[0][0] - 3 && x < s.x + s.strips[s.strips.length - 1][1] + 3)) continue;
    if (e.z === 80 && x > MARKET.x0 - 2 && x < MARKET.x1 + 2) continue;
    ficus(SB, x, e.z - 5.9, 0.85); ficus(SB, x + 8, e.z + 5.9, 0.85);
  }
  // bus stop on Dizengoff
  { const bz = -45, bx = 11.6; SB.box(0.1, 2.5, 0.1, bx - 0.9, 1.25, bz - 2, 0x666a75); SB.box(0.1, 2.5, 0.1, bx - 0.9, 1.25, bz + 2, 0x666a75);
    SB.box(1.8, 0.12, 4.6, bx, 2.55, bz, 0x2b58c9); SB.box(0.08, 1.8, 4.2, bx + 0.8, 1.2, bz, 0xa9d1e8); bench(SB, bx + 0.3, bz, Math.PI / 2);
    addBox(bx + 0.7, bz - 2.1, bx + 0.9, bz + 2.1, 2.5, 'low');
    const sg = signMesh('תחנה', 1.0, 0.4, { w: 256, h: 100, bg: '#2b58c9', size: 56 }); sg.position.set(bx - 0.9, 2.2, bz - 2.06); sg.rotation.y = Math.PI; WORLD.dyn.add(sg); }

  /* parked / abandoned scooters (iconic) */
  for (let i = 0; i < 26; i++) {
    const s = NS[1 + Math.floor(rng() * 3)], st = rng() < 0.5 ? s.strips[0] : s.strips[s.strips.length - 1];
    const x = s.x + R(st[0] + 0.5, st[1] - 0.5), z = R(-120, 120);
    if (EW.some((e) => Math.abs(z - e.z) < 10)) continue;
    const ry = R(0, 6.28), lying = rng() < 0.5;
    if (lying) { SB.add(GEO.box, 0x2a2d35, x, 0.3, z, 0.18, 0.1, 0.9, 0, ry, 0); SB.add(GEO.box, 0x2a2d35, x + Math.sin(ry) * 0.4, 0.28, z + Math.cos(ry) * 0.4, 0.12, 0.12, 1.0, 0, ry + 1.4, 0); }
    else { SB.add(GEO.box, 0x2a2d35, x, 0.3, z, 0.18, 0.1, 0.9, 0, ry, 0); SB.add(GEO.box, 0x2a2d35, x + Math.sin(ry) * 0.42, 0.75, z + Math.cos(ry) * 0.42, 0.07, 1.0, 0.07, 0, ry, 0); }
  }

  /* ---------- plaza ---------- */
  {
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA.r, PLAZA.r, 0.3, 40), MAT(0xe7c6ae));
    plaza.position.set(PLAZA.x, 0.07, PLAZA.z); plaza.receiveShadow = true; scene.add(plaza);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 0.32, 40), MAT(0xd8a98f));
    ring.position.set(PLAZA.x, 0.08, PLAZA.z); ring.receiveShadow = true; scene.add(ring);
    SB.cyl(3.2, 0.7, PLAZA.x, 0.5, PLAZA.z, 0xf7f4ee, 16);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x55b8ea, roughness: 0.2 }));
    water.position.set(PLAZA.x, 0.82, PLAZA.z); scene.add(water);
    SB.cyl(0.45, 2.6, PLAZA.x, 1.8, PLAZA.z, 0xf2a81d, 8);
    SB.cyl(1.3, 0.25, PLAZA.x, 3.1, PLAZA.z, 0x2b58c9, 10);
    SB.cyl(0.8, 0.25, PLAZA.x, 3.6, PLAZA.z, 0xe2463b, 10);
    addCircle(PLAZA.x, PLAZA.z, 3.3);
    const jets = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55 }));
    jets.position.set(PLAZA.x, 4.4, PLAZA.z); jets.rotation.x = Math.PI; scene.add(jets);
    WORLD.animated.push((t) => { jets.scale.y = 1 + Math.sin(t * 5) * 0.12; jets.rotation.y = t; });
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; bench(SB, PLAZA.x + Math.cos(a) * 11, PLAZA.z + Math.sin(a) * 11, -a + Math.PI / 2); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; palm(SB, PLAZA.x + Math.cos(a) * 12.8, PLAZA.z + Math.sin(a) * 12.8); }
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + Math.PI / 4; const px = PLAZA.x + Math.cos(a) * 14.8, pz = PLAZA.z + Math.sin(a) * 14.8;
      SB.cyl(0.06, 2.2, px, 1.1, pz, 0x555a66, 6); addCircle(px, pz, 0.2);
      const sg = signMesh('אזור הולכי רגל', 1.5, 0.9, { w: 300, h: 180, bg: '#ffffff', fg: '#c62828', size: 50, border: '#c62828', sub: 'אסור לרכוב!' });
      sg.position.set(px, 2.3, pz); sg.lookAt(PLAZA.x + Math.cos(a) * 40, 2.3, PLAZA.z + Math.sin(a) * 40); WORLD.dyn.add(sg);
    }
  }

  /* ---------- kiosk on Rothschild (like the reference image) ---------- */
  {
    const kx = 60.6, kz = 34;
    SB.box(3.6, 3.4, 4.2, kx, 1.7, kz, 0xf7f4ee); SB.box(3.8, 0.3, 4.4, kx, 3.55, kz, 0x2b58c9);
    SB.box(3.82, 0.08, 4.42, kx, 3.36, kz, 0xf3c341);
    SB.box(0.1, 2.2, 2.0, kx + 1.82, 1.6, kz, 0x2b4f9e);
    SB.box(1.4, 0.6, 0.9, kx + 0.4, 4.0, kz - 0.8, 0xf4f4f6); SB.add(GEO.box, 0x2c4aa0, kx - 0.6, 3.95, kz + 0.9, 1.4, 0.08, 1.0, -0.5, 0, 0);
    addBox(kx - 1.8, kz - 2.1, kx + 1.8, kz + 2.1, 3.4, 'low');
    const s = signMesh('קיוסק', 2.4, 0.8, { w: 384, h: 128, bg: '#2b58c9', fg: '#ffffff', size: 80 });
    s.position.set(kx + 1.92, 2.9, kz); s.rotation.y = Math.PI / 2; WORLD.dyn.add(s);
    // ICE freezer
    SB.box(0.9, 0.95, 1.9, kx + 2.4, 0.5, kz + 3.4, 0xf4f6fa); SB.box(0.92, 0.1, 1.92, kx + 2.4, 1.0, kz + 3.4, 0xc9d2e0);
    addBox(kx + 1.95, kz + 2.45, kx + 2.85, kz + 4.35, 1, 'low');
    const ice = signMesh('קרח', 1.6, 0.6, { w: 320, h: 120, bg: '#ffffff', fg: '#2b58c9', size: 90, weight: 900 });
    ice.position.set(kx + 2.86, 0.55, kz + 3.4); ice.rotation.y = Math.PI / 2; WORLD.dyn.add(ice);
    WORLD.kiosk = { x: kx + 3.3, z: kz + 3.2 };
    // backgammon table
    SB.box(0.8, 0.05, 0.6, kx + 3.4, 0.75, kz + 6.6, 0x8b5a2b); SB.box(0.1, 0.72, 0.1, kx + 3.4, 0.37, kz + 6.6, 0xffffff);
  }

  /* ---------- Carmel-ish market stalls ---------- */
  {
    const fruit = [0xe2463b, 0xf29a1d, 0xf6d02f, 0x6aa84f, 0x7a3fa0, 0xd94f8a];
    for (let x = MARKET.x0 + 2; x < MARKET.x1 - 3; x += 4.6) {
      const z = 88.0;
      SB.box(3.4, 0.9, 1.3, x + 1.7, 0.45 + 0.16, z, 0x9b6a3c);
      for (let i = 0; i < 6; i++) SB.add(GEO.ico, fruit[(i + Math.floor(x)) % fruit.length], x + 0.35 + i * 0.52, 1.18, z + rng() * 0.3 - 0.15, 0.42, 0.36, 0.42, 0, 0, 0);
      SB.box(0.08, 2.4, 0.08, x + 0.05, 1.3, z - 0.6, 0x666666); SB.box(0.08, 2.4, 0.08, x + 3.35, 1.3, z - 0.6, 0x666666);
      const cA = AWNING[Math.floor(rng() * AWNING.length)];
      for (let k = 0; k < 4; k++) SB.add(GEO.box, k % 2 ? 0xffffff : cA, x + 0.43 + k * 0.85, 2.5, z - 0.1, 0.85, 0.08, 1.9, 0.25, 0, 0);
      addBox(x, z - 0.65, x + 3.4, z + 0.65, 1, 'low');
    }
    const sg = signMesh('שוק', 2.6, 1.0, { w: 300, h: 120, bg: '#e2463b', size: 90 });
    sg.position.set(MARKET.x0 + 1, 3.8, 84.9); sg.rotation.y = Math.PI; WORLD.dyn.add(sg);
    SB.box(0.15, 4.2, 0.15, MARKET.x0 + 0.0, 2.1, 85, 0x555555); SB.box(0.15, 4.2, 0.15, MARKET.x0 + 2.0, 2.1, 85, 0x555555);
  }

  /* ---------- beach ---------- */
  {
    for (let z = -110; z < 120; z += 17) {
      const x = R(-138, -118), c = AWNING[Math.floor(rng() * AWNING.length)];
      SB.cyl(0.05, 2.3, x, 1.15, z, 0xeeeeee, 5);
      SB.add(GEO.cone(8), c, x, 2.3, z, 2.8, 0.7, 2.8, 0, 0, 0);
      SB.box(1.0, 0.03, 1.9, x + 1.2, 0.07, z + 0.4, AWNING[Math.floor(rng() * AWNING.length)]);
      addCircle(x, z, 0.15);
    }
    // lifeguard tower
    const lx = -134, lz = 12;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) SB.box(0.18, 3, 0.18, lx + dx, 1.5, lz + dz, 0xffffff);
    SB.box(2.6, 2.0, 2.6, lx, 4.0, lz, 0xf7f4ee); SB.box(2.9, 0.2, 2.9, lx, 5.1, lz, 0xe2463b); SB.box(0.05, 0.9, 2.0, lx + 1.31, 4.2, lz, 0x34507e);
    addBox(lx - 1.1, lz - 1.1, lx + 1.1, lz + 1.1, 5, 'low');
    const sg = signMesh('מציל', 1.4, 0.5, { w: 256, h: 92, bg: '#e2463b', size: 60 }); sg.position.set(lx + 1.32, 5.4, lz); sg.rotation.y = Math.PI / 2; WORLD.dyn.add(sg);
  }

  SB.build(scene); GB.build(scene);
}

/* ---------- prop helpers ---------- */
function ficus(SB, x, z, s) {
  s = s || 1;
  SB.cyl(0.22 * s, 2.6 * s, x, 1.3 * s, z, 0x7a5a43, 6);
  SB.add(GEO.ico, 0x4f8f3e, x, 3.4 * s, z, 3.4 * s, 2.4 * s, 3.4 * s, 0, z, 0);
  SB.add(GEO.ico, 0x5ea347, x + 0.7 * s, 4.1 * s, z - 0.4 * s, 2.4 * s, 1.8 * s, 2.4 * s, 0, x, 0);
  addCircle(x, z, 0.35 * s);
}
function palm(SB, x, z) {
  const lean = (x * 7 + z * 3) % 1 * 0.3 - 0.15;
  for (let i = 0; i < 4; i++) SB.add(GEO.cyl(6), 0x9c7a55, x + lean * i * 0.6, 0.9 + i * 1.75, z, 0.42 - i * 0.04, 1.8, 0.42 - i * 0.04, 0, 0, -lean * 0.4);
  const tx = x + lean * 2.4, ty = 7.6;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    SB.add(GEO.box, k % 2 ? 0x3f7f3a : 0x4f9a45, tx + Math.cos(a) * 1.4, ty - 0.35, z + Math.sin(a) * 1.4, 3.2, 0.08, 0.55, 0, -a, -0.45);
  }
  SB.add(GEO.ico, 0x6e5a3a, tx, ty, z, 0.8, 0.6, 0.8, 0, 0, 0);
  addCircle(x, z, 0.4);
}
function bench(SB, x, z, ry) {
  SB.add(GEO.box, 0x8b5a2b, x, 0.5, z, 1.8, 0.1, 0.5, 0, ry, 0);
  SB.add(GEO.box, 0x8b5a2b, x - Math.sin(ry) * 0.22, 0.85, z - Math.cos(ry) * 0.22, 1.8, 0.5, 0.08, 0, ry, 0);
  SB.add(GEO.box, 0x3a3d45, x, 0.25, z, 1.6, 0.5, 0.4, 0, ry, 0);
  addCircle(x, z, 0.6);
}
function streetLamp(SB, x, z) {
  SB.cyl(0.08, 5, x, 2.5, z, 0x3a3d45, 6); SB.box(0.3, 0.2, 0.6, x, 5, z, 0xfff1c9);
  addCircle(x, z, 0.2);
}

function updateLights() {
  for (const I of WORLD.intersections) {
    const ns = lightState(I, 'ns'), ew = lightState(I, 'ew');
    for (const L of I.lamps) {
      const st = L.axis === 'ns' ? ns : ew;
      L.m.material = WORLD.LAMP[st];
      L.m.position.y = L.y + (st === 'red' ? 0.3 : st === 'yellow' ? 0 : -0.3);
    }
  }
}
