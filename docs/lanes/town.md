# Lane: Farm, town and places

**Mission:** Calloway Farm, the town and every place you walk into (`PLACES.md`, `TOWN_PLAN.md`).

## Backlog (from `PLAN.md`)
- Places H2 to H5: Vane's Crossing orders, Morgan's Channel water, Foundry Yard, Fort Pell, Copper Bit, Tres Rios, Whisper Wash, Silver Belle, Hollow Hill
- Farm second field and levels
- New places are one file in `src/places/<name>.js` (a factory, shape in `src/places/registry.js`) plus one `registerPlace` line in `src/places/index.js`, a scene in `src/place<Name>.js`, and a `styles/` file. `townPanel.js` is no longer edited for a new place
- The Arena is a run mode in `src/modes/arena.js`

## Rules
Places change income and goods, never combat. A tended place never earns more than the jail's top rate. No timer is sold.

## You own
- `src/farm*.js`
- `src/placeFarm.js`
- `src/town.js`
- `src/townWalk*.js`
- `src/townSpots.js`
- `src/townSpace.js`
- `src/townTravel.js`
- `src/townFolk.js`
- `src/townCompanion.js`
- `src/townFeatures.js`
- `src/townTime.js`
- `src/townNews.js`
- `src/townDistricts.js`
- `src/arena.js`
- `src/steps.js`
- `styles/town*.css`
- `styles/farm.css`
- `styles/arena.css`
- `PLACES.md`
- `TOWN_PLAN.md`
- `tests/farm*`
- `tests/town*`
- `tests/arena.test.js`
- `tests/steps.test.js`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:town`
