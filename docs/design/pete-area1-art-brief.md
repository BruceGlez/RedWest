# Pete Area 1, "The Claims Road": art and level brief for Antigravity + Blender

Lane: `design` (advisory), written for the `art` lane. Companion: `pete-area1-image-prompts.md` (every image prompt, ready to paste).
Data: `tools/blender/pete_area1_layout.json` (the exact road, places, camps, crates, guard anchors; regenerate with
`node tools/blender/export_area1_layout.mjs`). Design context: `stage-world-framework.md` (sections 2 and 9).

**Who does what.** Antigravity makes the concept images from the prompts, then builds the level and every prop in Blender from the
images and this brief. **No human characters and no animals are modelled here** (those come from Meshy and the existing rigs). Guards,
sleepers and sentries appear in the level only as empty markers (`guardAnchors`); wolves and bandits are spawned by the game.

---

## 1. What we are making

Area 1 is the first of 5 to 8 big areas of Dusty Pete's chapter. The player follows one winding dirt road about **1,305 m** long,
through **seven places** and past **three side paths**, from a trailhead camp to a locked Company gate. It takes 6 to 9 minutes.
It must feel like a real journey through a ruined mining valley, not a corridor of repeating cliff boxes.

Story in one line: the Company (Meridian Land and Rail) drove the miners off Copper Bit's claims; the foreman's payroll book is the proof,
and it opens the gate. Serious, warm, storybook adventure tone; loss is told by what you walk through, never shown (the game has an under-13 mode).
Nothing violent or gory in any prop (no blood, no bodies, no skulls as decoration).

### The look (the style key)
Chunky, toy-like, hand-painted **stylized low poly**: big readable shapes, soft bevels, painted wood grain and rock facets, warm golden-hour
light, saturated terracotta canyon, teal and green accents from cactus, cloth and old copper. Think a storybook adventure game: clean silhouettes,
one strong light direction, gentle gradients, no photorealism, no noise-heavy PBR. It must read from a **high, tilted top-down camera on a phone**.

Palette (these are the game's existing hex values; stay inside them, plus the extras below):

| Role | Hex | Role | Hex |
|---|---|---|---|
| Cliff dark | `#88351c` | Wood | `#6e4a2c` |
| Cliff base | `#a84c2a` | Wood dark | `#48301c` |
| Cliff light | `#c46236` | Stone | `#75716b` |
| Cliff rim light | `#d97846` | Iron | `#36383d` |
| Sand (road dirt) | `#b07a45` | Paper | `#f4eedb` |
| Sand (ground) | `#e0a263` | Brass lantern | `#d4a03e` |
| Cactus green | `#3e8646` | Lantern glow | `#ffaa22` |
| Cactus highlight | `#549e5c` | Flame base / tip | `#f56218` / `#ffcc33` |
| Scrub tan | `#c8a256` | Company red (banners, crates stencil) | `#b33a2a` |
| Flower red / yellow | `#e63946` / `#ffcc00` | Company teal (rails, signs) | `#2f6f73` |

Sky and light (`src/atmosphere.js`, Pete): sky `#3c84c4` to `#df8450` to `#ed6828` to `#f6b468`, fog `#df925c`, warm hemisphere light. Everything is lit
as **late-afternoon sun from the west (low, long soft shadows pointing east)**. Bake only soft ambient occlusion into vertex colours; no baked cast shadows.

---

## 2. Hard rules for the level (these keep it playable)

1. **The walking surface is flat at game height 0.** Collision is 2D. Everything the player and enemies walk on (road, camps, clearings,
   the bridge deck top) must sit at `y = 0` (bridge deck top `y = +0.05` at most). Height drama comes from what is *around* the road, never under the player's feet.
2. **Stay inside the walkable mask.** The road is 26 m wide, places widen it to the `radius` given in the layout, side paths are 11 m wide ending in
   a 13 m radius clearing. Nothing solid may stand on the walkable area (scatter that the player passes through: grass, pebbles, tufts: is fine and must be
   flat and non-blocking). Props placed on the walkable area are decoration only; the game does not collide with them, so keep them small
   and to the edges (see "kept clear" in section 5).
3. **Walls where the walkable area ends.** Rock, buildings or fences must close every edge of the walkable area so the player cannot see
   an open edge. Walls begin 1 to 3 m beyond the walkable edge.
4. **The camera looks from the south and above.** Camera offset is about `(0, 35, 25)` (desktop) and `(0, 26, 18.5)` (phone), tilted about 54 degrees down,
   and pulls back (x1.3 to x1.6) in wide places. A tall object hides about `0.73 x height` metres of ground *north* of it. Therefore:
   **walls on the south side of the road must stay low (about 3 to 7 m) near the edge;** tall cliffs, mesas and towers go on the **north side** and
   further back (set back 20 m or more, they may reach 25 to 40 m). Where the road runs north to south, treat both sides as medium (4 to 9 m).
5. **Read it from above.** Roofs, rock tops and the road itself are what the camera sees most. Give roofs colour and shape variety; paint the road with edge wear and ruts.
6. **No text baked into textures** (signs may carry pictograms such as a pick, a rail, a wheel, a star; the game shows words as UI).
7. **Original design only.** No logos, no real brands, no other games' props. "Meridian Land and Rail" may appear only as a made-up red rail-and-sun emblem (see 'Company emblem').

---

## 3. Technical specification (applies to every model)

| Item | Spec |
|---|---|
| Units | 1 Blender unit = 1 metre = 1 game unit. Scene unit scale 1.0. |
| Axes in Blender | +Z up, game east = +X, game north = +Y (so game z = -Blender Y). Import layout points as `(x, -z)`. |
| Export | glTF Binary `.glb`, **+Y up** ("Y Up" on), apply modifiers, **Apply Transform on**, no cameras or lights, vertex colours exported, no animation unless stated. After export the game sees x = east, z = south, y = up. |
| Origin of a prop | at the centre of its footprint on the ground (`y = 0`), +Z-forward (front faces game south, +z) unless the asset is symmetric. |
| Origin of a chunk file | the world origin `(0,0,0)`: pieces keep their world position, so a chunk is dropped into the game at the origin and lines up. |
| Scale reference | The marshal is about 1.9 m tall. Door 2.4 m, crate 1.0 m cube, campfire ring 1.6 m, clay pot 0.9 m. |
| Materials | Maximum **4 materials per chunk**, shared across the whole area where possible: `M_rock`, `M_wood_metal`, `M_ground_foliage`, `M_cloth_glow` (emissive for lanterns and fire only). Matte, no metalness (set 0), roughness 0.9. Colour from **vertex colours plus one 1024 hand-painted atlas per material**; no normal maps, no roughness maps. |
| Textures | 1024 x 1024 atlas per material (2048 only for `M_ground_foliage`). Hand-painted look, seamless where tiled, sRGB, saved as `.webp` quality 85 inside the glb. |
| Smooth/flat | Flat-shaded faceted rock and wood (stylized). Smooth shading only on pots, barrels, cactus, round logs. |
| Naming | `kit_<thing>_<variant>` for reusable pieces (`kit_cliff_a`), `prop_<thing>` for single props, `chunk_<place>` for a placed chunk, `marker_<thing>` for empties (never exported as meshes). All lowercase, underscores. |
| UVs | Every mesh unwrapped, no overlapping except mirrored halves, 2 px padding. |
| Collection layout | `00_reference`, `10_terrain`, `20_cliffs`, `30_road`, `40_places`, `50_props`, `60_foliage`, `70_markers`, `90_export`. |

### Budgets
| Thing | Budget |
|---|---|
| Whole area on screen at once (phone) | **under 90,000 triangles and under 130 draw calls** |
| A chunk (one place and its surroundings, about 120 m x 120 m) | under 45,000 triangles, 4 materials, at most 40 draw calls |
| Hero prop (cabin, tower, gate, bridge) | 1,500 to 4,000 triangles |
| Medium prop (shack, cart, tent, wagon) | 300 to 1,200 triangles |
| Small prop (crate, pot, barrel, sign) | 40 to 250 triangles |
| Cliff kit piece | 150 to 600 triangles (many instances) |
| Foliage piece | 30 to 150 triangles |
| Total download for the area | under 12 MB of `.glb` (textures included) |

Merge everything static that shares a material into one mesh per chunk before export (the game needs few draw calls). Keep reusable kit pieces as
**separate small `.glb` files** only if the game will instance them; otherwise bake them into the chunk. Default: bake into chunks.

---

## 4. World layout (from `pete_area1_layout.json`)

Coordinates are game metres; game +x is east and +z is south, so the road starts at the **north-west** and ends at the **south-east**. The walkable
map spans about x -220 to +228 and z -228 to +153 (road centre line x -190 to +190, z -202 to +130), and the game lets the marshal walk to +-235. Ground size 560 m square (one plane at `y = 0`).

```
 north (-z)
  Trailhead(-182,-196) -> Claims(-8,-181) -> Flume Bridge(178,-159)      row 1, heading EAST, about 380 m
        Smuggler's Stash (204,-194): side path leaving near the flume, running north-east
                                                        |  turn (about 110 m)
  Pass(-187,-15) <- Miners' Camp(-16,-73) <- Hairpin(119,-61)             row 2, heading WEST, about 340 m
        Foreman's Nook (-18,-53): side nook just south of the Miners' Camp
     |  turn (about 100 m)
  row 3, heading EAST -> Company Gate place (150,90) -> the gate (190,130)   about 370 m
        Lookout Hill (-10,106): side path running south from row 3
 south (+z)
```

(The three rows are a switchback: east, then west, then east. The rows are 110 to 130 m apart, so the cliff ring between them is a thick band of terrain you
see from the road, 60 to 90 m deep. Use that band for the big scenery: gullies, mesas, a dry river, a rail trestle crossing in the distance, ore tailings. It is **never walkable**.)

### Where each place sits and what it must show

For every place: its **centre**, **clearing radius**, the **camera** the game uses, what it must **look and feel** like, its **landmark** (a tall, distinctive shape seen from far away so the
player always has a goal on the horizon), and its **set dressing density**.

| # | Place (id) | Centre x, z | Clearing r | Camera | Role in the story |
|---|---|---|---|---|---|
| 1 | The Trailhead (`trailhead`) | -182, -196 | 24 | reveal (wide look on arrival) | Safe start. First campfire. Introduces the road and the look. |
| 2 | The Abandoned Claims (`claims`) | -8, -181 | 30 | pull back | Smashed sluice boxes, eviction notices, miners' shacks. First guards. |
| 3 | The Flume Bridge (`flume`) | 178, -159 | 18 | narrow (lean in) | Plank deck over the dry flume. Ambush. Gateway to the Smuggler's Stash. |
| 4 | The Hairpin (`hairpin`) | 119, -61 | 22 | pull back | The road doubles back. Patrol. Campfire. A long view back along row 1. |
| 5 | The Miners' Camp (`miners`) | -16, -73 | 32 | pull back | Biggest camp. Foreman's cabin and the nook with the payroll manifest. Heavy guard. |
| 6 | Boulder Pass (`pass`) | -187, -15 | 24 | reveal | The choke point. Timber arch, landslide boulders, the brute. |
| 7 | The Company Gate (`gate`) | 150, 90 (gate at 190, 130) | 24 | reveal | Palisade and the locked gate. Final guard crowd. Campfire. |

Side paths (11 m wide, ending in a 13 m radius clearing with richer loot):

| Path | Leaves the road at | Clearing | Design |
|---|---|---|---|
| Smuggler's Stash (`smugglers-stash`) | about 28 percent along the road, near the flume | 204, -194 | A hidden cave mouth carved into the north wall, crates of contraband under tarps, a lantern, a rope ladder up to a rim. A reward, tucked behind a screen of boulders so it is easy to miss. |
| Foreman's Nook (`foremans-nook`) | about 50 percent, Miners' Camp | -18, -53 | A little alcove behind the foreman's cabin: a desk, a safe with its door open, a rolled map. The **payroll manifest** (clue prop) lies on the desk. **Required to open the gate.** Must be easy to find and well lit (a lantern and a warm light shaft). |
| Lookout Hill (`lookout-hill`) | about 83 percent, row 3 | -10, 106 | A switchbacked slope to a rim with a wooden lookout platform and a spyglass on a post, a view across the whole valley. Richer loot and a pot cluster. |

### The three scales the level must work at
1. **Moment to moment (the camera, 35 m up):** the road, its edges, props within 20 m. Detail lives here.
2. **A few seconds ahead (the horizon, 60 to 120 m):** a landmark per place, silhouettes against the sky, terrain rhythm (rim, mesa, gully, rim).
3. **The sense of a journey (150 to 400 m):** distant mesas, a rail trestle, the Company's water tower and smoke, the foundry stacks on the far skyline. The game draws a horizon strip
   (`src/horizon.js`); model these as **low-detail billboard-like cutouts or a ring of low-poly mesas beyond the cliff ring**, so you can see the valley is larger than the road.

### Anti-generic checklist (the level fails review if any answer is no)
- Every place has a **different silhouette and a different dominant colour accent** (see section 6).
- No cliff piece repeats within 40 m; use **at least 8 cliff kit variants** with random rotation, mirroring and scale 0.8 to 1.3.
- The road changes character: packed dirt, gravel, plank, rail ties, cobbled camp floor, mud near water. At least 5 road surface looks.
- Each place has **3 distinct story props** that tell what happened there (see section 6), not just crates.
- The road has **elevation rhythm around it**: it runs along the floor of a valley; walls step up in terraces; rims, shelves and gullies are visible. Use at least 3 terrace heights.
- Variation in light: shafts through the arch at Boulder Pass, warm glow at camps, cool shade in the gully under the bridge. (Colour only; the game has one sun.)
- A clear **breadcrumb trail**: the road is lighter than the ground, worn edges, wheel ruts, and each place has a landmark that pulls you toward it.

---

## 5. What stays clear

- The **centre line and 8 m either side of it** carry no standing props (barrels, crates, carts) so combat has room; place them at 9 to 13 m off the centre (they are decoration with no collision).
- **Campfire, crate, pot, clue and guard-anchor positions** in the layout are fixed by the game: put your props *around* them, never on them. A campfire needs 3 m of clear ground.
- Each place keeps a **clear circle of its radius minus 4 m** for fighting.
- At the **gate**, leave a 15 m wide opening on the road; the palisade stands beside it.

---

## 6. Place by place: composition, story props, colour, landmark

Compose each chunk so that it reads as the concept image from the prompt pack (`pete-area1-image-prompts.md`, "Level concept paintings").

### 6.1 The Trailhead  (accent: soft teal and cream cloth)
Landmark: a tall **wooden trailhead gate** with a hanging lantern and a bleached cattle-skull-free signboard (a pictogram of a pick and a rail). Behind it, a stepped red mesa catching the sun.
Story props: a **hitching rail with a bedroll and a battered coffee pot** on a campfire ring, a **handcart tipped on its side** with its load of ore scattered, an **eviction notice board** (papers, no readable text), a **telegraph pole** with sagging wire running down the road.
Surface: sandy road, grass tufts, a few wildflowers. Calm. First campfire at the layout position.

### 6.2 The Abandoned Claims  (accent: bleached grey-brown wood and mustard)
Landmark: a **mine headframe tower** (an A-frame timber hoist with a wheel and a rope), 14 m tall, standing in the north cliff band so it rises above the road.
Story props: **smashed sluice boxes and flume troughs**, a run of **four miners' shacks** with sagging porches and broken doors (use 3 shack variants), **wheelbarrows, picks stuck in a stump, a washtub, hanging laundry gone grey on a line**, a **tilted outhouse**, **nailed eviction notices** with a red Company stamp symbol.
Surface: trampled dirt with puddle stains; tailings piles (grey-red gravel heaps) along the edges.

### 6.3 The Flume Bridge  (accent: cool shade and dark wet wood; the only cool place in the area)
Landmark: the **flume itself**, a long wooden aqueduct on tall trestles running across the valley high above the road (a distant silhouette) plus the **plank bridge** on the road over the dry flume bed.
Story props: the **bridge** (hero prop): 11 m wide, 40 m long deck, rope-and-post rails, a few broken planks (visual only), a lantern at each end; beneath it a **dry gully** 6 m deep with a rusted ore cart, a dry waterwheel, mossy stones. A rope ladder and a **hidden cave mouth** to the north for the Smuggler's Stash path.
Surface: planks on the deck, wet-dark gravel at the ends.

### 6.4 The Hairpin  (accent: dusty violet shadow and orange)
Landmark: a **tall balanced-rock pillar (hoodoo)** on the inside of the turn, plus a **tall lookout rim** where an ambush once watched the road.
Story props: **two torn canvas tents**, a **stone fire ring with a kettle**, a **barrel of rainwater** with a ladle, **trampled grass and cart ruts** that curve with the road, a **wooden warning sign** on a post. Wide view back along the long first row.
Surface: curved ruts, rock outcrop shelves along the inside of the bend.

### 6.5 The Miners' Camp  (accent: rich warm red cloth and lantern gold; the busiest place)
Landmark: the **foreman's cabin**, the best building in the area, two storeys at the corner with a porch, a red-and-white striped awning, a **water tower** with a tin cap behind it (about 18 m tall, north side).
Story props: **long mess table and benches** under a canopy, **a chuck wagon without a driver** (wagon prop, no animals), **barrels, a dinner bell on a post, drying racks, a stack of lumber, a stove with a crooked chimney**, **lanterns on poles** around the circle, a **Company notice board** with the emblem, a **chained crate stencilled with a rail-and-sun emblem**. The **nook** behind the cabin: a desk, a lamp, an open safe, a rolled map; the **payroll manifest** (paper book with a ribbon) sits on the desk, lit by a warm light shaft.
Surface: cobbled camp floor, worn central ring, packed dirt paths.

### 6.6 Boulder Pass  (accent: grey stone and burnt orange; heavy, cramped)
Landmark: a **natural rock arch** at the west end the road passes under, with a **timber mine-style arch** (two posts and a beam; the game also draws one) just before it, and a **fresh landslide** of boulders spilling into the road edges.
Story props: **broken rail track** (a few ties and rails ending at a collapsed tunnel mouth), a **boarded-up mine adit** with a "Company property" emblem plate, **a rusted ore cart on its side**, **dynamite crates** (red, stencilled with a pictogram of a stick, stacked off the road), **a rope bridge** high above the pass.
Surface: gravel and broken stone, boulders at the edges, a sliver of light through the arch.

### 6.7 The Company Gate  (accent: Company red and teal; stern and ordered, a break from the ragged valley)
Landmark: the **gate itself** (hero prop): two stout posts 8 m tall, a heavy beam, two double doors, a red banner with the rail-and-sun emblem, brass lanterns, a **watchtower** on each side with a platform and a roof; a **palisade** of sharpened logs stretching to the cliff walls. Beyond the gate the next area is a rock face and hanging smoke.
Story props: **Company wagons stacked with crates**, **a barrier of logs and barbed wire (tidy, painted red-and-white posts)**, **sandbag-less wooden barricades**, a **guard shack with a stove**, **rail ties piled**, **freight crates stencilled with the emblem**, a **sign board** (pictogram: a locked chain). One **campfire** just before the gate.
The gate model must have **separate left and right door meshes named `gate_door_l` and `gate_door_r`** (the game swings them open) and a **fixed frame named `gate_frame`**. Pivot each door at its hinge.
Surface: planked road, cobbles near the gate, painted lines in Company red.

---

## 7. Asset catalogue (everything to model, non-character)

`Qty` is the number of distinct variants to author (the level will instance and kitbash them). `Tris` is the budget per variant. `Replaces` says which code-built prop it improves (keep the same footprint).

### 7.1 Terrain and cliffs
| ID | Asset | Size (m) | Qty | Tris | Notes |
|---|---|---|---|---|---|
| T01 | Valley ground plane | 560 x 560 | 1 | 4,000 | Flat at `y = 0` under the whole walkable area; gentle painted variation by vertex colour (cracks, scrub tan, red clay). The game also draws its own sand plane; make this one **slightly above** (y +0.02) so it hides it, or lower terrain to `-0.5` beyond the cliff ring so it sinks away. |
| T02 | Cliff band blocks (the ring between and around the rows) | modular, 8 to 20 wide, 3 to 40 tall | 10 | 250 to 600 | Terraced red rock with vertical strata, rim light edge, a few pillars. Kit with matching tops so they stack into terraces. |
| T03 | Wall facing pieces (the face directly along the road edge) | 10 long, 3 to 9 tall | 8 | 150 to 400 | Low-to-medium, varied: bevelled shelves, small ledges, ivy-free. Must tile in a line with random rotation. |
| T04 | Tall mesas (north side and far ring) | 30 to 60 wide, 20 to 45 tall | 5 | 400 to 900 | Flat tops, banded colour, one with a natural arch (Boulder Pass). |
| T05 | Hoodoo / balanced rock | 4 to 8 wide, 10 to 16 tall | 3 | 200 to 400 | Hairpin landmark and scenery. |
| T06 | Boulders (hero and field) | 1 to 4 m | 8 | 40 to 160 | Chunky faceted. Landslide set at Boulder Pass. |
| T07 | Gully and dry river bed | 12 wide strips | 3 | 300 | Carved trench under the bridge and in the cliff band, with cracked mud floor. |
| T08 | Rim terraces and shelves | 15 to 30 wide | 6 | 200 to 500 | Visible shelves 4, 9 and 15 m up, to create elevation rhythm. |
| T09 | Distant mesa ring and mountains | 80 to 300 wide | 6 | 150 to 400 | Low-detail silhouettes beyond the cliff ring, 250 to 450 m out. Flat colour with a banded gradient. |

### 7.2 The road
| ID | Asset | Size | Qty | Tris | Notes |
|---|---|---|---|---|---|
| R01 | Road ribbon along the centre line | 26 m wide (painted ~9 m wide worn centre) | 1 per row | 2,000 | Built from `layout.road`. Slightly raised 0.03 m, painted: worn centre, rut lines, edge crumble, gravel patches. Five surface textures (dirt, gravel, mud, cobble, plank) blended by vertex colour. |
| R02 | Camp floor discs | per place radius | 7 | 400 each | Worn ring-shaped ground plates for each place with cobble or planks; flat. |
| R03 | Rail track pieces | 2.5 m ties, 8 m rail sections | 3 | 60 to 150 | Broken and bent; used at Boulder Pass and the Hairpin. |
| R04 | Wheel ruts and footprints decals | 4 m strips | 6 | 2 each | Flat decals along the road, not geometry. |
| R05 | Puddle and mud patches | 2 to 6 m | 4 | 10 | Flat decals. |
| R06 | Gravel and pebble scatter patches | 3 to 8 m | 5 | 60 | Low flat scatter at edges. |

### 7.3 Buildings and big structures (hero props)
| ID | Asset | Size (m) | Qty | Tris | Place |
|---|---|---|---|---|---|
| B01 | Trailhead gate and signboard | 9 w x 6 h | 1 | 1,200 | trailhead |
| B02 | Miners' shack | 6 x 5 x 3.4 plus roof | 3 variants | 600 | claims, miners (replaces the box shack) |
| B03 | Mine headframe tower | 6 x 6 x 14 | 1 | 2,500 | claims (landmark) |
| B04 | Plank bridge over the dry flume | 11 x 40 | 1 | 2,500 | flume (replaces the box deck; deck top at `y +0.05`) |
| B05 | Flume trestle aqueduct | long, 14 tall | 2 | 2,000 | far silhouettes, flume |
| B06 | Foreman's cabin | 9 x 8 x 8 | 1 | 3,500 | miners (hero) |
| B07 | Water tower | 5 x 5 x 18 | 1 | 1,800 | miners (landmark, north) |
| B08 | Canvas tent | 4 x 4.5 x 2.8 | 3 variants | 250 | hairpin, miners, gate (replaces the box tent) |
| B09 | Mine adit mouth (boarded) | 6 w x 5 h | 1 | 700 | pass |
| B10 | Timber arch | 24 w x 7 h | 1 | 900 | pass (replaces the three-box arch) |
| B11 | Rope bridge | 30 long | 1 | 800 | pass (high, far) |
| B12 | Company gate (frame, `gate_door_l`, `gate_door_r`) | 15 w x 8 h | 1 | 3,500 | gate (replaces `createAreaGate`) |
| B13 | Watchtower | 4 x 4 x 11 | 2 | 1,500 | gate |
| B14 | Palisade section | 3.4 w x 6 h | 4 variants | 120 | gate, nook |
| B15 | Guard shack with stove | 5 x 4 x 3.2 | 1 | 600 | gate |
| B16 | Lookout platform with spyglass post | 5 x 5 x 8 | 1 | 900 | lookout hill |
| B17 | Smuggler's cave mouth and rope ladder | 7 w x 5 h | 1 | 700 | stash |
| B18 | Outhouse | 1.6 x 1.6 x 2.6 | 1 | 120 | claims |
| B19 | Foreman's nook set (desk, safe, map, lamp) | 5 x 4 | 1 | 500 | miners nook |

### 7.4 Props
| ID | Asset | Size (m) | Qty | Tris | Notes |
|---|---|---|---|---|---|
| P01 | Wooden crate (lid opens: `lid` node) | 1.0 cube | 3 variants | 120 | Replaces `createCrateMesh`; the game animates the lid, so author a separate `lid` mesh pivoted at its back edge. Splintered variant for 'opened'. |
| P02 | Clay pot (whole and a 6-shard broken set) | 0.9 tall | 2 | 150 + shards | Replaces the pot; keep a `pot_whole` and a `pot_shards` object. |
| P03 | Campfire (stone ring, logs, ember glow mesh named `fire_glow`, flame cone named `fire_flame`) | 1.6 dia | 1 | 300 | Replaces `createCampfireMesh`; flame and glow are separate meshes so the game can show and hide them. |
| P04 | Barrels | 0.8 dia x 1.0 | 3 (plain, open, tapped) | 120 | |
| P05 | Wheelbarrow | 1.6 x 0.7 x 0.8 | 1 | 200 | |
| P06 | Handcart / ore cart (tipped and upright) | 2.4 x 1.2 x 1.2 | 2 | 300 | Rails optional. |
| P07 | Chuck wagon (no horses) | 5 x 2.2 x 3 | 1 | 1,000 | |
| P08 | Company freight wagon with crates | 5 x 2.2 x 2.6 | 2 | 900 | |
| P09 | Mess table and benches | 5 x 1.6 | 1 | 250 | |
| P10 | Sluice boxes and flume troughs (broken) | 6 x 1.2 | 4 | 150 | |
| P11 | Pickaxe stump, shovel, washtub, bucket, lantern post | small | 6 | 40 to 120 | |
| P12 | Lantern (hanging, with `glow` mesh) and lantern post | 0.5 / 3 tall | 2 | 100 | Glow is emissive; the game animates a sway on the group named `lantern`. |
| P13 | Signposts and boards (pictograms only) | 1 to 3 | 6 | 80 | Pick, rail, wheel, chain-lock, star, arrow. |
| P14 | Eviction notice board (papers, red stamp symbol) | 2 x 1.4 | 1 | 120 | |
| P15 | Telegraph pole with sagging wire | 7 tall | 2 | 100 | |
| P16 | Dynamite crates (red) | 1 cube | 2 | 120 | Stencil: stick pictogram. |
| P17 | Tool and lumber stacks, rope coils, stack of sandbags | small | 5 | 60 to 200 | |
| P18 | Hanging laundry line and drying racks | 5 | 2 | 150 | Grey, tattered. |
| P19 | Bedroll, coffee pot, tin cups | tiny | 3 | 40 | Trailhead. |
| P20 | Hitching rail | 3 long | 2 | 80 | |
| P21 | **Clue props**: payroll manifest (paper book with ribbon on a small crate), claim ledger, brass key | 0.9 | 3 | 150 | The game bobs and removes them when collected; one mesh per clue, named `clue_manifest`, `clue_ledger`, `clue_key`. Manifest must be bright and readable from above. |
| P22 | Company emblem plate and banners (red, rail-and-sun) | 1 to 3 | 3 | 100 | |
| P23 | Barbed wire and log barriers, painted posts | 4 | 4 | 120 | |
| P24 | Supply tarp bundles (Smuggler's Stash) | 1.5 | 3 | 100 | |
| P25 | Spyglass on post | 1.5 tall | 1 | 80 | |
| P26 | Rope ladder and coil | 5 tall | 1 | 150 | |

### 7.5 Foliage and ground scatter
| ID | Asset | Size | Qty | Tris | Notes |
|---|---|---|---|---|---|
| F01 | Saguaro-style cactus (1 to 3 arms) | 2 to 5 m | 4 | 100 | Replaces the two-cylinder cactus; red flower on top for one variant. |
| F02 | Barrel and prickly-pear cactus | 0.5 to 1.5 | 3 | 60 | |
| F03 | Agave and yucca | 1 to 2 | 3 | 80 | |
| F04 | Dead tree, twisted | 3 to 7 | 3 | 150 | |
| F05 | Scrub bush, sage tuft | 0.5 to 1.2 | 4 | 40 | |
| F06 | Dry grass tufts (cross-card clumps) | 0.6 | 3 | 20 | Instanced scatter for edges only. |
| F07 | Wildflower patches (red, yellow) | 1 to 2 m patches | 2 | 40 | Trailhead and Lookout Hill. |
| F08 | Mesquite tree (rare, at the Hairpin and the nook) | 4 to 6 | 2 | 220 | |
| F09 | Rock cluster scatter | 1 to 3 | 5 | 80 | |

### 7.6 Atmosphere and extras
| ID | Asset | Notes |
|---|---|---|
| A01 | Sky gradient dome | One 2048 x 1024 equirectangular strip matching the Pete sky stops; the game currently builds its own, so this is optional. |
| A02 | Distant smoke columns (Company stacks, a camp fire) | Soft sprite cards, 8 to 12 m wide, 40 to 80 m tall, far away. |
| A03 | Dust motes and sun-shaft cards | Two cards for Boulder Pass and the nook. |
| A04 | Glints and a "pull" marker (small dust trail) | The game draws the road trail; optional art for the glints. |

---

## 8. Build order for Antigravity (the day-by-day plan)

1. **Image pass** (use the prompt pack): style key, 7 level concept paintings, top-down map, hero asset turnarounds, texture tiles. Save to `art/pete-area1/` and tell the owner which ones to
   approve before modelling. Do not model before the owner approves the style key and at least the Trailhead and Miners' Camp paintings.
2. **Blender set-up:** new `pete_area1.blend`, metres, collections as in section 3. Import `tools/blender/pete_area1_layout.json`: build the road centre line and the place circles as
   curves/empties on `00_reference` (game `(x, z)` becomes Blender `(x, -z)`). Mark places, campfires, crates, pots, guard anchors and encounters as empties named `marker_<id>`.
3. **Greybox the whole valley first** (blocks only, no detail): ground at `y = 0`, walls where the walkable area ends, terraces, mesas, gullies, the landmark masses. Check from the **game camera**:
   create a camera at height 35 m, 25 m south of the player, tilted 54 degrees, 40 degree FOV (phone portrait also: 26 m high, 18.5 m south). Fly the whole road in camera view and confirm: nothing hides the road
   (south walls low), every edge is closed, every place reads, and the whole route feels long. **Send the greybox renders to the owner for approval.**
4. **Kit pieces:** cliff kit, wall facings, mesas, boulders, trestles. Then each place's hero props and the gate.
5. **Dress each place** with its story props and the foliage scatter, following section 6 and the anti-generic checklist.
6. **Textures and vertex colours:** the hand-painted atlases, vertex-colour AO, palette check.
7. **Export:** one glb per chunk (`chunk_<place>.glb`, each with the world origin and all pieces in position), the reusable kit pieces that the game instances (crate, pot, campfire, clue props, lanterns, gate doors) as
   their own small glbs, plus `gate.glb` with `gate_frame`, `gate_door_l`, `gate_door_r`. Save to `public/models/pete-area1/`.
8. **Verify** with the checklist in section 9, then add the `ASSETS.md` rows (template in section 10).

### Chunks to export (each about 120 m x 120 m, centred on the place)
`chunk_trailhead`, `chunk_claims`, `chunk_flume`, `chunk_hairpin`, `chunk_miners`, `chunk_pass`, `chunk_gate`, `chunk_stash`, `chunk_nook` (inside miners), `chunk_lookout`, plus the
**connecting road stretches** `chunk_road_1` to `chunk_road_6` (the long runs between places: the road ribbon, wall facings, scatter, small scenery) and `chunk_far_ring` (the distant mesas, smoke cards).
Chunks may overlap by 20 m at their edges so the game can stream them with no gaps.

---

## 9. Acceptance checklist

- [ ] Walking surface flat at `y = 0` everywhere in the layout mask; the bridge deck top at most `y = +0.05`.
- [ ] Every edge of the walkable area is closed by rock, building or fence; no open void is visible from the game camera along the whole route.
- [ ] From the game camera, the road is never hidden by a wall on its south side; south walls near the road are 3 to 7 m.
- [ ] Props at the layout points (campfires, crates, pots, clue, gate) sit exactly there and are not buried or floating.
- [ ] Centre line plus 8 m either side has no standing props; each place's fight circle (radius minus 4) is clear.
- [ ] Budgets: under 90,000 tris and under 130 draw calls on screen; each chunk under 45,000 tris and 4 materials; whole area under 12 MB.
- [ ] Palette: colours stay in section 1's table; no pure black or pure white; roofs and rock tops read from above.
- [ ] No text in textures; signs use pictograms; no real brands; the emblem is the original rail-and-sun.
- [ ] No humans, no animals, no skeletons, no blood. Guard positions are markers only.
- [ ] Named nodes exist where the game needs them: `lid` (crate), `fire_glow` and `fire_flame` (campfire), `pot_whole` and `pot_shards`, `lantern` and `glow`, `gate_frame`, `gate_door_l`, `gate_door_r`, `clue_manifest`, `clue_ledger`, `clue_key`.
- [ ] Each of the seven places has its own silhouette, accent colour, landmark and at least three story props (section 6).
- [ ] At least 8 cliff variants, 5 road surface looks, 3 terrace heights; nothing repeats within 40 m.
- [ ] Every asset has an `ASSETS.md` row, and the `.blend` source is saved as `tools/blender/pete_area1.blend` (or the build script is saved beside it, as `make_town_buildings.py` is).

## 10. `ASSETS.md` row template (append at the end of the table)

```
| Pete Area 1 level and props (non-character) | `public/models/pete-area1/*.glb`, concept images `art/pete-area1/` | Concept images generated in Antigravity from `docs/design/pete-area1-image-prompts.md`; 3D modelled in Blender from `tools/blender/pete_area1_layout.json` | Owned (original art) | <date> | N chunk files, N kit files, <tris> triangles at the largest chunk. No humans or animals; guards are spawned by the game. |
```

## 11. Decisions for the owner

1. **D-A1:** Approve the style key and the Trailhead and Miners' Camp concept paintings before any modelling starts (recommended). Lane: `art`.
2. **D-A2:** Replace the current code-built props (crate, pot, campfire, clue props, gate) with the modelled ones, keeping the same footprints and animated node names (recommended; the game's animation code stays the same). Cost: one small `art` PR to load the glbs.
3. **D-A3:** Stream the area as chunk files (recommended: phones) or ship one big glb (simpler, but a heavier first load). A streaming loader is a small separate `art` PR.
4. **D-A4:** Keep the area flat for gameplay (recommended, no engine change) or allow slopes later (needs a ground-height function in the engine; a bigger change in the shared collision code).
