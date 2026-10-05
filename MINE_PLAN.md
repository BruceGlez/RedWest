# The Undertaker's Mine: a descent under Lantern Rock

Written 2026-10-05. The undertaker's building in town (`src/townScene.js`) is scenery today: no door, no card, no barks. This plan
turns it into the way down into an old miners' claim that the Company sealed, with levels, in the spirit of *Fate* (2005)
(`TOWN_PLAN.md`): the town is where you prepare, the mine is where you descend, and a lift brings you back.

The inspiration is mood and structure only. No names, art or characters from that game (see `ASSETS.md`).

## The idea in one paragraph

Mr. Grimsby, the undertaker, keeps a cellar hatch behind his shop. It leads down to the **Hollow Claim**, a mine of numbered
floors. Each floor is a fight in the dark: clear every pursuer and the shaft down opens. Deeper floors bring heavier enemies,
every fifth floor is a boss, and a checkpoint lift lets you ride back up to town and come back down to where you got to.

## House rules (the same as the rest of the game)

- Buildings and places never change combat in the Wanted Road; the mine is its own mode, like the Arena.
- Nothing is sold as a speed-up. Mine rewards are Bounty Dollars, ore and cosmetics, never stars and never real money.
- Stars come only from the Wanted Road, never from the mine.
- Walking must give something a button does not: the hatch is a place you walk to, and the town shows what the mine has done.

## Slices

| Slice | What | Size | Status |
|---|---|---|---|
| **1** | The way down from town, floors 1 to 5 in a dark mine look, depth scaling, a lift back up. Saves nothing (practice rules, like the Arena). | small to medium | **built 2026-10-05** (below) |
| **1b** | Maps made for it: the undertaker's parlour as a place you walk into, and a cave of its own for each floor, with walls, rails, a lift and a shaft you walk to. All drawn in code. | medium | **built 2026-10-05** ("The maps", below) |
| **2** | A deepest floor that is saved, checkpoints every 5 floors, ore picked up on the way down, ore lost when you fall and kept when you ride up | medium | planned |
| **3** | Boss floors (every 5th), enemies that live only in the mine, Mr. Grimsby's barks and rumours | medium | planned |
| **4** | The art pass for the maps: modelled rock, timber, carts, a real lift and shaft, painted textures (`POLISH_PLAN.md`, section 6) | large | parked, like the other art passes. The maps below are made of boxes so this can replace them one builder at a time. |

### Slice 1, as built

- **The way in:** the undertaker's door in town (`src/townSpots.js`, `undertaker`, verb `ENTER`) opens Mr. Grimsby's parlour (below). The
  cellar stairs at the back are a place in the parlour; the prompt reads `THE CELLAR STAIRS: THE HOLLOW CLAIM`.
- **The rules:** `src/mine.js`, with no rendering so it can be unit tested. It holds the floor count (5), the floor-to-stage ladder
  (floor *n* uses the enemies and difficulty of stage *n*, so each floor brings the next new enemy: rattlers, riflemen, dynamiters,
  brutes), the size of a floor, and when a floor counts as cleared.
- **How a floor plays:** `src/gameLoop.js` runs a floor like a pursuit with no timer. The director spends the floor's budget, and
  the floor is cleared when the budget is spent and no enemy is left. Heat no longer refunds budget in the mine, so a hot streak
  cannot make a floor endless. When the floor is cleared the shaft opens (the boards come off and a beam of light shows), the HUD
  names the distance and direction (`SHAFT 42 m ->`) and the marshal walks to it to go down. On floor 5 the same shaft is the lift
  up, and reaching it ends the run.
- **The look:** a dark, lantern-lit `MINE_ATMOSPHERE` in `src/atmosphere.js` (still bright enough to read on a phone), with a
  rock surface for footsteps. It is not one of the outlaws' stages, so the stage tests are untouched. The desert's props are not
  scattered in the mine at all: each floor is laid out by hand.
- **What is saved:** nothing. Dying or finishing shows a practice result with the floor reached. The run log, stars, earnings and
  leaderboards are not touched. Saving the deepest floor is slice 2.
- **Not in slices 1 and 1b:** checkpoints, ore, bosses, mine-only enemies, more of Mr. Grimsby's talk (he has one line per band of outlaws beaten), modelled art, the weekly event, the revive.

### The maps (slice 1b)

**The undertaker's parlour** is a place of its own, like Calloway Farm (`PLACES.md`): `src/undertakerLayout.js` is the flat map and
the rules (no rendering, so `tests/undertakerLayout.test.js` can walk it), `src/placeUndertaker.js` draws it, and `src/townPanel.js` hosts
it next to the farm (a second place, with the same walking code). It is a cut-away room: tall back and side walls, a low front sill,
candlelight. In it: a counter with Mr. Grimsby behind it (TALK opens a card with one line for how many outlaws you have beaten),
three coffins on show, a waiting bench, a stove, and the cellar stairs behind the coffins (DESCEND). A door at the front goes back to the
street. The tests check that every door can be stood at and walked to, that nothing blocks the way, and that you never start on a prompt.

**The caves** are one per floor, each a few shapes (circles, boxes, capsules) whose union is the open ground; everything else is rock:

| Floor | Cave | What it is for |
|---|---|---|
| 1 | The Upper Gallery | A round cavern, a rail passage east and the shaft in a small chamber. The first look at a mine. |
| 2 | The Rail Cut | A long straight gallery with side alcoves and ore carts: a corridor fight. |
| 3 | The Twin Caverns | Two caverns joined by a wide pass, with columns for cover. |
| 4 | The Crossing | Two galleries crossing under a round chamber: enemies from several sides. |
| 5 | The Deep Hollow | A ring of linked caverns with a column field and the shaft in the farthest. |

How they work (`src/mineMap.js` is the rules, `src/mineScene.js` the drawing; `tests/mineMap.test.js` checks all of it):
- Plain chasers walk straight at the marshal, so every cavern is wide and roughly convex and every passage is wide enough to fight in.
  Columns give cover instead of mazes. The test floods every cave the way the marshal can really walk it: the shaft and every tunnel
  mouth are reachable, nothing leaks out, and no wall has a gap a bullet could slip through.
- Walls are solid for the marshal, for enemies and for bullets: a ring of circles in the first few units of rock, plus a hard test that
  anything inside the rock is blocked, so nobody can stand, spawn or land in it (`src/physics.js`).
- Enemies come out of tunnel mouths far from the marshal instead of a ring around him, slide along walls instead of standing against
  them, and are put back at a mouth if a knock-back ever leaves one in the rock (`src/enemySystem.js`).
- Walls rise as they go back from the cave: low at its edge so the camera, which stands to the south and high, never loses the
  marshal behind them, and tall in the rock behind. Past the last block is plain dark rock, which reads as the roof.
- Every floor starts on the lift at (0, 0) and the shaft is a real walk away (at least 50 units). Rails run from one to the other.
- Everything is boxes, cylinders and a few merged meshes: the floor, the rock, the props (columns, timber arches, crates, carts, rails,
  the lift) and the lantern glow are about five draw calls, plus the shaft. Slice 4 can replace any one without touching the rules.

## Open questions

- How much ore a fall costs (slice 2): a share of what was carried, or all of it. To tune from playtests.
- Whether the mine gets its own leaderboard (deepest floor). Not before the server and the policy exist (`MONETIZATION.md`).
- Whether the dog follows you down. It is a companion in town only today (`src/townCompanion.js`).

## Verify

`npm test` (unit tests: `tests/mine.test.js`, `tests/mineMap.test.js`, `tests/undertakerLayout.test.js`, `tests/townSpots.test.js`,
`tests/atmosphere.test.js`), then `npm run test:mine` (the door, the parlour, the five caves and the lift up; `SHOTS=dir` saves a picture of each)
and `npm run test:town` for the walkable town.
