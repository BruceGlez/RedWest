# Pete Area 1, Section 1: the finished, playable version (story, mechanics, powers, build plan)

Lane: `design` (advisory). Nothing here is built until the owner says so. Companions: `stage-world-framework.md` (the engine, powers and camera in general),
`pete-area1-art-brief.md` and `pete-section1-and-town-prompts.md` (the art), `tools/blender/pete_area1_section1_notes.md` (what the art delivers).

**Section 1** is the first stretch of the Claims Road: the Trailhead, the Abandoned Claims (Shack Row, the Sluice Field, the Headframe), the Tailings Wash,
the Smuggler's Stash and the Flume Bridge. In the art it is 420 m; it has 487 props, 14 hiding places, 34 interactables, 2 fight circles and a secret.
The art is done. The game around it is not: this spec says what the player does there, what is new, and the pull requests that build it.

Owner answers that shape this spec (asked 2026-10-11):
1. **Flows into the old road.** Section 1 ends at the bridge and hands over to the existing code-built remainder of Area 1 (the Hairpin onward), so the whole area stays playable.
2. **Found powers are in.** Two elements (Dynamite, Whiskey) and one combo (a fire pool), found in the world.
3. **Story is told by a witness NPC with short dialogue boxes**, plus notices and lore props.
4. **One small PR per lane off `main`**, with the `shared-change` label where a shared file is touched (`AGENTS.md` rules 1, 3, 5).

---

## 0. What the code does today (so the numbers below are real)

- Area 1 exists in the game as data (`src/stages/peteArea1.js`, `src/stages/pete.js`) and a code-built scene (`src/placePeteArea.js`): a spline road of 1,305 units, 7 places, 5 campfires,
  11 crates, 13 pots, 5 camp guards, 7 guard groups, a clue (the manifest) and a gate. The run mode is `src/modes/peteWorld.js`; it wakes a group once when the marshal walks inside its radius.
- **In-run units:** the marshal is **6 units tall** (`CHARACTER_HEIGHT` in `src/playerSystem.js`), enemies about 5.4 (the brute 6.4), the loot crate 1.6 x 1.1 x 1.4, a campfire ring 2.2 wide.
  Speeds: the marshal 15 units/s, bandit 7, wolf 10, gunslinger 5, rifleman 4.5, brute 3.5 (`src/state.js`, `src/enemyTypes.js`). The marshal has 5 hit points, starts with 30 rounds, carries at most 120.
  Weapon ranges 22 to 140 units, bullet speed 58 to 130 (`src/weapons.js`). The camera sits 35 up and 25 back (phone 26 and 18.5), always (`src/gameLoop.js`).
- Combat today: everything has 1 to 3 hit points (the brute 7), the marshal outruns everyone, guards wake once and rush. That is why it feels stale: **no choices, no terrain use, no stealth, no found power.**
- Already built and reusable: sleeping and sentry guards with a three-step alert (idle, suspicious, alerted; `src/placePeteWorld.js`), smashable crates and pots with splinters, finite ammo and health crates,
  campfire checkpoints and a forced checkpoint on entering an area, zone banners with a camera "reveal", per-place camera tags (`reveal`, `pullback`, `narrow`), the comic intro, the loading screen,
  a walk mask built from corridors and discs (`src/stages/roadMask.js`), and the Bounty Book.
- Not built: hiding, doors, levers, ladders, breakable fences, explosive barrels, elements and combos, NPC dialogue, elevation, a GLB scene loader for a stage.

## 1. The scale problem, and the decision it forces first

The art was modelled at 1 unit = 1 m with a 1.9 m marshal (as the art brief says). In the game the marshal is **6 units** tall. Loaded as is, the marshal would be 3.2 times too big for the world:
a shack door is 2.4 high, the marshal 6; a hiding place sized for a 2 m figure is smaller than his hat; the 26-unit road is 4 marshals wide.

**Decision D-SC1 (world scale), needs the owner before any code.**

| Option | What changes | Cost | Result |
|---|---|---|---|
| **A. Scale the world by 3 (recommended)** | The Blender export multiplies everything by 3: chunks, kit pieces, collision grid, marker coordinates, wake and fight radii. Game constants (speeds, ranges, camera) stay. | One export setting plus the data files; a small loader factor. | The marshal is about 2 m against the art, doors fit, hiding spots fit. Section 1 becomes about 1,260 units: 84 s of pure walking at 15 units/s, about 6 to 8 minutes with fights, which matches the 6 to 9 minute area target (the old 1,305-unit area walks in 87 s total, too short). A 35-up camera sees a patch about 45 units wide, which is about 15 m in art terms, so only the road and the nearest dressing are in view. |
| B. Shrink the people | Characters shown 3 times smaller, with speeds, ranges, hit sizes and the camera all rescaled in this area. | Touches combat, AI and camera numbers in shared files. | Larger risk of breaking tuned balance. Not recommended. |

Everything below is written in **game units after the factor of 3** (`u`), with the art metre in brackets where it helps. The road is 78 u wide, the Claims fight circle 78 u, the bridge deck 33 u wide and about 120 u long.
**Handoff note:** the old road remainder stays at the old scale until Sections 2 to 4 replace it, so the handoff is a visible change of scale; it is hidden behind the loading screen and the checkpoint (section 9).

## 2. The loop in one paragraph

You arrive at the Trailhead camp, talk to a survivor, learn the Company wants the foreman's payroll book burned, and follow the road. You can sneak past sleeping guards, hide in barrels and sheets, smash and
loot, open doors and a gate, climb to a ledge for a sniper's view, and find dynamite and whiskey that you combine into a fire pool. You hold the Claims against a guard group, take the Smuggler's Stash if you spotted it,
and cross the Flume Bridge through an ambush from both ends. A campfire waits at the Trailhead and at the Headframe; crossing the bridge gives the forced checkpoint and a short beat that points to the Hairpin.

## 3. Story: beats, words, props

Voice: serious, warm, loss told by what you walk through, never shown (the under-13 mode rule in `src/story.js`). Marshal Flint Reed asks before he shoots (`STORY_BIBLE.md`). Pete's chapter confession is page one: *For rough work, $50.*
The Company is Meridian Land and Rail; its emblem is the rail-and-rising-sun.

| Beat | Where | What happens | Objective line (HUD) |
|---|---|---|---|
| B0 Hook | Trailhead | The existing comic intro; arrive at the campfire (forced checkpoint). | FOLLOW THE CLAIMS ROAD |
| B1 Witness | Trailhead camp (I01) | A survivor, **Miner Odell**, sits by the fire. Dialogue (3 boxes, under 200 characters a line): who the Company is, that the foreman kept the payroll book, that the guards sleep by the fire and the Claims are held. He gives the player 1 health crate and the first hint: "Watch the shack doors. Some of us left things behind." | FIND THE FOREMAN'S PAYROLL BOOK |
| B2 Notices | Notice board (I02), eviction boards at 146 m and 157 m (art units) | Read-only lore cards (a short line each, no text on the models). The toy (I24) is a one-line card: "A child's pull-toy, left in the road." | (unchanged) |
| B3 Proof of the Claims | Shack row door shack (I15) | The loot crate inside holds a **claim ledger page**, a story item (`clue_ledger`) that fills a Case File line and says the Company stamped the evictions; optional, shown on the Bounty Book. | (unchanged) |
| B4 The Claims fight | Claims circle, Sluice Field | The guard group wakes (section 5). On clearing, Odell's second line over the radio-less banner: "That was the Company's rent crew. The payroll book is on the road ahead." | HEAD FOR THE FLUME |
| B5 The Stash | Optional, behind the boulder screen (H14) | The map on the standing stone (lore card) shows the Company's gate and a note "bring the book"; the rich crates hold Whiskey and a health crate. | (unchanged) |
| B6 Bridge | Flume Bridge | Ambush from both ends (section 5). The bridge sign and lanterns set the scene. | CROSS THE FLUME BRIDGE |
| B7 Turn | Bridge end | One line from a downed rifleman or the bridge sign card: the Company pays by the claim, not by the day. Forced checkpoint, "AREA 1, CONTINUED". | FOLLOW THE ROAD TO THE HAIRPIN |

Story data lives in a new `src/stages/peteSection1.js` (zone banners, objective lines, dialogue). Words are written by the `story` lane (`src/story.js` style); the `ui` lane renders the dialogue box.
Odell's model: an existing townsfolk model as a placeholder, a proper one later (a Meshy model; no human modelling in the Blender lane).

## 4. Mechanics (each is one small PR; data comes from `pete_section1_markers.json`)

Marker types from the art map to mechanics: `hide` to M1, `door` to M2, `lever` and `climb` to M3 and M4, `breakable` to M5, `loot` and `campfire` to the existing systems, `hazard` and `vantage` to M6 and M7.

### M1 Hiding (14 hiding places: H01 to H14)
- **Rule (D-S2):** walk into a hiding marker (radius from the marker, scaled by 3) and press the interact button (or stay still for 0.4 s on touch) to hide. While hidden: guards that have **not** alerted ignore you; guards that
  have alerted lose track after **3 s** if they cannot see you and you do not fire. You can move 40 percent slower inside the marker. Firing from hiding reveals you but the shot is free.
- **Limits:** at most 8 s hidden at a time, then a 4 s cooldown (no infinite camping). Hiding never changes damage, ammo or speed outside it (`AGENTS.md` rule 6).
- **Feedback:** the marshal fades 60 percent and a small "HIDDEN" pip shows; the hiding place's marker glows when the marshal is close.
- **Where it matters:** the sleeper by the Trailhead fire (sneak by the grass H01 and the cart H02), Shack Row (H03 to H05 and the shack interior), the Claims fight (H06 to H08 let you reset a rush), the Wash (H09 to H12 for the riflemen),
  the bridge approach (H14 and H13 to flank).
- **Code:** a `hidden` flag and the marker list in the run mode; the guard sense step reads it (`src/enemySystem.js` already has `senseStep`). Lane `combat`. Tests: every hiding place reachable, hidden player is not targeted, the cooldown holds.

### M2 Doors (I15 the shack door, I16 the shed doors)
- Press interact within 4.5 u: `door` swings 100 degrees on its hinge in 0.4 s and stays open; shed `door_l` and `door_r` swing out. The shack interior (a 5 by 4 room in the art) holds a loot crate (`I08`-style) and the **claim ledger page**.
- A guard that has not alerted does not see into a closed shack; an open door shows the interior to guards.
- **Code:** the interact prompt system already used for crates (`isNearCrate`); add a door registry. Lane `town` (rules) and `art` (animation of the named nodes). Tests: open and closed collision, the interior is reachable.

### M3 Levers and gates (I17, the Headframe yard)
- Interact on the lever: `lever_arm` rotates 60 degrees in 0.3 s and `gate_leaf` swings open; the ore-bin yard shortcut from the north lane to the road is permanently open for the run.
- It is a pure shortcut and a flank route (the bins H08, the track) so it changes how the Headframe is fought, not how strong you are.
- **Code:** a gate registry that edits the walk mask (the mask already combines corridors and discs; add `closedGates`). Lane `combat` or `town`. Tests: closed gate blocks, open gate does not.

### M4 Climbing (I18 the ladder, the Stash rope ladder)
- Interact at the ladder foot: a 1.2 s climb moves the marshal to a **ledge pocket** on the lowest terrace (a flat walkable disc of 18 u radius, rendered 4.3 m (13 u) up). That needs a render-only
  `elevationAt(x, z)` for the player and bullets (collision stays 2D). From the ledge the marshal sees the Sluice Field and may snipe; guards cannot reach the ledge except riflemen who aim at it.
- A second press at the ladder edge climbs down. The Stash rope ladder leads to a rim ledge with a health crate (a reward for the secret).
- **Code:** elevation is new but small (`src/physics.js` walk mask plus a y offset in the player update). It is the riskiest mechanic, so it ships last (PR 14) and the rest does not depend on it.

### M5 Breakables and explosives (I03 to I07 pots, I14 fences, I23 barrels, crates)
- Pots and crates already splinter. Add `fence_whole` to `fence_broken` (one shot or a dash), no loot, a splinter burst.
- **Barrels** (`barrel_whole` to `barrel_broken`): a shot blows the barrel: 1 damage in a 12 u radius, 0.6 s fuse chain to a barrel within 14 u. Whiskey barrels (marked in the art: the Headframe and Shack Row groups) leave a **flammable puddle** (section 6).
- The lantern string (I20) over the Claims road: shoot a lantern to drop it; a dropped lantern ignites a whiskey puddle under it (a combo, section 6) and otherwise just goes dark (guards in the Claims lose their light cone at night variants later).
- Lane `combat`. Tests: radii, chain limit of 3, no friendly damage chain through walls.

### M6 Loot and elements (crates, the Stash, dynamite crates, whiskey barrels)
- The existing finite ammo economy stays (30 start, crates of 15 to 25). Section 1 adds two found **elements** (section 6) and a few more health pickups (the Stash gives 2).
- Dynamite crates (hazard markers at the Headframe, 3 stacked): interact to take **Dynamite x2**; shooting the stack from range blows it for 2 damage in a 24 u radius (a trap for the guards if they stand near, a trap for you if you do).

### M7 Vantage points (I21 the lookout, the Headframe terrace, the Stash rim)
- A vantage gives a 2.6 s camera "reveal" of what lies ahead (the bridge from the lookout) once, plus the first-time banner. No gameplay power.

### M8 Campfires and checkpoints
- Forced checkpoint at the Trailhead start and at the bridge end; activated campfires at the Trailhead (I01) and the Headframe (I26). Resume restores the area, the opened gate, the doors opened and the elements carried; hiding and cooldowns are not saved.
- Lane `combat` (the checkpoint code in `src/checkpoints.js`). Tests: save and resume at each point.

## 5. Enemies and the two fights (the part that is stale)

Today each group wakes once and rushes. Section 1 needs groups that use the ground, the hiding places and each other.

**The Trailhead sleeper (`a1-sleeper-1`, layout position).** A bandit asleep by the trail fire. Wake radius 4.5 m x 3 = 13.5 u. Walk past hidden or slow and he sleeps; shoot him from beyond 20 u and he never wakes the camp.
A shot or a smashed pot within 18 u wakes him ("suspicious" then "alerted", the art already has these states).

**The Claims guards (`a1-claims-guards`, circle 78 u radius, wake 102 u).** Bandit, bandit, wolf, plus three new roles:
- A **sentry** on the Headframe terrace ledge with a rifle (from the ladder you can reach him; from the road he shoots a red line, like the rifleman).
- Two **patrols** that walk the Sluice Field rows between the sluice boxes and tents (they turn at the tents). A patrol that sees you alerts everything within 120 u (the "alarm"); one that does not stays on its route.
- The wolf **flanks along the south lane** (a different route from the road) so it arrives from your side while you handle the bandits.
- The groups are not all awake at once: patrols wake as you pass them, the sentry and the wolf wake on the alarm. That gives three to four distinct moments instead of one rush.

**The Flume ambush (`a1-flume-ambush`, wake 90 u).** Bandit, bandit, gunslinger from the **layout points at the bridge**, plus a second bandit pair that crosses from the far end after 6 s ("closing the bridge").
The planks and ropes are visual; the deck is 33 u wide. Hiding under the bridge (H13) lets you flank: you can come out behind the second pair. The gunslinger holds at 30 u and raises the arm (the existing tell).

**Tuning rules:** the marshal has 5 hit points, so a fight is 6 to 10 enemies total, never more than 5 alive at once (`cap` in `enemyTypes.js` stays). Ammo: crates every 80 to 150 u (the layout's 11 crates scaled by 3), so a careless player runs low.

Lane `combat` for behaviours (patrol, alarm, flank, sniper ledge); data in `peteSection1.js` (`encounters[].roles`). Tests: each role triggers once; alarm radius; a hidden player is not alarmed.

## 6. Powers found in Section 1 (framework section 3, trimmed to two elements and one combo)

| Element | Where it is found | Alone | Held |
|---|---|---|---|
| **Dynamite** | The three-stack at the Headframe (take 2); a lobbed one from any dynamite crate | Throw: 2 damage in a 24 u blast after a 1.4 s fuse | 2 max |
| **Whiskey** | Breaking a whiskey barrel (take 1); the Stash crates (take 2) | Throw: a 20 u puddle for 12 s that slows enemies 40 percent and is flammable | 2 max |

**Combo (the framework's Fire Pool):** hold Whiskey then Dynamite (or throw dynamite into a whiskey puddle): a 28 u fire pool for 6 s that deals 1 damage per second and breaks cover (guards flee it). That is the Headframe's lesson:
the ore-bin yard is full of barrels and tailings, and the Claims guards often stand in the lantern light.

- **Slots and input:** two slots; tap an element in the tray to queue, tap fire to throw (aim assist on, `src/aimAssist.js`). Revolver stays the main weapon; elements are finite and refill only from found items. No money buys them (`AGENTS.md` rule 6).
- **The tutorial is the level:** the Headframe shows the dynamite stack and a whiskey barrel side by side with the campfire (I26) one step away; a banner "WHISKEY AND DYNAMITE MAKE A FIRE POOL" appears once when you hold both.
- **Balance numbers** above are first guesses (`combat` owns them); every element and the combo gets a unit test.
- Lanes: `combat` (state and effects), `ui` (tray, cooldown ring, prompt text), `audio` (a cue each), `art` (throw arc, puddle, fire pool, blast decals).

## 7. Camera

With the world scaled by 3 the existing 35-up camera sees a patch about 45 units (15 m in art terms) wide: workable but tight, and the valley walls are never in view. Recommendation **D-CAM**: keep the existing follow camera as the default and add two stage camera tags:
**chase** (about 27 back, 16 up, 58-degree field of view, looking 27 ahead along the road) for walking, and the existing `pullback` for the fight circles. Stage places already carry a camera tag; the bridge keeps `narrow`.
Reduced-motion turns every vista into a cut. Lane `art` for the director (`src/cameraDirector.js`, one hook in `src/gameLoop.js` as a separate `shared-change` PR).

## 8. HUD, prompts, dialogue

- Objective line (existing slot) from the table in section 3; interact prompts (existing) for door, lever, ladder, hide, crate, campfire, dynamite.
- New dialogue box: speaker name, up to 200 characters, tap to advance, skip button, off in reduced-motion for the typewriter effect. Lane `ui`.
- New element tray under the thumb (two slots plus fire). Lane `ui`.
- A small "alerted" tick on enemies (the art has the states; the HUD adds the pip). Lane `ui`.

## 9. Handoff to the old road and the loading screen

1. At the bridge end the forced checkpoint is saved with `areaIndex` 0 and a new field `section` 1 done.
2. The loading screen (`src/loadingScreen.js`) shows a story panel and a hint, then the run mode starts **the old Area 1 from its flume progress** (fraction about 0.32): same data file with `start` set at the bridge end and the earlier
   encounters, campfires and crates removed. The scene builder (`createAreaEnvironment`) already builds the whole road; only the later part is used.
3. The old remainder is a visible scale change from Section 1 until Sections 2 to 4 replace it. This is accepted and temporary (owner answer 1).
4. `exit` and the manifest rule are unchanged: the manifest still opens the Company Gate at the end.

## 10. Data and loader contract (data first, consumer after: `AGENTS.md` rule 5)

- **Export (art):** `tools/blender/make_pete_section1.py` gains `WORLD_SCALE = 3` applied to chunks, kits, the collision grid, `pete_section1_markers.json` and a new `pete_section1_spawns.json` (encounters, roles, patrol routes).
- **Stage data (town):** `src/stages/peteSection1.js` exports an area in the shape `src/stages/pete.js` documents: `start`, `places`, `story`, `encounters` (with `roles`), `campfires`, `crates`, `pots`, `markers`, `exit`, plus
  `objective`, `dialogue`, `elements`. A validator test checks every marker id is referenced and every beat has a trigger.
- **Scene (art):** `src/placePeteSection1.js` loads `chunk_section1_a` to `d` by progress (build the one you are in and the next, dispose the one two behind), applies the kit pieces from the marker data,
  hooks the named nodes (`lid`, `door`, `lever_arm`, `fire_flame`, `lantern`), and merges per `src/meshMerge.js`. Budgets: under 45k triangles a chunk (measured, 36k to 42k), `node tools/perf.mjs` three runs.
- **Collision (town):** `pete_section1_collision.json` (the 1 m grid and 453 obstacle boxes) feeds the walk mask; the existing mask code adds `blockedCells` and `boxes`.
- **File format:** the chunk files carry no normals (flat shading) and 8-bit vertex colours; the game's loader sets nothing special (three.js reads them). Size: 7.2 MB for Section 1; Draco or Meshopt would cut it
  several times over but needs a decoder in the game (a `shared-change`).

## 11. Pull requests (one lane each, in this order)

Each PR is small, adds tests, and says which lane it waits on. `node tools/lanes.mjs diff --strict` and `npm test` pass before every push.

| # | Lane | PR | Depends on | Done when |
|---|---|---|---|---|
| 0 | art | Add the Section 1 assets (chunks, kits, markers, collision, notes, renders, ASSETS row) | none | files in `main`, `npm test` green |
| 1 | design | This spec | none | merged, owner answers D-SC1 and D-CAM |
| 2 | art | Export at `WORLD_SCALE = 3`; add `pete_section1_spawns.json` | 0, D-SC1 | numbers match section 1 |
| 3 | town | `peteSection1.js` data and validator test | 2 | test green |
| 4 | art | `placePeteSection1.js` loader (static only, no mechanics) and a dev switch | 2, 3 | Section 1 walks in the game, perf budget held |
| 5 | town | Walk mask from the collision file (boxes and cells) | 2 | cannot walk through shacks or off the road |
| 6 | combat | Run mode: Section 1 as area, checkpoints, objective, handoff to the old road | 3, 4, 5 | start, bridge end, resume, handoff work |
| 7 | ui | Dialogue box and the witness (Odell), notice cards | 6 | B1 to B3, B5, B7 show |
| 8 | combat | M1 hiding and the guard sense changes | 6 | tests in section 4 pass |
| 9 | combat | M5 barrels and fences, lantern string, dynamite stack | 6 | radii tests pass |
| 10 | town | M2 doors and M3 lever gate | 6 | shack interior and shortcut work |
| 11 | combat | Guard roles: patrol, alarm, flank, sentry (section 5) | 8 | the Claims fight has distinct moments |
| 12 | combat | Elements: state, Dynamite, Whiskey, the fire pool combo and unit tests | 6 | every combo row has a test |
| 13 | ui | Element tray, prompts, alerted pip | 12 | tray usable with a thumb |
| 14 | art | Camera director (chase tag) and elevation, ladder climb (M4) | 6 | `shared-change` for the camera hook; ledges work |
| 15 | audio | One cue per element, door, lever, hide, alarm | 8 to 12 | all cues in `audioManifest.js` |
| 16 | story | Odell's lines, notices, bridge and Stash text, Case File entry | 7 | copy reviewed |
| 17 | qa | A full-slice smoke test: start, B1 to B7, hide, door, lever, elements, both fights, death and retry, resume, handoff | 6 to 16 | passes in the smoke suite |
| 18 | growth/money | Nothing needed; confirm no sold timers or paid power | all | rule 6 check in the PR description |

Work that is the same lane can be done in parallel by separate agents; the table order is the dependency order.

## 12. Definition of done for Section 1

- A new player completes Trailhead to bridge in 6 to 8 minutes and can name two ways they used the terrain (hide, shortcut, ledge, fire pool).
- Every marker in `pete_section1_markers.json` is bound to a mechanic or a lore card; none is dead art.
- The two fights have at least three distinct moments each, and each of M1 to M8 is used on the way by a player who plays normally.
- Death and retry, resume from either campfire, and the handoff to the old road all work (smoke test 17).
- Frame budget: chunks under 45k triangles, `node tools/perf.mjs` within the stage budget on the phone profile; reduced-motion and the under-13 setting respected.
- `AGENTS.md` rule 6 holds: no paid power, no sold timers, no dark patterns; places never change combat; original names and art.

## 13. Decisions for the owner

1. **D-SC1: world scale.** Scale the Section 1 world by 3 (recommended) or shrink the characters? Everything else waits on this.
2. **D-CAM: camera.** Keep the follow camera and add a low chase tag for walking (recommended), or keep the current camera everywhere.
3. **D-NPC: the witness.** Miner Odell with an existing townsfolk model as a placeholder (recommended), or June Holloway or Ezra Stone as the witness.
4. **D-HIDE: hiding limits.** 8 s with a 4 s cooldown (recommended), or unlimited while in the marker.
5. **D-ELEV: ladders.** Build the render-only elevation (PR 14, recommended) or drop the ladder and keep the lookout as a plain marker.
6. **D-HAND: handoff.** The old road from its flume progress, behind a loading screen (recommended), or end Section 1 on an end card until Section 2 is built.
