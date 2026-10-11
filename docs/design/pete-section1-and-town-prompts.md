# Pete Section 1 (rebuild) and Lantern Rock town: prompts for Antigravity

Lane: `design` (advisory), for the `art` lane. Replaces the "Place by place" detail of `pete-area1-art-brief.md` for the first section, and adds the town and the road out of it.
Nothing here changes game code. It is a brief and prompts only; the game side (collision, hiding, the road trigger, the loading screen) is listed in section 5 as decisions for the owner.

Words used: **Area 1** is the whole Claims Road (7 places, 1,305 m). **Section 1** is its first stretch, about **420 m**: the Trailhead, the Abandoned Claims and the Flume Bridge,
including the Smuggler's Stash path. That is what is being built now.

---

## 1. Why the first render felt stale (read this before modelling)

Looking at `pete_area1.blend` as it stands:
- The valley is **one flat tan plane with about eight giant box blocks**. Real places read as boxes with no strata, no ledges, no silhouettes.
- There are **about ten tiny props** on a huge floor. Section 1 needs hundreds, in clusters with empty space between them.
- There is **no road**, no worn dirt, no ruts, no edges. Nothing tells the eye where to go.
- Everything is **the same height and the same colour**. No terraces, no gullies, no rims, no distance.
- Nothing is **interactive or hideable**: no cover, no doors, no breakables, no reasons to leave the road.
- It is **one narrow corridor**. The player never chooses a route.

The fix is not more of the same boxes. It is **layers**: a bigger valley with three routes, a lot of cover, real relief around it, and dense, varied dressing that tells a story.

### The quality bar for Section 1 (the render fails review if any line is missing)
| Measure | Target for the 420 m of Section 1 |
|---|---|
| Valley size | about **420 m long x 130 m wide** walkable valley floor, inside a cliff ring about 230 m wide |
| Routes | **3 lanes** (main road, north workings lane, south creek-bed lane) joined by at least 6 crossovers |
| Hiding places | **at least 14** (see section 3), at least one in every 30 m of road |
| Interactables | **at least 24** (see section 3) |
| Distinct set-dressing groups (shack yards, camps, dumps) | at least **16**, no two alike |
| Placed props (everything bigger than a pebble, not foliage) | **450 to 650** |
| Foliage and scatter clusters | **250 to 400** |
| Cliff kit variants in view | at least **10**, nothing repeating within 40 m |
| Relief | at least **3 terrace heights** (4 m, 9 m, 16 m), a gully, two rims, two mesas |
| Landmarks | 4: a headframe tower, a hoodoo, the flume aqueduct, a water tower (far) |
| Triangle budget | still **under 45,000 per 120 m chunk** (Section 1 is about 4 chunks) and 4 materials per chunk |

---

## 2. Section 1 world design (v2)

### 2.1 The valley: three lanes, not one corridor
Game rule that does not change: **everything walkable is at height 0.** Depth comes from the *surroundings*: raised berms, banks, terraces and cliffs around lanes at y = 0.

```
 NORTH  (game -z): tall mesas, rims, the headframe tower, tailings, the hidden cave (Stash)
   ____________________________________________________________________________
  | rim ledge (visual, 9 m up)        terrace (visual, 4 m up)                 |
  |  NORTH LANE (workings): adits, ore bins, tailings, ladders                  |   14 m wide
  |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  |
  |  MAIN ROAD (the layout road): trailhead, claims street, bridge              |   26 m wide
  |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  |
  |  SOUTH LANE (creek bed): boulders, cut banks, culverts, dry waterwheel      |   12 m wide
  |__terrace (visual, 4 m up) ________ low berm ______ rim (visual, 9 m up)____|
 SOUTH  (game +z): low berms and low rock only (the camera looks from here)
```
Crossovers (a gap in the berm, a plank ramp, a culvert you can walk through) join the lanes at least every 60 m. The main road is the **widest, brightest and easiest**; the other lanes are narrower, darker and full of cover and reward.

**Camera reminder (from the brief, section 2):** the camera is high and to the south, so everything on the **south side must stay low (3 to 7 m)**; tall things go north.

Coordinates below are game metres (x east, z south). The main road centre line is in `tools/blender/pete_area1_layout.json`; here is Section 1 sampled every 26 m so you can place things by hand:

| Distance | x | z | Heading (x, z) | What stands here |
|---|---|---|---|---|
| 0 m | -190 | -195 | (0.99, -0.14) | **Trailhead gate**, start |
| 26 m | -162 | -199 | (0.99, -0.14) | Trailhead camp, first campfire at (-173, -192) |
| 52 m | -136 | -202 | (1.00, -0.01) | Leaving the Trailhead, telegraph poles start |
| 78 m | -111 | -200 | (0.99, 0.11) | First shack yard (north side) |
| 104 m | -85 | -196 | (0.98, 0.18) | Claims entrance, eviction boards |
| 131 m | -59 | -192 | (0.98, 0.18) | Sluice-box field |
| 157 m | -34 | -187 | (0.98, 0.21) | Claims street (shacks both sides) |
| 183 m | -8 | -181 | (0.98, 0.19) | **Claims centre**, guard group at (23, -176) |
| 209 m | 17 | -177 | (0.99, 0.14) | Headframe tower base (north cliffs) |
| 235 m | 43 | -174 | (0.99, 0.11) | Tailings and ore-bin yard |
| 261 m | 69 | -172 | (1.00, 0.02) | Washing station, long view east |
| 287 m | 95 | -174 | (0.98, -0.20) | Road dips toward the flume |
| 313 m | 120 | -180 | (0.98, -0.22) | **Smuggler's Stash path leaves here** (north), see 3.4 |
| 339 m | 146 | -181 | (0.97, 0.25) | Flume approach, trestles on the skyline |
| 365 m | 169 | -170 | (0.79, 0.61) | **Flume Bridge** starts, narrow camera |
| 392 m | 184 | -149 | (0.38, 0.92) | Bridge middle, ambush at (187, -135) |
| 418 m | 189 | -123 | (-0.02, 1.00) | Bridge end, Section 1 ends and the road turns south |

The Smuggler's Stash path (11 m wide): (173,-166), (181,-168), (187,-171), (193,-175), (197,-181), (201,-187), clearing at **(204, -194)**, radius 13.

### 2.2 The six "scenes" along Section 1
Think of Section 1 as six scenes, each with its own look, so the walk has rhythm:

| # | Scene | Distance | Look and mood |
|---|---|---|---|
| S1 | **The Trailhead** | 0 to 60 m | Calm, welcoming. Soft green and teal, wildflowers, a gate, a campfire. Wide clearing. |
| S2 | **Shack Row** | 60 to 140 m | Sagging miners' homes and their yards. Laundry, gardens gone dry, little fences, kids' things left behind (a hoop, a wooden horse toy on wheels, no people). Warm and sad. |
| S3 | **The Sluice Field** | 140 to 215 m | Broken sluice boxes in rows, tailings heaps, mud channels, wooden troughs, a washing station. Grey-brown and mustard. First guards. |
| S4 | **The Headframe** | 215 to 275 m | Heavy industry: the headframe tower, ore bins, an ore-cart track, a boarded adit. Iron and rust. Big vertical landmark. |
| S5 | **Tailings Wash** | 275 to 345 m | The road dips into a broad dry wash with boulders, cut banks and the south lane's creek bed at its widest. Cooler colour. The Stash path leaves here. |
| S6 | **The Flume Bridge** | 345 to 420 m | The plank bridge over the deep dry gully, a distant aqueduct on trestles. The coolest, shadiest place; narrow, tense. |

---

## 3. Hiding places and interactables (this is what makes it feel alive)

Everything in this section is **a marker (an Empty) in Blender with custom properties**, plus the model for it. The markers are how the game will later hook gameplay onto the art without re-modelling.
Naming: `marker_<type>_<short_id>`. Custom properties on every marker: `rw_type`, `rw_id`, `rw_radius` (metres, the zone the player must be inside), `rw_note` (one line). Types: `hide`, `breakable`, `loot`, `door`, `lever`, `climb`, `lore`, `vantage`, `campfire`, `hazard`.

### 3.1 Hiding places (at least 14)
A *hiding place* is a spot where the marshal can duck out of sight: large enough for a 1.9 m figure to crouch (an interior of about 2 m x 2 m), shaded, with a clear way in and out, and a gap or soft edge so the player can still be seen from above. **Every hiding place must have an entrance on the road side and be visible as a hiding place** (a darker pocket, a different colour, an inviting shape). No hiding place may sit on the centre line of the road.

| ID | Hiding place | Where (distance, side, offset) | Model notes |
|---|---|---|---|
| H01 | Tall dry-grass patch (waist high, 5 x 4 m) | 30 m, north, 14 m | Cross-card grass clumps with a trampled dip in the middle. |
| H02 | Wagon hiding gap | 45 m, south, 11 m | A tipped handcart against a berm, a pocket behind it. |
| H03 | Shack porch crawlspace | 90 m, north, 15 m | Raised porch with an open lattice front and a dark gap under. |
| H04 | Barrel stack alcove | 112 m, south, 12 m | A U-shape of barrels and a tarp roof. |
| H05 | Laundry-line maze | 135 m, north, 14 m | Hanging grey sheets forming a small cloth corridor. |
| H06 | Sluice-box tunnel | 165 m, south, 12 m | A long wooden trough on trestles, walkable inside, open at both ends. |
| H07 | Tailings hollow | 190 m, north, 16 m | A crescent of tailings heaps with a sheltered dip. |
| H08 | Ore-bin shadow | 225 m, north, 13 m | Between two big ore bins, narrow slot. |
| H09 | Culvert pipe | 250 m, south, 12 m | A big wooden-lined culvert under the road, walkable (lane crossover). |
| H10 | Boulder pocket | 285 m, south, 14 m | Boulders forming a fort, one gap in. |
| H11 | Old cart shed | 300 m, north, 16 m | Three-sided shed with a sagging roof. |
| H12 | Mesquite thicket | 330 m, south, 13 m | Dense low bushes, a hollow inside. |
| H13 | Bridge underside ledge | 385 m, side (lower), reached from the south bank | A timber ledge under the bridge's near end, in the cool shade. |
| H14 | Stash screen | 313 m, north, 22 m | The boulder screen that hides the Stash path (a hiding place and a secret). |
| H15 | Rim notch (optional) | 205 m, north, 30 m | A notch on the lowest terrace reached by a switchback, a vantage point as well. |

### 3.2 Interactables (at least 24)
Each is a marker plus a model with the **named nodes** the game will animate.

| ID | Type | Item | Where | Named nodes and behaviour |
|---|---|---|---|---|
| I01 | campfire | Trailhead campfire | (-173, -192) | `fire_flame`, `fire_glow` (as in the brief); the first checkpoint |
| I02 | lore | Trailhead notice board | 14 m, north | `board`; a place the story banner can appear (papers, pictograms only) |
| I03 to I07 | breakable | Five clay pot clusters (3 pots each) | scattered at 40, 105, 150, 230, 305 m | `pot_whole`, `pot_shards` per pot |
| I08 to I13 | loot | Six crates (ammo, health) | 50, 120, 160, 225, 270, 340 m | `crate_body`, `lid` (pivot at the back edge) |
| I14 | breakable | Three wooden fences (breakable sections) | along Shack Row | `fence_whole`, `fence_broken` |
| I15 | door | The foreman's-style shack door (opens inward) | 90 m, north | `door` pivoted at the hinge; the shack interior is a dim 3 x 3 m room with one loot crate (a **hiding place too**) |
| I16 | door | Shed double doors | 300 m, north | `door_l`, `door_r` |
| I17 | lever | A lever that opens the ore-bin yard shortcut gate | 235 m, north | `lever_arm` (rotates 60 degrees), `gate_leaf` (swings); a shortcut from the north lane to the road |
| I18 | climb | A ladder to the lowest terrace | 205 m, north | `ladder`, top at `y = 0` of the terrace platform |
| I19 | climb | A wooden ramp over the berm (crossover) | 150 m, south | A walkable plank ramp at 0 degrees (flat for the game): a bridge over a shallow ditch |
| I20 | hazard | A swinging lantern string over the sluice field (decor with light) | 175 m | `lantern` (swing node) with `glow` |
| I21 | vantage | A wooden lookout over the bridge approach | 335 m, north | A platform that shows the bridge from above (a high look) |
| I22 | loot | The Stash's contraband crates (richer loot) | (204, -194) | `crate_body`, `lid`, in a cave with two lanterns |
| I23 | breakable | Barrel (explodes, splinters) | at 110 m and 255 m | `barrel_whole`, `barrel_broken` |
| I24 | lore | A child's toy left in the road (a wooden horse on wheels) | 100 m | A small prop, a story beat |
| I25 | lore | The flume bridge sign (pictogram: a bucket and a pick) | 360 m | `sign` |
| I26 | campfire | Optional second campfire at the Headframe | 250 m, north, 12 m | As I01; checkpoint for Section 1's far half |

### 3.3 Make each place readable at 35 m up
- **Roofs are the main read.** Vary roof colour (rust, teal tarp, cream canvas, charcoal) and shape (gable, lean-to, flat with a barrel).
- **Light the hiding places**: a darker colour, a soft vertex-colour shadow, a lantern if it is a refuge. A good hiding place says "come here".
- **Break up the ground**: puddle stains, dry mud cracks, gravel fans, wheel ruts, footpaths between shacks, planked walkways.

### 3.4 The Smuggler's Stash path: a real secret
A hidden path behind **H14** (the boulder screen), 11 m wide, curving north-east to a clearing at **(204, -194)** (radius 13) with: a cave mouth in the cliff, a rope ladder up to a rim ledge,
contraband crates under tarps (loot **I22**), a small camp (a coffee pot, a bedroll, an old lantern), two clay pots, a hand-drawn map pinned to the rock (pictograms). It must feel **worth the detour** and slightly
dangerous: dark, with one lit lantern, and cooler colours than the road.

---

## 4. Prompts for Antigravity

Paste these in order. After each step, render the **GameCamera** and **PhoneGameCamera** views and send them to the owner for approval before the next step. Keep the existing
collections and naming (`00_reference` to `90_export`, brief section 3) and the existing file `pete_area1.blend`. Do not model humans or animals.

### Prompt S1-1: relief and valley layout (replaces the flat plane)
> Open `pete_area1.blend`. Delete the current large flat tan plane and the eight box blocks (keep the cameras, sun and reference collections). Build the **Section 1 valley** from the layout in `tools/blender/pete_area1_layout.json` (road centre line) and the table of coordinates in `docs/design/pete-section1-and-town-prompts.md` section 2.1.
> Create: (1) a **walkable valley floor at height 0** about 420 m long and 130 m wide following the road, (2) a **north lane** of 14 m wide and a **south lane** of 12 m wide, parallel to the road, joined by at least 6 crossovers (plank ramps, culvert tunnels, gaps in low berms) so every lane is connected, (3) **low berms** (1 to 2.5 m high) on the south edge and a **terraced rock wall** on the north edge at three heights (4 m, 9 m, 16 m), (4) **two mesas** (25 to 45 m tall) on the north side, one with a natural arch, (5) a **dry gully** under the future bridge, 6 m deep, with cracked mud, (6) a **cliff ring** closing the valley about 115 m either side of the road. **Keep south-facing walls under 7 m near the road** because the game camera looks from the south. Use at least 10 distinct cliff pieces with random rotation, mirroring and scale 0.8 to 1.3. Shade flat, faceted, warm terracotta (palette in the brief). Show the greybox from the GameCamera (35 m up, 25 m south, 54 degrees down) and the PhoneGameCamera and from above, and send three images.

### Prompt S1-2: the road, ground and paths
> Add the **road ribbon** along the centre line (26 m wide, a worn 9 m centre, two wheel ruts, crumbling edges, 0.03 m high), plus **foot paths** between shacks, a **plank walkway** in Shack Row, and the **north and south lane surfaces** (gravel, mud, packed dirt) painted by vertex colour. Use five ground looks: packed dirt, gravel, dry mud, cobble, planks. Add flat **decals**: ruts, footprints (boot soles only, no bodies), puddle stains, scattered pebbles, hay straw. The road must read clearly from the GameCamera: lighter and smoother than the ground, with a darker edge. Keep everything walkable at height 0.

### Prompt S1-3: Scene S1 and S2 (Trailhead and Shack Row, 0 to 140 m)
> Dress the **Trailhead** (0 to 60 m): the trailhead gate with a lantern and a pictogram signboard, the stone-ringed campfire at (-173, -192) with a bedroll, a coffee pot, tin cups, a hitching rail, a tipped handcart spilling ore (a hiding place, **H02**), a notice board (**I02**) with many nailed papers, telegraph poles with sagging wire, wildflower patches, a tall dry-grass patch (**H01**), three cacti, a bleached dead tree.
> Dress **Shack Row** (60 to 140 m): **six distinct miners' shacks** (three variants, plus a lean-to, a bunkhouse and a small chapel-less storehouse) with sagging porches, patched roofs in four colours, little yards with dry gardens, broken fences (**I14**), a **child's toy wooden horse on wheels** (**I24**), laundry lines (**H05**), barrels (**H04**), wheelbarrows, washtubs, one shack with an open door and a dim interior with a crate (**I15**, also a hiding place), one with a crawlspace under a raised porch (**H03**), hanging lanterns, an outhouse, a tilted well with a bucket. Groups must differ: no two yards alike.
> Place the markers listed in the doc section 3 for these scenes, named `marker_<type>_<id>` with `rw_type`, `rw_id`, `rw_radius` and `rw_note`. Keep the road centre line plus 8 m either side free of tall props. Send two GameCamera renders per scene.

### Prompt S1-4: Scene S3 and S4 (Sluice Field and Headframe, 140 to 275 m)
> Build the **Sluice Field** (140 to 215 m): rows of broken sluice boxes and troughs on trestles (one is walkable, **H06**), tailings heaps (**H07**), mud channels and puddles, a washing station, wooden ore bins, a hanging lantern string (**I20**), crate piles (**I08 to I13** where listed), a camp of three canvas tents for the Company, barrels (**I23**), a footbridge ramp over a ditch (**I19**). The guard group is at (23, -176): leave a clear fighting circle of 26 m radius there.
> Build the **Headframe** (215 to 275 m): a tall timber **A-frame mine headframe tower** (14 m) with a hoist wheel and rope against the north cliffs, a boarded **adit** (mine tunnel mouth) with a Company emblem plate (rail and rising sun, original), ore bins (**H08** between two), an **ore-cart track** with an ore cart and a tipped cart, a ladder to the lowest terrace (**I18**), a lever and gate (**I17**), a second campfire (**I26**), stacks of lumber, dynamite crates (red, stick pictogram), a hanging sign, rail ties, a rusted boiler. Add steam cards from a pipe. Heavy, rusty, grey and orange.
> Place markers as in section 3, check the camera, send three renders.

### Prompt S1-5: Scene S5 and S6 (Tailings Wash, the Stash path and the Flume Bridge, 275 to 420 m)
> Build the **Tailings Wash** (275 to 345 m): the road dips into a wide dry wash, with big boulders, cut banks, the **south lane creek bed**, a **culvert pipe** you can walk through (**H09**), a boulder pocket (**H10**), an old cart shed (**H11**, with doors **I16**), a mesquite thicket (**H12**), a wooden lookout (**I21**), clay pots (**I03 to I07** where listed), a dry waterwheel in the creek bed.
> Build the **Smuggler's Stash path** and clearing exactly as section 3.4, including the boulder screen **H14**.
> Build the **Flume Bridge** (345 to 420 m): a long plank bridge, 11 m wide and 40 m long with rope-and-post rails, a lantern at each end, a few broken planks, trestle legs, and the **deep dry gully** under it with a rusted ore cart, a dry waterwheel and cool shaded blue-violet colour. Add a ledge under the near end (**H13**). Add a distant wooden aqueduct on trestles across the valley (**B05**). The deck top must be at height 0 to +0.05 so the game's collision stays flat.
> Place markers, send three renders.

### Prompt S1-6: foliage, lighting and atmosphere
> Add foliage and scatter at the densities in the doc: saguaro and barrel cacti, agave, sage tufts, dry grass cross-cards, wildflower patches (the Trailhead only is flowery; the rest is dry), twisted dead trees, rock clusters. Keep foliage off the road centre and out of the fight circles. Set the light to the Pete late-afternoon sun from the west (long soft shadows to the east), warm hemisphere fill, fog like the game (`#df925c`, near 48 m, far 118 m). Bake **vertex-colour ambient occlusion** only (no baked cast shadows). Add a distant mesa ring and smoke cards beyond the cliff ring so the valley looks larger than the road.

### Prompt S1-7: review, budget and export
> Run the **acceptance checklist** (brief section 9 plus the quality bar in section 1 of this document), render the GameCamera and PhoneGameCamera from 12 points along the road, and send the images with the counts: triangles per chunk, materials, draw calls, props placed, hiding places, interactables. Fix anything over budget by merging meshes and instancing. Then export `chunk_section1_a.glb` to `chunk_section1_d.glb` (about 105 m each, 20 m overlap) with the world origin, and the kit pieces and clue/crate/pot/fire models with the **named nodes** in the brief. Save the source as `tools/blender/pete_area1.blend` and the build notes beside it.

---

## 5. Image prompts for Section 1 (Antigravity image generation)

Use the three blocks (STYLE, NEGATIVE, GAME CAMERA) from `pete-area1-image-prompts.md`, section 0. Save to `art/pete-area1/`.

### `s1_overview_topdown`: the whole Section 1 as a map
> A straight-down illustrated map of a long, wide copper-mining valley with three lanes: a wide light-brown main dirt road in the middle with wheel ruts, a narrow gravel lane along the northern cliffs with ore bins and ladders, a narrow dry creek-bed lane along the south with boulders and a culvert. About a dozen small clearings, a plank bridge over a deep gully at the east end, a hidden side path leading to a cave on the north-east, rows of shacks at the west, a tall wooden headframe tower in the middle against the north cliffs. Terraced red cliffs frame the valley, three shades of rock. Small painted icons only (campfire, crate, pot, door, lever, ladder, a bush for hiding places), no letters or numbers. + STYLE

### `s1_shack_row`
> A row of six different sagging timber miners' shacks along a dirt road, each with a different roof colour (rust, teal tarp, cream canvas, charcoal), tilted porches, little dry gardens, broken picket fences, a tipped handcart, laundry lines of grey sheets forming a cloth corridor, barrels with a tarp roof, a child's wooden toy horse on wheels left in the road, an open shack door with a dim interior, a tilted well, many small details and varied yards, no two alike. Terracotta cliffs behind, golden hour. + STYLE + GAME CAMERA

### `s1_sluice_field`
> Rows of broken wooden sluice boxes on trestles, one long trough big enough to walk inside, grey-red tailings heaps forming a hollow, mud channels and puddles, a washing station, wooden ore bins with a narrow gap between two, a hanging lantern string over the field, stacks of crates and dynamite crates with a stick pictogram, three canvas tents, a plank ramp over a ditch. Mustard and grey-brown, lots of cover and varied heights. + STYLE + GAME CAMERA

### `s1_headframe`
> A tall timber A-frame mine headframe tower with a hoist wheel against terraced red cliffs, a boarded mine tunnel mouth with a rail-and-rising-sun emblem plate, an ore-cart track with an ore cart and a tipped cart, ore bins, a ladder up to a ledge, a lever beside a gate, a rusted boiler with steam, stacks of lumber, a campfire, rust and grey and orange palette. Heavy industry mood. + STYLE + GAME CAMERA

### `s1_tailings_wash`
> A broad dry wash where a dirt road dips between boulders and cut banks, a wooden-lined culvert pipe large enough to walk through under the road, a boulder fort with one gap, a three-sided cart shed with a sagging roof, a dense mesquite thicket, a dry waterwheel in a creek bed, a wooden lookout platform on posts, cooler shadows and violet tints. + STYLE + GAME CAMERA

### `s1_flume_bridge`
> A long wide plank bridge with rope-and-post rails over a deep dry gully, lanterns at both ends, trestle legs, a timber ledge under the near end in cool shade, a rusted ore cart and a dry waterwheel at the bottom of the gully, a distant tall wooden aqueduct on trestles across the valley, cool blue-violet shade, tense and narrow. + STYLE + GAME CAMERA

### `s1_hiding_places_sheet`
> A design sheet of fourteen different hiding places for a stealth-adventure game, each shown as a small painted vignette from a high angle: a waist-high dry-grass patch with a trampled dip, a tipped handcart against a berm, a shack porch crawlspace behind lattice, a barrel U with a tarp roof, a laundry-line cloth maze, a walkable wooden sluice trough, a tailings hollow, a slot between ore bins, a big wooden culvert pipe, a boulder fort, a three-sided cart shed, a mesquite thicket, a ledge under a plank bridge, a boulder screen in front of a hidden path. Each has a darker inviting pocket and a clear entrance. No people, no animals, no text. + STYLE

### `s1_stash`
> A hidden clearing behind a boulder screen: a carved cave mouth in a red cliff, a rope ladder up to a rim ledge, tarp-covered contraband crates, one lit lantern, a small camp with a bedroll and a coffee pot, two clay pots, a hand-drawn map pinned to the rock with pictograms. Cooler colours, dark and a little mysterious, rewarding. + STYLE + GAME CAMERA

---

## 6. Lantern Rock: the town, and the road out to Copper Bit

### 6.1 What exists today (so the prompts fit)
- The town is **Lantern Rock**: a small, spread-out frontier town. Buildings (game metres, spread by 1.5): saloon (-22.5, -21), sheriff (0, -19.5), bank (21, -19.5), jail (-24, 7.5), gunsmith (1.5, 7.5), tailor (24, 7.5), the **Most Wanted depot** (49.5, -22.5), the **arena** (49.5, 9), a general store and undertaker on the west street, a **town station on the south road**. The walkable town spans about x -57 to +60, z -31 to +28.
- Around the town are **districts**, fenced and named until an outlaw is beaten: Calloway Farm (west), Foundry Yard (north-east), Morgan's Channel (south), Whisper Wash, and **Copper Bit (south-west, Dusty Pete)**. Copper Bit's gate is currently a **LOCKED sign naming Dusty Pete**; once Pete is beaten it opens the Copper Bit saloon street (the cooking shift place).
- The town is built from code and a few Blender models (`public/models/sheriff.glb`, `jail.glb`, `gunsmith.glb`). Its look is in `src/townScene.js` (art lane).

### 6.2 The new idea: walk out of town to the hunt
The marshal leaves Lantern Rock to hunt an outlaw. For Dusty Pete: a **road leaves the south-west edge of town** toward Copper Bit, winding 70 to 90 m through open desert and ending at a **trail arch**. Walking through the arch:
- if Pete has **not been hunted yet** (not defeated), a **loading screen** appears, then **Area 1** starts at the Trailhead;
- if Pete has **been beaten**, the arch leads into the **Copper Bit saloon street** (the existing place), with the lanterns lit;
- if a saved pursuit exists, the sign offers **RESUME PURSUIT** (see the brief, framework section 4).
Other outlaws' roads exist as **short chained roads with a COMING SOON sign** until their worlds are built.

### 6.3 What needs to be made (art)
| ID | Asset | Notes |
|---|---|---|
| TW1 | The **Copper Bit trail road**: a ribbon of packed dirt leaving the town, 70 to 90 m long, 14 m wide, gentle S-bend, wheel ruts, edge stones, telegraph poles, a few cacti and boulders, a distant glimpse of the red canyon | Flat at height 0, like everything walkable. Three **state variants** (see below) |
| TW2 | The **trail arch**: two stout posts, a heavy beam, brass lanterns, a Company emblem hanging off one side, a pictogram signboard of a pickaxe. 9 m wide, 7 m tall. States: **locked** (chains, a torn Pete poster), **open and hunting** (chains off, a fresh poster, lanterns lit), **cleared** (flowers, a red bunting, the saloon street beyond) | Separate nodes: `arch_frame`, `chain` (hide/show), `poster`, `lantern_glow`. Marker: `marker_trailgate` with `rw_radius` 6 |
| TW3 | The **Wanted board** at the road start: a big wooden board of pinned posters (pictograms and faces drawn as simple shapes, **no real faces: use faceless silhouettes or stylized icons**) | `board`, `poster_pete` |
| TW4 | **Road kit**: lamp posts, fence sections, mile marker stones, hitching rail, water trough (no animals), signposts with pictograms, crates and barrels | Reusable, 50 to 250 triangles each |
| TW5 | **Town mood pieces**: bunting lines, hanging lanterns for dusk, a clock on the sheriff's office, window glow (emissive), chimney smoke cards | Use the same atlas |
| TW6 | The **town ground**: packed dirt streets, boardwalks, a small plaza, planters, a well, a little fountain-free square | Keep flat at 0 and inside the current walk area |

### 6.4 The look of the town
Warm, friendly, lived-in frontier town at **golden morning** (the hero shot) and **dusk with lit windows** (the night variant). Chunky, hand-painted, readable from above. Each building has a different colour and
roof so the town reads as a place, not a block of boxes: sheriff (teal and cream with a star), bank (stone with brass), saloon (red and wood, swinging doors, a balcony), jail (heavy stone), gunsmith (brick chimney),
tailor (purple trim, a dress-form sign), store (green awning), station (dark green train and platform). Streets have life: laundry, flower boxes, barrels, benches, notice boards, lamps. The town should feel **safe and
welcoming** so that leaving it feels like **a journey into the unknown**.

### 6.5 Image prompts for the town
Use STYLE and NEGATIVE from the earlier doc. For town images use **this camera** instead of GAME CAMERA: *"viewed from a high tilted top-down game camera about 40 metres up and 30 metres to the south, looking about 55 degrees down toward the north"*.

**`town_establishing_morning`**
> A small, spread-out frontier town at golden morning: a wide dirt main street with boardwalks, a teal-and-cream sheriff's office with a star, a stone bank with brass, a red-and-wood saloon with a balcony, a heavy stone jail, a gunsmith with a brick chimney, a tailor with purple trim, a green-awning general store, a train station with a small green train at the far south, bunting and hanging lanterns, flower boxes, barrels, benches, notice boards, a well and a small plaza, long soft shadows, smoke from chimneys. Warm, safe and welcoming. + STYLE + TOWN CAMERA

**`town_establishing_dusk`**: the same town at dusk, windows glowing orange, lanterns lit, deep blue-violet sky with orange horizon. + STYLE + TOWN CAMERA

**`town_street_detail`**
> A close high-angle view of the main street: boardwalk planks, a hitching rail, a water trough, a lamp post, stacks of crates, a notice board with pinned papers, a bench, a barrel of flowers, wheel ruts in packed dirt. Lots of small readable details. + STYLE + TOWN CAMERA

**`town_wanted_board`**
> A large wooden Wanted board at the start of a dirt road out of town, pinned with many posters showing only faceless stylized silhouettes and icons (a hat, a star, a snake, a wolf-free emblem), one big poster for the first outlaw with a hat and a thick moustache silhouette and a bounty sum shown as simple coin symbols, torn corners, a lantern. No faces, no letters, no numbers. + STYLE + TOWN CAMERA

**`town_trail_road_locked`**
> A dirt road leaving a frontier town toward a distant red canyon, an S-bend, telegraph poles, edge stones, cacti, boulders. At the end a wooden trail arch with iron chains across it and a torn poster. Cloudy, a little ominous. + STYLE + TOWN CAMERA

**`town_trail_road_open`**
> The same road and arch, chains taken off, a fresh poster pinned, brass lanterns lit, a distant glimpse of a red canyon with a tall headframe tower, warm light, a sense of adventure beginning. + STYLE + TOWN CAMERA

**`town_trail_road_cleared`**
> The same road and arch after the outlaw is beaten: red bunting, flower pots, lanterns lit, beyond the arch a reopened saloon street with warm windows, a feeling of relief. + STYLE + TOWN CAMERA

**`town_trail_arch_sheet`**
> Model sheet of a stylized low-poly trail arch: two stout posts, a heavy beam, brass lanterns, a hanging emblem plate (rail and rising sun), a pictogram signboard, shown locked (chains), open, and cleared (bunting), front, back, side and top views, 9 m wide and 7 m tall. + STYLE (frame from the model-sheet block in the earlier doc)

### 6.6 Loading screens (three, each 16:9 and 9:16)
Illustrated story panels with **no text** (the game shows words). 2048 x 1152 and 1152 x 2048.

**`load_leave_town`**
> The marshal's long shadow (no figure, only a long shadow on the road) stretching toward a distant red canyon at sunrise, the town's rooftops small behind, a dirt road winding ahead, a lantern, telegraph poles. Hopeful and adventurous, painted, lots of sky. + STYLE

**`load_copper_bit`**
> A wide painted vista of a ruined copper-mining valley at golden hour, a tall headframe tower, rows of sagging shacks, a long road winding through it, smoke on the horizon. Empty of people and animals. Epic and a little sad. + STYLE

**`load_pete`**
> A wooden saloon with a broken piano in the street, the sun setting behind it, a large hat on the piano, a bottle and a single lantern, long shadows, an empty chair. No people. Mysterious. + STYLE

---

## 7. Loading flow (specification for the owner to approve; no code yet)

1. The marshal walks the Copper Bit trail road to the arch (`marker_trailgate`, radius 6).
2. **Not yet hunted:** a prompt reads HUNT DUSTY PETE (confirm / not now). On confirm, the **loading screen** (a story panel, one hint from the Bounty Book, a progress bar tied to the real model loading) shows for at least 1.5 s and at most as long as loading takes.
3. The game builds Area 1 and puts the marshal at the Trailhead, with the existing story comic the first time.
4. **Resume:** if a pursuit save exists, the prompt says RESUME PURSUIT (from the last checkpoint) or START OVER.
5. **Already beaten:** the arch opens to the Copper Bit saloon street as it does today.
6. Leaving (death or victory) returns the marshal to the **town side of the arch**, with the loading screen again for a short hold.
7. Only Area 1 / Section 1 is loaded for now; later sections load behind further gates (a forced checkpoint on each, as built in `src/stages/pete.js`).

### Decisions for the owner
1. **D-S1:** Approve the **three-lane valley** (road, north workings lane, south creek-bed lane, about 130 m wide) as the shape of Section 1. If yes, the game's walkable data (`src/stages/peteArea1.js`) is widened to match **after** the greybox is approved, with the Blender layout as the source (a combat-lane job, with a new `pete_area1_layout.json`).
2. **D-S2:** **Hiding places need a game mechanic that does not exist yet.** Recommended: crouch into a hiding spot (marker radius) and sleeping or patrolling guards lose track of you; a short cooldown; no change to combat power and no pay-to-win (rule 6). The art ships the markers now; the mechanic is a later combat-lane PR.
3. **D-S3:** Interactables (levers, doors, ladders, breakables) are **markers first**; each gets code one at a time. Recommended order: breakables and loot (exist), doors, hiding, levers, climbing.
4. **D-T1:** The **Copper Bit trail road with a trail arch** as the way into the hunt (recommended), replacing the current LOCKED gate sign. Lane: `town` for the trigger and the loading flow; `art` for the road and arch.
5. **D-T2:** One **shared loading screen** system with a different panel per outlaw (recommended) or one per place.
6. **D-T3:** Each other outlaw gets a **chained road and a COMING SOON sign** from the same road kit, so the town shows the future.

## 8. Hand-back checklist for Antigravity
For each step: the renders (GameCamera and PhoneGameCamera), the counts in section 1, a list of anything that disagrees with the brief, and the markers placed (a table: id, type, position, radius).
Do not start the next step until the owner approves the previous one.
