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
| **2** | A deepest floor that is saved, a checkpoint every few floors, ore picked up on the way down, ore lost when you fall and kept when you ride up | medium | planned |
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
- **A pursuit with no waves.** The cave keeps a measure of danger (the sum of the costs of everyone chasing) around the marshal and
  tops it up: more danger and faster top-ups with depth (`mineWave`). Pursuers come out of tunnel mouths in a ring around him, not far
  across the cave, and are asleep when he is more than 64 units away.
- **The way down is always open.** The shaft is a pit with a ladder, a ring of light on the floor and a beam of light 46 units tall that
  shows over the rock from far away. The HUD always says how far it is and which way (`SHAFT 237 m ->`). Walking into it goes down a
  floor and pays a little score (50 x depth).
- **The lift always brings you back.** It is where you arrive. It works once you have walked 20 units away from it (so you do not
  ride up by accident), and the HUD says how far it is (`LIFT UP 96 m <-`). Riding up ends the run with the depth you reached.
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

## Open questions

- How much ore a fall costs (slice 2): a share of what was carried, or all of it. To tune from playtests.
- How big is too big: floor 5 is about 900 units from lift to shaft. At the marshal's speed that is a minute of walking without a fight.
  If it feels long on a phone, the chamber spacing in `generate` is the one number to bring in.
- Whether the mine gets its own leaderboard (deepest floor). Not before the server and the policy exist (`MONETIZATION.md`).
- Whether the dog follows you down. It is a companion in town only today (`src/townCompanion.js`).

## Verify

`npm test` (unit tests: `tests/mine.test.js`, `tests/mineMap.test.js`, `tests/mineMonsters.test.js`, `tests/undertakerLayout.test.js`,
`tests/townSpots.test.js`, `tests/atmosphere.test.js`), then `npm run test:mine` (the door, the parlour, four depths with a new monster and a
bigger cave on each, the always-open shaft, a chest, and the lift up; `SHOTS=dir` saves a picture of each) and `npm run test:town` for the
walkable town.
