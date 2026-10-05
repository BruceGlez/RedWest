# Red West asset record

Where every non-code asset came from and the terms that allow the game to use it commercially. Keep this
up to date whenever an asset is added or regenerated. Keep the matching invoices and plan pages (for example
a screenshot of the account's billing page on the day of generation) outside the repository, so you can
show what licence applied if anyone asks.

| Asset | Files | Made with | Plan / licence | Made | Notes |
|---|---|---|---|---|---|
| Sound effects, music, voice lines | `public/audio/` | ElevenLabs API (`tools/elevenlabs.mjs`, list in `src/audioManifest.js`) | **Paid plan** (confirmed by the owner, 2026-09-29): commercial use allowed | 2026-09-28 | Voices are ElevenLabs stock voices only. Cloned voices are skipped by the script; never clone a real person's voice. Regenerating needs a paid plan too. |
| Character pictures (front views) | `art/characters/` | OpenAI Images API (`tools/character-picture.mjs`, prompts in `tools/character-prompts.mjs`) | OpenAI terms: outputs belong to the user | 2026-09-28 | Prompts describe original characters; keep them free of real people, brands and other games' characters. |
| Animated 3D characters | `public/models/` | Meshy API (`tools/meshy.mjs`) from the pictures above | **Paid plan** (confirmed by the owner, 2026-09-29): private models, commercial use allowed | 2026-09-28 | |
| New characters (2026-09-29) | `art/characters/june-holloway.jpg`, `ezra-stone.jpg`, `lucky-lou.jpg`, `colonel-crane.jpg`; `public/models/` same names | OpenAI Images API, then Meshy API (same tools and prompts file) | As the two rows above | 2026-09-29 | Original characters. All models (old and new) now carry two more Meshy library animations: Cowboy Quick Draw Shooting and Walk Forward While Shooting. |
| Wolf (3D enemy) | `public/models/wolf.glb` | Meshy web app (model file `Meshy_AI_Stoic_Wolf_Pup_0929160849_texture.glb`, no rig) rigged and animated by hand in Blender (`tools/blender/wolf_rig.py`, driven through the Blender MCP), then shrunk with `tools/optimize-model.mjs` | The Meshy plan the owner used for the character models above (**confirmed by the owner, 2026-09-30: made on the paid plan**); the rig and the three clips (idle, run, dead) are our own work | 2026-09-29 | Blender is GPL, and its output belongs to the user. Loaded for wolf enemies in `src/enemySystem.js`; the box wolf stays as the fallback. |
| Character pictures in the menus | `public/portraits/` | Rendered from the models above (`tools/render-portraits.mjs`) | Same as the models | 2026-09-29 | |
| Enemy character pictures & card portraits | `art/characters/` (bandit, brute, duelist, dynamiter, ghost, gunslinger, knifer, rattler, rider, rifleman, trooper), `public/portraits/enemy-*.webp` | Generated in project style via DeepMind Antigravity Image Generator (`tools/character-prompts.mjs`, `tools/generate-enemy-portraits.mjs`). Wolf card portrait rendered at runtime from `public/models/wolf.glb` (`src/main.js`). | Owned | 2026-10-01 | Original characters & creatures matching Brawl Stars vinyl toy aesthetic. Shipped to Bounty Book and NEW ENEMY cards. |
| Bandit (3D enemy) | `public/models/bandit.glb` | Meshy API (`tools/meshy.mjs`) from `art/characters/bandit.jpg` | **Paid plan** (confirmed by the owner, 2026-09-29): private models, commercial use allowed | 2026-10-05 | Single skinned mesh, 8,258 triangles, 915 KB. Clips: idle, run, runShoot, dead, draw, walkShoot. |
| Gunslinger (3D enemy) | `public/models/gunslinger.glb` | Meshy API (`tools/meshy.mjs`) from `art/characters/gunslinger.jpg` | **Paid plan** (confirmed by the owner, 2026-09-29): private models, commercial use allowed | 2026-10-05 | Single skinned mesh, 8,264 triangles, 1,065 KB. Clips: idle, run, runShoot, dead, draw, walkShoot. |
| Town concept pictures | `art/town/` | OpenAI Images API (prompts describe a mood only; no show or game names) | OpenAI terms: outputs belong to the user | 2026-09-29 | Reference for the 3D town, which is built in code (`src/townScene.js`); not shipped in the game. |
| Fonts: Rye, Roboto Mono | `fonts/` | Google Fonts | SIL Open Font License 1.1 (`fonts/OFL-*.txt`) | | Keep the licence files next to the fonts. |
| App icons | `public/icons/` | Made for the project | Owned | | |
| Three.js | npm `three` | | MIT licence | | |
| Other code-built art (props, box characters, the Drifter) | `src/` | Written in code | Owned | | |
| Story panels (opening and ending pictures) | `public/story/`, originals in `art/story/` | OpenAI Images API (`tools/story-picture.mjs`, prompts in `tools/story-prompts.mjs`) | The OpenAI account's terms allow commercial use of generated images; original prompts, no other games' characters or real people | 2026-09-30 | No text in the pictures; the words are on the panels in the game. Regenerate one with `node tools/story-picture.mjs <name>`. |

## Animals

Meshy's auto-rig is for humanoids only. A test on 2026-09-29 (a wolf picture through `tools/meshy.mjs`) did
produce a rigged model, but on a human skeleton: running tore the body apart. So animals are rigged by hand in
Blender (`tools/blender/README.md`). The wolf is done that way (`public/models/wolf.glb`); the snake and the
horse with rider stay code-built (`src/assets.js`, legs animated in `src/animation.js`) until they get the same
treatment, or a model that already comes with a four-legged rig and animations under a licence that allows
commercial use.

## Rules for new assets

- Use only services and plans that allow commercial use, and add a row here the same day.
- No real people, celebrities, brands, logos, or characters, art or names from other games (for example
  Red Dead, Kingshot, Whiteout Survival), in prompts, assets, store listings or ads.
- AI voices: stock or properly licensed voices only; no voice clones of real people.
- Music and effects from other sources need a licence that covers games and their ads (a "sync" licence
  for trailers and ads).
