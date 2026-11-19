'use strict';
/* ============================================================
   WORLD: a Tel-Aviv-inspired district (v2 — bigger, denser)
   x = east, z = south (north = -z)
   ============================================================ */
const MAPB = { xMin: -144, xMax: 168, zMin: -205, zMax: 205 };
const NS_Z0 = -260, NS_Z1 = 260;
const EWR = 6, EWS = 10; // EW road half width / full half width
const NS = [
  { name: 'הטיילת', x: -100, strips: [[-12, -7, 'sidewalk'], [-7, -4, 'bike'], [-4, 0, 'sidewalk']], lanes: [], bikeLanes: [{ off: -6.2, dir: 1 }, { off: -4.8, dir: -1 }], tayelet: true },
  { name: 'בן יהודה', x: -55, strips: [[-11, -6, 'sidewalk'], [-6, 6, 'road'], [6, 11, 'sidewalk']], lanes: [{ off: 2.6, dir: -1 }, { off: -2.6, dir: 1 }], park: [-5, 5] },
  { name: 'דיזנגוף', x: 0, strips: [[-12, -7, 'sidewalk'], [-7, 6, 'road'], [6, 8.5, 'bike'], [8.5, 13.5, 'sidewalk']], lanes: [{ off: 2.4, dir: -1 }, { off: -2.8, dir: 1 }], bikeLanes: [{ off: 6.7, dir: -1 }, { off: 7.8, dir: 1 }], park: [-6], bus: true },
  { name: 'שדרות רוטשילד', x: 65, strips: [[-17, -13, 'sidewalk'], [-13, -7, 'road'], [-7, -2, 'sidewalk'], [-2, 2, 'bike'], [2, 7, 'sidewalk'], [7, 13, 'road'], [13, 17, 'sidewalk']], lanes: [{ off: -10, dir: 1 }, { off: 10, dir: -1 }], bikeLanes: [{ off: -1, dir: 1 }, { off: 1, dir: -1 }], boulevard: true },
  { name: 'אבן גבירול', x: 135, strips: [[-15, -11, 'sidewalk'], [-11, -8.5, 'bike'], [-8.5, 8.5, 'road'], [8.5, 11, 'bike'], [11, 15, 'sidewalk']], lanes: [{ off: -6.3, dir: 1 }, { off: -2.2, dir: 1 }, { off: 2.2, dir: -1 }, { off: 6.3, dir: -1 }], bikeLanes: [{ off: -9.75, dir: 1 }, { off: 9.75, dir: -1 }], bus: true, wide: true },
];
const EW = [{ name: 'ארלוזורוב', z: -160 }, { name: 'פרישמן', z: -80 }, { name: 'גורדון', z: 0 }, { name: 'אלנבי', z: 80 }, { name: 'שינקין', z: 160 }].map((s) =>
  Object.assign(s, { strips: [[-EWS, -EWR, 'sidewalk'], [-EWR, EWR, 'road'], [EWR, EWS, 'sidewalk']], lanes: [{ off: 2.6, dir: 1 }, { off: -2.6, dir: -1 }], park: [-5, 5], x0: -100, x1: 182 }));
const PLAZA = { x: 31, z: 40, r: 14 };
const MARKET = { x0: -44, x1: -12, z0: 84, z1: 91 };
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
    if (dz < -EWS || dz >= EWS) continue;
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
  if (x > MARKET.x0 && x < MARKET.x1 && z > 72 && z < 92) return 'שוק הכרמל (כמעט)';
  if (x > 55 && x < 75 && z > 100 && z < 152) return 'מאהל המחאה ברוטשילד';
  for (const n of NS) { if (n.tayelet) continue; const dx = x - n.x; if (dx >= n.strips[0][0] && dx < n.strips[n.strips.length - 1][1]) return n.name; }
  for (const e of EW) if (Math.abs(z - e.z) < EWS) return 'רחוב ' + e.name;
  if (x > 13 && x < 48 && z > 9 && z < 71) return 'כיכר דיזנגוף (בערך)';
  return 'סמטה';
}

const WORLD = {
  buildings: [], circles: [], intersections: [], shops: [], bikeShop: null, police: null, bins: [], protest: null,
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
  let hit = null;
  const cx0 = Math.floor(p.x / GC), cz0 = Math.floor(p.z / GC);
  for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
    const cell = WORLD.grid.get((cx0 + gx) + ',' + (cz0 + gz));
    if (!cell) continue;
    for (const o of cell) {
      if (o.t === 'b') {
        const cx = clamp(p.x, o.x0, o.x1), cz = clamp(p.z, o.z0, o.z1);
        let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 1e-6) {
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
/* line of sight (tall buildings only), walking the grid cells along the segment */
let _losStamp = 0;
function hasLOS(x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(len / (GC * 0.5)));
  _losStamp++;
  for (let i = 0; i <= steps; i++) {
    const cell = WORLD.grid.get(Math.floor((x1 + dx * i / steps) / GC) + ',' + Math.floor((z1 + dz * i / steps) / GC));
    if (!cell) continue;
    for (const b of cell) {
      if (b.t !== 'b' || b.kind === 'low' || b._los === _losStamp) continue;
      b._los = _losStamp;
      let t0 = 0, t1 = 1, ok = true;
      const ps = [-dx, dx, -dz, dz], qs = [x1 - b.x0, b.x1 - x1, z1 - b.z0, b.z1 - z1];
      for (let k = 0; k < 4; k++) {
        if (Math.abs(ps[k]) < 1e-9) { if (qs[k] < 0) { ok = false; break; } }
        else { const t = qs[k] / ps[k]; if (ps[k] < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; } else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; } }
      }
      if (ok && t0 <= t1) return false;
    }
  }
  return true;
}
function buildingAt(x, y, z) {
  const cell = WORLD.grid.get(Math.floor(x / GC) + ',' + Math.floor(z / GC));
  if (!cell) return false;
  for (const b of cell) if (b.t === 'b' && x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3 && y < b.h + 0.5) return true;
  return false;
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
  ['חומוס אליהו', 1], ['סושי בר', 1], ['גלידה', 1], ['שווארמה', 1], ['מספרה', 0], ['פרחים', 0], ['בייגל', 1], ['קפה שחור', 1], ['יין וגבינות', 0],
  ['סלולר', 0], ['מאפייה', 1], ['פיצוצייה', 0], ['סביח עמבה', 1], ['יד שנייה', 0], ['מכבסה', 0], ['שקשוקה', 1], ['מעדניה', 1], ['קונדיטוריה', 1],
  ['אופטיקה', 0], ['הגרלות ולוטו', 0], ['טוסטים', 1], ['מסעדה תימנית', 1], ['כלבו', 0],
];
const SIGN_COLORS = ['#2b5fd9', '#e2463b', '#1f9b6b', '#f2a81d', '#7a4fd6', '#16324f', '#d94f8a', '#0f7d8c'];
const BLD_COLORS = [0xf7f4ee, 0xf4efe6, 0xffffff, 0xf3e6d3, 0xf0d9c8, 0xe9eef2, 0xf6e7b8, 0xf2f0f4, 0xf7f7f2, 0xe8dccb, 0xdde7e3];
const AWNING = [0x2b5fd9, 0xe2463b, 0x1f9b6b, 0xf2a81d, 0x2e2f6b, 0xd94f8a, 0x3aa0c8];
const GRAFFITI = ['תל אביב לא עוצרת', 'יאללה', '♥ TLV', 'חופש', 'אין כמו בבית', 'הכל לטובה', 'שקט! ישנים!', 'איפה החניה?!', 'מי לקח לי את הקורקינט'];

function flagTexture() {
  return canvasTex(160, 110, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4fb8'; g.fillRect(0, 12, w, 14); g.fillRect(0, h - 26, w, 14);
    g.strokeStyle = '#1d4fb8'; g.lineWidth = 5; const cx = w / 2, cy = h / 2, r = 20;
    for (const off of [0, Math.PI]) { g.beginPath(); for (let k = 0; k < 3; k++) { const a = off + k * Math.PI * 2 / 3 - Math.PI / 2; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.stroke(); }
  }, false);
}
function graffitiTexture(text) {
  return canvasTex(512, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 78px "Rubik", Arial, sans-serif';
    const c = pick(['#e2463b', '#2b5fd9', '#1f9b6b', '#d94f8a', '#f2a81d', '#7a4fd6']);
    g.lineWidth = 12; g.strokeStyle = '#1b1d2a'; g.strokeText(text, w / 2, h / 2); g.fillStyle = c; g.fillText(text, w / 2, h / 2);
  }, false);
}

function buildWorld() {
  const rng = seeded(1909); // the year Tel Aviv was founded
  const R = (a, b) => a + rng() * (b - a);
  const SB = new StaticBuilder({ cast: true, chunk: 110 });
  const GB = new StaticBuilder({ cast: false, chunk: 200 });
  const FB = FACADE_MAT.map((m) => new StaticBuilder({ cast: true, chunk: 110, mat: m, uv: true }));
  const G = {};
  const gscale = { asphalt: 1 / 9, sidewalk: 1 / 2, bike: 1 / 4, yard: 1 / 3.2, sand: 1 / 7, grass: 1 / 4 };
  for (const k in gscale) G[k] = new StaticBuilder({ cast: false, chunk: 260, mat: GROUND_MAT[k], uvScale: gscale[k] });
  const WHITE = 0xffffff;

  /* ground */
  G.asphalt.box(760, 0.2, 640, 30, -0.1, 0, WHITE);
  G.sand.box(34, 0.2, 640, -129, -0.05, 0, WHITE);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 900, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2f9fc9, roughness: 0.2, metalness: 0.15 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-446, 0.02, 0); sea.receiveShadow = true; scene.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 900), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(-146, 0.07, 0); scene.add(foam);
  WORLD.animated.push((t) => { foam.position.x = -146.5 + Math.sin(t * 0.8) * 1.2; foam.material.opacity = 0.45 + Math.sin(t * 0.8) * 0.2; });

  const nsRoadIntervals = [];
  for (const s of NS) for (const st of s.strips) if (st[2] !== 'sidewalk') nsRoadIntervals.push([s.x + st[0], s.x + st[1]]);
  const ewRoadIntervals = EW.map((e) => [e.z - EWR, e.z + EWR]);
  const complement = (a0, a1, ints) => {
    const out = []; let c = a0; const sorted = ints.slice().sort((p, q) => p[0] - q[0]);
    for (const [i0, i1] of sorted) { if (i1 <= c || i0 >= a1) continue; if (i0 > c) out.push([c, i0]); c = Math.max(c, i1); }
    if (c < a1) out.push([c, a1]); return out;
  };
  const curbColor = (k) => (k % 3 === 0 ? 0xd8392e : 0x2b5fd9);

  /* NS streets */
  for (const s of NS) {
    for (const st of s.strips) {
      if (st[2] === 'road') continue;
      const h = SURF_H[st[2]], segs = s.tayelet ? [[NS_Z0, NS_Z1]] : complement(NS_Z0, NS_Z1, ewRoadIntervals);
      for (const [z0, z1] of segs) G[st[2] === 'bike' ? 'bike' : 'sidewalk'].box(st[1] - st[0], h + 0.1, z1 - z0, s.x + (st[0] + st[1]) / 2, h / 2 - 0.05, (z0 + z1) / 2, WHITE);
    }
    for (const st of s.strips) if (st[2] === 'road') {
      const segs = complement(NS_Z0, NS_Z1, EW.map((e) => [e.z - EWS - 0.5, e.z + EWS + 0.5]));
      let k = 0;
      for (const [z0, z1] of segs) {
        for (const side of [st[0], st[1]]) {
          const xx = s.x + side;
          const sideStrip = s.strips.find((q) => (side === st[0] ? q[1] === side : q[0] === side));
          if (!sideStrip || sideStrip[2] === 'road') continue;
          const off = side === st[0] ? 0.15 : -0.15;
          GB.box(0.3, 0.19, z1 - z0, xx + off, 0.095, (z0 + z1) / 2, 0xf4f1ea);
          const cc = curbColor(k++);
          for (let z = z0; z < z1 - 2; z += 4) GB.box(0.32, 0.2, 2, xx + off, 0.1, z + 1, cc);
        }
        const cx = s.wide ? s.x : s.x + (st[0] + st[1]) / 2 + (s.name === 'דיזנגוף' ? 0.3 : 0);
        if (s.wide) {
          GB.box(0.16, 0.02, z1 - z0, cx - 0.18, 0.012, (z0 + z1) / 2, 0xf3c341); GB.box(0.16, 0.02, z1 - z0, cx + 0.18, 0.012, (z0 + z1) / 2, 0xf3c341);
          for (let z = z0 + 2; z < z1 - 3; z += 7) { GB.box(0.16, 0.02, 3, s.x - 4.2, 0.012, z + 1.5, 0xf6f2e6); GB.box(0.16, 0.02, 3, s.x + 4.2, 0.012, z + 1.5, 0xf6f2e6); }
        } else if (!s.boulevard) for (let z = z0 + 2; z < z1 - 3; z += 7) GB.box(0.18, 0.02, 3, cx, 0.012, z + 1.5, 0xf6f2e6);
      }
    }
    // bike lane icons
    for (const st of s.strips) if (st[2] === 'bike') for (let z = NS_Z0 + 13; z < NS_Z1; z += 26) {
      if (!s.tayelet && EW.some((e) => Math.abs(z - e.z) < 14)) continue;
      const bx = s.x + (st[0] + st[1]) / 2;
      GB.add(GEO.cyl(10), 0xf6f2e6, bx, 0.06, z - 0.45, 0.6, 0.02, 0.6); GB.add(GEO.cyl(10), 0xf6f2e6, bx, 0.06, z + 0.45, 0.6, 0.02, 0.6);
      GB.box(0.1, 0.02, 0.8, bx, 0.065, z, 0xf6f2e6);
    }
  }
  /* EW streets */
  const nsSpans = NS.map((s) => [s.x + s.strips[0][0] - 0.5, s.x + s.strips[s.strips.length - 1][1] + 0.5]);
  for (const e of EW) {
    for (const st of e.strips) {
      if (st[2] === 'road') continue;
      for (const [x0, x1] of complement(e.x0, e.x1, nsRoadIntervals))
        G.sidewalk.box(x1 - x0, SURF_H.sidewalk + 0.1, st[1] - st[0], (x0 + x1) / 2, SURF_H.sidewalk / 2 - 0.05, e.z + (st[0] + st[1]) / 2, WHITE);
    }
    let k = 1;
    for (const [x0, x1] of complement(e.x0, e.x1, nsSpans)) {
      for (const side of [-EWR, EWR]) {
        const off = side < 0 ? 0.15 : -0.15;
        GB.box(x1 - x0, 0.19, 0.3, (x0 + x1) / 2, 0.095, e.z + side + off, 0xf4f1ea);
        const cc = curbColor(k++);
        for (let x = x0; x < x1 - 2; x += 4) GB.box(2, 0.2, 0.32, x + 1, 0.1, e.z + side + off, cc);
      }
      for (let x = x0 + 2; x < x1 - 3; x += 7) GB.box(3, 0.02, 0.18, x + 1.5, 0.012, e.z, 0xf6f2e6);
    }
  }

  /* intersections, crosswalks, traffic lights */
  const lampGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const LAMP = { red: new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }), yellow: new THREE.MeshBasicMaterial({ color: 0xffc400, toneMapped: false }), green: new THREE.MeshBasicMaterial({ color: 0x2bff7a, toneMapped: false }) };
  WORLD.LAMP = LAMP;
  let io = 0;
  for (const s of NS) {
    if (s.tayelet) continue;
    const inner = s.strips.slice(1, -1);
    const bx0 = s.x + Math.min(...inner.map((q) => q[0])), bx1 = s.x + Math.max(...inner.map((q) => q[1]));
    const sx0 = s.x + s.strips[0][0], sx1 = s.x + s.strips[s.strips.length - 1][1];
    for (const e of EW) {
      const I = { x0: bx0, x1: bx1, z0: e.z - EWR, z1: e.z + EWR, sx0, sx1, ns: s, ew: e, offset: (io++ * 7.3) % 25, cx: (bx0 + bx1) / 2, cz: e.z };
      WORLD.intersections.push(I);
      for (const st of s.strips) if (st[2] === 'road' || st[2] === 'bike') {
        for (const zc of [e.z - 8, e.z + 8]) for (let x = s.x + st[0] + 0.5; x < s.x + st[1] - 0.3; x += 1.2) GB.box(0.6, 0.03, 3.4, x + 0.3, 0.02, zc, 0xf7f3ea);
        for (const zc of [e.z - 10.3, e.z + 10.3]) GB.box(st[1] - st[0], 0.03, 0.4, s.x + (st[0] + st[1]) / 2, 0.02, zc, 0xf7f3ea);
      }
      for (const st of [s.strips[0], s.strips[s.strips.length - 1]]) {
        const xc = s.x + (st[0] + st[1]) / 2;
        for (let z = e.z - 5.4; z < e.z + 5.4; z += 1.2) GB.box(st[1] - st[0] - 1, 0.03, 0.6, xc, 0.02, z + 0.3, 0xf7f3ea);
      }
      const poles = [[bx1 + 1.2, e.z - 7.2], [bx0 - 1.2, e.z + 7.2]];
      I.lamps = [];
      for (const [px, pz] of poles) {
        SB.cyl(0.09, 3.6, px, 1.8, pz, 0x30333d, 6);
        SB.box(0.36, 1.0, 0.22, px, 3.3, pz, 0x24262e);
        SB.box(0.22, 1.0, 0.36, px + 0.45, 3.3, pz, 0x24262e);
        SB.box(0.5, 0.08, 0.08, px + 0.22, 3.0, pz, 0x30333d);
        SB.box(0.3, 0.3, 0.12, px, 2.0, pz + 0.12, 0xf3c341); // pedestrian button box
        addCircle(px, pz, 0.25);
        const ln = new THREE.Mesh(lampGeo, LAMP.red); ln.position.set(px, 3.3, pz); WORLD.dyn.add(ln);
        const le = new THREE.Mesh(lampGeo, LAMP.red); le.position.set(px + 0.45, 3.3, pz); WORLD.dyn.add(le);
        I.lamps.push({ m: ln, axis: 'ns', y: 3.3 }, { m: le, axis: 'ew', y: 3.3 });
      }
      atlasSign(e.name, 1.6, 0.42, { bg: '#1f4fa8', size: 76, border: '#ffffff' }, bx0 - 1.2, 2.6, e.z + 7.2 - 0.14, Math.PI);
      atlasSign(s.name, 1.6, 0.42, { bg: '#1f4fa8', size: 76, border: '#ffffff' }, bx1 + 1.2 + 0.14, 2.6, e.z - 7.2, Math.PI / 2);
    }
  }

  /* ---------- parked cars along the curbs ---------- */
  const PARK_COL = [0xe2463b, 0xf4f4f6, 0x2b5fd9, 0x9fd3e8, 0x30323a, 0xc9c9cf, 0x8fbf5a, 0xd94f8a, 0xf6d02f, 0x7a7f8c, 0xffffff, 0x1d2840];
  const fill = LOW ? 0.38 : 0.55;
  function parkedCar(x, z, alongZ) {
    const c = PARK_COL[Math.floor(rng() * PARK_COL.length)], W = 1.8, L = rand(3.9, 4.4);
    const bxx = (w, h, d, ox, oy, oz, col) => alongZ ? SB.box(w, h, d, x + ox, oy, z + oz, col) : SB.box(d, h, w, x + oz, oy, z + ox, col);
    const flip = rng() < 0.5 ? 1 : -1;
    bxx(W, 0.62, L, 0, 0.62, 0, c); bxx(W + 0.02, 0.18, L + 0.02, 0, 0.36, 0, 0x2d2f36);
    bxx(W - 0.2, 0.52, L * 0.5, 0, 1.18, -0.2 * flip, 0x2c3e5a); bxx(W - 0.18, 0.07, L * 0.46, 0, 1.47, -0.2 * flip, c);
    for (const oz of [-L * 0.32, L * 0.32]) for (const ox of [-0.85, 0.85]) bxx(0.24, 0.62, 0.62, ox, 0.31, oz, 0x1d1e22);
    if (alongZ) addBox(x - 0.95, z - L / 2, x + 0.95, z + L / 2, 1.5, 'low'); else addBox(x - L / 2, z - 0.95, x + L / 2, z + 0.95, 1.5, 'low');
  }
  for (const s of NS) for (const off of s.park || []) {
    for (const [z0, z1] of complement(NS_Z0 + 20, NS_Z1 - 20, EW.map((e) => [e.z - EWS - 4, e.z + EWS + 4])))
      for (let z = z0 + 3; z < z1 - 3; z += 5.8) if (rng() < fill) parkedCar(s.x + off, z, true);
  }
  for (const e of EW) for (const off of e.park) {
    for (const [x0, x1] of complement(e.x0 + 2, e.x1 - 6, nsSpans.map(([a, b]) => [a - 4, b + 4])))
      for (let x = x0 + 3; x < x1 - 3; x += 5.8) if (rng() < fill) parkedCar(x, e.z + off, false);
  }

  /* ---------- blocks & buildings ---------- */
  const xSpans = NS.map((s) => [s.x + s.strips[0][0], s.x + s.strips[s.strips.length - 1][1]]);
  const xBlocks = complement(-100, 186, xSpans);
  const zBlocks = complement(-262, 262, EW.map((e) => [e.z - EWS, e.z + EWS]));
  let shopIdx = 0;
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.8 });
  const facadeBox = (B, face, along, y, out, w, h, d, color) => {
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
  /* textured walls from y0 to y1 */
  function walls(fb, x0, z0, x1, z1, y0, y1, col) {
    const v0 = 0, v1 = (y1 - y0) / 3.1, wq = (L, Rr, n) => {
      const W = Math.hypot(Rr[0] - L[0], Rr[1] - L[1]) / 4;
      fb.quad([L[0], y0, L[1]], [Rr[0], y0, Rr[1]], [Rr[0], y1, Rr[1]], [L[0], y1, L[1]], n, [[0, v0], [W, v0], [W, v1], [0, v1]], col);
    };
    wq([x1, z0], [x0, z0], [0, 0, -1]); wq([x0, z1], [x1, z1], [0, 0, 1]); wq([x0, z0], [x0, z1], [-1, 0, 0]); wq([x1, z1], [x1, z0], [1, 0, 0]);
  }
  function makeBuilding(x0, z0, x1, z1, face, opts) {
    opts = opts || {};
    const floors = opts.floors || Math.floor(R(opts.tall ? 4 : 2, opts.tall ? 7.99 : 5.99));
    const H = 4.2 + floors * 3.1;
    const col = BLD_COLORS[Math.floor(rng() * BLD_COLORS.length)];
    const r = rng(), variant = opts.variant != null ? opts.variant : r < 0.36 ? 0 : r < 0.66 ? 1 : r < 0.9 ? 2 : 3;
    const B = { x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
    const W = face === 'N' || face === 'S' ? x1 - x0 : z1 - z0;
    SB.box(x1 - x0 - 0.02, 4.2, z1 - z0 - 0.02, B.cx, 2.1, B.cz, col);
    walls(FB[variant], x0, z0, x1, z1, 4.2, H, col);
    SB.box(x1 - x0, 0.3, z1 - z0, B.cx, H - 0.15, B.cz, 0xd9d2c6);
    SB.box(x1 - x0 + 0.1, 0.25, z1 - z0 + 0.1, B.cx, 4.25, B.cz, col);
    addBox(x0, z0, x1, z1, H);
    // ground floor
    if (opts.colonnade) {
      for (let a = -W / 2 + 1.2; a <= W / 2 - 1; a += 3.2) { facadeBox(B, face, a, 2.1, 1.9, 0.5, 4.2, 0.5, col); const [px, pz] = facadePos(B, face, a, 1.9); addCircle(px, pz, 0.35); }
      facadeBox(B, face, 0, 4.0, 1.0, W, 0.4, 2.2, col);
    }
    facadeBox(B, face, 0, 1.75, 0.06, W * 0.82, 2.7, 0.14, 0x34507e);
    facadeBox(B, face, 0, 1.75, 0.1, 0.12, 2.7, 0.16, 0xe8e4dc);
    facadeBox(B, face, 0, 3.55, 0.12, W, 0.4, 0.26, 0x2b58c9);
    facadeBox(B, face, 0, 3.3, 0.14, W, 0.09, 0.3, 0xf3c341);
    let shop = null;
    if (opts.sign || rng() < 0.8) {
      const awn = AWNING[Math.floor(rng() * AWNING.length)];
      if (!opts.colonnade && rng() < 0.7) {
        facadeBox(B, face, 0, 3.0, 0.75, W * 0.7, 0.12, 1.5, awn);
        facadeBox(B, face, 0, 2.86, 1.48, W * 0.7, 0.3, 0.05, awn);
      }
      const nm = opts.sign || SHOP_NAMES[shopIdx++ % SHOP_NAMES.length];
      const sc = opts.signColor || SIGN_COLORS[Math.floor(rng() * SIGN_COLORS.length)];
      const sw = Math.min(W * 0.7, 5.5);
      const [sx, sz, ry] = facadePos(B, face, 0, opts.colonnade ? 2.12 : 0.27);
      atlasSign(nm[0], sw, 0.85, { bg: sc, size: 76 }, sx, opts.colonnade ? 4.0 : 4.2, sz, ry);
      const [fx, fz] = facadePos(B, face, 0, opts.colonnade ? 3.4 : 2.6);
      shop = { name: nm[0], food: !!nm[1], x: fx, z: fz, face, B };
      WORLD.shops.push(shop);
      if (nm[1] && rng() < 0.5 && !opts.colonnade) for (let k = -1; k <= 1; k += 2) {
        const [tx, tz] = facadePos(B, face, k * W * 0.25, 1.3);
        SB.cyl(0.35, 0.05, tx, 0.95, tz, 0xffffff, 8); SB.cyl(0.05, 0.8, tx, 0.55, tz, 0x555555, 5);
        for (const d of [-0.55, 0.55]) { const [cx2, cz2] = facadePos(B, face, k * W * 0.25 + d, 1.3); SB.box(0.4, 0.05, 0.4, cx2, 0.6, cz2, 0xf2f2f6); SB.box(0.05, 0.55, 0.05, cx2, 0.33, cz2, 0xf2f2f6); }
        addCircle(tx, tz, 0.5);
      }
    }
    // upper floors: balconies, AC units, flags, laundry
    const balc = variant === 1 ? rng() < 0.7 : rng() < 0.35;
    for (let f = 0; f < floors; f++) {
      const y = 4.2 + f * 3.1;
      if (balc) {
        facadeBox(B, face, 0, y + 0.1, 0.55, W * 0.62, 0.18, 1.1, col);
        facadeBox(B, face, 0, y + 0.55, 1.05, W * 0.62, 0.75, 0.12, col);
        if (rng() < 0.18) { // laundry
          const [lx, lz, ry] = facadePos(B, face, -W * 0.2, 0.9);
          for (let k = 0; k < 4; k++) { const [px, pz] = facadePos(B, face, -W * 0.28 + k * 0.45, 0.9); SB.add(GEO.box, pick([0xe2463b, 0xffffff, 0x2b5fd9, 0xf3c341, 0x8fbf5a]), px, y + 1.75, pz, 0.38, 0.5, 0.03, 0, ry, 0); }
          void lx; void lz;
        }
        if (rng() < 0.07) { const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), flagMat); const [px, pz, ry] = facadePos(B, face, W * 0.2, 1.15); fl.position.set(px, y + 0.65, pz); fl.rotation.y = ry; WORLD.dyn.add(fl); }
      } else if (rng() < 0.4) facadeBox(B, face, W * 0.3 * (rng() < 0.5 ? 1 : -1), y + 0.8, 0.25, 0.8, 0.5, 0.45, 0xdedede);
    }
    // roof: solar water heaters, antennas
    const nH = Math.floor(R(1, 3.99));
    for (let k = 0; k < nH; k++) {
      const hx = R(x0 + 1.5, x1 - 1.5), hz = R(z0 + 1.5, z1 - 1.5);
      SB.add(GEO.cyl(8), 0xf4f4f6, hx, H + 1.25, hz, 0.75, 1.6, 0.75, 0, 0, Math.PI / 2);
      SB.box(0.1, 0.9, 0.1, hx - 0.5, H + 0.45, hz, 0x777777); SB.box(0.1, 0.9, 0.1, hx + 0.5, H + 0.45, hz, 0x777777);
      SB.add(GEO.box, 0x2c4aa0, hx, H + 0.6, hz + 1.3, 1.8, 0.08, 1.2, -0.5, 0, 0);
    }
    if (rng() < 0.4) SB.box(0.05, 2.2, 0.05, R(x0 + 1, x1 - 1), H + 1.1, R(z0 + 1, z1 - 1), 0x555555);
    if (rng() < 0.3) SB.box(1.4, 0.5, 2.0, R(x0 + 2, x1 - 2), H + 0.25, R(z0 + 2, z1 - 2), 0xd0d0d0);
    // graffiti on ground-floor side walls
    if (rng() < 0.12) {
      const t = graffitiTexture(pick(GRAFFITI)), m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9 }));
      if (face === 'N' || face === 'S') { m.position.set(x0 - 0.03, 1.4, B.cz); m.rotation.y = -Math.PI / 2; } else { m.position.set(B.cx, 1.4, z0 - 0.03); m.rotation.y = Math.PI; }
      WORLD.dyn.add(m);
    }
    return shop;
  }
  function genEdge(face, a0, a1, fixed, D, opts) {
    let c = a0;
    while (c < a1 - 5) {
      let w = R(9, 16); if (c + w > a1 - 4) w = a1 - c;
      if (face === 'N') makeBuilding(c, fixed, c + w, fixed + D, 'N', opts);
      else if (face === 'S') makeBuilding(c, fixed - D, c + w, fixed, 'S', opts);
      else if (face === 'W') makeBuilding(fixed, c, fixed + D, c + w, 'W', opts);
      else makeBuilding(fixed - D, c, fixed, c + w, 'E', opts);
      c += w;
      if (rng() < 0.16 && c < a1 - 12) c += R(4, 6);
    }
  }
  const ibn = NS.find((s) => s.wide);
  const ibnW = ibn.x + ibn.strips[0][0], ibnE = ibn.x + ibn.strips[ibn.strips.length - 1][1];
  for (const [bx0, bx1] of xBlocks) for (const [bz0, bz1] of zBlocks) {
    G.yard.box(bx1 - bx0, 0.16, bz1 - bz0, (bx0 + bx1) / 2, 0.0, (bz0 + bz1) / 2, WHITE);
    const isPlaza = bx0 > 10 && bx1 < 50 && bz0 > 0 && bz1 < 75;
    const D = Math.min(13, (bx1 - bx0) / 2 - 1, (bz1 - bz0) / 2 - 1);
    const tall = bx0 >= 80;
    if (isPlaza) { genEdge('N', bx0, bx1, bz0, 9); genEdge('S', bx0, bx1, bz1, 9); continue; }
    genEdge('N', bx0, bx1, bz0, D, { tall }); genEdge('S', bx0, bx1, bz1, D, { tall });
    genEdge('W', bz0 + D, bz1 - D, bx0, D, { tall, colonnade: Math.abs(bx0 - ibnE) < 1 });
    genEdge('E', bz0 + D, bz1 - D, bx1, D, { tall, colonnade: Math.abs(bx1 - ibnW) < 1 });
    if (rng() < 0.85) {
      const gx = (bx0 + bx1) / 2, gz = (bz0 + bz1) / 2, gw = Math.max(2, bx1 - bx0 - 2 * D - 6), gd = Math.max(2, bz1 - bz0 - 2 * D - 6);
      G.grass.box(gw, 0.2, gd, gx, 0.1, gz, WHITE);
      ficus(SB, gx, gz, 1.2);
      if (gd > 12) ficus(SB, gx + 2, gz - gd / 3, 1);
    }
  }

  /* special buildings: bike shop, police station */
  let bs = null, bd = 1e9;
  for (const sh of WORLD.shops) if (sh.face === 'E' && Math.abs(sh.x - (-9.4)) < 1 && Math.abs(sh.z + 40) < bd) { bd = Math.abs(sh.z + 40); bs = sh; }
  if (bs) {
    bs.food = false; bs.name = 'אופני העיר'; WORLD.bikeShop = bs;
    const g = signMesh('אופני העיר — מוסך ושדרוגים', 5.2, 0.85, { w: 640, h: 128, bg: '#f2a81d', fg: '#1b1b1b', size: 64 });
    g.position.set(-11.7, 4.2, bs.z); g.rotation.y = Math.PI / 2; WORLD.dyn.add(g);
    SB.box(0.6, 2.2, 0.6, -11.2, 1.1, bs.z + 2.6, 0xf2a81d);
  }
  let ps = null; bd = 1e9;
  for (const sh of WORLD.shops) if (sh.face === 'N' && sh.z > 10 && sh.z < 16 && Math.abs(sh.x - 100) < bd) { bd = Math.abs(sh.x - 100); ps = sh; }
  if (ps) {
    ps.food = false; ps.name = 'תחנת משטרה'; WORLD.police = ps;
    const g = signMesh('תחנת משטרה', 5.0, 1.0, { w: 640, h: 128, bg: '#16326e', fg: '#ffffff', size: 76 });
    g.position.set(ps.x, 4.9, ps.B.z0 - 0.3); g.rotation.y = Math.PI; WORLD.dyn.add(g);
    for (const dx of [-3, 3]) { SB.cyl(0.25, 1.0, ps.x + dx, 0.5, ps.B.z0 - 1.2, 0x16326e, 8); addCircle(ps.x + dx, ps.B.z0 - 1.2, 0.3); }
    SB.box(0.1, 5, 0.1, ps.x + 5, 2.5, ps.B.z0 - 0.8, 0xbbbbbb);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), flagMat); fl.position.set(ps.x + 5.72, 4.5, ps.B.z0 - 0.8); WORLD.dyn.add(fl);
  }

  /* ---------- trees, lamps, benches, bins, bike docks ---------- */
  const busStops = [[11.6, -45], [11.6, 120], [148.6, -120], [148.6, 40]];
  for (const s of NS) {
    for (let z = NS_Z0 + 5; z < NS_Z1; z += s.tayelet ? 13 : 15) {
      if (!s.tayelet && EW.some((e) => Math.abs(z - e.z) < 13)) continue;
      if (s.tayelet) { palm(SB, s.x - 11.2, z + 3); if (Math.abs(z % 39) < 1) bench(SB, s.x - 1.5, z, Math.PI / 2); continue; }
      const L = s.strips[0], Rr = s.strips[s.strips.length - 1];
      const xl = s.x + L[1] - 0.9, xr = s.x + Rr[0] + 0.9;
      if (s.boulevard) {
        if (Math.abs(z - 36) > 9 && !(z > 98 && z < 152)) { ficus(SB, s.x - 6.2, z, 1); ficus(SB, s.x + 6.2, z + 7, 1); }
        if (Math.abs(z % 30) < 1) bench(SB, s.x - 3.2, z + 3, Math.PI / 2);
        continue;
      }
      if (busStops.some(([bx, bz]) => Math.abs(bz - z) < 5 && Math.abs(bx - xr) < 5)) continue;
      if (Math.round(z / 15) % 2 === 0) { ficus(SB, xl, z, 0.9); palm(SB, xr, z + 7); } else { palm(SB, xl, z); ficus(SB, xr, z + 7, 0.9); }
      if (Math.abs(z % 30) < 1) { streetLamp(SB, xl, z + 3.5); streetLamp(SB, xr, z + 10.5); }
      if (Math.abs(z % 45) < 1) { bin(SB, xl, z + 5.5); WORLD.bins.push({ x: xl - 0.9, z: z + 5.5 }); }
      if (Math.abs((z + 30) % 90) < 1) bikeDock(SB, xr + 0.4, z + 2);
    }
  }
  for (const e of EW) for (let x = -96; x < 178; x += 16) {
    if (NS.some((s) => x > s.x + s.strips[0][0] - 3 && x < s.x + s.strips[s.strips.length - 1][1] + 3)) continue;
    if (e.z === 80 && x > MARKET.x0 - 2 && x < MARKET.x1 + 2) continue;
    ficus(SB, x, e.z - EWS + 1.1, 0.85); ficus(SB, x + 8, e.z + EWS - 1.1, 0.85);
    if (Math.abs(x % 48) < 8) { bin(SB, x + 4, e.z - EWS + 0.9); WORLD.bins.push({ x: x + 4, z: e.z - EWS + 1.9 }); }
  }
  for (const [bx, bz] of busStops) {
    SB.box(0.1, 2.5, 0.1, bx - 0.9, 1.25, bz - 2, 0x666a75); SB.box(0.1, 2.5, 0.1, bx - 0.9, 1.25, bz + 2, 0x666a75);
    SB.box(1.8, 0.12, 4.6, bx, 2.55, bz, 0x2b58c9); SB.box(0.08, 1.8, 4.2, bx + 0.8, 1.2, bz, 0xa9d1e8); bench(SB, bx + 0.3, bz, Math.PI / 2);
    addBox(bx + 0.7, bz - 2.1, bx + 0.9, bz + 2.1, 2.5, 'low');
    const sg = signMesh('תחנה', 1.0, 0.4, { w: 256, h: 100, bg: '#2b58c9', size: 56 }); sg.position.set(bx - 0.9, 2.2, bz - 2.06); sg.rotation.y = Math.PI; WORLD.dyn.add(sg);
    const ad = signMesh('קיץ בתל אביב', 1.6, 1.2, { w: 300, h: 220, bg: '#f2a81d', fg: '#1b1d2a', size: 50, sub: 'הים מחכה לך 🌊' }); ad.position.set(bx + 0.75, 1.3, bz); ad.rotation.y = -Math.PI / 2; WORLD.dyn.add(ad);
  }

  /* parked / abandoned scooters (iconic) */
  for (let i = 0; i < 60; i++) {
    const s = NS[1 + Math.floor(rng() * 4)], st = rng() < 0.5 ? s.strips[0] : s.strips[s.strips.length - 1];
    const x = s.x + R(st[0] + 0.5, st[1] - 0.5), z = R(-200, 200);
    if (EW.some((e) => Math.abs(z - e.z) < 12)) continue;
    const ry = R(0, 6.28), cc = pick([0x2a2d35, 0x1f9b6b, 0x2b9bd9, 0xe2463b]);
    SB.add(GEO.box, cc, x, 0.3, z, 0.18, 0.1, 0.9, 0, ry, 0);
    if (rng() < 0.5) SB.add(GEO.box, cc, x + Math.sin(ry) * 0.4, 0.28, z + Math.cos(ry) * 0.4, 0.12, 0.12, 1.0, 0, ry + 1.4, 0);
    else SB.add(GEO.box, cc, x + Math.sin(ry) * 0.42, 0.75, z + Math.cos(ry) * 0.42, 0.07, 1.0, 0.07, 0, ry, 0);
  }

  /* ---------- plaza ---------- */
  {
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA.r, PLAZA.r, 0.3, 40), new THREE.MeshStandardMaterial({ map: TEX.yard, color: 0xf3d2bd, roughness: 0.9 }));
    plaza.material.map = TEX.yard.clone(); plaza.material.map.repeat.set(5, 5); plaza.material.map.needsUpdate = true;
    plaza.position.set(PLAZA.x, 0.07, PLAZA.z); plaza.receiveShadow = true; scene.add(plaza);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 0.32, 40), MAT(0xd8a98f));
    ring.position.set(PLAZA.x, 0.08, PLAZA.z); ring.receiveShadow = true; scene.add(ring);
    SB.cyl(3.2, 0.7, PLAZA.x, 0.5, PLAZA.z, 0xf7f4ee, 16);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x55b8ea, roughness: 0.15, metalness: 0.1 }));
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
    SB.box(0.9, 0.95, 1.9, kx + 2.4, 0.5, kz + 3.4, 0xf4f6fa); SB.box(0.92, 0.1, 1.92, kx + 2.4, 1.0, kz + 3.4, 0xc9d2e0);
    addBox(kx + 1.95, kz + 2.45, kx + 2.85, kz + 4.35, 1, 'low');
    const ice = signMesh('קרח', 1.6, 0.6, { w: 320, h: 120, bg: '#ffffff', fg: '#2b58c9', size: 90, weight: 900 });
    ice.position.set(kx + 2.86, 0.55, kz + 3.4); ice.rotation.y = Math.PI / 2; WORLD.dyn.add(ice);
    WORLD.kiosk = { x: kx + 3.3, z: kz + 3.2 };
    SB.box(0.8, 0.05, 0.6, kx + 3.4, 0.75, kz + 6.6, 0x8b5a2b); SB.box(0.1, 0.72, 0.1, kx + 3.4, 0.37, kz + 6.6, 0xffffff);
  }

  /* ---------- protest tents on Rothschild (housing protest) ---------- */
  {
    const tents = [];
    for (let z = 104; z < 150; z += 6.5) for (const x of [60.2, 69.8]) {
      if (rng() < 0.2) continue;
      const c = pick([0xe2463b, 0x2b9bd9, 0xf2a81d, 0x1f9b6b, 0x7a4fd6]);
      SB.add(GEO.cone(4), c, x, 0.95, z, 2.6, 1.6, 2.6, 0, Math.PI / 4, 0);
      addCircle(x, z, 1.1); tents.push([x, z]);
    }
    const signs = ['דיור בר השגה!', 'העם דורש צדק חברתי', 'קוטג׳ ב־5 שקל!', 'שכר דירה = משכורת?!'];
    signs.forEach((t, i) => {
      const s = signMesh(t, 2.4, 0.9, { w: 420, h: 160, bg: '#ffffff', fg: '#c62828', size: 60, border: '#1b1d2a' });
      s.position.set(i % 2 ? 67.5 : 62.5, 1.6, 108 + i * 11); s.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2; WORLD.dyn.add(s);
      SB.box(0.08, 1.6, 0.08, i % 2 ? 67.5 : 62.5, 0.8, 108 + i * 11, 0x8b5a2b);
    });
    WORLD.protest = { x: 65, z: 125 };
  }

  /* ---------- Carmel-ish market stalls ---------- */
  {
    const fruit = [0xe2463b, 0xf29a1d, 0xf6d02f, 0x6aa84f, 0x7a3fa0, 0xd94f8a];
    for (let x = MARKET.x0 + 2; x < MARKET.x1 - 3; x += 4.6) {
      const z = 88.7;
      SB.box(3.4, 0.9, 1.2, x + 1.7, 0.45 + 0.16, z, 0x9b6a3c);
      for (let i = 0; i < 6; i++) SB.add(GEO.ico, fruit[(i + Math.floor(x)) % fruit.length], x + 0.35 + i * 0.52, 1.18, z + rng() * 0.3 - 0.15, 0.42, 0.36, 0.42, 0, 0, 0);
      SB.box(0.08, 2.4, 0.08, x + 0.05, 1.3, z - 0.55, 0x666666); SB.box(0.08, 2.4, 0.08, x + 3.35, 1.3, z - 0.55, 0x666666);
      const cA = AWNING[Math.floor(rng() * AWNING.length)];
      for (let k = 0; k < 4; k++) SB.add(GEO.box, k % 2 ? 0xffffff : cA, x + 0.43 + k * 0.85, 2.5, z - 0.1, 0.85, 0.08, 1.9, 0.25, 0, 0);
      addBox(x, z - 0.6, x + 3.4, z + 0.6, 1, 'low');
    }
    const sg = signMesh('שוק', 2.6, 1.0, { w: 300, h: 120, bg: '#e2463b', size: 90 });
    sg.position.set(MARKET.x0 + 1, 3.8, 86.1); sg.rotation.y = Math.PI; WORLD.dyn.add(sg);
    SB.box(0.15, 4.2, 0.15, MARKET.x0, 2.1, 86.2, 0x555555); SB.box(0.15, 4.2, 0.15, MARKET.x0 + 2.0, 2.1, 86.2, 0x555555);
  }

  /* ---------- beach ---------- */
  {
    for (let z = -190; z < 190; z += 15) {
      const x = R(-138, -118), c = AWNING[Math.floor(rng() * AWNING.length)];
      SB.cyl(0.05, 2.3, x, 1.15, z, 0xeeeeee, 5);
      SB.add(GEO.cone(8), c, x, 2.3, z, 2.8, 0.7, 2.8, 0, 0, 0);
      SB.box(1.0, 0.03, 1.9, x + 1.2, 0.07, z + 0.4, AWNING[Math.floor(rng() * AWNING.length)]);
      addCircle(x, z, 0.15);
    }
    for (const lz of [12, -120, 130]) {
      const lx = -134;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) SB.box(0.18, 3, 0.18, lx + dx, 1.5, lz + dz, 0xffffff);
      SB.box(2.6, 2.0, 2.6, lx, 4.0, lz, 0xf7f4ee); SB.box(2.9, 0.2, 2.9, lx, 5.1, lz, 0xe2463b); SB.box(0.05, 0.9, 2.0, lx + 1.31, 4.2, lz, 0x34507e);
      addBox(lx - 1.1, lz - 1.1, lx + 1.1, lz + 1.1, 5, 'low');
      const sg = signMesh('מציל', 1.4, 0.5, { w: 256, h: 92, bg: '#e2463b', size: 60 }); sg.position.set(lx + 1.32, 5.4, lz); sg.rotation.y = Math.PI / 2; WORLD.dyn.add(sg);
    }
  }

  /* ---------- distant skyline (towers to the east) ---------- */
  for (let i = 0; i < 34; i++) {
    const a = rng();
    let x, z;
    if (a < 0.6) { x = R(205, 360); z = R(-330, 330); } else if (a < 0.8) { x = R(-60, 200); z = R(-360, -275); } else { x = R(-60, 200); z = R(275, 360); }
    const w = R(16, 30), d = R(16, 30), H = R(45, 150), col = pick([0xdfe6ee, 0xcfd8e3, 0xf0ece4, 0xb9c6d6]);
    walls(FB[3], x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, H, col);
    SB.box(w, 1, d, x, H, z, 0xc0c4cc);
    if (rng() < 0.4) SB.box(0.4, 12, 0.4, x, H + 6, z, 0xdddddd);
  }

  SB.build(scene); GB.build(scene); FB.forEach((f) => f.build(scene)); buildSigns(scene);
  for (const k in G) G[k].build(scene);
}

/* ---------- prop helpers ---------- */
function ficus(SB, x, z, s) {
  s = s || 1;
  SB.cyl(0.22 * s, 2.6 * s, x, 1.3 * s, z, 0x7a5a43, 6);
  SB.add(GEO.ico1, 0x4f8f3e, x, 3.5 * s, z, 3.6 * s, 2.5 * s, 3.6 * s, 0, z, 0);
  SB.add(GEO.ico, 0x5ea347, x + 0.8 * s, 4.2 * s, z - 0.5 * s, 2.5 * s, 1.9 * s, 2.5 * s, 0, x, 0);
  SB.add(GEO.ico, 0x467f37, x - 0.9 * s, 3.9 * s, z + 0.6 * s, 2.2 * s, 1.6 * s, 2.2 * s, 0, x + z, 0);
  addCircle(x, z, 0.35 * s);
}
function palm(SB, x, z) {
  const lean = Math.abs((x * 7 + z * 3) % 1) * 0.3 - 0.15;
  for (let i = 0; i < 4; i++) SB.add(GEO.cyl(6), i % 2 ? 0x9c7a55 : 0x8c6c49, x + lean * i * 0.6, 0.9 + i * 1.75, z, 0.42 - i * 0.04, 1.8, 0.42 - i * 0.04, 0, 0, -lean * 0.4);
  const tx = x + lean * 2.4, ty = 7.6;
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2;
    SB.add(GEO.box, k % 2 ? 0x3f7f3a : 0x4f9a45, tx + Math.cos(a) * 1.5, ty - 0.4, z + Math.sin(a) * 1.5, 3.4, 0.08, 0.6, 0, -a, -0.5);
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
function bin(SB, x, z) { // big green municipal container
  SB.box(1.2, 1.1, 1.0, x, 0.7, z, 0x2f7d46); SB.box(1.25, 0.1, 1.05, x, 1.3, z, 0x24603a);
  addCircle(x, z, 0.65);
}
function bikeDock(SB, x, z) {
  SB.box(0.25, 0.2, 7, x + 0.6, 0.25, z, 0x666a75);
  for (let k = 0; k < 5; k++) {
    const bz = z - 2.8 + k * 1.4;
    SB.add(GEO.cyl(8), 0x1d1e22, x, 0.36, bz, 0.7, 0.05, 0.7, Math.PI / 2, 0, 0);
    SB.box(0.9, 0.08, 0.08, x - 0.35, 0.6, bz, 0x2fae5a); SB.box(0.08, 0.5, 0.08, x - 0.6, 0.8, bz, 0x2fae5a);
    SB.add(GEO.cyl(8), 0x1d1e22, x - 0.7, 0.36, bz, 0.7, 0.05, 0.7, Math.PI / 2, 0, 0);
  }
  addBox(x - 1.1, z - 3.4, x + 0.8, z + 3.4, 1, 'low');
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
