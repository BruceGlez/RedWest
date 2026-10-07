# Lane: Farm, town and places

**Mission:** Calloway Farm, the town and every place you walk into (`PLACES.md`, `TOWN_PLAN.md`).

## Backlog (from `PLAN.md`)
- Places H2 to H5: Vane's Crossing orders, Morgan's Channel water, Foundry Yard, Fort Pell, Copper Bit, Tres Rios, Whisper Wash, Silver Belle, Hollow Hill
- Farm second field and levels
- New places are one file in `src/places/<name>.js` (a factory, shape in `src/places/registry.js`) plus one `registerPlace` line in `src/places/index.js`, a scene in `src/place<Name>.js`, and a `styles/` file. `townPanel.js` is no longer edited for a new place
- The Arena is a run mode in `src/modes/arena.js`

## Rules
You own the **layout, rules and cards** of the town and every place, not the look: the scene builders (`placeFarm.js`, `townScene.js`, `src/place*.js`) are the art lane's. A new place's PR adds a plain box-built placeholder scene so it works at once, flagged "cross-lane on purpose"; after that the art agent owns its look. See "Art and function on the same area" in `AGENTS.md`.
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

## Backlog: the cellar and the hidden door (owner's brief, `MINE_PLAN.md`, "Slice 5")
- The cellar becomes a place you walk into (pair per `AGENTS.md`: layout, rules, card, registry line, and a box placeholder scene marked "cross-lane on purpose: placeholder scene"). It holds a hidden door you have to find; the door opens only once **Deacon Graves** has a star (decided). Until then the stairs lead only to the cellar.
- The shops for the lantern, oil and torches: **two** of them, Mr. Grimsby's and the general store (decided 2026-10-06), Bounty Dollars only (a test that light is never priced in nuggets), once the mine lane's light data exists.
- **Slice 6, quests from the graves** (`MINE_PLAN.md`): the graves in Deacon Graves's place give generated jobs from fallen souls who want revenge or want their quests finished. Layout, cards and rules are the town lane's; the generator is a pure module with tests (`src/graveQuests.js`); the mine lane counts kills and finds. Rewards are an open question for the owner.
- `src/places/undertaker.js` today sends the stairs straight into the mine; existing saves (deepest floor, checkpoints, ore) must keep working.

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:town`

## Note: the shift screen moved to the ui lane (2026-10-07)
`src/saloonShiftView.js` and `styles/townSaloon.css` now belong to the `ui` lane (owner decision, `docs/design/copper-bit-shift.md`). You keep the rules and the bar's card. Ask the ui lane for view changes; add data the view needs to `src/saloonShift.js` first. New `styles/town<Name>.css` files must be named `styles/town-<name>.css` to stay yours.
