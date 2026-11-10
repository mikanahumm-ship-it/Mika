import * as THREE from 'three';

// kind:  knife  -> planar cut along your stroke (can be partial: a slit)
//        shave  -> removes a thin layer under the stroke (soap shavings)
//        carve  -> removes a narrow deep groove (carving / scooping)
// path:  stroke modifier applied to the real path you drew (zigzag/wave)
// cross-section profiles for curved / V carving tools: strips {o: offset, w: width, d: depth} (fractions)
const roundProfile = (k) => Array.from({ length: k }, (_, i) => { const o = (i + 0.5) / k - 0.5; return { o, w: 1 / k, d: Math.max(0.22, Math.sqrt(Math.max(0, 1 - (o / 0.5) ** 2))) }; });
const vProfile = (k) => Array.from({ length: k }, (_, i) => { const o = (i + 0.5) / k - 0.5; return { o, w: 1 / k, d: Math.max(0.18, 1 - Math.abs(o) * 2) }; });

export const TOOLS = [
  { id: 'chef', name: "Chef's Knife", kind: 'knife', len: 1.6, h: 0.42, prof: 'chef', weight: 1, pitch: 1, push: 1 },
  { id: 'dicer', name: 'Dicer', kind: 'dice', len: 2.7, h: 0.55, prof: 'dicer', weight: 1.2, pitch: 0.95, cube: 0.08 },
  { id: 'finedicer', name: 'Fine Dicer', kind: 'dice', len: 2.7, h: 0.5, prof: 'dicer', weight: 1, pitch: 1.12, cube: 0.055 },
  { id: 'chunkdicer', name: 'Chunk Dicer', kind: 'dice', len: 2.7, h: 0.62, prof: 'dicer', weight: 1.5, pitch: 0.85, cube: 0.125 },
  { id: 'squish', name: 'Squish', kind: 'squish', len: 0.4, h: 0.3, prof: 'press', weight: 0.5, pitch: 0.8 },
  { id: 'santoku', name: 'Santoku', kind: 'knife', len: 1.4, h: 0.44, prof: 'santoku', weight: 1, pitch: 1.1, push: 0.9 },
  { id: 'cleaver', name: 'Cleaver', kind: 'knife', len: 1.3, h: 0.75, prof: 'cleaver', weight: 1.8, pitch: 0.8, push: 1.8, knock: 0.8 },
  { id: 'bread', name: 'Bread Knife', kind: 'knife', len: 1.9, h: 0.32, prof: 'bread', weight: 0.9, pitch: 1, push: 0.8, saw: true },
  { id: 'precision', name: 'Precision Blade', kind: 'knife', len: 0.75, h: 0.18, prof: 'scalpel', weight: 0.5, pitch: 1.35, push: 0.4 },
  { id: 'soapcutter', name: 'Soap Cutter', kind: 'knife', len: 1.2, h: 0.55, prof: 'soap', weight: 1.2, pitch: 0.95, push: 1.1 },
  { id: 'wire', name: 'Wire Cutter', kind: 'knife', kerf: 0.014, len: 1.6, h: 0.9, prof: 'wire', weight: 0.6, pitch: 1.5, push: 0.6, whistle: true },
  { id: 'shaver', name: 'Peeler', kind: 'shave', len: 0.7, h: 0.3, prof: 'shaver', weight: 0.6, pitch: 1.1, width: 0.36, depth: 0.045 },
  { id: 'carver', name: 'Carving Gouge', kind: 'carve', len: 0.6, h: 0.16, prof: 'gouge', weight: 0.6, pitch: 1, width: 0.14, depth: 0.14 },
  { id: 'nakiri', name: 'Nakiri', kind: 'knife', len: 1.4, h: 0.5, prof: 'nakiri', weight: 1.1, pitch: 1, push: 1 },
  { id: 'yanagiba', name: 'Sashimi Knife', kind: 'knife', len: 2.1, h: 0.3, prof: 'yanagiba', weight: 0.8, pitch: 1.2, push: 0.7 },
  { id: 'paring', name: 'Paring Knife', kind: 'knife', len: 0.8, h: 0.24, prof: 'chef', weight: 0.6, pitch: 1.3, push: 0.6 },
  { id: 'butcher', name: 'Butcher Knife', kind: 'knife', len: 1.7, h: 0.55, prof: 'butcher', weight: 1.5, pitch: 0.85, push: 1.5, knock: 0.85 },
  { id: 'fillet', name: 'Fillet Knife', kind: 'knife', len: 1.8, h: 0.2, prof: 'fillet', weight: 0.6, pitch: 1.25, push: 0.6 },
  { id: 'ceramic', name: 'Ceramic Knife', kind: 'knife', len: 1.4, h: 0.4, prof: 'chef', weight: 0.7, pitch: 1.4, push: 0.8, finish: 'ceramic' },
  { id: 'mezzaluna', name: 'Mezzaluna', kind: 'knife', len: 1.6, h: 0.55, prof: 'mezzaluna', weight: 1.2, pitch: 0.95, push: 1.1 },
  { id: 'pizzawheel', name: 'Pizza Wheel', kind: 'knife', kerf: 0.02, len: 1.0, h: 0.7, prof: 'wheel', weight: 0.8, pitch: 1.1, push: 0.8 },
  { id: 'ulu', name: 'Ulu Knife', kind: 'knife', len: 1.2, h: 0.6, prof: 'ulu', weight: 1, pitch: 1, push: 1 },
  { id: 'crinkle', name: 'Crinkle Cutter', kind: 'knife', len: 1.1, h: 0.4, prof: 'crinkle', weight: 1, pitch: 1.05, push: 1, path: 'zigzag', unlock: 25 },
  { id: 'wave', name: 'Wave Blade', kind: 'knife', len: 1.4, h: 0.38, prof: 'chef', weight: 1, pitch: 1, push: 1, path: 'wave', unlock: 60 },
  { id: 'scoop', name: 'Melon Scoop', kind: 'carve', len: 0.5, h: 0.2, prof: 'gouge', weight: 0.7, pitch: 0.9, width: 0.3, depth: 0.24, unlock: 100 },
  { id: 'obsidian', name: 'Obsidian Blade', kind: 'knife', len: 1.5, h: 0.36, prof: 'santoku', weight: 0.8, pitch: 1.2, push: 0.8, finish: 'obsidian', unlock: 180 },
  { id: 'laser', name: 'Light Blade', kind: 'knife', len: 1.8, h: 0.12, prof: 'laser', weight: 0.3, pitch: 1.6, push: 0.5, whistle: true, unlock: 300 },
  // ---- carving mode ----
  { id: 'ugouge', name: 'U-Gouge', mode: 'carve', kind: 'carve', len: 0.6, h: 0.18, prof: 'gouge', weight: 0.7, pitch: 1, width: 0.26, depth: 0.09, profile: roundProfile(5) },
  { id: 'vgouge', name: 'V-Gouge', mode: 'carve', kind: 'carve', len: 0.6, h: 0.18, prof: 'vgouge', weight: 0.7, pitch: 1.1, width: 0.2, depth: 0.1, profile: vProfile(5) },
  { id: 'chisel', name: 'Flat Chisel', mode: 'carve', kind: 'carve', len: 0.6, h: 0.18, prof: 'chisel', weight: 0.8, pitch: 0.95, width: 0.24, depth: 0.05 },
  { id: 'spoongouge', name: 'Spoon Gouge', mode: 'carve', kind: 'carve', len: 0.6, h: 0.22, prof: 'gouge', weight: 0.8, pitch: 0.9, width: 0.42, depth: 0.16, profile: roundProfile(5) },
  { id: 'detailgouge', name: 'Detail Gouge', mode: 'carve', kind: 'carve', len: 0.5, h: 0.14, prof: 'gouge', weight: 0.5, pitch: 1.25, width: 0.11, depth: 0.05, profile: roundProfile(3) },
  { id: 'scraper', name: 'Card Scraper', mode: 'carve', kind: 'shave', len: 0.5, h: 0.3, prof: 'scraper', weight: 0.5, pitch: 1.3, width: 0.6, depth: 0.014 },
  { id: 'drawknife', name: 'Drawknife', mode: 'carve', kind: 'shave', len: 0.6, h: 0.2, prof: 'drawknife', weight: 0.9, pitch: 0.95, width: 0.9, depth: 0.035 },
];

export const FINISHES = [
  { id: 'steel', name: 'Steel', color: '#e4e8ee', metal: 1, rough: 0.16 },
  { id: 'black', name: 'Black', color: '#2a2b2f', metal: 0.8, rough: 0.35 },
  { id: 'rose', name: 'Rose', color: '#e7b3a4', metal: 1, rough: 0.25 },
  { id: 'damascus', name: 'Damascus', color: '#aab0ba', metal: 1, rough: 0.3, pattern: true, unlock: 40 },
  { id: 'gold', name: 'Gold', color: '#e3c071', metal: 1, rough: 0.2, unlock: 120 },
  { id: 'obsidian', name: 'Obsidian', color: '#141418', metal: 0.3, rough: 0.05, unlock: 180 },
  { id: 'ceramic', name: 'Ceramic', color: '#f6f4ef', metal: 0, rough: 0.3 },
  { id: 'copper', name: 'Copper', color: '#d08a5c', metal: 1, rough: 0.22 },
  { id: 'blue', name: 'Blued Steel', color: '#5d7ea8', metal: 0.9, rough: 0.25 },
];
export const HANDLES = [
  { id: 'walnut', name: 'Walnut', color: '#6a4630' },
  { id: 'ebony', name: 'Ebony', color: '#1e1b1a' },
  { id: 'ivory', name: 'Ivory', color: '#efe8dc' },
  { id: 'sage', name: 'Sage', color: '#9db39a' },
  { id: 'blush', name: 'Blush', color: '#e8b4bc' },
  { id: 'ocean', name: 'Ocean', color: '#5b86a8' },
];

function profile(t, L, H) {
  const P = [];
  switch (t) {
    case 'chef': P.push([0, 0]); for (let i = 1; i <= 12; i++) { const u = i / 12; P.push([u * L, Math.pow(u, 3.2) * H * 0.85]); } P.push([L * 0.9, H * 0.98], [0, H]); break;
    case 'santoku': P.push([0, 0]); for (let i = 1; i <= 10; i++) { const u = i / 10; P.push([u * L, Math.pow(u, 5) * H * 0.3]); } P.push([L * 0.82, H * 0.95], [0, H]); break;
    case 'cleaver': P.push([0, 0], [L, 0.02], [L, H], [0, H]); break;
    case 'bread': { P.push([0, 0]); const n = 26; for (let i = 1; i <= n; i++) P.push([(i - 0.5) / n * L * 0.97, -0.025], [i / n * L * 0.97, 0]); P.push([L, H * 0.5], [L * 0.95, H], [0, H]); break; }
    case 'scalpel': P.push([0, 0], [L * 0.6, 0], [L, H * 0.7], [L * 0.5, H], [0, H]); break;
    case 'soap': P.push([0, 0], [L, 0], [L, H], [0, H]); break;
    case 'crinkle': { P.push([0, 0]); const n = 9; for (let i = 1; i <= n; i++) P.push([(i - 0.5) / n * L, 0.05], [i / n * L, 0]); P.push([L, H], [0, H]); break; }
    case 'laser': P.push([0, 0], [L, 0], [L, H], [0, H]); break;
    case 'dicer': P.push([0, 0], [L, 0], [L, H * 0.75], [L * 0.94, H], [0, H]); break;
    case 'nakiri': P.push([0, 0], [L, 0], [L, H * 0.82], [L * 0.96, H], [0, H]); break;
    case 'yanagiba': P.push([0, 0], [L * 0.86, 0]); for (let i = 1; i <= 6; i++) { const u = i / 6; P.push([L * (0.86 + 0.14 * u), H * 0.6 * u * u]); } P.push([L * 0.8, H], [0, H]); break;
    case 'butcher': P.push([0, 0]); for (let i = 1; i <= 12; i++) { const u = i / 12; P.push([u * L, Math.pow(u, 2.2) * H * 0.7]); } P.push([L * 0.96, H * 0.95], [0, H]); break;
    case 'fillet': P.push([0, 0]); for (let i = 1; i <= 12; i++) { const u = i / 12; P.push([u * L, Math.pow(u, 4) * H * 0.85]); } P.push([L * 0.93, H * 0.95], [0, H]); break;
    case 'mezzaluna': case 'ulu': { const n = 16; for (let i = 0; i <= n; i++) { const u = i / n; P.push([u * L, H * 0.42 * Math.pow((u - 0.5) * 2, 2)]); } P.push([L, H * 0.75], [0, H * 0.75]); break; }
    default: P.push([0, 0], [L, 0], [L, H], [0, H]);
  }
  return P;
}

let damascusTex = null;
function damascus() {
  if (damascusTex) return damascusTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#9aa0aa'; g.fillRect(0, 0, 256, 64);
  for (let y = 0; y < 64; y += 2) { g.strokeStyle = y % 4 ? '#c8ccd4' : '#6d727c'; g.lineWidth = 1.2; g.beginPath(); for (let x = 0; x <= 256; x += 4) g.lineTo(x, y + Math.sin(x / 18 + y / 5) * 5 + Math.sin(x / 7) * 1.5); g.stroke(); }
  damascusTex = new THREE.CanvasTexture(c); damascusTex.colorSpace = THREE.SRGBColorSpace;
  return damascusTex;
}

// Builds a knife model. Local frame: origin at the blade's cutting point,
// +X along the blade (stroke direction), +Y up (spine), Z = blade normal.
export function buildToolModel(tool, finishId, handleId, opts) {
  const fin = FINISHES.find(f => f.id === (tool.finish || finishId)) || FINISHES[0];
  const han = HANDLES.find(h => h.id === handleId) || HANDLES[0];
  const g = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: fin.color, metalness: fin.metal, roughness: fin.rough, envMap: (opts && opts.env) || null, envMapIntensity: 2.6 });
  if (fin.pattern) { bladeMat.map = damascus(); bladeMat.color.set('#ffffff'); }
  const handleMat = new THREE.MeshStandardMaterial({ color: han.color, roughness: 0.55, metalness: 0 });
  const L = tool.len, H = tool.h;
  if (tool.prof === 'wire') {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(L / 2, 0.035, 8, 32, Math.PI), handleMat);
    frame.rotation.z = 0; frame.position.set(0, 0, 0); frame.scale.y = (H / (L / 2));
    g.add(frame);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, L, 6), new THREE.MeshStandardMaterial({ color: '#dfe3ea', metalness: 1, roughness: 0.2 }));
    wire.rotation.z = Math.PI / 2; g.add(wire);
    for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 12), handleMat); k.position.set(s * L / 2, 0.1, 0); g.add(k); }
    g.userData.edge = 0; return g;
  }
  if (tool.prof === 'press') {
    // soft silicone press pad (bottom of the pad at the origin) on a short stem
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 18), new THREE.MeshPhysicalMaterial({ color: '#f4cbc2', roughness: 0.45, clearcoat: 0.6, sheen: 0.5 }));
    pad.scale.set(1, 0.55, 1); pad.position.y = 0.11; pad.castShadow = true; g.add(pad);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.5, 18), handleMat);
    stem.position.y = 0.42; stem.castShadow = true; g.add(stem);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), handleMat);
    knob.position.y = 0.7; knob.castShadow = true; g.add(knob);
    return g;
  }
  if (['shaver', 'gouge', 'vgouge', 'chisel', 'scraper', 'drawknife'].includes(tool.prof)) {
    // Peeling blade: the cutting edge sits at the origin; a thin plate rises
    // forward from it at a rake angle (shavings ride up its top face and roll
    // over), and the handle angles back toward the player.
    const w = (opts && opts.width) || tool.width, pr = tool.prof;
    const rake = pr === 'scraper' ? 1.15 : 0.5, plateL = pr === 'scraper' ? 0.3 : pr === 'chisel' ? 0.2 : 0.16;
    let plateGeo;
    if (pr === 'gouge' || pr === 'vgouge') {
      // U: half tube; V: the same with two flat facets
      plateGeo = new THREE.CylinderGeometry(w / 2, w / 2, plateL, pr === 'vgouge' ? 2 : 18, 1, true, Math.PI / 2, Math.PI);
      plateGeo.rotateZ(-Math.PI / 2);
      plateGeo.translate(plateL / 2, w / 2, 0);
    } else {
      plateGeo = new THREE.BoxGeometry(plateL, pr === 'chisel' ? 0.024 : 0.012, w);
      plateGeo.translate(plateL / 2, 0.006, 0);
    }
    plateGeo.rotateZ(rake);
    const pm = bladeMat.clone(); pm.side = THREE.DoubleSide;
    const plate = new THREE.Mesh(plateGeo, pm); plate.castShadow = true; g.add(plate);
    if (pr === 'scraper') return g; // a card scraper is held by its edges
    if (pr === 'drawknife') {
      for (const sz of [-1, 1]) {
        const tang = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), bladeMat); tang.rotation.x = Math.PI / 2; tang.position.set(0.02, 0.02, sz * (w / 2 + 0.06)); g.add(tang);
        const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 6, 12), handleMat);
        grip.rotation.z = -1.0; grip.position.set(-0.08, 0.12, sz * (w / 2 + 0.12)); grip.castShadow = true; g.add(grip);
      }
      return g;
    }
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.1, 12), bladeMat);
    ferrule.rotation.z = -1.1; ferrule.position.set(-0.04, 0.05, 0); g.add(ferrule);
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.24, 6, 14), handleMat);
    handle.rotation.z = -1.1; handle.position.set(-0.18, 0.14, 0); handle.castShadow = true; g.add(handle);
    return g;
  }
  if (tool.prof === 'wheel') {
    // rolling disc: touches the board at the model's front point (x = 0.45L)
    const R = 0.34, cx = L * 0.45;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.02, 48), bladeMat);
    disc.rotation.x = Math.PI / 2; disc.position.set(cx, R, 0); disc.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 16), bladeMat);
    hub.rotation.x = Math.PI / 2; hub.position.copy(disc.position);
    const spin = new THREE.Group(); spin.position.copy(disc.position); disc.position.set(0, 0, 0); spin.add(disc);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(R * 1.6, 0.03, 0.025), new THREE.MeshStandardMaterial({ color: '#9aa1ab', metalness: 1, roughness: 0.3 }));
    spin.add(notch); g.add(spin); g.add(hub);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 10), bladeMat);
    arm.rotation.z = 1.0; arm.position.set(cx - 0.24, R + 0.16, 0.06); g.add(arm);
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.42, 6, 14), handleMat);
    grip.rotation.z = 1.0; grip.position.set(cx - 0.62, R + 0.42, 0.06); grip.castShadow = true; g.add(grip);
    g.userData.wheel = spin; g.userData.wheelR = R;
    return g;
  }
  const shape = new THREE.Shape(profile(tool.prof, L, H).map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1 });
  geo.translate(-L * 0.55, 0, -0.009);
  // UVs for damascus
  const pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) + L) / (L * 1.2); uv[i * 2 + 1] = pos.getY(i) / H; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  let mat = bladeMat;
  if (tool.prof === 'laser') mat = new THREE.MeshBasicMaterial({ color: '#bfefff', toneMapped: false });
  const blade = new THREE.Mesh(geo, mat); blade.castShadow = true; g.add(blade);
  if (tool.prof === 'laser') {
    const glow = new THREE.Mesh(new THREE.BoxGeometry(L, H * 2.2, 0.08), new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
    glow.position.set(L * -0.05, H / 2, 0); g.add(glow);
  }
  if (tool.prof === 'mezzaluna') {
    for (const sx of [-L * 0.55 + 0.08, L * 0.45 - 0.08]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), bladeMat); post.position.set(sx, H * 0.75 + 0.11, 0); g.add(post);
      const knob = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 6, 14), handleMat); knob.position.set(sx, H * 0.75 + 0.32, 0); knob.castShadow = true; g.add(knob);
    }
    return g;
  }
  if (tool.prof === 'ulu') {
    for (const sx of [-0.22, 0.22]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), bladeMat); post.position.set(-L * 0.05 + sx, H * 0.75 + 0.08, 0); g.add(post); }
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 6, 14), handleMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(-L * 0.05, H * 0.75 + 0.2, 0); bar.castShadow = true; g.add(bar);
    return g;
  }
  // handle
  const hl = tool.prof === 'scalpel' ? 0.7 : 0.75;
  const hh = Math.min(0.2, H * 0.55);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(hh / 2, hl, 6, 14), handleMat);
  handle.rotation.z = Math.PI / 2; handle.scale.z = 0.6;
  const hy = tool.prof === 'cleaver' || tool.prof === 'soap' ? H * 0.8 : H * 0.72;
  handle.position.set(-L * 0.55 - hl / 2 - 0.05, hy, 0); handle.castShadow = true; g.add(handle);
  const bolster = new THREE.Mesh(new THREE.CylinderGeometry(hh * 0.45, hh * 0.5, 0.06, 12), bladeMat);
  bolster.rotation.z = Math.PI / 2; bolster.position.set(-L * 0.55 - 0.02, hy, 0); bolster.scale.z = 0.5; g.add(bolster);
  for (const dx of [-0.15, 0.15]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), bladeMat); r.rotation.x = Math.PI / 2; r.position.set(handle.position.x + dx, hy, 0); g.add(r); }
  return g;
}

// Small SVG icon for the tool picker
export function toolIcon(tool) {
  const P = {
    chef: 'M4 22 L40 22 Q36 12 6 14 Z', santoku: 'M4 22 L38 22 Q40 14 34 12 L6 13 Z', cleaver: 'M8 22 L36 22 L36 8 L8 8 Z',
    bread: 'M2 22 L42 22 L40 16 L4 16 Z', scalpel: 'M16 22 L34 22 L40 18 L28 16 L16 17 Z', soap: 'M10 22 L36 22 L36 10 L10 10 Z',
    dicer: 'M2 22 L44 22 L44 15 L41 12 L2 12 Z',
    nakiri: 'M6 22 L38 22 L38 11 L6 11 Z', yanagiba: 'M2 22 L38 22 L44 17 L36 16 L2 17 Z',
    butcher: 'M4 22 Q32 23 42 11 L39 8 L4 11 Z', fillet: 'M2 22 Q32 22 44 17 L40 15 Q20 18 2 18 Z',
    crinkle: 'M8 22 L12 20 L16 22 L20 20 L24 22 L28 20 L32 22 L36 20 L36 12 L8 12 Z', laser: 'M4 21 L42 21 L42 18 L4 18 Z',
  }[tool.prof];
  const handle = (tool.kind === 'knife' || tool.kind === 'dice') && !['wire', 'mezzaluna', 'ulu', 'wheel'].includes(tool.prof);
  let body = '';
  if (tool.prof === 'press') body = '<ellipse cx="22" cy="21" rx="10" ry="4.5" fill="currentColor" opacity=".85"/><rect x="19.5" y="5" width="5" height="13" rx="2.5" fill="currentColor" opacity=".55"/><circle cx="22" cy="5" r="3.5" fill="currentColor" opacity=".55"/>';
  else if (tool.prof === 'mezzaluna') body = '<path d="M4 13 Q24 32 44 13 Z" fill="currentColor" opacity=".85"/><rect x="4" y="3" width="5" height="10" rx="2.5" fill="currentColor" opacity=".55"/><rect x="39" y="3" width="5" height="10" rx="2.5" fill="currentColor" opacity=".55"/>';
  else if (tool.prof === 'ulu') body = '<path d="M8 13 Q24 32 40 13 Z" fill="currentColor" opacity=".85"/><rect x="12" y="4" width="24" height="6" rx="3" fill="currentColor" opacity=".55"/>';
  else if (tool.prof === 'wheel') body = '<circle cx="28" cy="16" r="10" fill="currentColor" opacity=".85"/><rect x="0" y="3" width="20" height="5" rx="2.5" transform="rotate(25 10 5)" fill="currentColor" opacity=".55"/>';
  else if (tool.prof === 'wire') body = '<path d="M6 22 Q24 2 42 22" fill="none" stroke="currentColor" stroke-width="2.4"/><line x1="6" y1="22" x2="42" y2="22" stroke="currentColor" stroke-width="1"/>';
  else if (tool.prof === 'shaver') body = '<rect x="24" y="19" width="16" height="4" rx="1.5" fill="currentColor"/><line x1="26" y1="19" x2="12" y2="8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
  else if (tool.prof === 'vgouge') body = '<path d="M26 18 L32 25 L38 18" fill="none" stroke="currentColor" stroke-width="3"/><line x1="28" y1="17" x2="12" y2="7" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
  else if (tool.prof === 'chisel') body = '<rect x="26" y="18" width="14" height="5" rx="1" fill="currentColor"/><line x1="28" y1="18" x2="12" y2="7" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
  else if (tool.prof === 'scraper') body = '<rect x="14" y="6" width="20" height="18" rx="2" fill="currentColor" opacity=".8" transform="rotate(-12 24 15)"/>';
  else if (tool.prof === 'drawknife') body = '<rect x="10" y="17" width="28" height="5" rx="1.5" fill="currentColor"/><line x1="10" y1="19" x2="3" y2="8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><line x1="38" y1="19" x2="45" y2="8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
  else if (tool.prof === 'gouge') body = '<path d="M26 20 Q32 26 38 20" fill="none" stroke="currentColor" stroke-width="3"/><line x1="28" y1="18" x2="12" y2="8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
  else body = `<path d="${P}" fill="currentColor" opacity=".85"/>`;
  const h = handle ? '<rect x="-2" y="14" width="12" height="6" rx="3" fill="currentColor" opacity=".55" transform="translate(-6 0)"/>' : '';
  return `<svg viewBox="-8 0 52 30" width="46" height="26">${h}${body}</svg>`;
}
