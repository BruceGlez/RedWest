# Stage 0 baseline and Stage 1 status

**Baseline commit:** `a0a68e5` on `main` (the original browser build).
**Prototype branch:** `feat/heat-prototype`.

## Baseline inventory

- The original game loaded Three.js 0.160.0 from a CDN import map and had no package manifest, build, automated checks, or GitHub CI.
- It had two weapons (revolver and shotgun), bandits, wolves, gunslingers, a boss, randomized scenery, pickups, procedural audio, local high scores, pause/settings, and an endless wave director.
- The original release checklist left wave balance, loot verification, audio clipping, console errors, heavy-combat frame pacing, repeat restart safety, and three full playtest runs unchecked.
- Code inspection found that contact or bullet damage could repeat every frame, and that the game-over panel could extend outside a 720px-high viewport. Both are addressed in the prototype.

## Stage 1 implementation

- Reproducible local Vite build with pinned Three.js dependency and lockfile.
- One arena, existing revolver and shotgun, three regular enemy types, and one boss in a finite three-pursuit run.
- Heat from chained accurate kills raises the score multiplier and sends more and deadlier pursuers (more spawns, higher caps, more gunslingers and wolves). A trigger pull that hits nothing breaks the chain and Heat then decays; taking damage clears current Heat. The HUD and run report show Heat.
- The outlaw's bounty scales with Heat and is only paid on leaving. When the outlaw falls the player chooses: **bank it** (end the run with the bounty) or **ride on** (carry Heat into a 30-second bonus pursuit; escape to collect the bounty plus bonus earnings, die and lose both). This is the Heat tradeoff the Stage 1 gate tests.
- Players may save or skip saving a score before restarting. Prototype scores are stored under `redWestScores.v2` because their scale differs from the original build; the original `redWestScores` records are left untouched.
- Focused Heat and bounty rules tests, and a Chrome browser smoke path covering start, pause/resume, pursuit transitions, Heat, both bounty choices (escape and forfeit), and restarts. CI runs the unit tests, build, and both browser smoke tests.

## Prototype balance values to watch in playtests

These are first guesses, not tuned numbers: 4-second chain window, 2 kills per Heat level (max 4, x1.5 score per level), 5-second decay per level, 50-point base bounty, 30-second bonus pursuit, and the rule that dying in the bonus forfeits the bounty and bonus score. Record how often testers ride on and at what Heat.

## Verification and remaining gates

`npm test`, `npm run build`, `npm run test:smoke`, and `npm run test:static` pass locally. The browser smoke path uses accelerated timers and scripted hits; it does not assess the feel of a normal-length run.

Still required before Stage 2: observe 12 first-time players, check whether at least 8 understand the Heat tradeoff (including the bank / ride-on choice) and at least 6 voluntarily replay, record real run balance and frame pacing on a target PC, listen for audio clipping, and complete three uninterrupted full runs. The original `RELEASE_CHECKLIST.md` remains a release gate, not a claim that the prototype is ready to charge for.
