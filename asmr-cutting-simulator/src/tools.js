import * as THREE from 'three';

// kind:  knife  -> planar cut along your stroke (can be partial: a slit)
//        shave  -> removes a thin layer under the stroke (soap shavings)
//        carve  -> removes a narrow deep groove (carving / scooping)
// path:  stroke modifier applied to the real path you drew (zigzag/wave)
export const TOOLS = [
  { id: 'chef', name: "Chef's Knife", kind: 'knife', len: 1.6, h: 0.42, prof: 'chef', weight: 1, pitch: 1, push: 1 },
  { id: 'santoku', name: 'Santoku', kind: 'knife', len: 1.4, h: 0.44, prof: 'santoku', weight: 1, pitch: 1.1, push: 0.9 },
  { id: 'cleaver', name: 'Cleaver', kind: 'knife', len: 1.3, h: 0.75, prof: 'cleaver', weight: 1.8, pitch: 0.8, push: 1.8, knock: 0.8 },
  { id: 'bread', name: 'Bread Knife', kind: 'knife', len: 1.9, h: 0.32, prof: 'bread', weight: 0.9, pitch: 1, push: 0.8, saw: true },
  { id: 'precision', name: 'Precision Blade', kind: 'knife', len: 0.75, h: 0.18, prof: 'scalpel', weight: 0.5, pitch: 1.35, push: 0.4 },
  { id: 'soapcutter', name: 'Soap Cutter', kind: 'knife', len: 1.2, h: 0.55, prof: 'soap', weight: 1.2, pitch: 0.95, push: 1.1 },
  { id: 'wire', name: 'Wire Cutter', kind: 'knife', len: 1.6, h: 0.9, prof: 'wire', weight: 0.6, pitch: 1.5, push: 0.6, whistle: true },
  { id: 'shaver', name: 'Soap Shaver', kind: 'shave', len: 0.7, h: 0.3, prof: 'shaver', weight: 0.6, pitch: 1.1, width: 0.36, depth: 0.045 },
  { id: 'carver', name: 'Carving Gouge', kind: 'carve', len: 0.6, h: 0.16, prof: 'gouge', weight: 0.6, pitch: 1, width: 0.14, depth: 0.14 },
  { id: 'crinkle', name: 'Crinkle Cutter', kind: 'knife', len: 1.1, h: 0.4, prof: 'crinkle', weight: 1, pitch: 1.05, push: 1, path: 'zigzag', unlock: 25 },
  { id: 'wave', name: 'Wave Blade', kind: 'knife', len: 1.4, h: 0.38, prof: 'chef', weight: 1, pitch: 1, push: 1, path: 'wave', unlock: 60 },
  { id: 'scoop', name: 'Melon Scoop', kind: 'carve', len: 0.5, h: 0.2, prof: 'gouge', weight: 0.7, pitch: 0.9, width: 0.3, depth: 0.24, unlock: 100 },
  { id: 'obsidian', name: 'Obsidian Blade', kind: 'knife', len: 1.5, h: 0.36, prof: 'santoku', weight: 0.8, pitch: 1.2, push: 0.8, finish: 'obsidian', unlock: 180 },
  { id: 'laser', name: 'Light Blade', kind: 'knife', len: 1.8, h: 0.12, prof: 'laser', weight: 0.3, pitch: 1.6, push: 0.5, whistle: true, unlock: 300 },
];

export const FINISHES = [
  { id: 'steel', name: 'Steel', color: '#e4e8ee', metal: 1, rough: 0.16 },
  { id: 'black', name: 'Black', color: '#2a2b2f', metal: 0.8, rough: 0.35 },
  { id: 'rose', name: 'Rose', color: '#e7b3a4', metal: 1, rough: 0.25 },
  { id: 'damascus', name: 'Damascus', color: '#aab0ba', metal: 1, rough: 0.3, pattern: true, unlock: 40 },
  { id: 'gold', name: 'Gold', color: '#e3c071', metal: 1, rough: 0.2, unlock: 120 },
  { id: 'obsidian', name: 'Obsidian', color: '#141418', metal: 0.3, rough: 0.05, unlock: 180 },
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
export function buildToolModel(tool, finishId, handleId) {
  const fin = FINISHES.find(f => f.id === (tool.finish || finishId)) || FINISHES[0];
  const han = HANDLES.find(h => h.id === handleId) || HANDLES[0];
  const g = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: fin.color, metalness: fin.metal, roughness: fin.rough, envMapIntensity: 1.4 });
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
  if (tool.prof === 'shaver' || tool.prof === 'gouge') {
    const w = tool.width;
    const head = tool.prof === 'shaver'
      ? new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, w), bladeMat)
      : new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.22, 16, 1, true, 0, Math.PI), bladeMat);
    if (tool.prof === 'gouge') { head.material = bladeMat.clone(); head.material.side = THREE.DoubleSide; head.rotation.z = Math.PI / 2; head.rotation.x = Math.PI; head.position.y = w / 2; }
    else head.position.y = 0.02;
    g.add(head);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), bladeMat);
    shaft.rotation.z = -Math.PI / 3.2; shaft.position.set(-0.17, 0.12, 0); g.add(shaft);
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.36, 6, 12), handleMat);
    handle.rotation.z = -Math.PI / 3.2; handle.position.set(-0.42, 0.32, 0); g.add(handle);
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
    crinkle: 'M8 22 L12 20 L16 22 L20 20 L24 22 L28 20 L32 22 L36 20 L36 12 L8 12 Z', laser: 'M4 21 L42 21 L42 18 L4 18 Z',
  }[tool.prof];
  const handle = tool.kind === 'knife' && tool.prof !== 'wire';
  let body = '';
  if (tool.prof === 'wire') body = '<path d="M6 22 Q24 2 42 22" fill="none" stroke="currentColor" stroke-width="2.4"/><line x1="6" y1="22" x2="42" y2="22" stroke="currentColor" stroke-width="1"/>';
  else if (tool.prof === 'shaver') body = '<rect x="24" y="19" width="16" height="4" rx="1.5" fill="currentColor"/><line x1="26" y1="19" x2="12" y2="8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
  else if (tool.prof === 'gouge') body = '<path d="M26 20 Q32 26 38 20" fill="none" stroke="currentColor" stroke-width="3"/><line x1="28" y1="18" x2="12" y2="8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
  else body = `<path d="${P}" fill="currentColor" opacity=".85"/>`;
  const h = handle ? '<rect x="-2" y="14" width="12" height="6" rx="3" fill="currentColor" opacity=".55" transform="translate(-6 0)"/>' : '';
  return `<svg viewBox="-8 0 52 30" width="46" height="26">${h}${body}</svg>`;
}
