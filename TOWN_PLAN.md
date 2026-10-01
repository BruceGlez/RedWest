# Lantern Rock: making the walkable town make sense

The town can be walked (README, "Walking the town, and the town's look"), but it was still a menu with a 3D skin: eight
doors in a ring, each opening a card. This plan gives walking a purpose. It was written on 2026-09-30 from a review of
Hollow Knight's Dirtmouth, Fate (2005), Township and the mood of Peaky Blinders, and from what the game already has.

## What we take from each reference

| Reference | Lesson | Red West version |
|---|---|---|
| **Hollow Knight** (Dirtmouth) | A tiny hub that is always useful; the way into the world is a place you walk to (the well); NPCs move in as you rescue them, so the town changes because of what you did. | The steam train at the depot is the way out to the Wanted Road. Every beaten outlaw adds a thing and, later, a person to town. |
| **Fate** (2005) | Town, then dungeon; a companion that follows you and grows; shops and side jobs around the descent. | The town is where you prepare for a hunt. A companion (a dog, later a horse) follows the marshal. Daily jobs are the side jobs. |
| **Township** | Visible growth, land that expands, a busy readable town where things happen. | New districts open as outlaws fall (stars, never money). The town is busy: townsfolk with routines, smoke, trains. |
| **Peaky Blinders** (mood only) | Industrial slum after the war: flat caps, charcoal and navy coats, a muted palette, smoke, backstreets, a pub that is the gang's base. | A rail-and-mining boomtown: foundry glow, a saloon with a back room, back alleys and a canal. Dusk by default. |
| **Hub practice** (Hades, Moonlighter) | The hub is where you plan the next run and see its results; NPCs comment on your progress. | The town already has barks. Results are shown in the world: cash in the jail yard, notes on the board. |

House rules: the inspirations are mood only. No names, logos, characters or art from those works (see `ASSETS.md`).
Buildings still never change combat (`tests/town.test.js`), and nothing is sold as a speed-up.

## The rule for every addition

**Walking must give something the tap-overview does not**: a thing you can see change, a place you go to, or someone who
reacts. If a feature could just as well be a button, it does not belong here.

## Steps

| Step | What | Size | Status |
|---|---|---|---|
| **A** | A reason to walk: the train is the gate to the hunt, the jail's cash box shows and pays the income, a bounty board in the square shows the day's jobs | small to medium | **built 2026-09-30** (below) |
| **B** | Districts beyond the town's edge that open with a star, each with its own mood and a place to use | medium | **built 2026-09-30** (below) |
| **C** | Townsfolk with routines and proximity barks, plus a companion that follows the marshal | medium | **built 2026-09-30** (below) |
| **D** | Art pass for the new districts: modelled buildings, painted textures (`POLISH_PLAN.md`, section 6) | large | parked on purpose |
| **E** | Districts for the last four outlaws: Vane's Crossing, Tres Rios, the Silver Belle, Fort Pell | medium | **built 2026-10-01** (below) |
| **G** | The Arena in town, with boss fights as one of its options, locked until beaten on the Wanted Road | small to medium | **built 2026-10-01** (below) |
| **H** | Every district is a place of its own: a full screen you step into, with goods to make and things to do | large, in slices | **planned 2026-10-01** (below) |
| **F** | A town that reacts: a "new district" moment, townsfolk who talk about it, and a day that turns to night | small to medium | **built 2026-10-01** (below) |

### Step A, as built

All three are interaction spots in `src/townSpots.js` (positions, verbs, the wording and the pure rules), drawn in
`src/townScene.js`, and reached by walking up and pressing E, Enter or tapping the prompt. They are not buttons on a card.

- **The train** (depot platform, in front of the locomotive). The prompt reads `RIDE OUT: <next outlaw>`. It starts the
  same hunt as PLAY for the outlaw the Wanted Road has selected. The depot's station house still opens the weekly Most
  Wanted card. PLAY and the Wanted Road stay on the home screen, so nobody is forced to walk.
- **The jail cash box** (in the jail yard). It fills with coins as the jail earns and glows gold when the jail is full.
  Walking up to it collects the money and opens the jail card with the result. The jail's own card still works.
- **The bounty board** (main street). Notes are pinned for each job not yet done today; the card lists the three jobs
  with progress and the reward, and has the DAILY JOBS button.

Rules kept: income and jobs use the existing wallet and profile; nothing here touches combat.

### Step B, as built

Three districts, each opened by beating an outlaw (the first star, the rule the jail uses) and never by money. Rules and
data are in `src/townDistricts.js`; they are drawn in `src/townScene.js`.

| District | Opens with | What is there |
|---|---|---|
| **Calloway Farm** (west) | The Calloways | A barn, hay, a fence line, and the **kennel** (the dog, step C) |
| **Foundry Yard** (north-east) | Iron Jack Harlan | Jack's glowing furnace with smoke, an anvil, slag, crates, and a card about it |
| **Morgan's Channel** (south) | Mad Mesa Morgan | Water across the ground, a footbridge (the only way over), a warehouse, buckets, and the channel log |

- While a district is shut it is **seen but fenced**: a fence across the way in and a LOCKED sign. Standing at the fence
  shows `<DISTRICT>: SHUT` and the card says which outlaw opens it. When it opens the fence becomes a gate with its name.
- The walkable ground is now a list of areas (`map.areas` in `src/townWalkLogic.js`): the town plus each open district.
  Each area reaches 3 units into the town so crossing the edge never lands in a gap.
- The text on each place's card comes from `STORY_BIBLE.md` (the Calloways rebuild their fences outside town, Jack goes to
  work at the smithy, Morgan's dry channel gets water).

### Step C, as built

- **Townsfolk with routines** (`src/townFolk.js`): six people, each walking a short route of two to four stops and
  waiting at each (Old Gil, Mr. Grimsby, Mr. Pruitt, the barkeep, a miner, the station master). Routes follow the streets;
  `npm run test:town` walks every segment against the real walls.
- **Proximity barks**: stand within about three steps and they stop and a speech bubble shows one line for how far you have
  got (nothing beaten, a few, five or more). After a few seconds they go on until you leave and come back.
- **The dog** (`src/townCompanion.js`): meet it at the kennel on Calloway Farm, and it trots after the marshal and wags. The
  kennel button takes it, sends it home and calls it back. It is kept on the device, and is only a companion: nothing
  about it touches fights or the wallet.

### Step E, as built

Four more districts, each the old home ground of an outlaw whose epilogue prop already stands in town (`STORY_BIBLE.md`),
so the town and the road keep the same story. Each opens with the first star on its outlaw.

| District | Opens with | Edge of town | What is there |
|---|---|---|---|
| **Vane's Crossing** | Silas Vane | east | A street of weathered false fronts and a clock tower whose clock has stopped |
| **Tres Rios** | El Espectro | north-west | An adobe hacienda, a well, and a stone with a struck-out date |
| **The Silver Belle** | Lucky Lou | south-east | A riverboat tied at a pier, a notice post, crates |
| **Fort Pell** | Colonel Crane | north-east | A palisade, barracks, a flagpole, and the gatling oiled and pointed at the sky |

The Foundry Yard now ends at x = 37 so Fort Pell can meet the town's east edge. A test keeps every district apart from the
others and joined to the town.

### Step F, as built

- **A "new district" moment** (`src/townNews.js`): the first time the town opens after a district opens, a banner says
  `NEW: <DISTRICT> IS OPEN` and which edge the gate is on, and the gate rises out of the ground. Tap it or wait to dismiss.
  What has been announced is remembered on the device.
- **Townsfolk talk about it**: until the marshal has walked into a new district, everyone mentions the newest one
  (`react` lines in `src/townFolk.js`). Once he has been in, the usual lines return.
- **A day that turns to night** (`src/townTime.js`): the light slowly goes from the dusk the town has always had, through
  night, a pink dawn and a hazy day, and back to dusk. A round takes ten minutes; lamps and windows shine brighter at
  night. `?time=off` keeps it at dusk.

Draw calls: the overview was pushed over the limit by the extra geometry, so the shut gates, the board's notes and the cash
box coins are merged and rebuilt only when they change, and townsfolk share materials. Worst case (everything open, overview,
LOOK on) is about 123, about 110 with LOOK off, and about 80 while walking (the limit is 130).

### Step G, as built

- **The Arena** (`src/arena.js`, the building in `src/townScene.js`): a walled ring of sand with a gate, a flag and an ARENA sign
  on the south-east side of town. Walk up to the gate (or tap its sign in the overview) and its card opens. It replaces the BOSS
  ARENA link that sat at the bottom of the home screen.
- **Options**: the card has a row of options (`ARENA_MODES`). BOSS FIGHTS is the first and, for now, the only one; the list is there
  so more can be added without changing the card.
- **Locks**: a boss opens once the first star is earned on the Wanted Road (the same rule as the jail and the districts). Locked
  rows say so and cannot be started; `beginTownFight` refuses a locked boss too, so the rule is in the code and not only the grey
  button. CAN'T DIE and GANG work as before. Nothing is saved.
- **Back home**: a fight from the town is an Arena run only until you are back at the home screen (`endTownFight`).
- **`?arena`** still shows the same list full-screen for testing and now respects the same locks; `?arena=all` opens every boss.

### Step H, planned: districts you step into

Today a district is ground to walk on with one plaque. The plan: each district becomes a **place of its own**. Walk to its
gate or building, press E or tap, and a **full screen** replaces the town (a new place, with its own picture, its own
things to do and a way back to the street). The town stays the map; places are where the doing is.

**Rules (kept from before):** places only change income and goods, never combat (`tests/town.test.js` style test for each
place); no timer is ever sold as a speed-up; goods are earned, never bought with real money; nothing here is chance-based
spending (the game has an under-13 mode).

**The screen.** First version is a painted 2D screen, like the Arena card but full size: a layered scene (sky, buildings,
the place's own props) with tappable spots, a header with the place's name and a BACK TO TOWN button. It reuses the card
plumbing in `src/townPanel.js`, so it is cheap on phones and the draw-call guard is untouched. A walkable 3D room inside each
place is possible later and belongs to the parked art pass (step D); the place screens do not need it.

**Production, the Township way without the timers to buy.** Each place makes **goods** slowly in real time, up to a cap that
is the same idea as the jail (come back once or twice a day and collect everything; nothing is lost by being away). Goods
are kept in a small store (a new `goods` map in the profile, saved like the jail clock). Goods are spent on three things:
- **Orders:** townsfolk and the depot ask for crates of goods and pay Bounty Dollars (the Township order board, fed by the
  bounty board in the square).
- **Building upgrades:** some upgrade costs become dollars plus goods (iron bars for the Bank, and so on).
- **Place upgrades:** each place has its own levels, bought with dollars and goods, that raise its output or its cap.

| Place | Makes / does | Needs |
|---|---|---|
| **Calloway Farm** | Grows feed and eggs in plots you plant and harvest; the dog herds. First slice. | nothing |
| **Foundry Yard** | Smelts scrap (a drop from runs) into iron bars at the furnace | scrap from fights |
| **Morgan's Channel** | Water and fish; pumped water raises the farm's plots (places help each other) | nothing |
| **Vane's Crossing** | A wagon train arrives each day with orders for the town's goods and pays for them | goods |
| **Tres Rios** | A garden and cantina kitchen: turns eggs and feed into meals (worth more as orders) | farm goods |
| **The Silver Belle** | A trading post: goods sell here at a price that changes by day, the same for everyone | goods |
| **Fort Pell** | Sends deputies on patrols that come back with dollars and scrap after a set time | nothing |

**Slices (each one playable and merged on its own):**
1. **H1: the place screen and Calloway Farm.** The full-screen shell, the goods store and the farm's plots, with tests.
2. **H2: orders** on the bounty board, so goods have a use, and the Morgan's Channel link to the farm.
3. **H3: Foundry Yard and Fort Pell** (scrap and patrols).
4. **H4: Vane's Crossing, Tres Rios and the Silver Belle** (wagons, meals, trading).

**Open questions for the owner:** (1) painted 2D place screens first, or wait for 3D rooms? (2) Should goods also be dropped
by outlaws on the road, so fighting feeds the town? (3) Do places stay open to look at before their outlaw is beaten?

### Step D, parked

See `POLISH_PLAN.md`, section 6. Whatever is built in A to C only needs to keep `walkMap()` (footprints and doors) correct
when its art is replaced.

## How we know it works

- Unit tests: `townSpots`, `townDistricts`, `townFolk`, `townCompanion`, `townNews`, `townTime` and `townWalkLogic` cover positions, unlock rules, routines,
  barks, the dog's following and the walking rules.
- `npm run test:town`: in a real browser, each place can be reached and used (the train starts a run, the cash box pays, the
  board opens), shut districts hold the marshal back, open ones can be entered, no townsperson walks through a wall, and the
  dog comes and goes.
- The mobile draw-call guard (`tests/mobile-smoke.mjs`) still holds, so the town stays cheap on phones.
- Play it and answer one question per step: did I walk somewhere because I wanted to, or because I had to?
