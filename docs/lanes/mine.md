# Lane: Mine floors and mine monsters

**Mission:** The Hollow Claim: floors, builder and monsters (`MINE_PLAN.md`).

## Backlog (from `PLAN.md`)
- Slice 2: saved deepest floor, checkpoints, ore (needs a server field: coordinate with scale and money)
- Slice 3: boss floors
- More monsters and floor variety in `mineMonsters.js` and `mineMap.js`
- Mine flow is `src/modes/mine.js` (a run mode, see `src/modes/registry.js`): begin a floor, spawn, chests, shaft, lift. Add new floor kinds or boss floors there; do not edit `gameLoop.js`
- Put mine-only styles in `styles/mine.css` and import it from `style.css`

## Rules
You own the **cave layout, monsters and rules** (`mineMap.js`, `mineMonsters.js`, `src/modes/mine.js`), not the look: `mineScene.js` and the parlour scene (`placeUndertaker.js`) are the art lane's. The scene reads the cave data from `mineMap.js`; if a look needs a different cave shape, change the layout first. See "Art and function on the same area" in `AGENTS.md`.
The mine never gives stars and never sells speed-ups. Rules live in `mine.js` with no rendering so they can be unit tested.

## You own
- `src/mine*.js`
- `src/placeUndertaker.js`
- `src/undertakerLayout.js`
- `styles/mine.css`
- `MINE_PLAN.md`
- `tests/mine*`
- `tests/undertakerLayout.test.js`

## Backlog: the dark mine (owner's brief, `MINE_PLAN.md`, "Slice 5")
- Light rules first, as a pure module with tests: the lantern, the torches you carry and place, the dim ring (always visible: your feet, the lift and the shaft), what a placed torch lights.
- The light eater (rules, floors from about 8 on, goes for your lit torches), after torches and the combat lane's sense radius exist.
- The lift and shaft stay visible in the dark (glow, beam, the HUD arrow that is already there); a player with no light can always walk back to the lift.
- **Make the floors smaller and slower-growing first** (owner, 2026-10-06): targets and the measured table are in `MINE_PLAN.md`, "Level size and torches". Torches are about one per 40 units, so floor 1 needs about 6, not 14 or more.
- The lantern runs out of oil and needs refilling; everything light costs earned Bounty Dollars (never nuggets). Torches are permanent down to floor 14; from floor 15 it is undecided (one named setting, default permanent; propose options to the owner). Relighting costs a little. Light eaters from about floor 8, more annoying with depth but capped and never harmful. All decided answers are in `MINE_PLAN.md`, "Decided by the owner".
- Quest targets for Slice 6 (kills and finds counted in `profile.mine`) come after the dark mine.

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:mine`
