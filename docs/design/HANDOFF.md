# Handoff: where Red West stands (2026-10-08)

For whichever coding tool or agent continues the work (the owner is moving off Claude because of weekly limits). Read `AGENTS.md` first (12 lanes, one lane per branch and PR, shared files change in tiny separate PRs, the game rules never move), then `PLAN.md` (the master plan, with a "Parked backlog" section). `main` is green: `npm test` (about 565 tests), `npm run build`, and the browser smokes in CI.

## How to work here
- Branch `<lane>/<what>`, one lane per PR, small PRs. `node tools/lanes.mjs who <path>`, `diff`, `check`, `shared`. New files must be owned by a lane in `lanes.json` (append at the end). Do not edit `PLAN.md` in a feature PR.
- Green before pushing: `npm ci && npm test && npm run build`, plus the lane's checks (`npm run test:town`, `npm run test:mine`, ...). CI also runs browser smokes (about 20 minutes). The Wanted Road smoke (`tests/smoke.mjs`) has a rare timing flake (a score read before a shot); a re-run clears it.
- Merges are merge commits on green. Merge `main` into a branch with conflicts (docs and `lanes.json` conflicts are usually "keep both sides").
- **The rules do not move:** money never buys combat power; no sold timers, paid loot boxes or dark patterns; places never change combat; original art only (every asset gets an `ASSETS.md` row); paid currency (Gold Nuggets) is credited only by verified webhooks and is never at risk in the game.

## Decisions the owner has made (do not re-ask)
- Dark mine: lantern, oil, torches and matches are bought with earned Bounty Dollars only. Lantern tank is 5 minutes (two oil flasks fill it, flask $6, lantern $60, torches x5 $20, matches x5 $5, the general store +10%). Lantern and torch light radii 28 and 22.
- From floor 15: some torches go out in thin air, relit with a match; oxygen bar rules exist behind `OXYGEN_ENABLED` (drain by time on a thin floor, refill at the lift and beside a lit torch, slower and dimmer lantern at empty, never a lost heart).
- Mine runs: going up the shaft does not end the run (resume point); dying throws him up 5 floors (never above floor 1) and drops the ore he carries as a pile; monsters may take a share; he can bank money in the town bank; Gold Nuggets are never at risk. The mine pays ore only today.
- Copper Bit: **the walking kitchen REPLACES the flat shift screen** (see `docs/design/copper-bit-kitchen.md`, "Owner decisions"). Shift screen files belong to the `ui` lane.
- Held by the owner (do not start): **Postgres in CI** and **unique player names** (scale lane). The owner does his own VPS, Coolify, domain and App Store, Stripe and RevenueCat setup.

## What is built (on main)
- Dark mine end to end (cellar and hidden door, bought light, light eaters, small floors, sense radius, grave quests, resume and death pile with server routes `POST /api/mine/{resume,death,pile}`), two light shops, the Hollow Hill vigil (rules, route, placeholder place), Postgres store (off until configured), load test (`tools/loadtest`), leaderboard query, rattler model file (`public/models/rattler.glb`, not loaded by the game yet).
- Copper Bit rules: crowds, rushes, streak tips, farm-free stew (placeholder name), five upgrades, the $130 per-shift ceiling, the balance bot (`tests/saloonBalance.test.js`), the shelf spot in `src/saloonLayout.js`. The flat shift screen (`src/saloonShiftView.js`) does not yet read bought upgrades.

## Build next, in order
1. **Copper Bit walking kitchen**, build PRs 1 to 13 in `docs/design/copper-bit-kitchen.md` section 10 (town: layout data contract, shared arrivals, floor rules, floor balance bot, new upgrades; art: interior placeholder scene then characters and props; town: place wiring; ui: floor HUD and controls and fallbacks; audio: cues; town: farm crates; docs). Start with PRs 1 to 5, all town files, testable headless.
2. Then retire the flat shift screen (only once the floor plays).
3. **Mine follow-ups:** wire the oxygen bar (ui lane builds the HUD from `airEffects(air)` in `src/mineAir.js`, then set `OXYGEN_ENABLED`), a HUD arrow and a real look for the death pile (`src/minePile.js` is a box marker), the light eater's own model, boss floors and checkpoints (`MINE_PLAN.md` slice 3), the grave-quest generator wiring (slice 6).
4. **Art:** load the rattler model in `src/enemySystem.js` (like `attachWolfModel`), the look of the Hollow Hill scene (`src/placeHill.js`) and the general store (`src/placeStore.js`), the stew's name (story lane).
5. **Small fixes:** `tools/loadtest/run.mjs` fails on Windows (raw `C:\` paths in dynamic `import()`; wrap with `pathToFileURL(...).href`).

Everything else (places H3 to H5, story, growth, money and App Store) is in `PLAN.md`.
