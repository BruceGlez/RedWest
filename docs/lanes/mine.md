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

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:mine`
