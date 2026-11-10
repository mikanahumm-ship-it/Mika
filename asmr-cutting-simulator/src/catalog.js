import { PAT } from './materials.js';

// ---------------------------------------------------------------------------
// Object catalog. Every entry is data only: a convex base shape, an outer
// surface material, an inner (volumetric) material, physical/feel properties,
// a sound profile and a particle effect. Adding an object = adding one entry.
//
//  shape : see geometry.makeShape (box/cyl/cylx/ell/dome/capsule + clips)
//  out/in: { pat, c:[colors], s:scale, p:[params], axis, center, rough }
//  mat   : { rough, clearcoat, sheen, opacity, density }
//  snd   : sound profile id (audio.js)       fx : particle profile (particles.js)
//  wob   : jelly wobble strength (0..1)
// ---------------------------------------------------------------------------

const S = (pat, c, s = 4, p, extra = {}) => ({ pat, c, s, p, ...extra });
const box = (hx, hy, hz, r = 0.06, extra = {}) => ({ type: 'box', hx, hy, hz, r, ...extra });
const cyl = (rad, hy, r = 0.05, extra = {}) => ({ type: 'cyl', rad, hy, r, ...extra });
const ell = (a, b, c, flat = 0.15) => ({ type: 'ell', a, b, c, flat });

export const CATEGORIES = [
  { id: 'meat', name: 'Meat & Fish' },
  { id: 'sushi', name: 'Sushi' },
  { id: 'bakery', name: 'Bakery' },
  { id: 'cake', name: 'Cakes' },
  { id: 'cheese', name: 'Cheese & Dairy' },
  { id: 'fruit', name: 'Fruit' },
  { id: 'veg', name: 'Vegetables' },
  { id: 'sweet', name: 'Sweets & Jelly' },
  { id: 'soap', name: 'Soap' },
  { id: 'soft', name: 'Soft & Sand' },
  { id: 'wax', name: 'Wax & Candles' },
  { id: 'misc', name: 'Satisfying' },
];

const L = [];
const add = (cat, id, name, shape, out, inn, opt = {}) => L.push({ cat, id, name, shape, out, in: inn, mat: opt.mat || {}, snd: opt.snd || 'soft', fx: opt.fx || 'none', wob: opt.wob || 0, star: !!opt.star });

// ======================= MEAT & FISH =======================
const sear = (a = '#6e3a22', b = '#93502c', d = '#4a2616') => S(PAT.speckle, [a, b, d], 3.2, [0.8, 0.45]);
add('meat', 'steak', 'Ribeye Steak', box(1.25, 0.32, 0.85, 0.16), sear(), S(PAT.meat, ['#b81d2c', '#d0313d', '#f4e3da'], 2.6, [0.032, 0.35]), { snd: 'meat', fx: 'juice', mat: { rough: 0.45, clearcoat: 0.3 }, star: true });
add('meat', 'wagyu', 'A5 Wagyu Block', box(0.95, 0.38, 0.75, 0.08), S(PAT.meat, ['#d1495b', '#e17582', '#fbeee6'], 4.2, [0.12, 1]), S(PAT.meat, ['#c63d50', '#d9667a', '#fff2ea'], 4.6, [0.14, 1]), { snd: 'meat', fx: 'juice', mat: { rough: 0.4, clearcoat: 0.4 } });
add('meat', 'filet', 'Filet Mignon', cyl(0.75, 0.38, 0.12), sear('#5c311f', '#7c4329'), S(PAT.meat, ['#b9363f', '#d65a5e', '#e9c9bd'], 2, [0.03, 0.2]), { snd: 'meat', fx: 'juice', mat: { rough: 0.45, clearcoat: 0.3 } });
add('meat', 'roastbeef', 'Roast Beef', box(1.3, 0.45, 0.7, 0.3), sear('#4f2a1a', '#6e3b25'), S(PAT.radial, ['#7a4430', '#c7505a', '#d7656c', '#d7656c'], 0, [0.92, 0.82, 0, 0.7], { axis: [1, 0, 0], center: [0, 0.45, 0] }), { snd: 'meat', fx: 'juice', mat: { rough: 0.5 } });
add('meat', 'ham', 'Glazed Ham', box(1.2, 0.5, 0.8, 0.35), S(PAT.solid, ['#b8643a', '#d48a52'], 3), S(PAT.meat, ['#e58d93', '#ef9fa4', '#fae6e2'], 2, [0.03, 0.3]), { snd: 'meat', fx: 'juice', mat: { rough: 0.35, clearcoat: 0.6 } });
add('meat', 'bacon', 'Pork Belly', box(1.3, 0.35, 0.65, 0.07), S(PAT.solid, ['#e8c3a4', '#f0d2b8'], 3), S(PAT.layers, ['#f6e4d8', '#c4525c', '#f3dccd', '#b84651'], 7, [0.6, 0, 4, 0.2]), { snd: 'meat', fx: 'juice', mat: { rough: 0.5 } });
add('meat', 'chicken', 'Chicken Breast', ell(1.1, 0.32, 0.62, 0.35), S(PAT.solid, ['#f2c9b5', '#eab39c'], 3), S(PAT.stripes, ['#f5d2c2', '#efc2ae', '#fbe6dd'], 10, [0.15]), { snd: 'meat', fx: 'juice', mat: { rough: 0.45, clearcoat: 0.3 } });
add('meat', 'salmon', 'Salmon Fillet', box(1.4, 0.3, 0.6, 0.18, { clips: [{ n: [0, 1, 0.35], c: 0.35 }] }), S(PAT.stripes, ['#f2875b', '#f79b6f', '#fde2d1'], 9, [0.12]), S(PAT.stripes, ['#f37d50', '#f9946a', '#fff0e4'], 11, [0.16]), { snd: 'fish', fx: 'juice', mat: { rough: 0.3, clearcoat: 0.6 }, star: true });
add('meat', 'tuna', 'Tuna Loin', box(1.35, 0.38, 0.55, 0.15), S(PAT.solid, ['#a3243b', '#b93049'], 4), S(PAT.stripes, ['#a71f38', '#be2e48', '#d65d70'], 8, [0.08]), { snd: 'fish', fx: 'juice', mat: { rough: 0.28, clearcoat: 0.6 } });
add('meat', 'sausage', 'Bratwurst', { type: 'capsule', hx: 1.3, rad: 0.28 }, S(PAT.speckle, ['#b07552', '#c58a64', '#7d4f33'], 5, [0.75, 0.7]), S(PAT.speckle, ['#e4b9a7', '#d9a593', '#fdf1ea'], 10, [0.7, 1]), { snd: 'meat', fx: 'juice', mat: { rough: 0.35, clearcoat: 0.6 } });

// ======================= SUSHI =======================
const rice = S(PAT.dots, ['#f7f4ec', '#ffffff', '#efeadf', '#fbfaf6'], 22, [0.32]);
const nori = S(PAT.solid, ['#1c2b22', '#2f4034'], 7);
add('sushi', 'maki', 'Salmon Maki Roll', { type: 'cylx', rad: 0.45, hx: 1.3, r: 0.04 }, nori, S(PAT.radial, ['#1f2d24', '#f8f5ee', '#f58a5c', '#f58a5c'], 0, [0.94, 0.4, 0, 0.45], { axis: [1, 0, 0], center: [0, 0.45, 0] }), { snd: 'fish', fx: 'crumb', mat: { rough: 0.7 }, star: true });
add('sushi', 'uramaki', 'Avocado Uramaki', { type: 'cylx', rad: 0.45, hx: 1.3, r: 0.06 }, S(PAT.dots, ['#f5f2ea', '#222', '#f9f6ee', '#e9e3d4'], 26, [0.12]), S(PAT.radial, ['#f6f3ea', '#203026', '#9cc36b', '#9cc36b'], 0, [0.62, 0.5, 0, 0.45], { axis: [1, 0, 0], center: [0, 0.45, 0] }), { snd: 'fish', fx: 'crumb', mat: { rough: 0.75 } });
add('sushi', 'tamago', 'Tamagoyaki', box(1.1, 0.35, 0.5, 0.06), S(PAT.solid, ['#f0c24a', '#e0a93a'], 4), S(PAT.layers, ['#f7d35e', '#f3c94f', '#efbf47'], 10, [0.15, 0, 3, 0.08]), { snd: 'cake', fx: 'crumb', mat: { rough: 0.55 } });
add('sushi', 'sashimi', 'Sashimi Block', box(0.9, 0.3, 0.55, 0.08), S(PAT.stripes, ['#f48a60', '#fba07a', '#ffeadc'], 12, [0.14]), S(PAT.stripes, ['#f48a60', '#fba07a', '#ffeadc'], 12, [0.14]), { snd: 'fish', fx: 'juice', mat: { rough: 0.25, clearcoat: 0.7 } });
add('sushi', 'tofu', 'Silken Tofu', box(0.85, 0.4, 0.6, 0.03), S(PAT.solid, ['#f9f6ee', '#f1ece0'], 5), S(PAT.solid, ['#fbf8f1', '#f3eee2'], 7), { snd: 'jelly', fx: 'juice', wob: 0.4, mat: { rough: 0.35, clearcoat: 0.4 } });
add('sushi', 'mochi', 'Strawberry Mochi', { type: 'dome', a: 0.7, b: 0.6 }, S(PAT.solid, ['#f9dfe4', '#fbe9ec'], 4), S(PAT.radial, ['#f7dbe1', '#fbf2f3', '#e64a5a', '#e64a5a'], 0, [0.92, 0.55, 0, 0.7], { axis: [0, 0, 0], center: [0, 0.2, 0] }), { snd: 'slime', fx: 'none', wob: 0.25, mat: { rough: 0.6, sheen: 0.8 } });

// ======================= BAKERY =======================
const crust = (a = '#b46a2c', b = '#d39150') => S(PAT.speckle, [a, b, '#7a4318'], 4, [0.7, 0.4]);
const crumb = (a = '#f1dfbc', b = '#e8d1a6') => S(PAT.crumb, [a, b, '#c9ad80'], 9, [0.42]);
add('bakery', 'bread', 'Sourdough Loaf', box(1.35, 0.55, 0.8, 0.42), crust(), crumb(), { snd: 'bread', fx: 'crumb', mat: { rough: 0.85 }, star: true });
add('bakery', 'baguette', 'Baguette', { type: 'capsule', hx: 1.7, rad: 0.3, sz: 1.15 }, crust('#c27c34', '#dfa55f'), crumb('#f4e4c4', '#ecd6ad'), { snd: 'bread', fx: 'crumb', mat: { rough: 0.8 } });
add('bakery', 'brioche', 'Brioche', box(1.1, 0.55, 0.65, 0.35), S(PAT.solid, ['#9a4d1c', '#c06c2c'], 3), crumb('#fbe3a6', '#f5d78e'), { snd: 'bread', fx: 'crumb', mat: { rough: 0.5, clearcoat: 0.5 } });
add('bakery', 'rye', 'Dark Rye', box(1.2, 0.5, 0.7, 0.25), crust('#4c2d1a', '#5f3a22'), crumb('#7c5536', '#6d4a2f'), { snd: 'bread', fx: 'crumb', mat: { rough: 0.85 } });
add('bakery', 'focaccia', 'Focaccia', box(1.35, 0.22, 0.95, 0.1), S(PAT.speckle, ['#d9a14c', '#e9bb6a', '#5e7f39'], 4, [0.78, 1]), crumb('#f6e6bf', '#f0d9a6'), { snd: 'bread', fx: 'crumb', mat: { rough: 0.6, clearcoat: 0.3 } });
add('bakery', 'bagel', 'Bagel Slab', cyl(0.75, 0.3, 0.22), crust('#b77436', '#cf9152'), crumb('#efdcb8', '#e2c99b'), { snd: 'bread', fx: 'crumb', mat: { rough: 0.6, clearcoat: 0.2 } });
add('bakery', 'pullman', 'Pullman Loaf', box(1.3, 0.6, 0.6, 0.08), crust('#c58a4b', '#dba564'), crumb('#fbf1dc', '#f4e6c8'), { snd: 'bread', fx: 'crumb', mat: { rough: 0.85 } });
add('bakery', 'cornbread', 'Cornbread', box(1.0, 0.35, 0.8, 0.05), S(PAT.solid, ['#d6922f', '#e5a940'], 4), crumb('#f6d36a', '#efc451'), { snd: 'cake', fx: 'crumb', mat: { rough: 0.8 } });
add('bakery', 'butter', 'Butter Block', box(0.9, 0.3, 0.45, 0.04), S(PAT.solid, ['#f7e08a', '#f3d775'], 5), S(PAT.solid, ['#f8e396', '#f5da80'], 6), { snd: 'wax', fx: 'shave', mat: { rough: 0.35, clearcoat: 0.3 } });

// ======================= CAKES =======================
add('cake', 'chococake', 'Chocolate Layer Cake', cyl(1.0, 0.55, 0.05), S(PAT.solid, ['#3b1f14', '#4a2819'], 3), S(PAT.layers, ['#3a1d12', '#6a3b24', '#3a1d12', '#f1e2c9'], 5.5, [0.12, 0, 2, 0.1]), { snd: 'cake', fx: 'crumb', mat: { rough: 0.45, clearcoat: 0.4 }, star: true });
add('cake', 'redvelvet', 'Red Velvet', cyl(0.95, 0.55, 0.05), S(PAT.solid, ['#fbf6ee', '#f6efe2'], 4), S(PAT.layers, ['#b02a37', '#fbf5ea'], 5, [0.1, 0, 2, 0.08]), { snd: 'cake', fx: 'crumb', mat: { rough: 0.7 } });
add('cake', 'cheesecake', 'Cheesecake', cyl(0.95, 0.4, 0.04), S(PAT.grady, ['#c58b4b', '#f6e6c7'], 1, [0.08, 0.16, 0.02]), S(PAT.grady, ['#c58b4b', '#fbefd6'], 1, [0.1, 0.14, 0.02]), { snd: 'cheese', fx: 'none', mat: { rough: 0.55 } });
add('cake', 'rainbowcake', 'Rainbow Cake', box(1.0, 0.6, 0.8, 0.05), S(PAT.solid, ['#fffaf3', '#fbf1e4'], 4), S(PAT.rainbow, ['#fff'], 1.5, [0.55, 0.95]), { snd: 'cake', fx: 'crumb', mat: { rough: 0.7 } });
add('cake', 'tiramisu', 'Tiramisu', box(1.1, 0.42, 0.75, 0.03), S(PAT.speckle, ['#6b3f22', '#8a5634', '#3b2213'], 7, [0.6, 1]), S(PAT.layers, ['#c48e5c', '#f6ead3', '#9a663c', '#f6ead3'], 6.5, [0.06, 0, 4, 0.06]), { snd: 'cake', fx: 'none', wob: 0.08, mat: { rough: 0.8 } });
add('cake', 'matcha', 'Matcha Roll', { type: 'cylx', rad: 0.5, hx: 1.3, r: 0.08 }, S(PAT.solid, ['#93ad5a', '#a6bf6a'], 4), S(PAT.rings, ['#9ab65e', '#f7f3e6'], 7, [0.1]), { snd: 'cake', fx: 'crumb', mat: { rough: 0.7 } });
add('cake', 'sponge', 'Victoria Sponge', cyl(0.95, 0.45, 0.06), S(PAT.solid, ['#d39c55', '#e7b871'], 4), S(PAT.layers, ['#f5d79c', '#f5d79c', '#c9233a', '#fffaf0'], 7, [0.05, -0.12, 4, 0.05]), { snd: 'cake', fx: 'crumb', mat: { rough: 0.8 } });
add('cake', 'brownie', 'Fudge Brownie', box(1.1, 0.3, 0.8, 0.04), S(PAT.speckle, ['#3a1f12', '#4a2a19', '#5c3824'], 6, [0.6, 1]), S(PAT.speckle, ['#3b1f12', '#45261a', '#26130a'], 7, [0.66, 1]), { snd: 'choc', fx: 'crumb', mat: { rough: 0.5, clearcoat: 0.3 } });
add('cake', 'carrotcake', 'Carrot Cake', box(1.0, 0.55, 0.7, 0.05), S(PAT.solid, ['#fbf4e8', '#f4eadb'], 4), S(PAT.layers, ['#c8823f', '#fbf3e3'], 4, [0.12, 0, 2, 0.08]), { snd: 'cake', fx: 'crumb', mat: { rough: 0.8 } });
add('cake', 'macaron', 'Giant Macaron', cyl(0.85, 0.35, 0.22), S(PAT.layers, ['#f4b7c4', '#f4b7c4', '#fdf2ea'], 1.4, [0, -0.05, 3, 0.03]), S(PAT.layers, ['#f4b7c4', '#f4b7c4', '#fdf2ea'], 1.4, [0, -0.05, 3, 0.03]), { snd: 'cake', fx: 'crumb', mat: { rough: 0.6 } });

// ======================= CHEESE =======================
add('cheese', 'cheddar', 'Aged Cheddar', box(1.0, 0.45, 0.65, 0.04), S(PAT.solid, ['#f0a43a', '#e9962b'], 5), S(PAT.speckle, ['#f4ad42', '#efa236', '#fbe8b9'], 9, [0.82, 0.6]), { snd: 'cheese', fx: 'crumb', mat: { rough: 0.6 }, star: true });
add('cheese', 'swiss', 'Swiss Wedge', box(1.0, 0.45, 0.65, 0.03, { clips: [{ n: [0.5, 0, 1], c: 0.4 }] }), S(PAT.crumb, ['#f6dc84', '#f1d270', '#d9b55a'], 4, [0.5]), S(PAT.crumb, ['#f8e293', '#f3d77c', '#d8b660'], 4, [0.48]), { snd: 'cheese', fx: 'crumb', mat: { rough: 0.55 } });
add('cheese', 'brie', 'Brie Wheel', cyl(0.85, 0.28, 0.12), S(PAT.speckle, ['#fbf6ea', '#f4ecd8', '#e8dcbd'], 8, [0.7, 0.4]), S(PAT.solid, ['#f6e6b5', '#f1db9b'], 4), { snd: 'cheese', fx: 'none', wob: 0.06, mat: { rough: 0.85, sheen: 0.6 } });
add('cheese', 'gouda', 'Gouda Wheel', cyl(0.9, 0.4, 0.2), S(PAT.solid, ['#d9373a', '#c42e33'], 4, null, { rough: 0.25 }), S(PAT.speckle, ['#f6cf6a', '#f1c457', '#fbe6a5'], 8, [0.86, 0.4]), { snd: 'cheese', fx: 'crumb', mat: { rough: 0.35, clearcoat: 0.6 } });
add('cheese', 'parmesan', 'Parmesan Chunk', box(0.8, 0.5, 0.65, 0.04, { clips: [{ n: [0.6, 1, 0.3], c: 0.6 }] }), S(PAT.grain, ['#f3dfa6', '#e9cf89', '#ffffff'], 2, [0.6]), S(PAT.grain, ['#f5e2ab', '#ead08e', '#fff8e6'], 2.5, [0.8]), { snd: 'crunch', fx: 'crumb', mat: { rough: 0.8 } });
add('cheese', 'blue', 'Blue Cheese', box(0.9, 0.45, 0.6, 0.05), S(PAT.swirl, ['#f4efe1', '#eae2cf', '#4f6b7a'], 9, [6, 0.8]), S(PAT.swirl, ['#f6f1e4', '#ece4d1', '#4d6878'], 10, [6, 0.9]), { snd: 'cheese', fx: 'crumb', mat: { rough: 0.7 } });
add('cheese', 'mozzarella', 'Mozzarella Ball', ell(0.75, 0.6, 0.75, 0.2), S(PAT.solid, ['#fdfcf7', '#f6f3ea'], 4), S(PAT.rings, ['#fbf9f2', '#f2eee2'], 18, [0.4], { axis: [0, 0, 0], center: [0, 0.5, 0] }), { snd: 'slime', fx: 'juice', wob: 0.2, mat: { rough: 0.25, clearcoat: 0.6 } });
add('cheese', 'halloumi', 'Halloumi', box(0.9, 0.3, 0.55, 0.05), S(PAT.solid, ['#fbf6ea', '#f3ead4'], 4), S(PAT.stripes, ['#fdf9ef', '#f6efdf', '#ffffff'], 14, [0.08]), { snd: 'cheese', fx: 'none', mat: { rough: 0.5 } });

// ======================= FRUIT =======================
const juicy = { snd: 'fruit', fx: 'juice' };
add('fruit', 'watermelon', 'Watermelon', ell(1.3, 0.8, 0.9, 0.12), S(PAT.angular, ['#2d5c2a', '#4c8a3e'], 10, [0.3], { center: [0, 0.7, 0] }), S(PAT.radial, ['#2f6a2e', '#eef3d2', '#f05264', '#2b1b18'], 1, [0.97, 0.86, 0, 0.95], { axis: [0, 0, 0], center: [0, 0.7, 0] }), { ...juicy, mat: { rough: 0.35, clearcoat: 0.5 }, star: true });
add('fruit', 'orange', 'Orange', ell(0.75, 0.75, 0.75, 0.1), S(PAT.speckle, ['#f38a1c', '#f69a2a', '#e2770e'], 18, [0.75, 0.5]), S(PAT.citrus, ['#f3891c', '#fff3dc', '#fff4e2', '#f9a33b'], 10, [0.95, 0.85, 0, 0.75], { axis: [0, 1, 0], center: [0, 0.68, 0] }), { ...juicy, mat: { rough: 0.5, clearcoat: 0.3 } });
add('fruit', 'lemon', 'Lemon', ell(0.85, 0.6, 0.6, 0.1), S(PAT.speckle, ['#f6d32c', '#fbe04a', '#e9c11b'], 18, [0.75, 0.5]), S(PAT.citrus, ['#f6d32c', '#fffbe6', '#fffbe9', '#f8e889'], 9, [0.94, 0.84, 0, 0.6], { axis: [1, 0, 0], center: [0, 0.54, 0] }), { ...juicy, mat: { rough: 0.45, clearcoat: 0.4 } });
add('fruit', 'lime', 'Lime', ell(0.6, 0.55, 0.55, 0.1), S(PAT.speckle, ['#5fa83a', '#6fbc45', '#4b8f2b'], 18, [0.75, 0.5]), S(PAT.citrus, ['#57a134', '#f4fbe2', '#f5fbe8', '#bfe07a'], 10, [0.94, 0.86, 0, 0.55], { axis: [1, 0, 0], center: [0, 0.5, 0] }), { ...juicy, mat: { rough: 0.45, clearcoat: 0.4 } });
add('fruit', 'grapefruit', 'Pink Grapefruit', ell(0.85, 0.8, 0.85, 0.1), S(PAT.speckle, ['#f6b04a', '#f7be66', '#ec9a3a'], 16, [0.75, 0.5]), S(PAT.citrus, ['#f2a344', '#fff2e3', '#fff2ea', '#f0707a'], 12, [0.95, 0.86, 0, 0.8], { axis: [0, 1, 0], center: [0, 0.72, 0] }), { ...juicy, mat: { rough: 0.5, clearcoat: 0.3 } });
add('fruit', 'kiwi', 'Kiwi', ell(0.75, 0.55, 0.55, 0.1), S(PAT.grain, ['#7a5a33', '#8d6a3f', '#5b4022'], 1.2, [0.5]), S(PAT.radial, ['#7a5a33', '#86c23e', '#7cbb3a', '#eef3c8'], 1, [0.97, 0.9, 0.24, 0.55], { axis: [1, 0, 0], center: [0, 0.5, 0] }), { ...juicy, mat: { rough: 0.85, sheen: 1 } });
add('fruit', 'apple', 'Red Apple', ell(0.72, 0.7, 0.72, 0.12), S(PAT.stripes, ['#c8202f', '#de3a3a', '#f6d16b'], 8, [0.06]), S(PAT.radial, ['#c8202f', '#fbf3d8', '#f3e6c6', '#efe2c0'], 1, [0.97, 0.3, 0.1, 0.7], { axis: [0, 1, 0], center: [0, 0.6, 0] }), { snd: 'crisp', fx: 'juice', mat: { rough: 0.3, clearcoat: 0.8 } });
add('fruit', 'greenapple', 'Green Apple', ell(0.72, 0.7, 0.72, 0.12), S(PAT.solid, ['#8cc63f', '#a5d455'], 4), S(PAT.radial, ['#8cc63f', '#fbf8dd', '#f1ebc8', '#efe2c0'], 1, [0.97, 0.3, 0.1, 0.7], { axis: [0, 1, 0], center: [0, 0.6, 0] }), { snd: 'crisp', fx: 'juice', mat: { rough: 0.3, clearcoat: 0.8 } });
add('fruit', 'pear', 'Pear', { type: 'capsule', hx: 0.95, rad: 0.5, taper: 0.7 }, S(PAT.speckle, ['#cbd25a', '#dade73', '#9b9a3a'], 16, [0.8, 0.5]), S(PAT.solid, ['#fbf6dc', '#f3edc8'], 5), { snd: 'crisp', fx: 'juice', mat: { rough: 0.5, clearcoat: 0.4 } });
add('fruit', 'mango', 'Mango', ell(0.95, 0.55, 0.65, 0.12), S(PAT.grady, ['#e8a22d', '#d24a2d'], 1, [0.2, 1.0, 0.3]), S(PAT.solid, ['#f7a928', '#fbb93d'], 4), { ...juicy, mat: { rough: 0.35, clearcoat: 0.6 } });
add('fruit', 'pineapple', 'Pineapple', cyl(0.7, 0.85, 0.15), S(PAT.dots, ['#b98a2c', '#7c5a1b', '#8f6a22', '#6b4c18'], 9, [0.22]), S(PAT.radial, ['#b98a2c', '#f9dc5c', '#f9dc5c', '#f1c94a'], 0, [0.95, 0.9, 0.2, 0.7], { axis: [0, 1, 0], center: [0, 0, 0] }), { snd: 'crisp', fx: 'juice', mat: { rough: 0.7 } });
add('fruit', 'peach', 'Peach', ell(0.7, 0.68, 0.7, 0.12), S(PAT.grady, ['#f7b46a', '#e2533e'], 1, [0.3, 1.1, 0.4]), S(PAT.radial, ['#f39a54', '#f9c27c', '#d0603a', '#7a4a2e'], 0, [0.97, 0.32, 0.2, 0.7], { axis: [0, 0, 0], center: [0, 0.6, 0] }), { ...juicy, mat: { rough: 0.8, sheen: 1 } });
add('fruit', 'avocado', 'Avocado', ell(0.85, 0.5, 0.55, 0.12), S(PAT.speckle, ['#2f4a1f', '#3c5c27', '#1f3214'], 14, [0.7, 0.8]), S(PAT.radial, ['#2f4a1f', '#cfe08a', '#e9eda0', '#7a4a26'], 0, [0.95, 0.85, 0.4, 0.55], { axis: [0, 0, 0], center: [0, 0.45, 0] }), { snd: 'fruit', fx: 'none', mat: { rough: 0.6 } });
add('fruit', 'dragonfruit', 'Dragon Fruit', ell(0.8, 0.65, 0.65, 0.1), S(PAT.solid, ['#e8357a', '#f04a8c'], 4), S(PAT.radial, ['#e8357a', '#fafafa', '#fafafa', '#141414'], 1, [0.94, 0.9, 0, 0.65], { axis: [1, 0, 0], center: [0, 0.6, 0] }), { ...juicy, mat: { rough: 0.4, clearcoat: 0.4 } });
add('fruit', 'strawberry', 'Giant Strawberry', { type: 'ell', a: 0.65, b: 0.8, c: 0.65, flat: 0.1 }, S(PAT.dots, ['#d61f3a', '#f5e17a', '#f2d564', '#f5e17a'], 9, [0.07]), S(PAT.radial, ['#d61f3a', '#ef4a5e', '#fbe0e0', '#fbe0e0'], 0, [0.95, 0.6, 0.1, 0.62], { axis: [0, 1, 0], center: [0, 0, 0] }), { ...juicy, mat: { rough: 0.3, clearcoat: 0.7 } });
add('fruit', 'banana', 'Banana', { type: 'capsule', hx: 1.4, rad: 0.25, sz: 1.05 }, S(PAT.solid, ['#f6d23d', '#f0c62c'], 4), S(PAT.radial, ['#f2cd38', '#fbf3d2', '#f6ecc2', '#d9c99a'], 0, [0.93, 0.3, 0.1, 0.25], { axis: [1, 0, 0], center: [0, 0.25, 0] }), { snd: 'slime', fx: 'none', mat: { rough: 0.5, clearcoat: 0.3 } });

// ======================= VEGETABLES =======================
const crunchy = { snd: 'crunch', fx: 'juice' };
add('veg', 'cucumber', 'Cucumber', { type: 'capsule', hx: 1.5, rad: 0.3 }, S(PAT.angular, ['#2e6b2b', '#4a8a3a'], 9, [0.5], { center: [0, 0.3, 0] }), S(PAT.radial, ['#2e6b2b', '#c7e3a2', '#eaf4d4', '#f6f8e8'], 1, [0.93, 0.6, 0.3, 0.3], { axis: [1, 0, 0], center: [0, 0.3, 0] }), { ...crunchy, mat: { rough: 0.35, clearcoat: 0.6 }, star: true });
add('veg', 'carrot', 'Carrot', { type: 'capsule', hx: 1.4, rad: 0.27, taper: 0.55 }, S(PAT.stripes, ['#ef7f1a', '#f39432', '#d76a10'], 6, [0.05]), S(PAT.radial, ['#ec7a18', '#f39a32', '#f6b14a', '#f6b14a'], 0, [0.96, 0.5, 0.2, 0.27], { axis: [1, 0, 0], center: [0, 0.27, 0] }), { ...crunchy, mat: { rough: 0.55 } });
add('veg', 'tomato', 'Beefsteak Tomato', ell(0.75, 0.6, 0.75, 0.15), S(PAT.solid, ['#e3282a', '#ef3a35'], 4), S(PAT.citrus, ['#e3282a', '#ec4a3c', '#f2c0a6', '#e8433b'], 5, [0.94, 0.8, 0, 0.75], { axis: [0, 1, 0], center: [0, 0.5, 0] }), { ...juicy, mat: { rough: 0.2, clearcoat: 1 } });
add('veg', 'onion', 'Red Onion', ell(0.7, 0.62, 0.7, 0.12), S(PAT.stripes, ['#7d2b4c', '#9a3a61', '#c789a3'], 14, [0.2]), S(PAT.rings, ['#f6e8f0', '#a8486f'], 12, [0.03], { axis: [0, 0, 0], center: [0, 0.55, 0] }), { ...crunchy, mat: { rough: 0.3, clearcoat: 0.6 } });
add('veg', 'potato', 'Potato', ell(0.85, 0.5, 0.6, 0.15), S(PAT.speckle, ['#b88d5a', '#c79e6a', '#7f5d36'], 10, [0.78, 0.7]), S(PAT.solid, ['#f6e6b4', '#f1dea2'], 5), { ...crunchy, fx: 'shave', mat: { rough: 0.8 } });
add('veg', 'sweetpotato', 'Sweet Potato', { type: 'capsule', hx: 1.2, rad: 0.38, sz: 0.9 }, S(PAT.speckle, ['#8e3f3a', '#a24a43', '#6b2b28'], 10, [0.78, 0.6]), S(PAT.solid, ['#f6953c', '#f8a24d'], 5), { ...crunchy, mat: { rough: 0.7 } });
add('veg', 'bellpepper', 'Bell Pepper', cyl(0.65, 0.55, 0.3), S(PAT.angular, ['#e3242b', '#c41c22'], 4, [0.6], { center: [0, 0.55, 0] }), S(PAT.radial, ['#e3242b', '#e8333a', '#f8efe2', '#f8f1e6'], 0, [0.98, 0.82, 0.1, 0.65], { axis: [0, 1, 0], center: [0, 0, 0] }), { ...crunchy, mat: { rough: 0.15, clearcoat: 1 } });
add('veg', 'zucchini', 'Zucchini', { type: 'capsule', hx: 1.45, rad: 0.28 }, S(PAT.angular, ['#2f5b25', '#4b7a38'], 7, [0.6], { center: [0, 0.28, 0] }), S(PAT.radial, ['#2f5b25', '#eef3c9', '#f4f6d8', '#e3e8b6'], 0, [0.95, 0.5, 0.2, 0.28], { axis: [1, 0, 0], center: [0, 0.28, 0] }), { ...crunchy, mat: { rough: 0.35, clearcoat: 0.5 } });
add('veg', 'eggplant', 'Eggplant', { type: 'capsule', hx: 1.3, rad: 0.42, taper: 0.7 }, S(PAT.solid, ['#3a1d3e', '#4a2550'], 4), S(PAT.speckle, ['#f4eccf', '#ece2be', '#a08a5a'], 14, [0.8, 0.6]), { snd: 'foam', fx: 'none', mat: { rough: 0.15, clearcoat: 1 } });
add('veg', 'cabbage', 'Red Cabbage', ell(0.85, 0.75, 0.85, 0.12), S(PAT.swirl, ['#5b2e6e', '#7a4691', '#c7a9d6'], 5, [4, 0.6]), S(PAT.swirl, ['#f2e6f2', '#6e3a85', '#f8f0f8'], 14, [8, 0.4]), { ...crunchy, mat: { rough: 0.4, clearcoat: 0.4 } });
add('veg', 'beet', 'Beetroot', ell(0.65, 0.6, 0.65, 0.12), S(PAT.solid, ['#5a1a2e', '#6e2237'], 4), S(PAT.rings, ['#a3184a', '#c72a5f'], 9, [0.05], { axis: [0, 1, 0], center: [0, 0, 0] }), { ...crunchy, mat: { rough: 0.5, clearcoat: 0.3 } });
add('veg', 'radish', 'Daikon Radish', { type: 'capsule', hx: 1.5, rad: 0.35, taper: 0.7 }, S(PAT.solid, ['#f7f6ef', '#eef0e2'], 4), S(PAT.radial, ['#f7f6ef', '#fbfbf6', '#f2f4ea', '#f2f4ea'], 0, [0.96, 0.6, 0.2, 0.35], { axis: [1, 0, 0], center: [0, 0.35, 0] }), { ...crunchy, mat: { rough: 0.35, clearcoat: 0.3 } });
add('veg', 'pumpkin', 'Pumpkin', ell(0.95, 0.7, 0.95, 0.15), S(PAT.angular, ['#e47a1e', '#c8620f'], 9, [0.5], { center: [0, 0.6, 0] }), S(PAT.radial, ['#e47a1e', '#f6a03b', '#f7d79b', '#f7d79b'], 0, [0.96, 0.6, 0.3, 0.95], { axis: [0, 1, 0], center: [0, 0, 0] }), { snd: 'crunch', fx: 'shave', mat: { rough: 0.4, clearcoat: 0.4 } });
add('veg', 'celery', 'Celery Root', ell(0.75, 0.6, 0.75, 0.15), S(PAT.speckle, ['#c4b38a', '#b29f74', '#7d6a48'], 10, [0.7, 0.8]), S(PAT.solid, ['#f6f2df', '#efe9cf'], 6), { ...crunchy, mat: { rough: 0.85 } });

// ======================= SWEETS & JELLY =======================
const jelly = (c1, c2, extra = {}) => ({ snd: 'jelly', fx: 'jelly', wob: 1, mat: { rough: 0.08, clearcoat: 1, opacity: 0.82, spec: 1 }, ...extra });
add('sweet', 'jellycube', 'Strawberry Jelly Cube', box(0.75, 0.75, 0.75, 0.1), S(PAT.solid, ['#ff4f6d', '#ff6b84'], 2), S(PAT.solid, ['#ff5873', '#ff7690'], 2), jelly(0, 0, { star: true }));
add('sweet', 'lemonjelly', 'Lemon Jelly', box(0.75, 0.6, 0.75, 0.15), S(PAT.solid, ['#ffd84a', '#ffe36e'], 2), S(PAT.solid, ['#ffd84a', '#ffe36e'], 2), jelly());
add('sweet', 'layerjelly', 'Rainbow Layer Jelly', box(0.85, 0.7, 0.7, 0.08), S(PAT.rainbow, ['#fff'], 1.6, [0.6, 1]), S(PAT.layers, ['#ff6b8a', '#ffd166', '#6fd3a8', '#7aa7ff'], 5.7, [0.03, 0, 4, 0.05]), jelly());
add('sweet', 'pannacotta', 'Panna Cotta', { type: 'dome', a: 0.75, b: 0.75 }, S(PAT.grady, ['#fbf4e6', '#c22e48'], 1, [0.6, 0.75, 0.02]), S(PAT.grady, ['#fbf4e6', '#c22e48'], 1, [0.6, 0.75, 0.02]), jelly(0, 0, { mat: { rough: 0.2, clearcoat: 0.8 }, wob: 0.6 }));
add('sweet', 'gummy', 'Giant Gummy Block', box(0.8, 0.5, 0.6, 0.15), S(PAT.solid, ['#57d18a', '#6be09b'], 2), S(PAT.solid, ['#57d18a', '#6be09b'], 2), jelly(0, 0, { wob: 0.5 }));
add('sweet', 'darkchoc', 'Dark Chocolate Bar', box(1.1, 0.16, 0.6, 0.03), S(PAT.solid, ['#3a1e12', '#422316'], 4, null, { rough: 0.25 }), S(PAT.solid, ['#3d2014', '#4a2819'], 6), { snd: 'choc', fx: 'choc', mat: { rough: 0.3, clearcoat: 0.6 }, star: true });
add('sweet', 'milkchoc', 'Milk Chocolate Block', box(0.9, 0.35, 0.6, 0.04), S(PAT.solid, ['#7a4a2a', '#8a5532'], 4), S(PAT.solid, ['#7f4d2c', '#93603a'], 6), { snd: 'choc', fx: 'choc', mat: { rough: 0.35, clearcoat: 0.5 } });
add('sweet', 'whitechoc', 'White Chocolate', box(0.9, 0.3, 0.6, 0.04), S(PAT.solid, ['#f6ecd6', '#efe2c4'], 4), S(PAT.solid, ['#f8eedb', '#f1e5cb'], 6), { snd: 'choc', fx: 'choc', mat: { rough: 0.35, clearcoat: 0.4 } });
add('sweet', 'marble', 'Marbled Chocolate', box(0.95, 0.35, 0.6, 0.04), S(PAT.swirl, ['#3d2014', '#f3e6cc', '#7a4a2a'], 6, [5, 0.6]), S(PAT.swirl, ['#3d2014', '#f3e6cc', '#7a4a2a'], 6, [5, 0.6]), { snd: 'choc', fx: 'choc', mat: { rough: 0.3, clearcoat: 0.5 } });
add('sweet', 'fudge', 'Vanilla Fudge', box(0.9, 0.35, 0.6, 0.04), S(PAT.speckle, ['#e9c48d', '#f0d19f', '#3d2014'], 9, [0.8, 0.8]), S(PAT.speckle, ['#ecc893', '#f2d6a6', '#3d2014'], 10, [0.82, 0.8]), { snd: 'cheese', fx: 'crumb', mat: { rough: 0.55 } });
add('sweet', 'turkish', 'Turkish Delight', box(0.85, 0.45, 0.6, 0.06), S(PAT.grain, ['#ffffff', '#f6eef0', '#ffffff'], 2, [0]), S(PAT.speckle, ['#f6a1b8', '#f8b2c5', '#86b75a'], 6, [0.82, 1]), jelly(0, 0, { wob: 0.35, mat: { rough: 0.5, opacity: 1 } }));
add('sweet', 'nougat', 'Nougat', box(1.0, 0.3, 0.55, 0.04), S(PAT.solid, ['#fbf6ec', '#f5eedd'], 4), S(PAT.speckle, ['#fbf6ec', '#f5eedd', '#7cae4b'], 6, [0.8, 1]), { snd: 'cheese', fx: 'crumb', mat: { rough: 0.6 } });

// ======================= SOAP =======================
const soap = (extra = {}) => ({ snd: 'soap', fx: 'shave', mat: { rough: 0.45, sheen: 0.3 }, ...extra });
add('soap', 'soapbar', 'Lavender Soap Bar', box(1.0, 0.42, 0.62, 0.1), S(PAT.solid, ['#b9a4dc', '#c8b6e6'], 4), S(PAT.solid, ['#bca8de', '#cbbbe8'], 6), soap({ star: true }));
add('soap', 'layersoap', 'Layered Pastel Soap', box(1.0, 0.6, 0.62, 0.05), S(PAT.layers, ['#f7b7c5', '#fbe3a2', '#b7e3cf', '#b9c8f4'], 6.6, [0.08, 0, 4, 0.08]), S(PAT.layers, ['#f7b7c5', '#fbe3a2', '#b7e3cf', '#b9c8f4'], 6.6, [0.08, 0, 4, 0.08]), soap({ star: true }));
add('soap', 'glycerin', 'Glycerin Soap (Clear Blue)', box(0.95, 0.45, 0.6, 0.08), S(PAT.solid, ['#7fd2f0', '#9ee0f6'], 3), S(PAT.solid, ['#7fd2f0', '#a5e4f8'], 3), soap({ mat: { rough: 0.1, clearcoat: 1, opacity: 0.7, spec: 1 }, snd: 'wax' }));
add('soap', 'amber', 'Translucent Amber Soap', box(0.95, 0.45, 0.6, 0.08), S(PAT.solid, ['#f2a63c', '#f6bb5e'], 3), S(PAT.solid, ['#f2a63c', '#f6bb5e'], 3), soap({ mat: { rough: 0.1, clearcoat: 1, opacity: 0.75, spec: 1 }, snd: 'wax' }));
add('soap', 'rosesoap', 'Rose Clay Soap', box(1.0, 0.42, 0.62, 0.12), S(PAT.speckle, ['#f0b4b8', '#f6c6c9', '#d98d93'], 8, [0.8, 0.6]), S(PAT.speckle, ['#f2b8bc', '#f8cccf', '#d98d93'], 8, [0.82, 0.6]), soap());
add('soap', 'swirlsoap', 'Swirl Soap Loaf', box(1.25, 0.55, 0.55, 0.05), S(PAT.swirl, ['#fdf6ee', '#7bc4c4', '#e88aa6'], 5, [5, 0.8]), S(PAT.swirl, ['#fdf6ee', '#7bc4c4', '#e88aa6'], 5, [5, 0.8]), soap());
add('soap', 'charcoal', 'Charcoal Soap', box(1.0, 0.42, 0.62, 0.1), S(PAT.speckle, ['#2b2c30', '#35363b', '#5a5b60'], 8, [0.8, 0.5]), S(PAT.solid, ['#2b2c30', '#38393e'], 6), soap());
add('soap', 'oatmeal', 'Oat & Honey Soap', box(1.0, 0.42, 0.62, 0.12), S(PAT.speckle, ['#ecd6a6', '#f2e0b8', '#a77f45'], 9, [0.78, 0.9]), S(PAT.speckle, ['#efd9aa', '#f4e3bd', '#a77f45'], 9, [0.8, 0.9]), soap());
add('soap', 'confetti', 'Confetti Soap', box(1.0, 0.45, 0.62, 0.06), S(PAT.dots, ['#fbf8f4', '#ff7aa2', '#6fd3e8', '#ffd166'], 7, [0.09]), S(PAT.dots, ['#fbf8f4', '#ff7aa2', '#6fd3e8', '#ffd166'], 7, [0.09]), soap());
add('soap', 'rainbowsoap', 'Rainbow Soap', box(1.1, 0.45, 0.6, 0.06), S(PAT.rainbow, ['#fff'], 1.2, [0.42, 0.97]), S(PAT.rainbow, ['#fff'], 1.2, [0.42, 0.97]), soap());
add('soap', 'mintsoap', 'Mint Round Soap', cyl(0.75, 0.35, 0.14), S(PAT.solid, ['#a8e6cf', '#bdeedb'], 4), S(PAT.solid, ['#aee8d2', '#c3f0de'], 5), soap());
add('soap', 'gradsoap', 'Ombré Soap', box(0.95, 0.6, 0.6, 0.06), S(PAT.grady, ['#ff9a8b', '#ffd3a5'], 1, [0, 1.2, 0.05]), S(PAT.grady, ['#ff9a8b', '#ffd3a5'], 1, [0, 1.2, 0.05]), soap());
add('soap', 'milksoap', 'Goat Milk Soap', box(1.0, 0.42, 0.62, 0.14), S(PAT.solid, ['#fbf7ef', '#f3ede0'], 4), S(PAT.solid, ['#fcf8f1', '#f4eee2'], 6), soap());
add('soap', 'starch', 'Dyed Starch Block', box(0.8, 0.5, 0.8, 0.03), S(PAT.grain, ['#c7b8f2', '#d6cbf6', '#ffffff'], 2, [0.4]), S(PAT.grain, ['#c7b8f2', '#dcd2f8', '#ffffff'], 2.5, [0.5]), { snd: 'sand', fx: 'sand', mat: { rough: 0.95 } });

// ======================= SOFT & SAND =======================
add('soft', 'kinetic', 'Kinetic Sand Cube', box(0.8, 0.6, 0.8, 0.03), S(PAT.grain, ['#e8b4c8', '#f2c8d8', '#ffffff'], 2.6, [0.6]), S(PAT.grain, ['#e8b4c8', '#f3cddc', '#ffffff'], 2.6, [0.6]), { snd: 'sand', fx: 'sand', mat: { rough: 1 }, star: true });
add('soft', 'sandblue', 'Blue Sand Block', box(1.0, 0.5, 0.7, 0.03), S(PAT.grain, ['#8ab6e8', '#a3c7f0', '#ffffff'], 2.6, [0.6]), S(PAT.grain, ['#8ab6e8', '#a3c7f0', '#ffffff'], 2.6, [0.6]), { snd: 'sand', fx: 'sand', mat: { rough: 1 } });
add('soft', 'sandlayers', 'Layered Sand Tower', box(0.7, 0.8, 0.7, 0.03), S(PAT.layers, ['#f4a7b9', '#f9d98b', '#9fd8c6', '#a7b8f4'], 5, [0.04, 0, 4, 0.03]), S(PAT.layers, ['#f4a7b9', '#f9d98b', '#9fd8c6', '#a7b8f4'], 5, [0.04, 0, 4, 0.03]), { snd: 'sand', fx: 'sand', mat: { rough: 1 } });
add('soft', 'sanddome', 'Sand Castle Dome', { type: 'dome', a: 0.85, b: 0.75 }, S(PAT.grain, ['#e8cf9e', '#f1dcb1', '#ffffff'], 2.6, [0.5]), S(PAT.grain, ['#e2c58f', '#eed6a6', '#ffffff'], 2.6, [0.5]), { snd: 'sand', fx: 'sand', mat: { rough: 1 } });
add('soft', 'clay', 'Terracotta Clay', box(0.9, 0.5, 0.65, 0.12), S(PAT.solid, ['#c86f4e', '#d07a58'], 4), S(PAT.solid, ['#c06648', '#cc7556'], 5), { snd: 'clay', fx: 'none', wob: 0.08, mat: { rough: 0.55, clearcoat: 0.2 } });
add('soft', 'polyclay', 'Polymer Clay Cane', { type: 'cylx', rad: 0.4, hx: 1.25, r: 0.04 }, S(PAT.solid, ['#f4b9c9', '#f8c9d6'], 4), S(PAT.citrus, ['#7bc4a4', '#fbf6ef', '#fbf6ef', '#f48aa8'], 6, [0.92, 0.82, 0, 0.4], { axis: [1, 0, 0], center: [0, 0.4, 0] }), { snd: 'clay', fx: 'none', mat: { rough: 0.45 } });
add('soft', 'slime', 'Cloud Slime Blob', { type: 'dome', a: 0.9, b: 0.55 }, S(PAT.solid, ['#bfe3ff', '#d6eeff'], 3), S(PAT.solid, ['#c7e7ff', '#e2f2ff'], 4), { snd: 'slime', fx: 'jelly', wob: 0.9, mat: { rough: 0.15, clearcoat: 1, sheen: 0.4 } });
add('soft', 'butterslime', 'Butter Slime', box(0.85, 0.45, 0.7, 0.2), S(PAT.solid, ['#fbe7a1', '#fdf0bf'], 3), S(PAT.solid, ['#fbe7a1', '#fdf0bf'], 4), { snd: 'slime', fx: 'jelly', wob: 0.7, mat: { rough: 0.3, clearcoat: 0.6 } });
add('soft', 'foam', 'Floral Foam Brick', box(1.0, 0.5, 0.55, 0.02), S(PAT.grain, ['#3d8a5a', '#4a9a68', '#2c6b44'], 3, [0.3]), S(PAT.grain, ['#469a64', '#55a873', '#326f48'], 3, [0.3]), { snd: 'foam', fx: 'sand', mat: { rough: 1 }, star: true });
add('soft', 'memoryfoam', 'Memory Foam Block', box(0.95, 0.55, 0.7, 0.05), S(PAT.crumb, ['#f6f3ea', '#eee9db', '#ddd5c2'], 14, [0.5]), S(PAT.crumb, ['#f6f3ea', '#eee9db', '#ddd5c2'], 14, [0.5]), { snd: 'foam', fx: 'none', wob: 0.15, mat: { rough: 0.95 } });
add('soft', 'squishy', 'Pastel Squishy', box(0.8, 0.55, 0.8, 0.3), S(PAT.grady, ['#ffc2d4', '#c2e0ff'], 1, [0, 1.1, 0.05]), S(PAT.crumb, ['#ffd2df', '#fbe6ee', '#f0b8c8'], 10, [0.5]), { snd: 'foam', fx: 'none', wob: 0.5, mat: { rough: 0.8, sheen: 0.6 } });
add('soft', 'cornstarch', 'Gym Chalk Block', box(0.8, 0.45, 0.6, 0.04), S(PAT.grain, ['#ffffff', '#f2f2f2', '#ffffff'], 2, [0]), S(PAT.grain, ['#ffffff', '#f4f4f4', '#ffffff'], 2, [0]), { snd: 'sand', fx: 'sand', mat: { rough: 1 } });

// ======================= WAX & CANDLES =======================
const wax = (extra = {}) => ({ snd: 'wax', fx: 'shave', mat: { rough: 0.35, sheen: 0.2, clearcoat: 0.2 }, ...extra });
add('wax', 'pillar', 'Pillar Candle', cyl(0.55, 0.9, 0.06), S(PAT.solid, ['#fbf6ec', '#f4ecdc'], 4), S(PAT.solid, ['#fcf8f0', '#f6efe1'], 6), wax({ star: true }));
add('wax', 'beeswax', 'Beeswax Block', box(0.9, 0.45, 0.6, 0.05), S(PAT.solid, ['#e9b23e', '#f0c25a'], 4), S(PAT.solid, ['#ecb848', '#f2c661'], 6), wax());
add('wax', 'layercandle', 'Layered Candle', cyl(0.6, 0.8, 0.06), S(PAT.layers, ['#f7c6d0', '#fbe8c4', '#cfe8d8', '#d3d8f6'], 3.2, [0.05, 0, 4, 0.06]), S(PAT.layers, ['#f7c6d0', '#fbe8c4', '#cfe8d8', '#d3d8f6'], 3.2, [0.05, 0, 4, 0.06]), wax());
add('wax', 'crayon', 'Giant Crayon Block', box(1.2, 0.35, 0.35, 0.04), S(PAT.solid, ['#3c78d8', '#4a86e2'], 4), S(PAT.solid, ['#3c78d8', '#4a86e2'], 6), wax());
add('wax', 'marblecandle', 'Marble Candle', cyl(0.6, 0.7, 0.06), S(PAT.swirl, ['#f8f6f2', '#b9bcc4', '#5d6068'], 4, [6, 0.7]), S(PAT.swirl, ['#f8f6f2', '#b9bcc4', '#5d6068'], 4, [6, 0.7]), wax({ mat: { rough: 0.2, clearcoat: 0.8 } }));
add('wax', 'gelwax', 'Gel Wax Candle', cyl(0.55, 0.7, 0.05), S(PAT.solid, ['#9fe6d9', '#b6eee3'], 3), S(PAT.solid, ['#9fe6d9', '#b6eee3'], 3), wax({ mat: { rough: 0.05, clearcoat: 1, opacity: 0.6, spec: 1 }, wob: 0.15 }));
add('wax', 'paraffin', 'Paraffin Slab', box(1.1, 0.25, 0.75, 0.03), S(PAT.solid, ['#f4f4f0', '#ebebe5'], 4), S(PAT.solid, ['#f6f6f2', '#ededE7'], 6), wax({ mat: { rough: 0.3, opacity: 0.92, clearcoat: 0.3 } }));
add('wax', 'soywax', 'Soy Wax Ombré', box(0.85, 0.6, 0.6, 0.06), S(PAT.grady, ['#b48ad8', '#f7c4d9'], 1, [0, 1.2, 0.05]), S(PAT.grady, ['#b48ad8', '#f7c4d9'], 1, [0, 1.2, 0.05]), wax());

// ======================= SATISFYING =======================
add('misc', 'ice', 'Clear Ice Block', box(0.85, 0.75, 0.85, 0.05), S(PAT.solid, ['#dff3ff', '#eef9ff'], 3), S(PAT.solid, ['#e5f6ff', '#f5fcff'], 3), { snd: 'ice', fx: 'ice', mat: { rough: 0.02, clearcoat: 1, opacity: 0.55, spec: 1 }, star: true });
add('misc', 'iceball', 'Ice Sphere', ell(0.7, 0.7, 0.7, 0.06), S(PAT.solid, ['#dff3ff', '#eef9ff'], 3), S(PAT.solid, ['#e5f6ff', '#f5fcff'], 3), { snd: 'ice', fx: 'ice', mat: { rough: 0.02, clearcoat: 1, opacity: 0.55, spec: 1 } });
add('misc', 'colorice', 'Frozen Berry Ice', box(0.8, 0.6, 0.8, 0.06), S(PAT.dots, ['#f1e6ff', '#a03da0', '#3b4fc4', '#d63a5a'], 4, [0.12]), S(PAT.dots, ['#f1e6ff', '#a03da0', '#3b4fc4', '#d63a5a'], 4, [0.12]), { snd: 'ice', fx: 'ice', mat: { rough: 0.05, clearcoat: 1, opacity: 0.7, spec: 1 } });
add('misc', 'crystal', 'Amethyst Crystal Block', cyl(0.6, 0.75, 0.0, { segs: 6 }), S(PAT.grady, ['#4b1f7a', '#c9a6f2'], 1, [0, 1.5, 0.1]), S(PAT.grady, ['#5b2a8f', '#e0c8fb'], 1, [0, 1.5, 0.1]), { snd: 'ice', fx: 'ice', mat: { rough: 0.05, clearcoat: 1, opacity: 0.8, spec: 1 } });
add('misc', 'rubber', 'Rubber Eraser Block', box(1.0, 0.35, 0.55, 0.06), S(PAT.layers, ['#f27aa0', '#5aa0e6'], 1.85, [0, 0.0, 2, 0.02], { axis: [1, 0, 0] }), S(PAT.solid, ['#f27aa0', '#f48aab'], 6), { snd: 'clay', fx: 'crumb', wob: 0.1, mat: { rough: 0.7 } });
add('misc', 'cork', 'Cork Block', box(0.9, 0.45, 0.6, 0.04), S(PAT.grain, ['#b98b5c', '#c99c6c', '#7a5634'], 1.4, [0.6]), S(PAT.grain, ['#c0915f', '#d0a372', '#7a5634'], 1.4, [0.6]), { snd: 'foam', fx: 'crumb', mat: { rough: 0.95 } });
add('misc', 'wood', 'Balsa Wood Block', box(1.1, 0.4, 0.6, 0.03), S(PAT.stripes, ['#e7cf9f', '#dcc08b', '#c7a66d'], 16, [0.18]), S(PAT.stripes, ['#ecd6a8', '#e0c693', '#c7a66d'], 16, [0.2]), { snd: 'bread', fx: 'shave', mat: { rough: 0.8 } });
add('misc', 'marshmallow', 'Giant Marshmallow', cyl(0.75, 0.55, 0.25), S(PAT.solid, ['#fdfbf8', '#f6f2ec'], 4), S(PAT.crumb, ['#fefcf9', '#f8f4ee', '#efe7dc'], 12, [0.55]), { snd: 'foam', fx: 'none', wob: 0.45, mat: { rough: 0.85, sheen: 0.7 } });
add('misc', 'honeycomb', 'Honeycomb Toffee', box(0.9, 0.45, 0.6, 0.05), S(PAT.solid, ['#d68a1f', '#e9a43a'], 4), S(PAT.crumb, ['#f2b84c', '#f7c868', '#b8721a'], 6, [0.35]), { snd: 'crunch', fx: 'crumb', mat: { rough: 0.4, clearcoat: 0.5 } });
add('misc', 'glass', 'Sugar Glass Pane', box(1.0, 0.15, 0.7, 0.02), S(PAT.solid, ['#f6f0ff', '#ffffff'], 3), S(PAT.solid, ['#f6f0ff', '#ffffff'], 3), { snd: 'ice', fx: 'ice', mat: { rough: 0.02, clearcoat: 1, opacity: 0.45, spec: 1 } });
add('misc', 'cube', 'Pastel Soft Cube', box(0.8, 0.8, 0.8, 0.12), S(PAT.solid, ['#cdb4f6', '#dcc8fa'], 4), S(PAT.layers, ['#cdb4f6', '#fbcfe0'], 4.5, [0.1, 0, 2, 0.15]), { snd: 'foam', fx: 'none', wob: 0.4, mat: { rough: 0.7, sheen: 0.8 } });
add('misc', 'bathbomb', 'Bath Bomb', ell(0.7, 0.7, 0.7, 0.1), S(PAT.grain, ['#f7a9c4', '#fbc6d8', '#ffffff'], 1.6, [0.6]), S(PAT.layers, ['#f7a9c4', '#b8e4f2', '#fbe3a2'], 4, [0.25, 0, 3, 0.1]), { snd: 'sand', fx: 'sand', mat: { rough: 1 } });

export const OBJECTS = L;
export const byId = Object.fromEntries(L.map(o => [o.id, o]));
