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

- **206 objects** in 15 categories: carving (woods, bowl blank, carving soap and wax …), glass & ice (glass blocks, stained glass, marbles, tempered pane, ice cubes, glacier ice, frozen-flower ice …), viral & squishy (pistachio kunafa chocolate, tanghulu, mille crêpe, geode, stress ball, slime, play dough, water-bead jelly …), meat & fish, sushi, bakery, cakes, cheese, fruit, vegetables, sweets & jelly, soap, soft & sand, wax & candles, and other satisfying objects.
- **Cutting tools**: Chef's knife; Dicer, Fine Dicer and Chunk Dicer (sweep objects into scattering cubes); nakiri, sashimi knife, paring knife, butcher knife, fillet knife, ceramic knife, mezzaluna, pizza wheel (it rolls) and ulu; Squish (press and hold to deform), santoku, cleaver, bread knife (serrated sawing sound), precision blade, soap cutter, wire cutter, soap shaver, carving gouge. Five more unlock as you cut: crinkle cutter, wave blade, melon scoop, obsidian blade and light blade.
- **Customisation**: 6 blade finishes (Damascus, gold and obsidian unlock) and 6 handle colours.

## How the cutting works

- **Live cutting** (`src/live.js`). The object's geometry changes every frame while you drag, under the blade.
  - **Knife tools** carve a thin slot (the blade's kerf) that follows your path. Once the slot fully crosses a piece, the connectivity check finds two separate parts and the piece falls away with physics, mid-stroke.
  - **Peeler and gouge** remove a strip of chosen width and thickness below the local top surface. The removed strip turns into a curl, peel, drape, chunk or crumbs, depending on the material.
- **The blade sits in the cut.**
  - The knife's tip leads at the cut front, with its edge at the slot floor.
  - Starting on top of an object, the blade presses in as it travels, so the slot is a real ramp at first. Arriving from the side, it slides in at board level.
  - On release, any shallow part is pushed through.
  - The blade follows your finger with resistance that depends on the material, so jelly is slick and ice is stubborn.
- **Curls are real removed material.** Each curl sample remembers the 3D position inside the object it was shaved from, and the curl is shaded with the same volumetric material. Layered soap gives striped curls, and cucumber peel is green on the outside and pale on the inside. Curls grow while attached to the blade, then roll off as physics bodies when you lift your finger. Chocolate curls snap off as they grow.
- **Material behaviour** comes from each object's tags (`behavior()` in `src/live.js`). It sets the style (curl, peel, drape, chunk or crumble), blade resistance, press-in speed, curl radius, brittleness and how much the object wobbles while cut. Any object can override it with a `live` field in the catalog.
- **Clean geometry.**
  - **Convex-part kernel** (`src/geometry.js`). Every object is a set of convex polyhedra. Splitting a convex part with a plane is exact, and non-convex results like slots and grooves are kept as convex parts glued together by internal faces.
  - **Rebuilt every frame.** While you cut, each touched body is rebuilt from its shape at the start of the stroke plus the blade's path simplified into straight lines (RDP). A long stroke stays a handful of parts, with no seams or slow-down. Each straight line is split only by depth, so all its sections share the same side planes and their internal faces line up exactly.
- **Dicer** (`src/dice.js`, `src/patterns.js`). A long blade sweeps across the object, and everything it passes is voxelised into real cubes.
  - A cube is created at every grid cell, in the object's own frame, whose centre lies inside the removed volume.
  - Each cube is coloured by a CPU port of the volumetric shader at that exact point, so fat, layers, rind and seeds land on the right cubes.
  - Cubes fall, bounce and tumble. On landing, each one finds its resting cell downhill on a height field (angle of repose), reserves it and hops there, so piles build up without overlaps.
  - Tens of thousands of cubes run cheaply as one instanced mesh. The *Cube size* slider sets their size, and the counter shows how many you've made.
- **Squish** (`src/squish.js`). Press and hold to push a dent into the object. Dragging your finger leaves a groove.
  - While pressing, the dent is a vertex-shader deformation, with a soft bulge and a raised rim around it.
  - The mesh is first subdivided around your finger (crack-free refinement) so it can bend smoothly.
  - What happens on release depends on the material:

    | Type | Examples | On release |
    |---|---|---|
    | Plastic | clay, kinetic sand, dough, cake, meat | The dent is baked into the real geometry. You can press again, drag a groove, or cut through it, and the cut face follows the dent. |
    | Elastic | jelly, stress ball, sponge, honey jelly | The dent springs back with a wobble. |
    | Brittle | chocolate, ice, soap, crunchy food | The object gives a little, then cracks into real pieces along planes through your finger. |

  - Cutting a dented object traces the real (non-convex) cross-section instead of a convex hull.
- **Splat**: keep holding a squish past full depth and soft things give way. Jelly, slime and fruit burst into real chunks that fly out to the sides. Dough, clay, sand and cake flatten into a pancake (an affine squash, so the geometry stays valid) and squirt blobs coloured from the inside.
- **Carving mode** (the *Carve* tab, `src/live.js` + `src/tools.js`). It has its own tools:

  | Tool | Profile |
  |---|---|
  | U-Gouge, Spoon Gouge, Detail Gouge | round |
  | V-Gouge | V |
  | Flat Chisel | flat |
  | Card Scraper | wide, shallow |
  | Drawknife | wide, two handles |

  - The material under the tool is really removed. A curved tool cuts several side-by-side strips, each as deep as the tool's cross-section at that point, so the groove is curved.
  - Going over the same area again digs deeper, so you can hollow an object out.
  - *Width* and *Depth* sliders size the tool. Direction and length follow your finger.
  - Shavings are the removed material, shaded from the spot they came from:

    | Material | Shavings |
    |---|---|
    | Wood | short, tight curls that snap off as chips |
    | Soap | long, smooth ribbons |
    | Wax | soft shavings |
    | Chocolate | brittle curls |

  - Shavings drop as physics bodies, tumble, and pile up around the object or inside a hollow, like the roughed-out *Wooden Bowl Blank*.
  - Carving objects: basswood, walnut, cherry, an oak log round, a pine plank, a spoon blank, the bowl blank, ivory carving soap, a soap dome, jeweler's wax, layered wax and a chocolate block.
- **Diced cubes scatter** (`src/dice.js`).
  - Every cube detaches at once and tumbles, bounces and slides, with corner contact on the board, cube-vs-cube collisions on a hashed grid, and sleeping.
  - The material sets the feel: soap slides, jelly bounces and jiggles, meat tumbles, kinetic sand crumbles into grains, ice and glass skate.
  - The blade shoves cubes out of its way. Small cubes fly further, and impacts make material-matched sounds.
- **Glass & ice**: glass has its own sound (scratch, shatter, tinkle shower) and glass shards. Squishing glass shatters it into many real pieces.
- **Smooth on phones**:
  - Resolution adapts automatically from measured frame time, and shadows switch off if a phone still can't keep up.
  - When the blade falls behind a fast swipe it takes longer steps, and on release it catches up to where your finger ended, so fast flicks always cut through.
- **Sound variety**: object-size pitch, blade whoosh through the air, landing thuds when pieces hit the board, cubes pattering onto the pile, a continuous wet or crumbly squish, splat and shatter sounds, and a camera shake on big moments.
- **Guides**: Lengthwise and Across lock the blade to a straight line along or across the piece's long axis. On release the cut is completed in both directions through the whole piece.
- **Volumetric materials** (`src/materials.js`). Colour comes from the 3D position inside the object (marbling, layers, fruit flesh and seeds, citrus segments, crumb, sand grain …), so every new surface shows the matching inside.
- **Physics** (`vendor/rapier.es.js`). Pieces and curls are Rapier rigid bodies with convex-hull colliders.
- **Audio** (`src/audio.js`). Sound is synthesised from noise grains with a profile per material. It plays while the blade is actually in material, at a rate set by blade speed.

## Honest limitations

- Knife slots go down to the board once the blade has pressed in. For horizontal or depth-limited cuts, use Follow view or the peeler and gouge.
- Curved strokes are cut as chains of short straight sections (within about 4 mm of the path for knives and 8 mm for peelers).
- Curls are generated along the path of the removed strip. They don't collide with the object while still attached to the blade.
- Base shapes are convex: boxes, rounded bars, cylinders, ellipsoids, domes, capsules and wedges. Objects with real holes, like a bagel ring or Swiss-cheese holes, use shading instead of geometry.
- Jelly, slime, clay and other soft materials are rigid bodies. Their wobble is a vertex-shader effect, not a soft-body simulation.
- Cut faces are flat. Fibrous tearing, crumbling and squishing are suggested with particles and sound only.
- Vibration uses the Vibration API, which works on Android Chrome. iPhone Safari has no Vibration API; on iOS 18+ a light tick is tried with the native switch trick. On iPhone, sound needs the silent switch off.
- If WebAssembly can't load, the game falls back to a simple separate-and-rest mode without full physics.

## Files

```
index.html, style.css      UI shell (minimal glass interface, bottom sheets)
src/main.js                UI controller, menus, 3D thumbnails, settings
src/game.js                scene, physics bridge, input, camera, undo, follow-view cuts
src/live.js                live cutting engine: blade path, slots, peeling, curls, material behaviour
src/dice.js                dicer cubes: voxelisation + lightweight pile simulation
src/patterns.js            CPU port of the volumetric material patterns (cube colours)
src/squish.js              squish tool: press deformation, baking, spring-back, cracking, splat
src/geometry.js            convex part kernel: split, caps, connectivity, shape generators
src/materials.js           procedural volumetric shaders (15 patterns)
src/catalog.js             206 object definitions (data only — add objects here)
src/tools.js               tool definitions, 3D knife models, icons
src/audio.js               procedural ASMR sound engine
src/particles.js           instanced shavings / crumbs / juice / sand / ice
```

To add an object, add one `add(...)` line in `src/catalog.js`. Give it a shape, an outer surface, an inner surface, material feel, a sound profile and a particle type.
