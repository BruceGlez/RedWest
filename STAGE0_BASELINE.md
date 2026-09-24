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
- Heat from chained kills raises score multiplier and pursuit pressure; damage clears current Heat. The HUD and run report show Heat.
- Boss defeat ends the run with a win result; players may save or skip saving a score before restarting.
- Focused Heat rules tests and a Chrome browser smoke path covering start, pause/resume, pursuit transitions, boss defeat, and restart.

## Verification and remaining gates

`npm test`, `npm run build`, and `npm run test:smoke` pass locally. The browser smoke path uses accelerated timers and a scripted boss hit; it does not assess the feel of a normal-length run.

Still required before Stage 2: observe 12 first-time players, check whether at least 8 understand the Heat tradeoff and at least 6 voluntarily replay, record real run balance and frame pacing on a target PC, listen for audio clipping, and complete three uninterrupted full runs. The original `RELEASE_CHECKLIST.md` remains a release gate, not a claim that the prototype is ready to charge for.
