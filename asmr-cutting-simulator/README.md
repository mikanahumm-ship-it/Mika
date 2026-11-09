# Slice ASMR — 3D Cutting Simulator

A relaxing, mobile-first 3D cutting sandbox for iPhone and Android browsers (desktop works too).
You drag your finger to cut. The objects are split as real geometry along your stroke.

## Run it

It is a static site with no build step. Serve the folder over HTTP. ES modules and WASM do not load from `file://`.

```bash
cd asmr-cutting-simulator
python3 -m http.server 8080
# open http://<your-computer-ip>:8080 on your phone (same Wi-Fi)
```

You can also host it on GitHub Pages or any static host. All dependencies are vendored in `vendor/`
(three.js r170 and Rapier 0.14, which has its WASM inlined), so there are no CDN calls.

## Controls

| Action | Touch | Mouse |
|---|---|---|
| Cut / shave / carve | one-finger drag | left drag |
| Rotate camera | two-finger drag, or the orbit button then one finger | right drag |
| Zoom | pinch | wheel |
| Poke (jelly wobble) | tap | click |
| Move pieces | hand button, then drag | same |

- **Straight** mode: the blade enters vertically, and **Tilt** (±50°) makes bevel cuts.
- **Follow view** mode: the cut plane goes through the camera and your stroke. With a low camera this gives horizontal slices, and with other angles it gives cuts at any angle.
- **Undo** reverts each cut (30 levels). **Reset** restores the object. The **stopwatch** turns on slow motion for physics, particles and sound.

## Content

- **131 objects** in 12 categories: meat & fish, sushi, bakery, cakes, cheese, fruit, vegetables, sweets & jelly, soap, soft & sand, wax & candles, and other satisfying objects.
- **14 tools**: Chef's knife, santoku, cleaver, bread knife (serrated sawing sound), precision blade, soap cutter, wire cutter, soap shaver, carving gouge. Five more unlock as you cut: crinkle cutter, wave blade, melon scoop, obsidian blade and light blade.
- **Customisation**: 6 blade finishes (Damascus, gold and obsidian unlock) and 6 handle colours.

## How the cutting works

- **Convex-part kernel** (`src/geometry.js`). Every object is a set of convex polyhedra. Splitting a convex part with a plane is exact and robust, and gives two convex parts plus a cap polygon.
- **Your stroke becomes cutting planes.**
  - The screen path is simplified (RDP) and projected onto the object surface.
  - Each segment becomes a plane, bounded at its ends by bisector planes, so curved strokes cut along the path you drew as a chain of short straight segments.
  - The zigzag and wave tools change the path itself, so the crinkle cut is real geometry.
- **Partial cuts and connectivity.**
  - Bounding a cut needs extra "glue" splits, which are internal faces that keep parts bonded.
  - After every cut, a connectivity pass (glue faces that overlap on the same plane) works out which parts are still attached.
  - A stroke that stops halfway leaves a real slit that stays attached. The pieces only separate once they are fully cut through.
- **Shaving and carving** clip the material under the stroke to a band of the chosen width, then cut it at a depth below the local top surface. The chip is removed and turns into shavings in proportion to its volume. Repeated strokes go deeper.
- **Volumetric materials** (`src/materials.js`). Colour comes from the 3D position inside the object (marbling, layers, fruit flesh/pith/seeds, citrus segments, crumb, sand grain …). A cut face always shows the inside that matches where it is.
- **Physics** (`vendor/rapier.es.js`). Every piece is a Rapier rigid body with convex-hull colliders. Thin slices topple, cubes tumble, and the hand tool lets you push pieces around.
- **Audio** (`src/audio.js`). All sound is synthesised from filtered noise grains and short tonal bodies, with a profile per material (wet meat, crisp soap, crunchy vegetables, granular sand, crackling ice, jelly bloops …). It is generated while the blade moves through material, at a rate set by your speed. There are no sound files and no music.

## Honest limitations

- Cuts go straight down through the whole object, like pressing a knife to the board. You can't stop the blade halfway down. For horizontal or depth-limited cuts, use Follow view or the shaver and gouge.
- Curved strokes are cut as chains of short planar segments, which looks smooth at normal stroke speeds.
- Base shapes are convex: boxes, rounded bars, cylinders, ellipsoids, domes, capsules and wedges. Objects with real holes, like a bagel ring or Swiss-cheese holes, use shading instead of geometry.
- Jelly, slime, clay and other soft materials are rigid bodies. Their wobble is a vertex-shader effect, not a soft-body simulation.
- Cut faces are flat. Fibrous tearing, crumbling and squishing are suggested with particles and sound only.
- Vibration uses the Vibration API, which works on Android Chrome. iPhone Safari has no Vibration API; on iOS 18+ a light tick is tried with the native switch trick. On iPhone, sound needs the silent switch off.
- If WebAssembly can't load, the game falls back to a simple separate-and-rest mode without full physics.

## Files

```
index.html, style.css      UI shell (minimal glass interface, bottom sheets)
src/main.js                UI controller, menus, 3D thumbnails, settings
src/game.js                scene, physics bridge, input, cutting operations, camera, undo
src/geometry.js            convex part kernel: split, caps, connectivity, shape generators
src/materials.js           procedural volumetric shaders (15 patterns)
src/catalog.js             131 object definitions (data only — add objects here)
src/tools.js               tool definitions, 3D knife models, icons
src/audio.js               procedural ASMR sound engine
src/particles.js           instanced shavings / crumbs / juice / sand / ice
```

To add an object, add one `add(...)` line in `src/catalog.js`. Give it a shape, an outer surface, an inner surface, material feel, a sound profile and a particle type.
