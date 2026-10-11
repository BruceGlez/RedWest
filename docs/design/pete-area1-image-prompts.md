# Pete Area 1: image prompt pack for Antigravity

Lane: `design` (advisory), for the `art` lane. Read `pete-area1-art-brief.md` first (specs, layout, budgets). Every prompt below is ready to paste.
Output goes to `art/pete-area1/` (originals) and the owner approves before any 3D work starts.

Rules for every prompt (from `AGENTS.md`, rule 6, and the asset record in `ASSETS.md`): original art only; **no other game's or film's name, character or logo in a prompt;
no real people; no text, letters or numbers in the image; no humans and no animals** (people and creatures are made elsewhere). The Company emblem is an
original made-up "rail and rising sun" symbol, never a real brand.

---

## 0. The three blocks you add to every prompt

Copy these blocks and append them as shown. Keep the wording identical so the whole set looks like one game.

**STYLE** (append to every prompt):
> Stylized hand-painted low-poly game art, chunky toy-like proportions, big readable shapes, soft bevelled edges, visible painted wood grain and faceted rock planes, saturated warm terracotta and
> golden-hour palette with teal, cream and brass accents, clean silhouettes, one strong light from the low west sun, soft long shadows, gentle painterly gradients, storybook adventure game feel,
> not photorealistic, no noisy PBR detail, no harsh black outlines.

**NEGATIVE** (put in the negative-prompt box, or append "Avoid: ..." if there is none):
> text, letters, numbers, watermark, signature, logo, brand, people, humans, faces, hands, skeletons, skulls, bodies, blood, gore, animals, horses, cattle, birds, insects, photorealism, photograph,
> 3D render noise, lens flare, heavy depth of field blur, fisheye, purple tint, neon colours, UI, border, frame, collage

**GAME CAMERA** (append to every *level* prompt, not to asset sheets):
> viewed from a high, tilted top-down game camera about 35 metres up and 25 metres to the south, looking about 54 degrees down toward the north, the road runs through the centre of the frame, wide 16:9 composition,
> the ground in the foreground and middle clearly visible, nothing tall hiding the road

**Output spec for all images:** 2048 x 1152 (level paintings, 16:9), 2048 x 2048 (sheets and textures), PNG, sRGB. Generate 4 variants per prompt and keep the best two.
Name files exactly as given in each prompt heading (`art/pete-area1/<name>.png`).

---

## 1. Style key (approve this first)

### 1.1 `style_key_a`: the mood of the whole area
> A winding dusty dirt road through a ruined copper-mining valley at golden hour, towering terraced red-orange canyon walls on both sides with banded strata, an abandoned wooden headframe tower in the
> distance, weathered timber miners' shacks along the road, a small campfire glowing beside a hitching rail, cacti and dry scrub, a few wildflowers, long soft shadows, teal-green cloth accents and brass lanterns,
> sense of a long journey and a story of people driven out, hopeful and adventurous rather than grim. Wide establishing shot, slightly high angle. + STYLE

### 1.2 `style_key_b`: palette and material swatches
> A flat design sheet of material swatches and colour chips for a stylized desert mining valley game: terracotta cliff rock (dark, base, light, rim-lit), packed dirt road, weathered wood (light and dark),
> grey stone, dark iron, canvas cloth in cream and Company red, brass, cactus green, scrub tan, red and yellow wildflowers, glowing lantern orange. Each swatch is a small painted tile showing its surface
> (rock facets, wood grain, canvas weave, dirt with gravel). Neatly arranged on a warm neutral background in a grid. No text. + STYLE

### 1.3 `style_key_c`: the Company emblem and signs (pictograms only)
> A design sheet of eight simple original sign pictograms painted on weathered boards and tin plates for a mining company: a pickaxe, a rail track, a wagon wheel, a padlock and chain, a five-point star,
> an arrow, a sun rising over two rails (the company emblem, red and cream, bold and simple), and a no-entry bar. Each on its own small board, front view, flat, lit from the west. No letters or numbers. + STYLE

---

## 2. Level concept paintings (one per place, the composition for modelling)

Each prompt describes the **landmark, the story props and the colour accent** from the brief, section 6. Generate with GAME CAMERA appended. Then generate the `_wide` version for the hero view.

### 2.1 `lvl_trailhead` (and `lvl_trailhead_wide`)
> The Trailhead: a broad packed-sand clearing at the start of a long road. A tall wooden trailhead gate with a hanging brass lantern and a signboard with a pickaxe and rail pictogram stands over the road. A hitching
> rail beside a stone-ringed campfire with a bedroll and a dented coffee pot, a handcart tipped on its side spilling ore, a notice board with nailed papers, a telegraph pole with sagging wire running down the road.
> Soft teal and cream cloth accents. Behind it a stepped red mesa catches the sun. Calm and welcoming, grass tufts and a few red and yellow wildflowers. + STYLE + GAME CAMERA

### 2.2 `lvl_claims`
> The Abandoned Claims: a wide trampled-dirt road lined with four sagging timber miners' shacks with broken doors and tilted porches, smashed wooden sluice boxes and flume troughs, wheelbarrows, a pickaxe stuck
> in a stump, a washtub, a line of grey tattered laundry, a tilted outhouse, nailed eviction notices with a red Company stamp symbol. Grey-red tailings heaps along the edges. A tall wooden A-frame mine headframe tower
> with a hoist wheel rises above the cliffs on the north side. Bleached grey-brown wood and mustard accents. + STYLE + GAME CAMERA

### 2.3 `lvl_flume`
> The Flume Bridge: the dirt road crosses a deep dry gully on a long wide plank bridge with rope-and-post rails, a brass lantern at each end, a few broken planks. Under the bridge a cracked mud gully with a rusted ore
> cart, a dry waterwheel and mossy stones in cool blue-violet shade. In the far distance a tall wooden aqueduct on trestles crosses the valley. A boulder-screened cave mouth with a rope ladder is half hidden in the north wall.
> The coolest, shadiest place in the valley. + STYLE + GAME CAMERA

### 2.4 `lvl_hairpin`
> The Hairpin: the road bends sharply back on itself around a tall balanced-rock pillar, curved wheel ruts follow the bend, two torn canvas tents, a stone fire ring with a kettle, a barrel of rainwater with a ladle, a
> wooden warning sign on a post. A high rim above where watchers once stood. Long view back along the straight road below. Dusty violet shadows and orange rock. + STYLE + GAME CAMERA

### 2.5 `lvl_miners_camp`
> The Miners' Camp: the busiest and richest place. A circular cobbled camp floor around a worn central ring. A two-storey foreman's cabin with a porch and a red-and-cream striped awning at the corner, a tall tin-capped
> water tower behind it, a long mess table and benches under a canopy, an empty chuck wagon, barrels, a dinner bell on a post, lantern poles around the circle, a Company notice board with the rail-and-sun emblem, a chained crate
> stamped with the emblem. A little alcove behind the cabin shows a desk, a lamp, an open safe and a rolled map with a paper ledger book on the desk lit by a warm shaft of light. Warm red cloth and lantern gold. + STYLE + GAME CAMERA

### 2.6 `lvl_pass`
> Boulder Pass: a cramped, heavy choke point. The road squeezes between towering grey-orange rock under a natural stone arch, a timber mine-style arch of two posts and a beam just before it, a fresh landslide of boulders
> spilling to the road edges, a short broken rail track ending at a boarded-up mine tunnel mouth with a Company emblem plate, a rusted ore cart on its side, stacks of red dynamite crates with a stick pictogram stencilled on them,
> a rope bridge far overhead. A sliver of golden light slants through the arch. Grey stone and burnt orange. + STYLE + GAME CAMERA

### 2.7 `lvl_gate`
> The Company Gate: an ordered, stern end of the road. A great gate with two stout posts, a heavy beam, two double doors and a red banner with the rail-and-rising-sun emblem, brass lanterns, a watchtower with a roof
> on each side, a palisade of sharpened logs reaching to the cliff walls. Company wagons stacked with crates, tidy red-and-cream painted barrier posts, wooden barricades, a guard shack with a stove chimney, piles of rail ties,
> freight crates stamped with the emblem, a signboard with a padlock-and-chain pictogram, a campfire in front of it all. Beyond the gate a sheer rock face and drifting smoke. Company red and teal. + STYLE + GAME CAMERA

### 2.8 Side paths

**`lvl_stash`**: *Smuggler's Stash.* > A narrow path behind a screen of boulders leads to a carved cave mouth in a red cliff, crates of contraband under tarps, a lantern, a rope ladder up to a rim, a small clearing with two pots. Hidden and a little mysterious. + STYLE + GAME CAMERA

**`lvl_nook`**: *Foreman's Nook.* > A cosy sheltered alcove behind a log cabin: a wooden desk with a lit lantern, an open iron safe, a rolled map, and a bright paper payroll ledger with a red ribbon on the desk, a warm light shaft from above, hanging ivy-free rope and tools on pegs. Easy to find and welcoming. + STYLE + GAME CAMERA

**`lvl_lookout`**: *Lookout Hill.* > A switchbacked path climbs a rocky slope to a rim with a wooden lookout platform and a spyglass on a post, wooden steps, a few crates and clay pots, wildflowers, and a breathtaking view across the whole valley with the road winding far below. + STYLE + GAME CAMERA

### 2.9 `lvl_horizon_ring`: the sense of scale
> The far edge of the valley seen from the road: a ring of distant layered mesas and mountain silhouettes in stepped atmospheric blue-violet and orange, a rail trestle crossing a far gap, tall Company foundry stacks with
> thin smoke columns on the skyline, a water tower, a windmill on a far ridge. Very large, quiet, lots of sky with the sunset gradient. + STYLE

---

## 3. Route map

### 3.1 `map_route_topdown`
> A straight-down illustrated map of a winding dirt road through a canyon valley: the road makes three long rows like a switchback (first running east, then west, then east), seven round clearings along it
> (a trailhead camp, a field of shacks, a bridge over a gully, a hairpin bend, a big camp with a cabin, a stone pass with an arch, a walled gate), three short dead-end side paths with small clearings, terraced red cliff bands between
> the rows, a dry river bed, a distant rail line. Stylized hand-painted game map, warm parchment-orange tones, painted icons only (a pickaxe, a campfire, a bridge, a gate), no letters or numbers, no grid. + STYLE

---

## 4. Asset sheets (orthographic turnarounds for modelling)

For every asset sheet use **this frame**, then replace `<ASSET>`:
> Model sheet of a stylized low-poly game prop: <ASSET>. Four views on one plain light-warm-grey background: front, back, left side and a three-quarter view from above, plus a top-down plan view, all the same
> scale, neatly aligned, no perspective distortion in the straight views, evenly lit, hand-painted textures visible. No text, no ground clutter, no characters, no animals. + STYLE
Generate at 2048 x 2048. File name `asset_<id>.png` (ids from the brief, section 7).

### 4.1 Hero buildings and structures
| File | `<ASSET>` text |
|---|---|
| `asset_B01` | a wooden trailhead gate: two thick posts, a crossbeam, a hanging brass lantern, a signboard with a pickaxe and rail pictogram, 9 m wide and 6 m tall |
| `asset_B02` (3 sheets: a, b, c) | a sagging timber miner's shack with a rusty tin or shingle roof, tilted porch, broken door, boarded window, 6 x 5 m, variant (a) leaning left, (b) with a lean-to, (c) with a stone chimney |
| `asset_B03` | a tall timber A-frame mine headframe tower with a hoist wheel, rope, a small hut at the base, 14 m tall |
| `asset_B04` | a long wide plank bridge with rope-and-post rails, thick timber stringers and trestle legs, a few broken planks, a lantern post at each end, 11 m wide and 40 m long |
| `asset_B05` | a tall wooden aqueduct (flume) on trestle legs, long and straight, 14 m high, shown as a long silhouette |
| `asset_B06` | a two-storey wooden foreman's cabin with a porch, red-and-cream striped awning, shutters, a stone chimney, an outdoor stair, a small back alcove, 9 x 8 x 8 m |
| `asset_B07` | a wooden water tower on stilts with a tin conical cap, ladder and a pipe, 18 m tall |
| `asset_B08` (3 sheets) | a canvas tent: (a) A-frame cream, (b) torn and patched, (c) lean-to with a red Company stripe; 4 x 4.5 x 2.8 m, with poles, ropes and pegs |
| `asset_B09` | a boarded-up mine tunnel mouth (adit) with timber frame, planks nailed across, a tin Company emblem plate (rail and rising sun), 6 m wide |
| `asset_B10` | a timber mine-style arch of two posts and a heavy beam with cross braces, 24 m wide and 7 m tall |
| `asset_B11` | a long rope-and-plank suspension bridge, 30 m, sagging |
| `asset_B12` | a great Company gate: two stout 8 m posts with iron bands, a heavy beam, a red banner with the rail-and-rising-sun emblem, brass lanterns, and two separate double doors (shown closed and shown open) |
| `asset_B13` | a wooden watchtower with a roofed platform, ladder and railing, 11 m tall |
| `asset_B14` (4 variants on one sheet) | a palisade section of sharpened logs lashed together, 3.4 m wide and 6 m tall, four slightly different tops |
| `asset_B15` | a small guard shack with a stove chimney, shuttered window, a Company red stripe, 5 x 4 x 3.2 m |
| `asset_B16` | a lookout platform on posts with steps, railing and a spyglass on a post, 5 x 5 x 8 m |
| `asset_B17` | a carved cave mouth in red rock with a timber lintel, a rope ladder hanging nearby, 7 m wide |
| `asset_B18` | a tilted wooden outhouse with a moon-free door, 1.6 x 1.6 x 2.6 m |
| `asset_B19` | a small foreman's office set: desk, lantern, open iron safe, rolled map, chair, a hanging coat-free peg rack |

### 4.2 Props
| File | `<ASSET>` text |
|---|---|
| `asset_P01` | a chunky wooden freight crate with a separate hinged lid shown closed, half open, and splintered; metal corner straps; 1 m; also a variant stamped with a red rail-and-sun emblem |
| `asset_P02` | a clay pot, whole, with a painted band, and a set of six broken clay shards of it, 0.9 m |
| `asset_P03` | a campfire: ring of stones, crossed logs, a glowing ember bed (separate), a cone of stylized flame (separate), a thin ash patch, 1.6 m across |
| `asset_P04` | three wooden barrels with iron hoops: plain, open top with a ladle, and tapped with a spigot |
| `asset_P05` | a rusty wheelbarrow, and an upright and a tipped wooden handcart with ore spilling, 2.4 m |
| `asset_P07` | a canvas-topped chuck wagon with a side cabinet and a flap table, no animals, 5 m |
| `asset_P08` | a flat Company freight wagon stacked with stamped crates and a tarp, no animals, 5 m |
| `asset_P09` | a long rough mess table with two benches and a canvas canopy on poles |
| `asset_P10` | broken wooden sluice boxes and flume troughs, four pieces, splintered, 6 m |
| `asset_P11` | six small mine props: a pickaxe stuck in a stump, a shovel, a washtub, a bucket, a lantern post, a stack of lumber |
| `asset_P12` | a hanging brass lantern with a glowing core, and a lantern on a tall post, each shown lit |
| `asset_P13` | six signposts and boards painted with pictograms only: pick, rail, wheel, padlock-and-chain, star, arrow |
| `asset_P14` | an eviction notice board with many nailed papers, a red stamp symbol, and torn corners |
| `asset_P15` | a telegraph pole with crossarms, insulators, and sagging wire |
| `asset_P16` | two crates of red dynamite with a stick pictogram stencilled on the side, one open showing rolled paper sticks |
| `asset_P17` | five small props: tool and lumber stack, rope coils, a stack of grain sacks, a cart wheel, a spare rail tie pile |
| `asset_P18` | a grey tattered laundry line and two wooden drying racks, no clothes shaped like bodies, just cloth sheets |
| `asset_P19` | a bedroll, a dented coffee pot, and tin cups on a flat stone |
| `asset_P20` | two hitching rails of rough timber with iron rings |
| `asset_P21` | three clue props on little pedestals: a bright paper payroll book with a red ribbon on a small crate, an open claim ledger on a stone slab, and a brass key with a glow |
| `asset_P22` | three Company banners and emblem plates: red cloth with a cream rail-and-rising-sun emblem, a tin plate version, and a small flag version |
| `asset_P23` | log and barbed-wire barriers with red-and-cream painted posts, four kinds |
| `asset_P24` | three canvas tarp bundles tied with rope over crates (contraband), no labels |
| `asset_P26` | a rope ladder with wooden rungs, hanging, and a coil of rope |

### 4.3 Foliage and scatter
| File | `<ASSET>` text |
|---|---|
| `asset_F01` | four saguaro-style cacti with 1 to 3 arms, one with a red flower on top, chunky and rounded, 2 to 5 m |
| `asset_F02` | three small cacti: a barrel cactus, a prickly pear with yellow flowers, and a cluster |
| `asset_F03` | agave and yucca plants, three shapes |
| `asset_F04` | three twisted dead trees with bleached branches, 3 to 7 m |
| `asset_F05` | four scrub and sage bushes, rounded and tan-green |
| `asset_F06` | three clumps of dry grass tufts, flat card style |
| `asset_F07` | two wildflower patches, red and yellow, low and flat |
| `asset_F08` | two mesquite trees with flat canopies, 5 m |
| `asset_F09` | five rock clusters, small, chunky and faceted |

### 4.4 Cliffs and terrain kit
Use the same frame but add: *"modular pieces designed to snap together with matching tops and sides, shown from the front, the side and the top"*.
| File | `<ASSET>` text |
|---|---|
| `asset_T02` | ten terraced red-orange canyon cliff blocks with banded strata, rim-lit tops and a few rock pillars, from 8 to 20 m wide and 3 to 40 m tall, stacking pieces |
| `asset_T03` | eight low canyon wall facing pieces, 10 m long, 3 to 9 m tall, with small ledges and bevelled shelves, tileable end to end |
| `asset_T04` | five tall flat-topped mesas 30 to 60 m wide, banded colours; one with a natural stone arch |
| `asset_T05` | three balanced-rock pillars (hoodoos) 10 to 16 m tall |
| `asset_T06` | eight boulders from 1 to 4 m, chunky and faceted, including a landslide pile |
| `asset_T07` | a dry gully with cracked mud floor, steep terraced sides, and an old rusted ore cart half buried |
| `asset_T08` | rim terraces and shelves at three heights with scrub on top |
| `asset_T09` | six distant mesa and mountain silhouettes with flat banded colour |

---

## 5. Texture tiles (for the hand-painted atlases)

All 1024 x 1024 (ground 2048), seamless, **flat top-down/straight-on lighting with no baked shadows or highlights**, no objects, no text. File `tex_<name>.png`. Append STYLE (without the camera words).

| File | Prompt |
|---|---|
| `tex_rock_a` | seamless texture of terracotta canyon rock: vertical banded strata in dark, base and light orange-red, chunky faceted planes, gentle painted gradients |
| `tex_rock_b` | seamless texture of grey-orange rough stone with cracks and lichen-free faceting, for boulders and pass walls |
| `tex_wood_light` | seamless texture of weathered light timber planks with painted grain, nail heads, and cracks |
| `tex_wood_dark` | seamless texture of dark old timber boards with a worn edge and darker grain |
| `tex_metal_iron` | seamless texture of dark iron plate with rivet rows, light rust at the edges |
| `tex_canvas` | seamless texture of cream canvas cloth with a soft weave and a few patches; and a second one in Company red |
| `tex_dirt_road` | seamless packed dirt road texture with two wheel ruts, light gravel and worn centre, painted style |
| `tex_gravel` | seamless texture of grey-red gravel with scattered chunky pebbles |
| `tex_mud_cracked` | seamless texture of cracked dry mud with polygon cracks, for the gully floor |
| `tex_cobble_planks` | seamless texture, left half rounded cobblestones, right half rough wooden planks, split vertically (for the camp floor and the bridge approach) |
| `tex_sand_ground` | 2048 seamless sand and clay ground texture with faint cracks, scrub tan flecks and tiny pebbles, warm orange |
| `tex_foliage` | a flat atlas sheet in a 4 x 4 grid of foliage colour swatches (cactus green with a highlight, sage, dry grass, flowers in red and yellow) painted with soft shapes, for vertex-coloured foliage |
| `tex_cloth_glow` | a small atlas of emissive swatches: lantern glow orange, ember red, flame yellow, warm window light |

---

## 6. Sky and atmosphere

### 6.1 `sky_pete`: the sunset sky
> A wide panoramic stylized sunset sky for a canyon valley: top deep sky blue, a smooth band of coral orange, a hot orange glow near the horizon, and a pale gold line at the horizon, with a few soft long streaky clouds
> lit pink-orange from below. No sun disc, no ground, no text. 2048 x 1024, seamless left and right.

### 6.2 `atmos_smoke_cards`
> Four soft stylized smoke column sprites on a transparent-looking plain background: a thin grey-brown industrial stack plume, a soft campfire plume, a wider dust cloud, and a faint haze bank, painted, no hard outlines.

### 6.3 `atmos_light_shafts`
> Two soft golden shafts of sunlight as flat painted cards on a plain dark background: a narrow beam through a stone arch with floating dust, and a wide warm shaft from above. Stylized, soft edges.

---

## 7. Review and iteration prompts

Use these to correct a result without changing the style:
- **Too realistic:** "Same image, but simplify to stylized hand-painted low-poly: bigger chunkier shapes, flatter faceted rock, painted wood grain, reduce fine noise and photographic detail."
- **Too dark or too cool:** "Same image with a warmer golden-hour light from the low west sun, lighter shadows tinted violet, brighter road so it reads clearly from above."
- **Road not readable:** "Same image, but make the road lighter and more worn at the centre with clear wheel ruts, darker edges, and keep the area beside the road clear of tall objects."
- **Walls hide the road:** "Same image, but lower the rock walls on the near (south) side of the road to about a third of their height, keep tall cliffs only on the far side."
- **Too generic:** "Same place, but add distinctive story props and a tall landmark that makes it unmistakable: <landmark from the brief>; vary the rock shapes and add terrace layers at three heights."
- **Human or animal appeared:** re-run with "empty of any people, figures, statues of people, animals or footprints of animals".
- **Text appeared:** re-run with "all signs and papers show only simple pictogram shapes, no writing".

## 8. What to hand back

For each prompt group send the owner: the two best images per prompt, their filenames, and a one-line note on anything the images disagree on with the brief
(for example a prop that cannot be built within the triangle budget). Do not start modelling until the owner approves section 1 (style key) and the Trailhead and Miners' Camp
concept paintings.
