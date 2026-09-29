# Rigging animals in Blender (local session with the Blender MCP)

Humanoids do not need this: `tools/meshy.mjs` rigs and animates them. Meshy's auto-rig is humanoid-only
(see `ASSETS.md`), so the snake, wolf and horse-with-rider are rigged by hand in Blender, driven by Claude
Code through the Blender MCP running on your own machine (a cloud session cannot reach your Blender).

## One-time setup (your machine)

1. Install Blender 3.6 or newer, and `uv` (https://docs.astral.sh/uv/) so `uvx` works.
2. Download `addon.py` from https://github.com/ahujasid/blender-mcp. In Blender: Edit > Preferences >
   Add-ons > Install..., pick it, and tick it on.
3. In the 3D viewport press N, open the "BlenderMCP" tab and click "Connect to Claude" (socket on
   `localhost:9876`).
4. Clone this repo, `git checkout claude/wonderful-archimedes-4orino`, and start Claude Code inside it.
   The root `.mcp.json` registers the `blender` server; approve it when asked, and check with `/mcp`.
5. The add-on runs arbitrary Python inside Blender: save your .blend file first, and keep the "Poly Haven",
   "Hyper3D" and "Sketchfab" toggles off (they are not needed and pull in outside assets).

## Workflow per animal

1. Make the mesh with Meshy image-to-3D **without** rigging (`node tools/meshy.mjs` always rigs, so use the
   Meshy web app or API `image-to-3d` task and download the GLB into `tools/.meshy-cache/<name>-raw.glb`).
   Ask for a plain standing pose, legs apart, mouth closed.
2. Ask Claude to import it, apply scale and rotation, put the origin between the feet, decimate to
   about 8000 triangles, and fix normals.
3. Claude builds the armature (bone names below), binds with automatic weights, and you check with viewport
   screenshots in extreme poses. Fix weights by hand where it tears.
4. Claude keys the clips below (30 fps), loop points matching.
5. Export glTF Binary (.glb) with: Skinning on, Animation on, "Group by NLA track" off, every action
   pushed to an NLA track or marked Fake User, +Y up, apply modifiers.
6. Put it in `public/models/<name>.glb`, run `node tools/optimize-model.mjs` on it (shrinks the textures, drops
   the normal and roughness maps), and add a row to `ASSETS.md` the same day (made with: Meshy + Blender).
7. Save the finished setup as a script in `tools/blender/` so it can run again without the MCP.

## What the game needs from each model

The code-built animals today (`src/assets.js`, `src/animation.js`) only know "moving" and "standing", so
the required clips are few. Clip names must be exactly these (`characterModels.js` reads `idle`, `run`, `dead`).

| Character | Clips (all loop except `dead`) | Notes |
|---|---|---|
| Wolf (`createWolfMesh`, type `wolf`) | `idle` (breathing, tail sway), `run` (gallop, about 0.5 s cycle), `dead` (falls on its side, holds last frame) | About 3 units long as a box body today; the game rescales a model to a set height, so proportions matter more than size. |
| Snake (`createRattlerMesh`, type `rattler`) | `idle` (slow sway, tongue flick if it has one), `run` (side-to-side wave travelling tail-ward, about 0.6 s), `dead` (goes limp and flat) | Today: about 12 segments swaying with `sin(time*10 - i*0.9)`. A chain of 12 to 20 bones matches that. |
| Horse with rider (`createRiderMesh`, type `rider`, quadruped) | `idle`, `run` (gallop), `dead` (horse falls, rider thrown off is optional) | Rider is a separate humanoid at 0.72 scale, sitting at the saddle. Keep the rider and the horse as separate meshes, and parent the rider to a `saddle` bone. |

Do not bake root motion into `run`: the game moves the character (`src/animationClips.js` pins the hips for
humanoids only; animals must stay in place on their own).

## Bone names (the `fl`/`fr`/`bl`/`br` names match the code-built animals, so a model can drop in)

- Quadruped (wolf, horse): `root`, `spine01`..`spine03`, `neck`, `head`, `tail01`..`tail03`, and per leg an
  upper, lower and foot bone, named `fl_upper`, `fl_lower`, `fl_foot` (same for `fr`, `bl`, `br`; `fl` = front
  left). Horse adds `saddle` (rider mount), `jaw` and `mane` are optional.
- Snake: `root`, `seg01`..`segNN` head to tail, in a straight line along Z.
- Rider (humanoid on the horse): Mixamo / Meshy names (`Hips`, `Spine`, `LeftArm`, ...) so it can reuse
  the sitting or gun-holding poses later.

## Checks before committing a model

- `idle`, `run`, `dead` exist and `run` has no forward drift.
- Skinned mesh count is 1 per character (horse and rider count as 2).
- File under about 1.5 MB after `optimize-model.mjs` (phone performance, see `STAGE0_BASELINE.md`).
- Open it in the game or `tools/render-portraits.mjs`, and look at idle and run from the side.

## Not done yet

Nothing loads these animals as models yet: `enemySystem.js` still builds them with `createWolfMesh`,
`createRattlerMesh` and `createRiderMesh`, and `characterModels.js` is written for gun-carrying humanoids
(hand gun, draw clips). Once a rigged animal GLB exists, a small change is needed to load it for those enemy
types and to skip the gun logic. That comes after the first rig is approved.
