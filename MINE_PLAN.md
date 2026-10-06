# The Undertaker's Mine: a descent under Lantern Rock

Written 2026-10-05, reworked the same day after the first playtest. The undertaker's building in town has a parlour you walk into, and
behind it the way down into an old miners' claim that the Company sealed, in the spirit of *Fate* (2005) (`TOWN_PLAN.md`): the town is where
you prepare, the mine is a descent with no bottom, and a lift brings you back.

The inspiration is mood and structure only. No names, art or characters from that game (see `ASSETS.md`).

## The idea in one paragraph

Mr. Grimsby, the undertaker, keeps cellar stairs behind his coffins. They lead down to the **Hollow Claim**, a mine with **no bottom**.
Every floor is a **much bigger cave** than the one above, with **a new kind of monster** in it and treasure chests off the main road.
**The way down is always open**: find the shaft and walk into it, fighting or not. The lift you came down on is always behind you, and
walking back to it brings you up with whatever you got. Deeper is stranger, harder and worth more.

## House rules (the same as the rest of the game)

- Buildings and places never change combat in the Wanted Road; the mine is its own mode, like the Arena.
- Nothing is sold as a speed-up. Mine rewards are score, hearts and (slice 2) Bounty Dollars, ore and cosmetics, never stars and never real money.
- Stars come only from the Wanted Road, never from the mine.
- Walking must give something a button does not: the stairs are a place you walk to, and the cave is somewhere you see things change.

## Slices

| Slice | What | Size | Status |
|---|---|---|---|
| **1** | The way down from town, a descent with a lift back up. Saves nothing (practice rules, like the Arena). | small to medium | **built 2026-10-05** |
| **1b** | Maps made for it: the undertaker's parlour as a place you walk into, and caves with walls, rails, a lift and a shaft you walk to. All drawn in code. | medium | **built 2026-10-05** ("The maps", below) |
| **1c** | Fate-style depth, after the first playtest: no bottom, caves that grow a lot with every floor, a new monster on every floor, chests, and a shaft that is always open | medium | **built 2026-10-05** ("The descent", below) |
| **1d** | After the second playtest: the shaft and the lift ask first, and the monsters belong to their chambers (no endless stream; a chamber refills only after you have gone far away) | small | **built 2026-10-05** ("The descent", below) |
| **1e** | Floor variety: twin caverns, long galleries and rockfalls you walk round, deterministic per depth | small | **built 2026-10-05** ("The maps", below) |
| **1f** | Six more monsters for floors 15 to 20, built only from behaviours and looks the game already has (`look` field, see "Deeper monsters") | small | **built 2026-10-05**; own models wait for the art lane |
| **2** | A deepest floor that is saved, a checkpoint every few floors, ore picked up on the way down, ore lost when you fall and kept when you ride up | medium | **2a built 2026-10-06** (the data contract, below); **2b built 2026-10-06** (the mine side: stairs, ore, saving; "Slice 2b" below); the server endpoint is still to do |
| **5** | The dark mine (owner's brief, 2026-10-06): a cellar and a hidden door that Deacon Graves's defeat unlocks, a mine with no light of its own, a lantern and torches you buy and place, monsters that sense you by distance, light eaters from the deep floors, and a lift and shaft you can see | large; five parts, below | **in progress** ("Slice 5"): the cellar and the hidden door are built (town lane, 2026-10-06); the rest is planned by lane |
| **6** | Quests from the graves: Deacon Graves's graveyard in town gives generated jobs, the fallen souls asking for revenge or for their unfinished quests to be finished (find an item, kill a creature, kill a number, or a mix), many of them in the mine | medium | planned, owner said yes 2026-10-06 ("Slice 6") |
| **3** | Boss floors (every 5th), more of Mr. Grimsby's talk and rumours, a pet that follows you down | medium | planned |
| **4** | The art pass for the maps and the monsters: modelled rock, timber, carts, a real lift and shaft, painted textures (`POLISH_PLAN.md`, section 6) | large | parked, like the other art passes. The maps are made of boxes so this can replace them one builder at a time. |

### What changed after the first playtest

The first version ran five fixed floors, each one a fight you had to *clear* before the shaft opened. Playing it, "the floor didn't open".
Two things were wrong, and both are gone with the design:
- **A real bug:** a floor counted as cleared only when the director's spare budget fell under the price of the cheapest enemy
  *in its list*, but the floor's check used one number for every floor. On the first floor the cheapest enemy costs 1.0 and the check
  waited for under 0.8, so a leftover of 0.8 to 1.0 left the floor unclearable forever.
- **A design problem:** even when it worked, "kill everything" gave no way to tell what was left, and nothing to do about it.

Now nothing has to be cleared. There is no budget gate and no locked shaft; the pursuit is a measure of danger that the cave keeps up.

### The descent (slice 1c)

- **No bottom.** Depth only grows (`src/mine.js`). Every floor makes its own cave from its depth, so a floor looks the same every time.
- **A lot larger each floor.** The cave has `2 + 2 x depth` chambers (up to 15), each bigger than the last: the shaft is about 240 units
  from the lift on floor 1 (the old hand-made caves were about 110 across), 380 on floor 2, 470 on floor 3 and over 900 on floor 5.
  The marshal's walking limit grows to fit (`gameState.MAP_SIZE`, restored when he leaves).
- **A new monster every floor** (`src/mineMonsters.js`). The ladder mixes the Wanted Road's own enemies with four that live only down
  here, one new one on each floor: **2 cave bat** (a flitting flier), 3 rattler, **4 crawler** (a pale thing that comes in numbers),
  5 rifleman, 6 dynamiter, **7 stonekin** (a slab of the mountain that shakes, then charges), 8 brute, **9 lantern wraith** (a miner's
  ghost that fades and reappears), 10 rider, 11 duelist, 12 ghost, 13 knifer, 14 trooper. The floor's banner names a new mine monster.
  The newest monster is sent more often on its own floor. Past the eighth floor anything that takes more than one hit takes more.
- **Monsters belong to their chambers, and are not endless.** Every chamber, alcove and treasure room has its own monsters
  (`planNode`, `src/mineMonsters.js`): a fixed amount of danger by its size (a treasure room is guarded harder, an alcove less, the chamber
  you land in is quiet and nobody is put within about 20 units of the lift). They are there when you come within 45 units of the chamber's edge.
  Kill them and nothing new comes while you stay. Once you have gone more than 100 units away, the survivors go back to sleep and the
  chamber fills again for the next time you come. Monsters more than 64 units from you are asleep, and they come out a couple a frame,
  so a big chamber does not hitch.
- **The way down is always open, and it asks first.** The shaft is a pit with a ladder, a ring of light on the floor and a beam of light 46
  units tall that shows over the rock from far away. The HUD always says how far it is and which way (`SHAFT 237 m ->`). Walking into it
  stops the game and asks `GO DOWN?` (ENTER, E or Y to go; ESC, X or Backspace, or a tap on STAY, to stay). Yes goes down a floor and pays a
  little score (50 x depth). No stays, and it does not ask again until you have stepped away from the shaft.
- **The lift always brings you back, and it asks first.** It is where you arrive. It works once you have walked 20 units away from it (so
  you do not ride up by accident), and the HUD says how far it is (`LIFT UP 96 m <-`). Walking onto it asks `RIDE THE LIFT UP?`; yes
  ends the run with the depth you reached, and no works like the shaft's.
- **Chests.** Each side alcove and treasure room has a chest. Walking up to one opens it: score by depth (100 x depth) and a heart if
  you are hurt, else ten seconds of triple shot.
- **What is saved:** nothing. The run log, stars, earnings and leaderboards are not touched. Dying or riding up shows a practice result
  with the depth. Saving the deepest floor is slice 2.

### The maps (slice 1b, grown in 1c)

**The undertaker's parlour** is a place of its own, like Calloway Farm (`PLACES.md`): `src/undertakerLayout.js` is the flat map and
the rules (no rendering, so `tests/undertakerLayout.test.js` can walk it), `src/placeUndertaker.js` draws it, and `src/townPanel.js` hosts
it next to the farm (a second place, with the same walking code). It is a cut-away room: tall back and side walls, a low front sill,
candlelight. In it: a counter with Mr. Grimsby behind it (TALK opens a card with one line for how many outlaws you have beaten),
three coffins on show, a waiting bench, a stove, and the cellar stairs behind the coffins (DESCEND). A door at the front goes back to the
street. The tests check that every door can be stood at and walked to, that nothing blocks the way, and that you never start on a prompt.

**The caves** are made by a generator (`generate` in `src/mineMap.js`), seeded by the depth: chambers one after another along a winding
road (each turning a little from the last and never near an earlier one), joined by tunnels, with round side alcoves and, from the second
floor, treasure rooms down a tunnel of their own. Each cave also has rock columns for cover, timber arches in the tunnels, crates, ore
carts parked beside the track, rails from the lift to the shaft, and chests. A cave is a few circles and capsules whose union is the open
ground; everything else is rock.

**Variety (slice 1e).** Besides round chambers, from the second floor a chamber may grow a *lobe* (a second round cavern joined to it, a twin
cavern), from the third a long *gallery* (a wide capsule across it), and from the second a *rockfall* (a fat column of rubble, 4.6 to 6.6
units across, in the middle of a chamber with at least 7 units of way past it). Lobes and galleries are only more ground in the cave's union
(`layout.extras`, `{ kind, owner }`, with the shapes at the end of `layout.shapes`), never on the lift's or the shaft's chamber, and clear of
every other chamber, tunnel and room tunnel; rockfalls are in `layout.pillars` and `layout.rockfalls`, so the scene already draws and the
physics already blocks them. They come from their own seeded roll, so a floor is still the same every time, and the tests walk floors 1 to
30 to check the shaft, every chest and every tunnel mouth stay reachable. Not done: pits and pools as blockers (the scene has no look for
a hole or water; art would need one before the layout can use it).

How they work (`src/mineMap.js` is the rules, `src/mineScene.js` the drawing; `tests/mineMap.test.js` checks all of it):
- Plain chasers walk straight at the marshal, so chambers are wide and roughly round and tunnels are wide enough to fight in. For a
  pursuer that cannot see the marshal there is a road of waypoints (`steerTarget`): it heads for the next chamber along the road
  instead of pressing against the rock. The tests follow the road from one chamber to another and check it always leads there.
- The test floods floors 1 to 5, 8 and 13 the way the marshal can really walk them: the shaft, every tunnel mouth and every chest are
  reachable, nothing leaks out, and no wall has a gap a bullet could slip through. Depths up to 30 were checked the same way while building it.
- Walls are solid for the marshal, for enemies and for bullets: a ring of circles in the first few units of rock, plus a hard test that
  anything inside the rock is blocked, so nobody can stand, spawn or land in it (`src/physics.js`).
- Enemies slide along walls instead of standing against them, and are put back at a tunnel mouth if a knock-back ever leaves one in the rock.
- Walls rise as they go back from the cave: low at its edge so the camera, which stands to the south and high, never loses the
  marshal behind them, and tall in the rock behind. Past the last block is plain dark rock, which reads as the roof.
- Every floor starts on the lift at (0, 0). A cave is found and drawn only where there is cave (`gridPoints`), so a big floor costs
  tens of milliseconds to make, not a second.
- Everything is boxes, cylinders and a few merged meshes: the floor, the rock, the props (columns, timber arches, crates, carts, rails,
  the lift) and the lantern glow are about five draw calls, plus the shaft and the chests. Slice 4 can replace any one without touching the rules.

## Deeper monsters (slice 1f, floors 15 to 20)

One new monster per floor below the old ladder, in `MINE_MONSTERS` and `MINE_LADDER` (`src/mineMonsters.js`). None needs a new behaviour:
each runs one the Wanted Road already has, and each borrows an existing model through a `look` field that `spawnEnemy` reads
(`src/enemySystem.js`, a small separate PR in the combat lane's file). When the art lane makes a model, the monster gets its own mesh in
`MINE_MESHES` and drops `look`; nothing else changes.

| Floor | Id | Name | Behaviour | Borrowed look | Cost | hp | What is new about it |
|---|---|---|---|---|---|---|---|
| 15 | `slagadder` | SLAG ADDER | zigzag | rattler | 1.0 | 2 | A glowing snake: a rattler that takes two hits |
| 16 | `slaglobber` | SLAG LOBBER | lobber | dynamiter | 2.4 | 3 | A blaster who throws from the dark |
| 17 | `sentry` | CAIRN SENTRY | sniper | rifleman | 2.6 | 3 | A watcher with a red line |
| 18 | `hollowhide` | HOLLOWHIDE | charger | stonekin | 3.8 | 11 | The mountain's weight, walking |
| 19 | `choir` | PALE CHOIR | volley | trooper | 2.8 | 3 | Singing miners, a burst on every beat |
| 20 | `ghoul` | GALLERY GHOUL | phantom | ghost | 2.4 | 3 | Steps out of the timbers beside you |

Costs, hp and speed stay within about 40% of the monster whose behaviour they use (`tests/mineMonsters.test.js` checks it), so the budget
of a chamber (`nodeBudget`) still buys a real fight on every floor. Past floor 20 the roster stops growing, as before.

### Art prompts (for the art lane)

Style for all six: the game's low-poly Wild West look (`src/assets.js`, `ASSETS.md`), original design, no real-world brands or characters,
one figure about 2 world units tall (Hollowhide about 3.5), readable from the high camera at a distance, flat colours with a little
emissive glow for the mine lighting. Add a row to `ASSETS.md` for each. Each prompt can go to the model tool as is.

1. **SLAG ADDER** (`slagadder`): "Low-poly stylised snake about 1.5 units long, thick body in a loose S shape, head raised. Charcoal
   black scales with seams of glowing orange like cooling slag along the back and a pale ember glow in the eyes. Small flat forked
   tongue. Cartoon proportions, chunky shapes, no realistic scales."
2. **SLAG LOBBER** (`slaglobber`): "Low-poly Wild West miner-blaster, 2 units tall, stocky. Soot-black face scarf, battered hard hat with
   a dead lamp, canvas vest with sticks of dynamite across the chest, one arm raised holding a lit stick with an orange spark. Dusty
   brown and charcoal clothing, ash grey skin, orange accents only on the fuse."
3. **CAIRN SENTRY** (`sentry`): "Low-poly watcher figure, 2.2 units tall, thin and still, built from stacked grey stones like a cairn
   with a ragged brown poncho and a wide hat made of a flat slate. Holds a long old rifle across its body. Two small pale blue-white
   glints for eyes. Silhouette must read as a tall narrow figure."
4. **HOLLOWHIDE** (`hollowhide`): "Low-poly hulking rock giant, 3.5 units tall, broad shoulders, small head sunk between them, arms
   hanging to the knees. Body of dark slate plates with a cracked hollow in the chest that glows faint amber, old rusted mine-timber
   braces strapped across it. Heavier and rounder than a plain stone golem, so it is not mistaken for the stonekin."
5. **PALE CHOIR** (`choir`): "Low-poly undead miner in a long ragged shift coat, 2 units tall, hat in one hand, mouth open as if
   singing, bone-pale skin and sunken eyes, other arm holding a short carbine at the hip. Washed-out cream and grey with a faded dark
   red neckerchief. Faint cold-white glow at the mouth."
6. **GALLERY GHOUL** (`ghoul`): "Low-poly ghoul, 2 units tall, hunched and long-armed, wrapped in rotted timber and rope like it grew
   out of a mine gallery, splintered planks for ribs, a lantern hook for a hand. Mossy grey-green and bark brown, pale green glow in
   the eye sockets. Semi-translucent edges are welcome because it fades in and out."

What the combat lane would add later: nothing. Every behaviour above already exists. If a future monster needs a new behaviour it is
the combat lane's, as before.

## Slice 2: what the mine remembers (2a, the data contract)

Split by lane (`AGENTS.md`, rule 5): **2a** is the contract, in the mine lane's `src/mineProgress.js` plus three lines in the shared `src/profile.js`.
It is pure rules, like `src/town.js`, shared by the browser wallet and the server. **2b** is the consumer, after 2a merges.

`profile.mine` is `{ version: 1, deepest, checkpoint, ore, runs }`:
- **deepest**: the deepest floor ever reached (0 before the first run). It only grows.
- **checkpoint**: derived from `deepest`, never trusted from input: the highest multiple of 5 not deeper than it (`CHECKPOINT_EVERY`). A run may begin
  on floor 1 or any checkpoint reached (`startFloors`). A checkpoint only lets you start lower; it gives no power and no items.
- **ore**: banked ore, up to `MAX_ORE`. It is found on the way down. **Riding the lift up keeps what the run carried; falling loses it all**
  (`FALL_KEEPS = 0`, the one number to tune from playtests; this settles the open question below for now). Banked ore is never lost.
- **runs**: mine runs finished.

`applyMineRun(profile.mine, { startFloor, depth, ore, outcome: 'up' | 'fell', seconds })` is the one write. It changes `profile.mine` only (tested), and
the client is not trusted: a start floor that is not one of his checkpoints is floor 1, a depth no walk could reach (`MIN_SECONDS_PER_FLOOR`) is cut,
and ore beyond what the floors hold (`maxOreForRun`) is cut. Nothing is rejected.

House rules (tests/mineProgress.test.js): the mine gives no stars, dollars, score records or leaderboard entries; ore is not in `CURRENCIES`, no product
or shop item grants or sells it, and a normal Wanted Road run does not touch it. What ore is spent on is a later question and will be cosmetic only.

**Waiting on (2b):** the **scale/server lane** for `POST /api/mine/run` in `server/app.js` (auth like `/api/run`: apply `applyMineRun` to the user's
`profile.mine`, answer with the result and the profile; no purchase or webhook code is involved), and the **shared** `profile.js` hook in this PR. The
browser wallet needs the same call (`src/wallet.js`, shared). Then the mine lane's consumer: pick the start floor at the stairs, count ore in
`src/modes/mine.js`, send the summary when the run ends, and show the result.

## Slice 2b: the mine side

What a player sees: at the cellar stairs, once a checkpoint has been reached (deepest floor 5 or more), a card offers **FLOOR 1** and every checkpoint
reached; before that the stairs go straight down as before (`src/places/undertaker.js`). Each chest now also holds **ore**, its share of the floor's
limit (`oreInChest`, so opening every chest never gives more than `maxOreOnFloor`); the HUD shows `ORE n` beside the lift. When the run ends,
`runSummary` (`src/mine.js`) is sent to the wallet (`reportMineRun`), which applies `applyMineRun` to `profile.mine`, and the result screen replaces
its line with what was saved (`savedText`): the new deepest floor, a new checkpoint, and the ore banked or lost. The result still says the mine gives
no stars and no money, and nothing here touches the Wanted Road records.

Where it lives: rules and words in `src/mine.js`, the flow in `src/modes/mine.js` (`begin` from the picked floor, chest ore, the `settle` hook),
the stairs card in `src/places/undertaker.js` (town lane's file, a small edit on purpose), and small hooks in the shared `gameLoop.js` (the mode's
`settle` is called when a practice run ends), `townPanel.js`/`main.js` (the floor travels from the card to `beginMineRun`) and the money lane's
`wallet.js` (`reportMineRun`: local applies it at once; remote calls `POST /api/mine/run`).

**Still to do: the server.** `POST /api/mine/run` in `server/app.js` (scale lane) does not exist yet, so a signed-in account on the server gets "could
not be saved this time" on the result screen, and a local (offline) wallet saves fine. The endpoint is `applyMineRun` on the user's `profile.mine`,
authenticated like `/api/run`, returning `{ result, profile }`.

## Slice 5: the dark mine (owner's brief, 2026-10-06)

Written down as the owner gave it, then split by lane. Decisions he made when asked are marked **decided**; anything else is an assumption and is
listed under "Still open" so an agent asks before building on it.

**Built so far (town lane, 2026-10-06): the cellar and the hidden door.** The parlour's stairs now lead to the cellar, a small room of its own (`src/cellarLayout.js`, `src/places/cellar.js`, a placeholder scene `src/placeCellar.js`). The way down is a hidden door in its east wall, a door that only shows its prompt when the marshal is within about 1.6 of it (a per-door `reach` in `nearestDoor`, `src/townWalkLogic.js`), so he has to walk the wall to find it. Until Deacon Graves has a star the wall only "rings hollow" (a card names him); once he has, the door offers FLOOR 1 and every checkpoint, as the stairs card used to. Nothing new is saved: finding the door is walking to it, so a save keeps its deepest floor, checkpoints and ore (`tests/cellarLayout.test.js`). A player who had reached the mine before the Deacon is beaten keeps all of it and gets back in when he is. `tests/mine-smoke.mjs` now starts with the Deacon beaten and goes down through the cellar. The parlour's stairs prompt reads THE CELLAR STAIRS (`src/undertakerLayout.js`, mine lane's file, one line).

### The brief

1. **A cellar before the mine, and a hidden door.** Today the cellar stairs go straight down. Instead the cellar is a small place of its own
   (like the parlour): you walk into it and have to *find* a hidden door, and the door only opens after **Deacon Graves** (Wanted Road stage 3)
   is beaten (**decided**). Until then the stairs lead only to the cellar.
2. **The mine is completely dark.** You bring a **lantern** or **torches** (**decided**: they are not free, everything is bought somewhere).
   **Decided look:** a dim radius around the marshal, and everything outside it truly black until torches are on the wall.
3. **Torches are placed along the corridors** to mark where you have been, and they light the place they are in.
4. **Monsters sense you by distance, Fate style.** They do not all come at once: each has a sense radius, stays asleep or idle outside it, and
   comes for you once you are inside it.
5. **Light eaters** (new monster): small bugs that put out the torches you placed. They only appear on the deeper floors.
6. **The lift and the shaft are always visible**, so you can always see where to ride up or go down (in the dark too).

### The rules this has to keep

- **Light is bought with earned Bounty Dollars only** (never Gold Nuggets, never real money, no timers, no loot box): the same rule as guns
  (`MONETIZATION.md`, "No pay-to-win", and the unit test that fails if a gun is priced in nuggets gets the same test for light). Prices
  are small. Whether the shop is Mr. Grimsby's or the general store is open (below). Light does not change combat numbers; it changes what you can see.
- **Nobody gets stuck.** Without light you can still see your own feet and the lift and shaft glow (a small ring, **decided**), so a player
  who arrives with nothing can walk back to the lift. The mine is never a softlock.
- **Stars and money still come only from the Wanted Road** (slice 2's rule): the mine gives score, ore and cosmetics.
- Original art only; every new asset gets a row in `ASSETS.md` (lantern, torch, light eater).

### What Fate does (the investigation)

Sources: [Wikipedia, *Fate (video game)*](https://en.wikipedia.org/wiki/Fate_(video_game)), [the GameFAQs review](https://gamefaqs.gamespot.com/pc/927041-fate/reviews/125003) and [the Codex Gamicus entry](https://gamicus.fandom.com/wiki/FATE). *Fate* is the 2005 WildTangent game.

- **Levels come from a generator, one at a time, not all at once.** The dungeon has no fixed number of levels (the cap is a 32-bit integer, in
  practice endless). Each level's layout is randomised, and so are its treasure and the number and kind of monsters. Layout style varies from
  level to level: a twisty maze, a wide open hall, rooms joined by halls, or a mine-like cave. So it is made when you get to it.
- **Quests also come from a generator.** The main quest picks an ordinary monster, enlarges it and strengthens it, gives it a posse of boss-tier
  allies, puts it on a random floor between about 40 and 50, and sends you to kill it. Side quests from the townspeople are small random
  jobs: find an item, kill one creature, kill a number of creatures, or a mix.
- I did **not** find a source for Fate's monster sense radius or whether a level is saved once made; the agents should treat "sense radius" as
  our own design (below), and keep to the idea, not the numbers.

What we already do and what it means:
- Our mine already works the same way: **a generator per floor, made from the depth** (`src/mineMap.js`, `src/mine.js`), deterministic, so
  the same depth is the same cave, and floors are made when you arrive, never all at once. That matches Fate and needs no change.
- Fate's **quest generator** is the thing we do not have. A good small first step for the mine is a generated "job" at the cellar door
  (find N ore, reach floor N, put out no torch...), built from the same kind of templates: an item, a creature, a number, or a mix. Not in the
  five parts above; proposed as slice 6 and left for the owner to approve.

### Lane by lane

| Part | Lane that builds it | What | Needs first |
|---|---|---|---|
| Cellar place and hidden door | **town** (`src/places/undertaker.js`, cellar layout and scene as a placeholder pair, per `AGENTS.md`) | A cellar you walk into, with a hidden door you must find (a searchable spot), locked until Deacon Graves has a star; the card and prompt words; walk map tests (door reachable once found) | owner's boss choice (done) |
| The dark, the lantern, the torches | **mine** (`src/mine.js`, `src/modes/mine.js`) for the rules (carry, place, light radius, the dim ring, shop items, saved count), **art** for how it looks (`src/mineScene.js`: lighting, glow, fog, the black) | Light rules first (a pure module with tests); the look follows on the same data | the data contract goes first (`AGENTS.md`, rule 5) |
| Buying light | **town** (shop card) with **money** only if the wallet changes | A small shop for lantern and torches, priced in Bounty Dollars; a test that light is never priced in nuggets | the light rules |
| Monsters sense you by distance | **combat** (`src/enemySystem.js`, `src/mineMonsters.js` is the mine's) | A sense radius per monster (some wider, some narrower), idle or asleep outside it, a short wake-up, and a "lost you" distance (a leash) so they go back; the existing chamber sleep (45 and 100 units) becomes this per monster | none |
| Light eaters | **mine** (the monster's rules and floors) with **combat** (its behaviour) and **art** (its model: add a prompt to "Art prompts" above) | Only from a floor decided with the owner; they go to the nearest lit torch of yours and put it out; killing one is easy and is the answer; torches can be relit (cost decided below) | torches and the sense radius |
| Visible lift and shaft | **mine** (HUD, beams) with **art** | The lift and the shaft stay visible in the dark (a glow and a beam, and the HUD arrow already there), with a "you can see the lift from here" rule so a dark floor is never a lost player | the dark |

### Art status (art lane, code art only for now)

1. **The dark: built** (`src/placeDark.js`, `src/mineScene.js`). One screen-space layer, black outside a dim radius around the marshal; the lift (cold white beam) and the shaft (gold beam) glow above it and have a lit patch, so they are found from far away. The radius comes through one hook, `setMineLightSource(() => ({ radius, holes }))` in `src/placeDark.js`; the mine lane's light module should call it (lantern lit, torch near, out of oil = `MIN_RADIUS`, the faint ring). Until then a named constant (`LANTERN_RADIUS`) stands in. Waiting on: the **mine** lane's light rules.
2. **Torches and lantern: built** (`src/placeTorch.js`). `setMineTorches([{ x, z, lit }])` in `src/mineScene.js` shows them (lit ones burn, flicker and clear the dark; unlit ones are charred stubs with smoke, which is what a light eater leaves); `setMineLantern(false)` puts the marshal's lantern out. The **mine** lane calls these from its torch rules. Up to 48 torches, five draw calls in all.
3. **Light eater model: built** (`createLightEaterMesh` in `src/assets.js`): a small dark bug with pale mandibles, four running legs and a dim amber abdomen (`userData.ember`, an unlit child the rules may dim or brighten). Waiting on the **mine** lane (its rules and floors) and **combat** (its behaviour): they add the monster with `look: 'lighteater'` and the mesh in `MINE_MESHES` (`src/enemySystem.js`).
4. **Hidden door: built** as a part (`src/placeHiddenDoor.js`, `createHiddenDoor()`): `group.position`/`rotation.y` from the cellar layout, `update(t, distanceFromMarshal)` each frame (a faint seam of light, dust at the foot and a draught when near, nothing from far away), `setOpen(true)` swings it on a lit passage. Waiting on the **town** lane: the cellar layout and placeholder scene (`src/placeCellar.js`) that place it on a wall spot, say how wide the wall spot is (the door is 3.2 x 4.6 units; ask the art lane to change that), and call `setOpen` once Deacon Graves has a star.
5. **Bigger light: follows the mine lane's numbers.** `placeDark.js` and `placeTorch.js` now import `LANTERN_RADIUS`, `TORCH_RADIUS` and `MAX_HOLES` from `src/mineLight.js`, so the dark layer, the lantern and placed torches share one number; the torch limit is 12. Checked at 28 / 22: a wide soft-edged pool, black beyond it, 22 draw calls.

### Decided by the owner (2026-10-06, answers to the "still open" list)

1. **The lantern runs out of oil and needs refilling.** Everything costs in-game currency (earned Bounty Dollars, never Gold Nuggets): the lantern, oil, torches and anything else the dark needs. Prices are small and are tuned against what a Wanted Road run earns, because the mine itself pays no money (slice 2's rule), so the player must be able to afford a descent from road income.
2. **The floors grow slowly at first.** Today a floor grows fast (see "Level size and torches" below). Make the first 10 floors small and let size grow gently after that.
3. **Torches are permanent down to floor 14.** From **floor 15 and deeper it is undecided**: leave it as a single named setting in code (for example `torchesBurnOutFrom`), default permanent, and the mine agent proposes options to the owner before changing it.
4. **Light is sold in both places:** Mr. Grimsby and the general store (two shops, same rules; prices may differ a little, nothing else).
5. **Light eaters start about floor 8, and get more annoying the deeper you go:** more of them, faster, and they put out torches from further away and more often. Annoying, not unfair: they never hurt you (they put torches out), they are easy to kill, and the number and speed have a cap so a floor is never impossible. A put-out torch can always be relit.
6. **Relighting costs** a little (a match, in Bounty Dollars, or a splash of oil), never free and never a timer.
7. **It is the existing mine.** Saved deepest floor, checkpoints and ore carry over; the hidden door replaces today's direct stairs.
8. **Yes to the quest generator** (slice 6, below).

### Level size and torches (checked 2026-10-06)

Measured from `floorLayout(depth)` (`src/mineMap.js`; "main road" is the chain from the lift to the shaft):

| Floor | Chambers | Main road | Torches at one per 30 | at one per 45 |
|---|---|---|---|---|
| 1 | 4 | 404 | 14 | 9 |
| 2 | 6 | 780 | 27 | 18 |
| 3 | 8 | 1,033 | 35 | 23 |
| 5 | 12 | 1,876 | 63 | 42 |
| 8 | 15 | 2,354 | 79 | 53 |
| 10 | 15 | 2,383 | 80 | 53 |
| 20 | 15 | 2,596 | 87 | 58 |

So floor 1 is already about 400 and it is 1,900 by floor 5: marking the way back would take 60 or more torches, which is too many to carry, buy or place. **Targets for the mine agent** (the numbers are a start, to tune by playing): a main road of about 250 on floor 1, about 500 by floor 5, about 800 on floor 10, then growing slowly to about 1,500 by floor 30 and staying there; chambers `3 + floor` for the first 10 floors, then slowly; a torch roughly every 40 units, so about 6 torches on floor 1, 12 on floor 5, 20 on floor 10 and not more than about 38 deep down. Carry limit around 10 to 12, bought in stacks of a few, plus oil to match. Floors stay deterministic per depth (the generator is unchanged); only the sizes change, and `tests/mine*.test.js` pin the new targets.

**Built 2026-10-06 (slice 5, part 0: the floors are smaller).** `chamberCount` is now `3 + floor` for the first ten floors and one more chamber every five
floors after (up to `MAX_CHAMBERS` 17); chambers are 22 to 30 units wide (growing from the tenth floor) and spaced so the road (`roadLength`, the rails from
the lift to the shaft, one number the torches have to mark) is about 270 on floor 1, 550 on floor 5, 840 on floor 10, 990 on floor 15, 1,180 on floor 20 and
1,500 on floor 30 (`tests/mineMap.test.js` pins each target within 15% and says no floor jumps by more than 40%). A torch every 40 units is then 7 on floor 1,
14 on floor 5, 21 on floor 10 and 38 at the deepest. **Note on the table above:** it measured a longer "main road" than the rails (404 on floor 1); the
straight distance lift to shaft quoted in "The descent" (237 on floor 1) matches `roadLength`, so the targets are applied to `roadLength`. Two generator fixes
came with it, because new floors meant new dice: props are kept off the way into every alcove and treasure room, and a repair pass (`openBlockedWays`)
walks the cave after the props go in and takes away any column, crate or cart that shuts a way to the shaft, a chamber, a chest or an extra cavern; tunnel
mouths are only put where the marshal can walk. The wall ring also stands 1.2 units inside the open ground (`WALL_INSET`), so a thin spit of rock between two
caves cannot slip between its circles. Rockfalls are a little smaller (3.6 to 5.4) so they still fit the smaller chambers. Smaller chambers hold fewer
monsters (a chamber's danger grows with its area), so the early floors are quieter: tune `nodeBudget` if a playtest says so.

**Built 2026-10-06 (slice 5, part (a): the light rules).** `src/mineLight.js` (pure, with `tests/mineLight.test.js`) and a `light` field in `profile.mine`:
`{ lantern, oil, torches, matches }` (what he owns, kept inside its limits by `normalizeLightKit`). What it says:
- **Numbers:** `DIM_RING` 6 (always: your own feet), `LANTERN_RADIUS` 15 (lit, while it has oil), `TORCH_RADIUS` 12, a torch every `TORCH_SPACING` 40 units of the
  road (`torchesFor(roadLength)`: 7 on floor 1), `MIN_TORCH_GAP` 14, carry limit `CARRY_LIMIT` 10 torches and `MATCH_LIMIT` 20 matches, `OIL_CAPACITY` 900 seconds of burn.
- **What is sold** (`LIGHT_ITEMS`, in Bounty Dollars only; `buyLight(profile, id, shop)` spends `balances.dollars` and nothing else, and refuses without changing
  anything): the lantern (once, comes full), lamp oil (fills it), torches x5, matches x5 (a relight costs one match). Mr. Grimsby's and the general store
  charge the same except `SHOP_MARKUP` (the store 10% more, rounded up). The test fails if any price is in nuggets or any real-money product sells light.
- **Running out:** with no lantern or no oil the radius falls to the dim ring, never to nothing, so nobody is ever stuck (and the lift and shaft stay visible: part (c)).
- **A run:** `createLightRun(kit)`, `burnLantern`, `placeTorch` (not within `MIN_TORCH_GAP` of another on the same floor), `putOutTorch` (a light eater, part (d)),
  `relightTorch` (one match), `burnTorches` (only from `TORCHES_BURN_OUT_FROM`, default `Infinity`: permanent), `isLit`, and `lightSource(run, floor, at)` which returns
  `{ radius, holes: [{ x, z, r, k }] }` (at most 12 torches, nearest first): exactly what `setMineLightSource` in the art lane's `src/placeDark.js` reads.
- **Saving:** the run's summary carries `used: { oil, torches, matches }` and `applyMineRun` takes that from the kit (never below nothing, whatever happened to the
  marshal). Placed torches stay on their floor and are not returned. The server cannot see the run, so a client could under-report what it used: that gives free light,
  not money or power, and a server-issued run token (already proposed for the depth) would close it.
- **Owner to confirm (OPEN):** the prices (lantern 60, oil 15, torches x5 20, matches x5 5; a first kit 85 and a refill 35 against what a short Wanted Road run earns),
  the oil in a refill (a full lantern is 15 minutes of burn), and what torches do from floor 15 (`TORCHES_BURN_OUT_FROM`; options: stay permanent, burn out after
  `TORCH_BURN_SECONDS` 10 minutes, or need a match to relight each floor).
- **Built 2026-10-06 (town lane): Mr. Grimsby's shop card.** `src/lightShop.js` lays out what is for sale (`shopRows`: the four things, a dollar price each, and the reason one cannot be bought now, from exactly the refusals of `buyLight`, which a test checks for every state) and `src/places/undertaker.js` puts it on his card with a BUY button each; a sale goes to `wallet.buyLight({ id, shop })` (`POST /api/mine/buy`, the scale lane's) and the card is drawn again from the new profile. The card never names another currency (`tests/lightShop.test.js`). **The general store is built as a place of its own** (the owner's answer, 2026-10-06): a door on the town's west street (`store` in `src/townSpots.js`), `src/storeLayout.js`, `src/places/store.js`, a placeholder scene and building, the same shop card at the 10% markup (`tests/storeLayout.test.js`). Both shops sell through `wallet.buyLight`.
- **Still to do for the light:** the wallet and server calls to buy (`POST /api/mine/buy`, scale; `wallet.buyLight`, money), the shop cards (town), and the mine mode
  using it (a button to place a torch, burning the lantern, calling `setMineLightSource`): after the dark layer (#56) and the shops exist.

**Built 2026-10-06 (slice 5, part (b): monsters sense you by distance).** Cross-lane on purpose, owner approved: `src/enemySystem.js` and `src/bulletSystem.js`
are the combat lane's. In the mine a monster that came out of a chamber (`spawnEnemy` with a post) waits there until the marshal is inside its **sense radius**,
takes `WAKE_SECONDS` (0.7 s, standing and facing him: the tell) to wake, then hunts as before. If he gets away past its **leash** (twice the radius, never less than
40 beyond it) it gives up and walks back to its post, and sleeps again; if he returns before it is home it hunts at once. A shot that hits wakes it with no wait. The rule
is pure (`createSense`, `senseStep` in `src/combatMath.js`, tested); the radii are the mine lane's (`senseRadius`, `leashRadius` in `src/mineMonsters.js`): a number per
way of fighting (`SENSE_BY_BEHAVIOR`: chase 36, zigzag 34, charger 26, phantom 44, sniper 60, shooter 48, ...) and an override on an entry (bat 50, crawler 30,
stonekin 22, wraith 55). The Wanted Road, bosses and anything spawned without a post hunt from the start, so nothing there changes. The chamber rules (a chamber
fills within `WAKE_DISTANCE` 45 of its edge and empties past `LEAVE_DISTANCE` 100) stay as the cap on how many monsters exist; the radius decides when each one acts.
Every number is a guess to tune by playing. A lit marshal being sensed from farther is not built (it needs the light rules wired in).

**Built 2026-10-06 (slice 5, part (a) wired into the mine mode).** `src/modes/mine.js`: a run starts with a light kit (`mine.light`, from `profile.mine.light` once the shops
are open); the lantern burns oil each frame; **T** (or the TORCH button, made by the mode, for a touch screen) puts a torch down where the marshal stands (refused with a
word when none are left or one is too close); the HUD shows `TORCHES n` and `OIL nm` (or `LANTERN OUT`); `setMineLightSource` gives the dark layer the lantern's radius
(the dim ring when out of oil), `setMineTorches` shows the placed torches of the floor (they cut their own holes in the dark, so none are passed again as holes) and
`setMineLantern` lights or puts out the marshal's lantern. The run's summary carries `used` so the oil, torches and matches spent come off what he owns.
**Until the light shops are open, `LIGHT_NEEDS_SHOP` in `src/mineLight.js` is `false` and every run starts with a free full kit** (a lantern, full oil, 10 torches and 20 matches),
otherwise nobody could buy a lantern and the mine would be black for everyone. When the shops are in, set it to `true`: a run then starts with what he owns.

**Built 2026-10-06 (slice 5, part (d): the light eater).** `lighteater` in `MINE_MONSTERS` (`special`: not on the ladder, so the one-new-monster-a-floor rule is untouched): a pale bug
that lives on light, hp 1 (one shot), `harmless` (it never touches the marshal), wearing the crawler's look until the art lane makes its own (prompt below). From floor 8 a
chamber may hold one (`eaterChance`: 31% on floor 8 rising to the cap of 70%; at most one to a chamber, never the landing; its dice are drawn after the chamber's other
monsters, so those do not change). New behaviour `eater` in `src/enemySystem.js` (combat lane's file, cross-lane on purpose, owner approved): it sleeps by the usual sense
rules (radius 30), then walks to the nearest lit torch of the marshal's within `eaterReach` of itself and gnaws it for `eatSeconds`, which puts it out (`putOutTorch`); with nothing to
eat it hovers near the marshal. It gets more annoying with depth and every number is capped, so a floor is never impossible: speed 6.5 rising to 11, reach 24 rising to 60,
gnaw time 3.0 s falling to 1.0 s. A put-out torch shows as a smoking stub (the art lane) and **T beside it relights it with a match** (one match, bought in the shop; never free).
Nothing else is hurt by it, and the cheapest answer is to shoot it.

*Art prompt, the light eater (`lighteater`):* "Low-poly stylised cave bug about 1 unit long, a pale grub-like body with six short legs and two wide round eyes, a soft glow inside
its belly as if it has swallowed a lamp, small blunt jaws. Cream and pale grey with a faint warm yellow glow in the belly. Cartoon proportions, chunky shapes, friendly rather
than scary, readable from the high camera in the dark." Add a row to `ASSETS.md` when it exists.

### Decisions and options from the owner's answers (2026-10-06, second round)

**Oil (the owner said "choose something reasonable"; built).** A full lantern stays 15 minutes of burn (`OIL_CAPACITY` 900 s). A flask fills it. **A top-up costs in proportion to
the oil missing**, with a small minimum (`priceOf('oil', shop, kit)`; `OIL_MIN_PRICE` 2 dollars), so nobody pays 15 dollars to add a minute; with no kit named the price is the full
flask's, which is what the shop card shows until it passes the kit. Prices stay my first guess in one table (`LIGHT_ITEMS`: lantern 60, oil 15 for a full flask, torches x5 20, matches x5 5; the general
store 10% more); the owner has not confirmed them. **`LIGHT_NEEDS_SHOP` is flipped to `true` in its own small PR right after the shops (#73) merge**, not before.

**Thin air from floor 15 (built, named and tested).** "Torches go out for lack of oxygen, randomly, not all of them, just a few; the deeper you go the more it becomes an issue."
`THIN_AIR_FROM_FLOOR` is 15. A torch put down on a thin floor gets, from the floor and its number on the floor, a time after which the air puts it out, or never
(`torchFailAfter`): about 10% of torches on floor 15, rising 2.5 points a floor to a cap of 50% (`torchFailChance`), each lasting between 1 and 6 minutes. The first torch of a floor never fails, so
the way back is never all dark. The same floor goes the same way every time (a hash of floor and torch number), so tests fix it. A dead torch is the same smoking stub as a light eater's:
**T beside it relights it with a match**, and a relit torch may fail again at a time of its own. The mode says `THE AIR IS THIN: A TORCH WENT OUT` where it happened. This replaces the
earlier open `TORCHES_BURN_OUT_FROM` idea.

**The oxygen bar from floor 15: OPTIONS for the owner (nothing is wired; `OXYGEN_ENABLED` is `false` in `src/mineAir.js`).** The owner gave no details beyond "the marshal has an oxygen bar as well".
`src/mineAir.js` is pure rules with tests, so any choice below is a change of numbers, not of design. My default is marked **(default)**.
- *What drains it.* **(default)** Time on a thin floor, gently on floor 15 (`0.5` units a second, a full bar of 100 lasting 200 s) and worse deeper (`+0.05` a floor, capped at `2.0`, 50 s). *Or* only while running, dashing or shooting
  (rewards standing still; punishes the fight). *Or* only when far (more than about 40 units) from the lift and from any lit torch of his (rewards laying a torch road).
- *What refills it.* **(default)** At the lift (within 14 units, 12 a second) and beside a lit torch of his (within 10 units, 3 a second: a place to catch his breath, not a cure); arriving on a new thin floor gives 25 at once so a floor is never started on empty.
  *Or* also a landing on every fifth floor (the checkpoints). *Or* an oxygen flask bought in the shop: Bounty Dollars only, filling part of the bar, never touching combat and never sold for nuggets.
- *What happens at empty.* **(default, non-lethal)** The marshal is a little slower (x0.85) and his lantern a little dimmer (x0.6, never below the dim ring), growing worse from a quarter bar down; the bar warns. *Or* a blurred, darkened screen only. *Or* (not recommended) hearts drain slowly: it changes combat
  stakes, which the game rules keep for fights.
- *Where the bar shows.* A HUD element: the **ui lane's** (the coordinator should hand it a spec: `airEffects(air)` gives `{ speed, light, warning, empty }`, `air.level` is 0 to 100).
Money must not buy combat power: if oxygen can be bought it is Bounty Dollars only and the item changes the bar, not damage, fire rate or enemies (`tests/mineAir.test.js` checks no effect touches hearts or damage).

**Held, not answered by the owner (listed for the coordinator):** (1) rescaling the floor lengths if "main road" meant the longer measure in the table above (one constant, `hopGap` in `src/mineMap.js`); (2) a small "lift or shaft in sight" HUD rule (the art lane's glow and beams and the HUD arrows already work).

**The light shops are open (#73), so `LIGHT_NEEDS_SHOP` is now `true` (2026-10-06).** A run starts with what the player owns (`profile.mine.light`) and nothing else; with no lantern he has the dim ring
and the lift and the shaft to walk back by (never a softlock). The free kit (`FREE_KIT`) is kept only as a test aid behind the setting. The mine smoke starts as a player who has bought a kit.
**Bigger light (owner, 2026-10-06: "the light is too small").** `LANTERN_RADIUS` 15 to **28** and `TORCH_RADIUS` 12 to **22** (about 1.9x and 1.8x), both named constants in `src/mineLight.js`; the dim ring
stays 6 (your own feet, with no light). Beyond them it is still truly black. A chamber is 22 to 30 wide, so the lantern lights about a chamber's width; a torch every 40 units overlaps its
neighbour a little (2 x 22 = 44), so a torch road is a lit path with dark cave to either side. `MIN_TORCH_GAP` (14) is unchanged. **For the art lane (`src/placeTorch.js`, `src/placeDark.js`):** the
lantern's radius reaches the dark layer through the hook as before, but a placed torch's hole is drawn with the art lane's own `TORCH_LIGHT_RADIUS` through `setMineTorches`, so it stays small until
that is set from `TORCH_RADIUS` in `src/mineLight.js` (and the `limit` of `torchHoles`, 8, raised towards the 12 the light rules allow; `MAX_HOLES` 16 already fits the lift, the shaft and 12 torches).

**The oxygen bar: spec for the ui lane (the owner confirmed my defaults, 2026-10-06).** Confirmed: drain = time on a thin floor (0.5 a second on floor 15, +0.05 a second each floor deeper, cap 2.0); refill = at the lift and beside
a lit torch of his, plus the arrival fill; **not** checkpoints and **not** a shop flask; at empty = a slower marshal and a dimmer lantern, never a lost heart. `OXYGEN_ENABLED` in `src/mineAir.js` is set to
`true` when the bar is wired. The bar is a HUD element built from `src/mineAir.js`: `air.level` (0 to `AIR_CAPACITY` 100), `airLow(air)`, `airEmpty(air)` and `airEffects(air)` = `{ speed, light, warning, empty }`
(`speed` and `light` are factors from 1 down to `SLOW_AT_EMPTY` 0.85 and `LIGHT_AT_EMPTY` 0.6). It shows only on floors 15 and deeper (`THIN_AIR_FROM_FLOOR`), warns below `LOW_AIR` (25), and
fills fast within `LIFT_AIR_RADIUS` (14) of the lift. The mine mode will call `tickAir(air, dt, { floor, nearLift, nearLitTorch })` each frame, `arriveAir` on each new floor, scale the marshal's speed by
`airEffects(air).speed` and the lantern radius by `.light`; that wiring is the mine lane's and follows once the bar exists.

## Slice 6: quests from the graves (owner's brief, 2026-10-06)

The owner said yes to a quest generator, with a theme: **the graves in Deacon Graves's place are the quest givers, fallen souls who want
revenge or want their quests finished.** The investigation (see Slice 5) found that Fate's quests are small random templates: find an item,
kill one creature, kill a number of creatures, or a mix, plus a main quest that enlarges an ordinary monster and puts it on a deep floor.

- **A generator, not a list:** `src/graveQuests.js` (pure, deterministic from a seed and the day, with tests): a template (find, hunt, clear,
  or a mix) plus a target (an ore count, a monster kind, a floor, a number) plus a soul's story line. Quests are made when you open a grave,
  not all at once; two players on the same day may see the same graves.
- **Where it happens:** the graves live in Deacon Graves's place (town lane: layout, card, rules); the targets are in the mine (mine lane:
  counts what you kill and find, already saved in `profile.mine`). Combat lane: only if a quest needs a stronger "revenge target" monster.
- **The main grave** is the Fate main quest in our terms: one named monster, bigger and tougher, on a deep floor, with a posse.
- **Rules:** no stars, no Gold Nuggets and no timers. **Rewards are open (ask the owner):** score, ore, cosmetic titles, or a small amount of
  Bounty Dollars. Since light costs money and the mine pays none, a small Bounty Dollar reward from a grave quest may be the fair answer.
- Needs first: the dark mine (Slice 5), then a data contract (quest state in the profile and the server) before the screens.

**Design note and the generator (town lane, 2026-10-06).** `src/graveQuests.js` is the pure generator (`tests/graveQuests.test.js`); nothing else is built yet.
- **Six graves, six souls** (`SOULS`): each has a name, a trade, a mood (*revenge* or *unfinished*) and one line. A grave's quest is made when it is opened from
  `graveQuest({ seed, day, grave, deepest })`: the same inputs always give the same quest. `seed` is 0 for everyone the same day, or an account's own number if the
  owner wants different graves for different players.
- **Templates (Fate's small ones):** FIND (bring up ore), HUNT (kill one named creature), CLEAR (kill a number of one kind), MIX (a clear and a find). One grave
  each day is the **main** grave: a named creature, bigger and tougher, on floor 10 or three below the deepest the player has reached, with 2 to 4 of another
  kind following it. The target kinds are only what lives on the asked floor (`mineRoster`), and an ordinary quest is never deeper than two floors below the
  player's deepest, so it is always something he can do. A new player is sent no deeper than floor 2.
- **What the mine lane has to count** (a tally since the quest was taken): `{ kills: { monsterId: n }, ore: n }`. `questProgress(quest, tally)` reads it and says
  which goals are done. The state in the profile and the server (`profile.quests`: the quest ids taken, their tallies, the ones finished) is the data contract for
  the next PR, once the reward is decided.
- **The graves appear only after Deacon Graves has a star** (`gravesOpen`, the same unlock as the cellar's hidden door), and they stand in his own section, Hollow Hill
  (owner, 2026-10-06). Same quests for every player on the same day (`seed` 0), made when a grave is opened.
- **What a quest pays (owner's answers, 2026-10-06): it depends on the quest and pays more the deeper it goes.** `questReward(quest)` gives `{ dollars, ore, title }`:
  earned Bounty Dollars, ore, and for the main quest a cosmetic rank title; never Gold Nuggets, stars or anything that changes a fight. `dollars = (6 + 4 x floor)`
  times the template's share (find 0.8, clear 1, hunt 1.2, mix 1.4, main 1.8), rounded, at most **$90** a quest; `ore = floor / 2` (the main quest: 1.5 x floor), at least 1;
  the main quest's title by its floor: 10 DELVER, 15 DEEP DELVER, 25 LAMPLESS, 40 THE LONG DARK. A quest is never timed.

  | Floor asked | find | clear | hunt | mix | main |
  |---|---|---|---|---|---|
  | 2 | $11 | $14 | $17 | $20 | (the main quest is never above floor 10) |
  | 6 | $24 | $30 | $36 | $42 | |
  | 10 | $37 | $46 | $55 | $64 | $83 and DELVER |
  | 20 | $69 | $86 | $90 | $90 | $90 and DEEP DELVER |
  | 40 | $90 | $90 | $90 | $90 | $90 and THE LONG DARK |

  The most the six graves of a day can pay together is six times the cap, $540, always less than the $600 a single Wanted Road run can bank
  (`MAX_DOLLARS_PER_RUN`); the table is pinned by `tests/graveQuests.test.js`. Since light costs money and the mine pays none, this is where the
  mine's money comes back, only through the graves and only for the deeper trips; ore and titles are banked and shown the same way as before.
- **Not built yet:** the state in the profile and the server (`profile.quests`: the quests taken, their tallies, the ones finished and paid), the cards on the hill, and
  the mine lane's counting. The data contract goes next.

## Open questions

- How much ore a fall costs: 2a starts with all of the run's carried ore (`FALL_KEEPS`). To tune from playtests.
- How big is too big: floor 5 is about 900 units from lift to shaft. At the marshal's speed that is a minute of walking without a fight.
  If it feels long on a phone, the chamber spacing in `generate` is the one number to bring in.
- Whether the mine gets its own leaderboard (deepest floor). Not before the server and the policy exist (`MONETIZATION.md`).
- Whether the dog follows you down. It is a companion in town only today (`src/townCompanion.js`).

## Verify

`npm test` (unit tests: `tests/mine.test.js`, `tests/mineMap.test.js`, `tests/mineMonsters.test.js`, `tests/undertakerLayout.test.js`,
`tests/townSpots.test.js`, `tests/atmosphere.test.js`), then `npm run test:mine` (the door, the parlour, four depths with a new monster and a
bigger cave on each, the always-open shaft, a chest, and the lift up; `SHOTS=dir` saves a picture of each) and `npm run test:town` for the
walkable town.
