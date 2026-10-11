# Big Stages: a Mini Ninjas / Magicka style road for every outlaw

Lane: `design` (advisory). Builds on `dusty-pete-open-world-mvp.md`. Nothing here is built until the owner says so.

## 0. Where we are (the honest baseline)

Dusty Pete's canyon today (`src/modes/peteWorld.js`, `src/peteWorldMap.js`, `src/placePeteWorld.js`):
- One straight trail along z, from -95 to 125 (about 220 units), with scenery on both sides. Walk limit `MAP_SIZE` 140.
- Five guard groups (`ENCOUNTERS`), three clues, four campfires, eleven crates, one boss. Zone banners and a HUD objective.
- Camera is a fixed offset from the marshal, lerped (`cameraOffset()` in `src/gameLoop.js`, line ~675). It never changes.
- Power-ups: none in a stage. Perks (`src/perks.js`) are fixed per character; guns are shop side-grades.
- Every outlaw is still a wave-survival run (`src/modes/road.js`); only Pete has a world.
- Cliffs are decoration, with no collision. A stage is a hard-coded file with hand-typed coordinates.

What the owner wants: a stage that feels like following a road through a world (Mini Ninjas), where you find and combine
powers (Magicka), with Red West flavour, one different world and story per outlaw, and big.

Two things stand in the way and are worth fixing first: stages are hand-built per outlaw, and the camera and the walls
do nothing to tell you where to go. The plan fixes those before it makes anything bigger.

## 1. Design pillars

1. **A road you follow.** Each stage is a chain of *places* joined by a path, not one box. The road bends, climbs and
   forks; the camera and landmarks pull you along it. Optional side paths hold the secrets.
2. **Stage as a story.** Every stage has a start, three to five beats and a showdown. The outlaw's motive (STORY_BIBLE.md)
   is told by what you walk through, not by a wall of text.
3. **Found power, not bought power.** Powers come from the world (shrines, pickups, enemies). Money never buys them
   (`AGENTS.md` rule 6, checked in section 6).
4. **Combine, don't just collect.** Two or three held elements make a Trick Shot. Learning the combinations is the depth.
5. **Data, not code.** A stage is a data file read by one engine. A new outlaw's world is a new file, not a new mode.
6. **Phone first.** Every camera and control choice works with a thumb stick and one button, at about 10 FPS on a weak
   device (the debug panel showed 10 FPS in software rendering; budget accordingly).

## 2. Stage framework (the engine every outlaw shares)

### 2.1 Stage file shape

One file per outlaw, `src/stages/<outlaw-id>.js`, exporting data only:

```
{
  id, outlawId, name, atmosphereId,
  road:    [ { id, kind, points[], width, mood } ],          // the spine, as a spline of points
  places:  [ { id, roadAt, kind, layout, guards, props } ],   // camps, bridges, ruins, gates
  beats:   [ { id, trigger, objective, banner, unlocks } ],   // the story, in order
  powers:  [ { id, at, kind } ],                              // shrines and pickups
  secrets: [ { id, branchFrom, reward } ],
  boss:    { at, arena, phases }
}
```

A new engine module `src/stageRunner.js` reads that and replaces the hand-written `peteWorld.js` logic: wake guards,
fire beats, save checkpoints, spawn the boss. `src/modes/peteWorld.js` becomes a thin mode that loads `pete.js`.
The existing Pete data (`ENCOUNTERS`, `ZONE_STORY`, clues, campfires) maps onto this one-to-one, so migration is mechanical.

**Decision for the owner (D1):** approve the data-driven stage file as the base for all ten outlaws before anyone builds
a second world. Cost: medium, about one PR to define plus one to migrate Pete. Lanes: `town` (data and rules), `combat`.

### 2.2 The road

- Stages are about 600 to 900 units of travel, not 220. Five to seven places on a bending spine, so about 8 to 12 minutes
  for the first run and 5 to 6 on a replay.
- The road is a spline. Props and cliffs are placed **relative to the spline**, so a bend needs no hand-moved scenery.
- Walls are real: a walkable mask (a coarse grid, like `mineMap.js` does for the mine) so the player cannot leave the
  road corridor, and the camera is told the same corridor. This also gives us the secret branches.
- Streaming: build places when the player is within about 150 units and dispose them 250 behind, so a big stage
  stays inside the draw-call budget (a place under about 130, `AGENTS.md` rule 4). Merge static props (`src/meshMerge.js`).
- One forward-leaning "pull": a faint dust trail and a glint on the next landmark, so a player never wonders where to go.

**Decision (D2):** corridor-with-forks (recommended: reads clearly, cheap, phone-safe) versus a true open field with
points of interest. Recommendation: corridor-with-forks. A field costs far more content per minute.

### 2.3 Camera (the Mini Ninjas feel)

Today the camera is one fixed offset. Add a small **camera director** (`src/cameraDirector.js`, new, one hook in
`gameLoop.js`) that picks the offset, pitch, FOV and look-ahead each frame from the stage data:

| Camera | When | Effect |
|---|---|---|
| Follow (default) | Walking the road | Today's offset, with look-ahead along the road tangent so you see where you are going |
| Pull-back | Entering a camp, arena or boss | Wider and higher so the whole fight reads |
| Vista | First time into a place | 2 to 3 second slow pan to the landmark, then control returns (skippable by any input) |
| Boss intro | Boss wakes | Short push-in on the boss with a name card, then back to follow |
| Danger shake | Shockwave, dynamite, big hit | Existing shake, scaled and capped (and off in the under-13 and reduced-motion setting) |
| Narrow | Tight canyon or bridge | Tilts lower and closer for drama |

Rules: the player never loses control for more than about 3 seconds; every cinematic is skippable; the camera never
clips through a cliff (it uses the same walkable mask and eases back); reduced-motion turns vistas into a cut.
Authored per place in the stage file (`camera: 'vista' | 'pullback' | 'narrow'`).

**Decision (D3):** cinematic vistas on first visit only (recommended) or every visit. First visit only keeps replays fast.
Lane: `art` (camera director, scene), `ui` (skip control, reduced-motion).

### 2.4 Story beats

Each stage ends up as about five beats, always the same skeleton so writers can fill it quickly:

1. **Hook:** the comic intro (exists: `comicIntro.js`), one line of objective.
2. **Witness:** someone who saw the outlaw. A friendly NPC gives a clue and a safe campfire.
3. **Proof:** the outlaw's receipt or ledger page (the chapter-one "Ledger" in `STORY_BIBLE.md`, so every stage feeds the
   same larger mystery).
4. **Turn:** a twist that changes how you see the outlaw (Pete is paid, not evil).
5. **Showdown:** the boss, with a phase structure from `combat`.

Serious voice, loss told never shown (the under-13 mode rule in `story.js`). Every outlaw's three story cards and ledger
page already exist; the stage beats unlock them instead of the result screen alone.

**Decision (D4):** an NPC with real dialogue boxes (recommended, one per stage, text under 200 characters per line) or
banners only. Lane: `story` writes, `ui` renders the dialogue box.

## 3. Powers: Magicka style, Red West flavour

### 3.1 The idea

Magicka lets you queue elements and combine them. Red West keeps the same *feel* but uses Western things the player
already understands, and it stays phone-friendly: **three slots, not eight**.

Elements (original names and look; no Magicka assets or names):

| Element | Icon idea | Alone it does |
|---|---|---|
| **Dynamite** | red stick | Short fuse thrown blast |
| **Whiskey** | brown bottle | Wet ground, slows; flammable |
| **Rattle** | snake rattle | Stun and fear in a cone |
| **Dust** | brown cloud | Blinds enemies, hides you for a moment |
| **Storm** | grey cloud | Chain lightning to nearby foes |
| **Lasso** | rope loop | Pull one enemy in or tie a gap |

### 3.2 Combine

Hold up to two elements and tap fire for a **Trick Shot**. Examples (balance numbers are for `combat` to set):

| Combo | Trick Shot |
|---|---|
| Whiskey + Dynamite | Fire pool: burns everything in it (matches Pete's barrels) |
| Dust + Storm | Dust devil: a moving cyclone that drags foes |
| Rattle + Lasso | Snare: ties a group to a post and stuns them |
| Storm + Whiskey | Lightning arc across the wet ground |
| Dynamite + Dust | Smoke bomb: blast and blind |

Same element twice makes a bigger version of it. Each stage's boss is weak to a combo, which the world hints at.

### 3.3 How you get them

- **Shrines** on the road teach one element per stage (a one-time tutorial, with a campfire and a safe space).
- **Element pickups** from crates and breakable props (the pots and crates already exist).
- Elements are a **stage-run resource that refills from pickups**, the same way ammo is: finite, found in the world,
  and (like ammo) the *amount carried* may be extended by a shop upgrade bought with earned in-game money only, never
  real money. The rule "money never buys combat power" is kept by making the shop **cosmetic and convenience only**
  (see section 6); Section 6 flags this as a decision.
- Outlaw characters (`perks.js`) stay as they are: one perk, one drawback.

### 3.4 Phone controls

Left stick moves, one fire button, a two-slot element tray under the thumb: tap an element to queue it, tap fire to cast.
No long chords. Auto-aim assist on casts (`ui` and `combat`).

**Decision (D5):** go with 6 elements and 2 held slots (recommended) or the full Magicka-sized system. Smaller means
fewer than 30 combos to balance and test, and a screen that a thumb can use. Lane: `combat` builds, `ui` builds the tray,
`audio` gives each element its own sound.

## 4. One world per outlaw

Each world has a look (`atmosphere.js` id), a road shape and a hook. Names stay original (`STORY_BIBLE.md` rules); the
owner and `story` decide the final story. This is a starting proposal.

| # | Outlaw | World and road | Signature power learned | Signature set-piece |
|---|---|---|---|---|
| 1 | Dusty Pete | Copper Bit gulch: mine camp, rail spur, saloon street | Whiskey, Dynamite | Charge him into the piano |
| 2 | Rattlesnake Rosa | Whisper Wash: a dry riverbed with salted wells | Rattle | Wolf packs on the dry banks |
| 3 | Deacon Graves | Mission ruins on a hill, switchback road up | Storm | Bell tower sniper nests |
| 4 | The Calloways | Cattle ranch maze of fences and barns | Lasso | Twelve brothers, find the last one |
| 5 | Iron Jack Harlan | Foundry rail yard, a moving train level | Dynamite (big) | Fight along train cars |
| 6 | Mad Mesa Morgan | Badlands mesas with stone bridges | Dust | Narrow bridges, the camera "narrow" mode |
| 7 | Silas Vane | A gun-fighting town at dusk | Lasso + Rattle | Duel street |
| 8 | El Espectro | A ghost town at night, lantern light | Storm | Light and dark switching |
| 9 | Lucky Lou | Riverboat on the water | Whiskey | Card-table arenas |
| 10 | Colonel Crane | Company fort, a gatling gauntlet | All | Final siege |

Only Pete is in the MVP. All others keep the "COMING SOON" lock (`src/progress.js`) until their world ships, so the catalog
never promises what is not there.

## 5. Build plan: small PRs, one lane each

Following `AGENTS.md` rule 5 (data contract first, consumer after) and rule 3 (shared files in small separate PRs).

**Phase A: Foundation (no new look, Pete still plays)**
1. `design`: this spec, with D1 to D5 answered by the owner.
2. `town` data contract: `src/stages/schema.js` and a validator test (every id reachable, every beat has a trigger).
3. `combat`/`town`: `src/stageRunner.js` and Pete migrated to `src/stages/pete.js` with identical behaviour (tests stay green).
4. Shared, own PR with `shared-change` label: one hook in `gameLoop.js` for the camera director.

**Phase B: The road and the camera**
5. `art`: `cameraDirector.js` (follow, look-ahead, pull-back, boss intro), reduced-motion path.
6. `town`: walkable mask for the road corridor, collision for cliffs and bridges (closing the "physical canyon/gate collision" follow-up in `docs/lanes/combat.md`).
7. `art`: spline road builder and place streaming; budgets measured with `node tools/perf.mjs`.
8. `art`: lengthen Pete to about 700 units with bends, one fork and two secrets.

**Phase C: Powers**
9. `combat`: element state (2 slots), Dynamite and Whiskey first, plus the combo table as data with a unit test for every combo.
10. `ui`: element tray, cooldown ring, tutorial prompts.
11. `audio`: one cue per element and combo.
12. `combat`: remaining four elements; shrines in Pete's stage.
13. `combat`: the three-phase Pete boss (spec already in `dusty-pete-open-world-mvp.md`, section 5) using combos as the weakness.

**Phase D: Story and polish**
14. `story`: five beats and an NPC for Pete; ledger pages unlocked by beats.
15. `qa`: a full-stage smoke test (start, every beat, every power, boss, death and retry, resume); frame-time budget on a low-end phone profile.
16. Then stage 2 (Rosa) is a data file plus new art, proving the framework.

Each later outlaw repeats steps like 16: stage data (`town`), look and props (`art`), beats (`story`), balance (`combat`).

## 6. Rule check (`AGENTS.md` rule 6)

- *Money never buys combat power.* Elements and Trick Shots come only from play. The proposed ammo/element capacity upgrade
  must be bought with in-game earnings that only the game awards, never real money, and nothing may be sold for real money
  that changes a fight. **Decision (D6): confirm that carry-capacity upgrades are allowed at all.** If in doubt, remove them
  and keep power purely found.
- *No paid loot boxes, no sold timers, no dark patterns.* None used. Crates are world loot with visible contents.
- *Places never change combat.* A place's decoration does not alter damage; only the stage's enemies, hazards and
  found powers do, and those belong to the stage, not to town buildings.
- *Original art, names and story.* Elements are Western concepts with original icons; no Magicka or Mini Ninjas assets
  or names. Every asset gets a row in `ASSETS.md`.

## 7. Risks

| Risk | Plan |
|---|---|
| Bigger stage hurts frame rate on phones | Streaming places, merged meshes, measure every PR with `tools/perf.mjs`; cut props before cutting length |
| Camera makes people sick or hides enemies | Reduced-motion setting, short cinematics, skippable, pull-back for fights |
| Too many combos to balance | Six elements, two slots, combos as a table with a test per row |
| Ten worlds is a lot of art | Reuse the engine; each world is a data file plus a themed prop set and palette; ship one world at a time |
| Scope creep before Pete is great | Do not start world 2 until Pete passes the full-stage smoke test and a real playtest |

## 8. What I need from the owner

Answer D1 to D6 above (a one-word answer for each is enough), and say whether Phase A should start now.
Recommended answers: D1 yes, D2 corridor with forks, D3 first visit only, D4 NPC with dialogue, D5 six elements and two slots,
D6 remove carry-capacity upgrades so power is purely found.

## 9. Owner answers, round 2 (these override sections 2.2 and 5 where they differ)

Research read first. Mini Ninjas is linear with no hub: big, wide levels with optional shrines and collectibles on side paths,
and a castle level before each major boss. Magicka's adventure is 12 chapters, each split into sub-areas, with forced
checkpoints (automatic on entering an area) and activated ones (runestones); once you move on you cannot return.
Sources: gamespot.com/reviews/mini-ninjas-review/1900-6231284, magicka.fandom.com/wiki/Adventure_Walkthrough_(Magicka).

What the owner decided:
1. **Shape:** a chapter per outlaw made of 5 to 8 **big areas**. Each area is a finished level that feels like a Mini Ninjas
   stage inside (one road with side paths), and areas are joined by gates. The outlaw is in the last area.
2. **Length:** 45 to 60 minutes per outlaw, about 6 to 9 minutes per area. This replaces the 8 to 12 minutes in section 2.2.
   An area is therefore roughly 600 to 900 units on its own, not the whole stage.
3. **Clues still open the final gate.** The find-the-clues rule stays, spread across the areas (for example one required clue
   or key per area, the last one opens the outlaw's gate). Side-path secrets are optional.
4. **Gate and checkpoint, no going back** (Magicka style): a forced checkpoint on entering each area, activated campfires
   inside it. Because nothing is revisited, only the current area needs to be loaded, which is good for phones.
5. **To confirm:** the answer was "a mix of 1 and 4". I read it as: Magicka-style chapter of gated areas (1), with Mini Ninjas
   style big, open, side-path-rich areas inside each (the feel of 4). If it means something else, say so.

Effect on the build plan: stage data gets an `areas[]` list, each with its own road, guards, required clue and gate. Pete grows
from one 220-unit trail into 5 to 8 areas. The stage runner saves per area, not per campfire only. Phase B (road and camera)
now happens inside one area first, then is repeated, so build one finished area as the template before making the rest.
