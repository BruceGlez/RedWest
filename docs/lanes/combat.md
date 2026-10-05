# Lane: Combat and balance

**Mission:** How a fight feels and is balanced.

## Backlog (from `PLAN.md`)
- Tune Heat, bounties, enemy and boss numbers from playtest data
- Hit and death feedback, new enemies and weapons
- Balance numbers are first guesses; record loadout and aim mode with every playtest note

## Rules
Money never buys combat power; unit tests enforce it. Buildings and places never change combat.

## You own
- `src/aimAssist.js`
- `src/bulletSystem.js`
- `src/combatFx.js`
- `src/combatMath.js`
- `src/enemySystem.js`
- `src/enemyTypes.js`
- `src/heat.js`
- `src/lootSystem.js`
- `src/physics.js`
- `src/playerSystem.js`
- `src/weapons.js`
- `src/outlaws.js`
- `src/turning.js`
- `src/bounty.js`
- `tests/aimAssist.test.js`
- `tests/combatMath.test.js`
- `tests/enemyTypes.test.js`
- `tests/heat.test.js`
- `tests/outlaws.test.js`
- `tests/perks.test.js`
- `tests/turning.test.js`
- `tests/bounty.test.js`
- `tests/boss-smoke.mjs`
- `tests/enemies-smoke.mjs`
- `src/perks.js`
- `tests/progress.test.js`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:enemies`
- `npm run test:bosses`
