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

## Backlog: monsters sense you by distance (owner's brief, `MINE_PLAN.md`, "Slice 5")
- A sense radius per monster, Fate style: idle or asleep outside it, a short wake-up when you come inside it, and a leash distance past which it gives up and goes back. Today the mine uses fixed 45 and 100 unit chamber rules; this makes it per monster. Keep the Wanted Road's numbers unless the owner says otherwise.
- Behaviour for the light eater (it walks to the nearest lit torch of yours and puts it out; easy to kill), together with the mine lane's rules for it.

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:enemies`
- `npm run test:bosses`

## Dusty Pete finishable pursuit (2026-10-10)
- The minimal canyon run uses the shared 22-HP charge-and-punch Pete. The standalone three-phase `bossPete.js` remains a future combat slice; the mode no longer ticks a second, disconnected HP state.
- Arena, mine and weekly event runs retain their own modes. The shared loop resolves the menu selection before choosing a mode and lends `clearSceneCollections` so the canyon starts without random road obstacles.
- Actual clue pickups unlock one boss at `{ x: 0, z: 100 }`. The shared defeat callback banks Pete's bounty once, records the defeat star/unlock, displays BOUNTY CLAIMED and clears the checkpoint.
- Death preserves the last campfire's HP, ammo, clues, crate and fire state; RETURN TO TOWN followed by another pursuit resumes it. Victory/restart remove the canyon scene; reset also removes an unfinished comic.
- Regression coverage: `tests/peteWorld.test.js` checks selection, pickups, spawn arguments, settlement and saved fire state. `tests/boss-smoke.mjs` adds a default-mode browser pursuit using real firing input, bullet damage, death/retry and victory/exit, without `__rwSmokeTest`.
- Follow-up: physical canyon/gate collision, zone encounters, a paused comic and three-phase boss integration remain outside this milestone.
