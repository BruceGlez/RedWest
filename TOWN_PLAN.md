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

### Step D, parked

See `POLISH_PLAN.md`, section 6. Whatever is built in A to C only needs to keep `walkMap()` (footprints and doors) correct
when its art is replaced.

## How we know it works

- Unit tests: `townSpots`, `townDistricts`, `townFolk`, `townCompanion` and `townWalkLogic` cover positions, unlock rules, routines,
  barks, the dog's following and the walking rules.
- `npm run test:town`: in a real browser, each place can be reached and used (the train starts a run, the cash box pays, the
  board opens), shut districts hold the marshal back, open ones can be entered, no townsperson walks through a wall, and the
  dog comes and goes.
- The mobile draw-call guard (`tests/mobile-smoke.mjs`) still holds, so the town stays cheap on phones.
- Play it and answer one question per step: did I walk somewhere because I wanted to, or because I had to?
