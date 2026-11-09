// Convex-part geometry kernel.
//
// Every cuttable object is represented as a set of CONVEX parts. A part is a
// closed convex polyhedron made of polygon faces. Cutting a convex part with a
// plane always yields two convex parts plus a flat "cap" polygon, so the
// operation is exact and robust. Non-convex results (slits, grooves, curved
// cuts, carved channels) are expressed as several convex parts that stay
// "glued" together through shared glue faces.
//
// Face types:
//   0 = original outer surface (crust, skin, wrapper ...)
//   1 = knife cut surface   (never glued -> pieces may separate here)
//   2 = glue surface        (internal bookkeeping split, keeps parts bonded)
//
// All coordinates are in "material space": the object's original frame.
// Procedural shaders colour surfaces by this position, so the inside of an
// object stays consistent no matter how it is cut.

const EPS = 1e-6;
const PEPS = 2e-5; // plane distance tolerance

export class Face {
  constructor(pts, nrm, type, plane = null) {
    this.pts = pts;   // Float64Array-like flat [x,y,z,...]
    this.nrm = nrm;   // flat normals per vertex (null for flat faces -> use plane)
    this.type = type;
    this.plane = plane; // {n:[x,y,z], c} for cap faces (outward normal)
  }
  get count() { return this.pts.length / 3; }
}

export class Part {
  constructor(faces) {
    this.faces = faces;
    this._vol = null;
    this.id = Part.nextId++;
  }
  static nextId = 1;
  verts() {
    const out = [];
    for (const f of this.faces) for (let i = 0; i < f.pts.length; i++) out.push(f.pts[i]);
    return out;
  }
  // volume + centroid via divergence theorem
  massProps() {
    if (this._vol) return this._vol;
    let V = 0, cx = 0, cy = 0, cz = 0;
    for (const f of this.faces) {
      const p = f.pts, n = p.length / 3;
      for (let i = 1; i < n - 1; i++) {
        const ax = p[0], ay = p[1], az = p[2];
        const bx = p[i * 3], by = p[i * 3 + 1], bz = p[i * 3 + 2];
        const qx = p[i * 3 + 3], qy = p[i * 3 + 4], qz = p[i * 3 + 5];
        const v = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
        V += v; cx += v * (ax + bx + qx) / 4; cy += v * (ay + by + qy) / 4; cz += v * (az + bz + qz) / 4;
      }
    }
    const c = Math.abs(V) > 1e-12 ? [cx / V, cy / V, cz / V] : [0, 0, 0];
    this._vol = { V: Math.abs(V), c };
    return this._vol;
  }
  bounds() {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const f of this.faces) {
      const p = f.pts;
      for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) {
        if (p[i + k] < mn[k]) mn[k] = p[i + k];
        if (p[i + k] > mx[k]) mx[k] = p[i + k];
      }
    }
    return { mn, mx };
  }
  // signed-distance range against plane (n,c)
  range(n, c) {
    let lo = Infinity, hi = -Infinity;
    for (const f of this.faces) {
      const p = f.pts;
      for (let i = 0; i < p.length; i += 3) {
        const d = p[i] * n[0] + p[i + 1] * n[1] + p[i + 2] * n[2] - c;
        if (d < lo) lo = d; if (d > hi) hi = d;
      }
    }
    return [lo, hi];
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const V3 = { sub, dot, cross, norm };

function planeBasis(n) {
  const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(n, a));
  const v = cross(n, u);
  return [u, v];
}

// Split a part by plane dot(n,x)=c. Returns {front, back} (either may be null).
// capType: type of the new cap faces (1 knife, 2 glue).
export function splitPart(part, n, c, capType) {
  const [lo, hi] = part.range(n, c);
  if (lo >= -PEPS) return { front: part, back: null };
  if (hi <= PEPS) return { front: null, back: part };
  const F = [], B = [], cap = [];
  for (const f of part.faces) {
    const p = f.pts, m = p.length / 3, nr = f.nrm;
    const d = new Array(m);
    let any = 0, allOn = true;
    for (let i = 0; i < m; i++) {
      d[i] = p[i * 3] * n[0] + p[i * 3 + 1] * n[1] + p[i * 3 + 2] * n[2] - c;
      if (d[i] > PEPS) any |= 1; else if (d[i] < -PEPS) any |= 2;
      if (Math.abs(d[i]) > PEPS) allOn = false;
    }
    if (allOn) { // coplanar face: belongs to the side it faces away from
      const fn = f.plane ? f.plane.n : faceNormal(p);
      (dot(fn, n) > 0 ? B : F).push(f);
      continue;
    }
    if (any === 1 || any === 0) { F.push(f); collectOn(p, d, cap); continue; }
    if (any === 2) { B.push(f); collectOn(p, d, cap); continue; }
    const fp = [], fn = [], bp = [], bn = [];
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const di = d[i], dj = d[j];
      const pi = [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
      const ni = nr ? [nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]] : null;
      if (di >= -PEPS) { fp.push(...pi); if (ni) fn.push(...ni); }
      if (di <= PEPS) { bp.push(...pi); if (ni) bn.push(...ni); }
      if ((di > PEPS && dj < -PEPS) || (di < -PEPS && dj > PEPS)) {
        const t = di / (di - dj);
        const q = [p[i * 3] + (p[j * 3] - p[i * 3]) * t, p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * t, p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * t];
        fp.push(...q); bp.push(...q); cap.push(q);
        if (nr) {
          const nq = norm([nr[i * 3] + (nr[j * 3] - nr[i * 3]) * t, nr[i * 3 + 1] + (nr[j * 3 + 1] - nr[i * 3 + 1]) * t, nr[i * 3 + 2] + (nr[j * 3 + 2] - nr[i * 3 + 2]) * t]);
          fn.push(...nq); bn.push(...nq);
        }
      }
    }
    if (fp.length >= 9) F.push(new Face(fp, nr ? fn : null, f.type, f.plane));
    if (bp.length >= 9) B.push(new Face(bp, nr ? bn : null, f.type, f.plane));
  }
  const poly = buildCap(cap, n);
  if (!poly || F.length === 0 || B.length === 0) {
    // degenerate grazing cut – treat as no split
    return lo + hi > 0 ? { front: part, back: null } : { front: null, back: part };
  }
  const nn = [-n[0], -n[1], -n[2]];
  F.push(new Face(poly.rev, null, capType, { n: nn, c: -c }));
  B.push(new Face(poly.fwd, null, capType, { n: n.slice(), c }));
  return { front: new Part(F), back: new Part(B) };
}

function collectOn(p, d, cap) {
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) <= PEPS) cap.push([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
}

export function faceNormal(p) {
  let nx = 0, ny = 0, nz = 0; const m = p.length / 3;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    nx += (p[i * 3 + 1] - p[j * 3 + 1]) * (p[i * 3 + 2] + p[j * 3 + 2]);
    ny += (p[i * 3 + 2] - p[j * 3 + 2]) * (p[i * 3] + p[j * 3]);
    nz += (p[i * 3] - p[j * 3]) * (p[i * 3 + 1] + p[j * 3 + 1]);
  }
  return norm([nx, ny, nz]);
}

// Order cap points into a convex polygon. fwd winds CCW around +n, rev around -n.
function buildCap(pts, n) {
  if (pts.length < 3) return null;
  const [u, v] = planeBasis(n);
  const uniq = [];
  for (const q of pts) {
    let dup = false;
    for (const r of uniq) if (Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) + Math.abs(q[2] - r[2]) < 1e-5) { dup = true; break; }
    if (!dup) uniq.push(q);
  }
  if (uniq.length < 3) return null;
  // 2D convex hull (monotone chain) – removes collinear/inner points robustly
  const P = uniq.map(q => ({ q, x: dot(q, u), y: dot(q, v) })).sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const p of P) { while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop(); lower.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop(); upper.push(p); }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  if (hull.length < 3) return null;
  let area = 0;
  for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; area += a.x * b.y - b.x * a.y; }
  if (Math.abs(area) < 1e-9) return null;
  // (u,v,n) is right-handed, so CCW in (u,v) == CCW around +n
  const fwd = [], rev = [];
  for (const h of hull) fwd.push(...h.q);
  for (let i = hull.length - 1; i >= 0; i--) rev.push(...hull[i].q);
  return { fwd, rev };
}

// ---------------------------------------------------------------- connectivity
// Two parts are bonded if they own opposite glue faces on the same plane whose
// polygons overlap with non-zero area.
function polyArea2D(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function clip2D(subj, clipP) {
  // both CCW convex
  let out = subj;
  for (let i = 0; i < clipP.length && out.length; i++) {
    const a = clipP[i], b = clipP[(i + 1) % clipP.length];
    const inp = out; out = [];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let k = 0; k < inp.length; k++) {
      const p = inp[k], q = inp[(k + 1) % inp.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return out;
}
function gluesTouch(fa, fb) {
  const na = fa.plane.n, nb = fb.plane.n;
  if (dot(na, nb) > -0.9999) return false;
  if (Math.abs(fa.plane.c + fb.plane.c) > 1e-4) return false;
  const [u, v] = planeBasis(na);
  const A = [], B = [];
  for (let i = 0; i < fa.pts.length; i += 3) { const q = [fa.pts[i], fa.pts[i + 1], fa.pts[i + 2]]; A.push([dot(q, u), dot(q, v)]); }
  for (let i = fb.pts.length - 3; i >= 0; i -= 3) { const q = [fb.pts[i], fb.pts[i + 1], fb.pts[i + 2]]; B.push([dot(q, u), dot(q, v)]); }
  if (polyArea2D(A) < 0) A.reverse();
  if (polyArea2D(B) < 0) B.reverse();
  const I = clip2D(A, B);
  return I.length >= 3 && Math.abs(polyArea2D(I)) > 1e-5;
}
export function components(parts) {
  const n = parts.length;
  const glue = parts.map(p => p.faces.filter(f => f.type === 2));
  const bb = parts.map(p => p.bounds());
  const par = parts.map((_, i) => i);
  const find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (find(i) === find(j)) continue;
    const a = bb[i], b = bb[j];
    if (a.mn[0] > b.mx[0] + 1e-4 || b.mn[0] > a.mx[0] + 1e-4 || a.mn[1] > b.mx[1] + 1e-4 || b.mn[1] > a.mx[1] + 1e-4 || a.mn[2] > b.mx[2] + 1e-4 || b.mn[2] > a.mx[2] + 1e-4) continue;
    let ok = false;
    for (const fa of glue[i]) { for (const fb of glue[j]) if (gluesTouch(fa, fb)) { ok = true; break; } if (ok) break; }
    if (ok) par[find(i)] = find(j);
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(parts[i]); }
  return [...groups.values()];
}

// ---------------------------------------------------------------- shape generation
// A convex surface is sampled on an (odd-row, half-offset-column) direction grid
// and mapped through a support-like function dir -> point. The offset grid makes
// flat sides appear as long stretched quads, producing exact flat faces.
function gridShape(fn, rows = 17, cols = 36) {
  const P = [], N = [];
  for (let i = 0; i <= rows; i++) {
    const th = (i / rows) * Math.PI;
    const row = [], nrow = [];
    for (let j = 0; j < cols; j++) {
      const ph = ((j + 0.5) / cols) * Math.PI * 2;
      const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const r = fn(d);
      row.push(r.p); nrow.push(r.n || d);
    }
    P.push(row); N.push(nrow);
  }
  const faces = [];
  const tri = (a, b, c, na, nb, nc) => {
    const ab = sub(b, a), ac = sub(c, a);
    const cr = cross(ab, ac);
    if (Math.hypot(cr[0], cr[1], cr[2]) < 1e-10) return;
    faces.push(new Face([...a, ...b, ...c], [...na, ...nb, ...nc], 0));
  };
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const j2 = (j + 1) % cols;
    const a = P[i][j], b = P[i][j2], c = P[i + 1][j], d = P[i + 1][j2];
    const na = N[i][j], nb = N[i][j2], nc = N[i + 1][j], nd = N[i + 1][j2];
    // outward winding: rows go top->bottom, cols go +phi (x->z)
    tri(a, b, d, na, nb, nd);
    tri(a, d, c, na, nd, nc);
  }
  return faces;
}
const sgn = (x) => (x >= 0 ? 1 : -1);

// Fix winding & smooth normals of generated faces using the centroid.
function orient(faces) {
  let c = [0, 0, 0], k = 0;
  for (const f of faces) for (let i = 0; i < f.pts.length; i += 3) { c[0] += f.pts[i]; c[1] += f.pts[i + 1]; c[2] += f.pts[i + 2]; k++; }
  c = c.map(v => v / k);
  for (const f of faces) {
    const n = faceNormal(f.pts);
    const p0 = [f.pts[0], f.pts[1], f.pts[2]];
    if (dot(n, sub(p0, c)) < 0) {
      const m = f.pts.length / 3, np = [], nn = [];
      for (let i = m - 1; i >= 0; i--) { np.push(f.pts[i * 3], f.pts[i * 3 + 1], f.pts[i * 3 + 2]); nn.push(f.nrm[i * 3], f.nrm[i * 3 + 1], f.nrm[i * 3 + 2]); }
      f.pts = np; f.nrm = nn;
    }
  }
  return faces;
}

// Shape spec -> Part (bottom resting at y=0, centred in x/z)
export function makeShape(s) {
  let faces;
  const q = s.q || 1; // quality multiplier
  const R = Math.max(5, Math.round(13 * q)) | 1, C = Math.max(12, Math.round(28 * q / 4) * 4);
  switch (s.type) {
    case 'box': { // half extents hx,hy,hz, bevel r
      const r = s.r ?? 0.06, k = [s.hx - r, s.hy - r, s.hz - r];
      faces = gridShape(d => ({ p: [sgn(d[0]) * k[0] + r * d[0], sgn(d[1]) * k[1] + r * d[1], sgn(d[2]) * k[2] + r * d[2]] }), r < 0.02 ? 5 : R, r < 0.02 ? 8 : C);
      break;
    }
    case 'cyl': { // radius rad, half height hy, bevel r, rTop (optional frustum), segs
      const r = s.r ?? 0.05, rt = s.rTop ?? s.rad;
      faces = gridShape(d => {
        const L = Math.hypot(d[0], d[2]) || 1e-9;
        const rad = d[1] >= 0 ? rt : s.rad;
        return { p: [(d[0] / L) * (rad - r) + r * d[0], sgn(d[1]) * (s.hy - r) + r * d[1], (d[2] / L) * (rad - r) + r * d[2]] };
      }, R, s.segs || C);
      break;
    }
    case 'cylx': { // cylinder lying along x: rad, hx, r
      const r = s.r ?? 0.05;
      faces = gridShape(d => {
        // map: grid y-axis -> x-axis
        const e = [d[1], d[0], d[2]];
        const L = Math.hypot(e[1], e[2]) || 1e-9;
        return { p: [sgn(e[0]) * (s.hx - r) + r * e[0], (e[1] / L) * (s.rad - r) + r * e[1], (e[2] / L) * (s.rad - r) + r * e[2]], n: e };
      }, R, C);
      break;
    }
    case 'ell': // ellipsoid a,b,c ; flat bottom via flat (0..1 fraction of b)
      faces = gridShape(d => {
        const p = [d[0] * s.a, d[1] * s.b, d[2] * s.c];
        const fl = s.flat ?? 0.15; const yb = -s.b * (1 - fl);
        if (p[1] < yb) p[1] = yb;
        return { p, n: norm([d[0] / s.a, d[1] / s.b, d[2] / s.c]) };
      }, R, C);
      break;
    case 'dome': // hemisphere-ish: a (radius xz), b (height)
      faces = gridShape(d => ({ p: [d[0] * s.a, Math.max(d[1], 0) * s.b, d[2] * (s.c ?? s.a)], n: d[1] > 0 ? norm([d[0] / s.a, d[1] / s.b, d[2] / (s.c ?? s.a)]) : [0, -1, 0] }), R, C);
      break;
    case 'capsule': { // along x: hx (half length incl. caps), rad, sy (y squash)
      const L = s.hx - s.rad, sy = s.sy ?? 1, sz = s.sz ?? 1;
      faces = gridShape(d => {
        const e = [d[1], d[0], d[2]];
        const taper = s.taper ? (e[0] > 0 ? s.taper : 1) : 1;
        return { p: [sgn(e[0]) * L + s.rad * e[0] * taper, s.rad * e[1] * sy * (e[0] > 0 && s.taper ? s.taper : 1), s.rad * e[2] * sz * (e[0] > 0 && s.taper ? s.taper : 1)], n: e };
      }, R, C);
      break;
    }
    default: throw new Error('shape ' + s.type);
  }
  orient(faces);
  let part = new Part(faces);
  // optional clipping planes to make wedges / slices (outer-type caps)
  for (const cl of s.clips || []) {
    const n = norm(cl.n);
    const res = splitPart(part, n, cl.c, 0);
    if (res.back) part = res.back;
  }
  // flatten caps type to 0 and rest on y=0
  const b = part.bounds();
  const off = [-(b.mn[0] + b.mx[0]) / 2, -b.mn[1], -(b.mn[2] + b.mx[2]) / 2];
  for (const f of part.faces) {
    for (let i = 0; i < f.pts.length; i += 3) { f.pts[i] += off[0]; f.pts[i + 1] += off[1]; f.pts[i + 2] += off[2]; }
    if (f.plane) f.plane = { n: f.plane.n, c: f.plane.c + dot(f.plane.n, off) };
    if (f.type !== 0) f.type = 0;
  }
  part._vol = null;
  return part;
}

// Transform a world plane into a body's local frame (body: position p, quaternion q).
export function planeToLocal(n, c, pos, quat) {
  // local normal = q^-1 * n ; c' = c - dot(n, pos)
  const [x, y, z, w] = [-quat.x, -quat.y, -quat.z, quat.w];
  const ix = w * n[0] + y * n[2] - z * n[1], iy = w * n[1] + z * n[0] - x * n[2], iz = w * n[2] + x * n[1] - y * n[0], iw = -x * n[0] - y * n[1] - z * n[2];
  const ln = [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  return { n: norm(ln), c: c - (n[0] * pos.x + n[1] * pos.y + n[2] * pos.z) };
}
