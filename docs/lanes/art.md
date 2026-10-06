# Lane: Art and 3D

**Mission:** Make the game and town look studio grade without breaking the phone budget.

## Backlog (from `PLAN.md`)
- Modelled town buildings and a one-page style guide (`POLISH_PLAN.md` section 6)
- Ground detail, wind, horizon pieces; quality switch and bloom for the desert and arena
- Rig the snake and horse in Blender (`tools/blender/README.md`)
- Every new asset gets a row in `ASSETS.md` the same day

## Rules
You own the **scene builders** of every area (`placeFarm.js`, `placeUndertaker.js`, `mineScene.js`, `townScene.js`, each new `src/place*.js`). The function agents own the layout and rules; read doors, positions and footprints from their layout files and keep `walkMap()` valid. See "Art and function on the same area" in `AGENTS.md`.

Budget: about 90 draw calls in town, under about 50 in a fight. Run `node tools/perf.mjs` three times before and after and take the middle. Original art only.

## You own
- `src/assets.js`
- `src/atmosphere.js`
- `src/scenery.js`
- `src/textures.js`
- `src/meshMerge.js`
- `src/heroProps.js`
- `src/horizon.js`
- `src/wind.js`
- `src/decals.js`
- `src/characterModels.js`
- `src/animation*.js`
- `src/portraits.js`
- `src/portraitFiles.js`
- `src/townScene.js`
- `src/townLook.js`
- `src/townQuality.js`
- `src/world.js`
- `tools/blender/**`
- `tools/meshy.mjs`
- `tools/optimize-model.mjs`
- `tools/model-utils.mjs`
- `tools/render-portraits.mjs`
- `tools/character-*.mjs`
- `tools/gemini-picture.mjs`
- `tools/generate-enemy-portraits.mjs`
- `tools/perf.mjs`
- `public/models/**`
- `public/portraits/**`
- `art/**`
- `fonts/**`
- `public/icons/**`
- `ASSETS.md`
- `POLISH_PLAN.md`
- `tests/atmosphere.test.js`
- `tests/animationClips.test.js`
- `tests/townQuality.test.js`
- `src/particleSystem.js`
- `tests/characters-smoke.mjs`

## Backlog: the dark mine (owner's brief, `MINE_PLAN.md`, "Slice 5")
- The look of the dark: truly black outside a small dim radius, torch light and glow, a lantern in the marshal's hand, the lift and shaft glowing so they can be found in the dark (`src/mineScene.js`, the town lane's cellar placeholder scene once it exists). Keep a fight under about 50 draw calls (`node tools/perf.mjs`).
- Models and prompts (prompts go in `MINE_PLAN.md`, "Art prompts"; `ASSETS.md` rows): lantern, wall torch, the light eater (a small bug that puts torches out), the hidden door in the cellar.

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:characters`
- `node tools/perf.mjs`
