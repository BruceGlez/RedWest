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
| **1** | The cellar hatch in town, floors 1 to 5 on a reused map in a dark mine look, depth scaling, a lift back up. Saves nothing (practice rules, like the Arena). | small to medium | **built 2026-10-05** (below) |
| **2** | A deepest floor that is saved, checkpoints every 5 floors, ore picked up on the way down, ore lost when you fall and kept when you ride up | medium | planned |
| **3** | Boss floors (every 5th), enemies that live only in the mine, Mr. Grimsby's barks and rumours | medium | planned |
| **4** | A proper mine scene instead of the reused map: timber supports, rails, carts, lanterns, a lift (`POLISH_PLAN.md`, art pass) | large | parked, like the other art passes |

### Slice 1, as built

- **The hatch:** a `hatch` place in `src/townSpots.js`, beside the undertaker's door (verb `DESCEND`). The prompt reads
  `THE HOLLOW CLAIM: FLOOR 1`. The cellar doors and a lantern are drawn in `src/townScene.js` next to the building, and the marshal
  walks around them like any other prop.
- **The rules:** `src/mine.js`, with no rendering so it can be unit tested. It holds the floor count (5), the floor-to-stage ladder
  (floor *n* uses the enemies and difficulty of stage *n*, so each floor brings the next new enemy: rattlers, riflemen, dynamiters,
  brutes), the size of a floor, and when a floor counts as cleared.
- **How a floor plays:** `src/gameLoop.js` runs a floor like a pursuit with no timer. The director spends the floor's budget, and
  the floor is cleared when the budget is spent and no enemy is left. Heat no longer refunds budget in the mine, so a hot streak
  cannot make a floor endless. After the break the next floor begins; clearing floor 5 ends the run with the lift back up.
- **The look:** a dark, lantern-lit `MINE_ATMOSPHERE` in `src/atmosphere.js` (still bright enough to read on a phone), with a
  rock surface for footsteps. It is not one of the outlaws' stages, so the stage tests are untouched.
- **What is saved:** nothing. Dying or finishing shows a practice result with the floor reached. The run log, stars, earnings and
  leaderboards are not touched. Saving the deepest floor is slice 2.
- **Not in slice 1:** checkpoints, ore, bosses, mine-only enemies, barks, a modelled mine, the weekly event, the revive.

## Open questions

- How much ore a fall costs (slice 2): a share of what was carried, or all of it. To tune from playtests.
- Whether the mine gets its own leaderboard (deepest floor). Not before the server and the policy exist (`MONETIZATION.md`).
- Whether the dog follows you down. It is a companion in town only today (`src/townCompanion.js`).

## Verify

`npm test` (unit tests: `tests/mine.test.js`, `tests/townSpots.test.js`, `tests/atmosphere.test.js`), then `npm run test:town`
for the walkable town.
