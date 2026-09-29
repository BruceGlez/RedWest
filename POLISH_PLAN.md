# Red West polish plan: what "studio grade" needs

Written 2026-09-29 from a read of the code and outside research (sources at the end). It is a plan, not a
record of finished work: nothing here is built unless it says so. Numbers marked "first guess" need testing on a
real phone (`node tools/perf.mjs` gives draw calls and frame times to compare before and after each item).

## Where the game stands

**Already good:** a cohesive cel-shaded look (toon materials with outlines, ACES tone mapping, fog, a sun with a
player-following shadow box), the feel basics (screen shake, hit-stop, slow-mo when the outlaw falls, haptics,
floating score text, aim assist, off-screen enemy arrows), pooled particles, a phone pixel-ratio cap, and a perf
tool. The 3D wolf (2026-09-29) is the first modelled animal.

**Where it still reads as indie:**

- **Hit and death feedback is thin.** A hit is knockback plus 8 orange boxes (`src/particleSystem.js`); no hit
  flash. Enemies vanish the moment they die (`src/bulletSystem.js`), and the wolf's `dead` clip is unused.
- **No post-processing.** No bloom, vignette or colour grade, so muzzle flashes and explosions have no glow.
- **A static world.** One ground plane with a repeating texture and randomly placed box-built props
  (`src/world.js`, `src/assets.js`). No wind, dust, grass, tracks or decals. All eight stages share one lighting.
- **Audio is one file per sound** (38 clips, 1.8 MB, `src/audioManifest.js`): no ambience, no footsteps, no
  variations of a gunshot, so shots repeat.
- **Character style may be inconsistent:** Meshy models generated one by one next to code-built box characters.

## Order of work

Each item lists what to build and where. Sizes: S = a day or less, M = a few days, L = a week or more.

### 1. World and props (next; decided 2026-09-29)

Do the baseline first: run `node tools/perf.mjs` and write the draw-call and frame-time numbers here, so every
change below can be checked against them. Phone target from the research: under about 50 draw calls (first guess).

- **Instance the scenery (M).** `src/world.js` makes about 60 rocks, 15 trees, 15 crates, 20 cacti and 15 fence
  pieces, each its own mesh. Turn each kind into an `InstancedMesh` (or `BatchedMesh`, in three r160) with per-instance
  colour and scale variation. Collision stays as it is (`obstacles` in `src/physics.js`).
- **Better props (M).** Replace the plainest box props with small modelled versions that keep the toon style:
  varied rocks, barrels, wagon wheels, bones, signs, cacti with arms and flowers. Same outline width everywhere.
- **Ground detail (M).** Instanced grass tufts, pebbles and dry scrub; a second ground texture for dirt patches;
  footprints or tracks and scorch marks as small pooled decals.
- **Wind and life (S to M).** A vertex shader sway for cacti and grass, tumbleweeds rolling across, dust drifting
  low, a few birds. All cheap, all far from the player culled.
- **Stage atmosphere (M).** Each of the eight outlaws gets its own sky, fog colour, sun angle and light colour
  (dusk, noon, night with a moon, storm), set from `src/outlaws.js`. Biggest look change for the least cost.
- **Horizon (S).** A distant mesa and mountain ring, and a heat-haze band, so the world edge is not a flat fog wall.

### 2. Combat feel (M)

Add a 60 to 100 ms white hit flash on enemies, muzzle flash sprites, impact particles (dust or sparks by surface),
shell casings, a camera kick per weapon (a pistol does not shake like a shotgun), and death reactions: play the
`dead` clip, or a short tumble, before the enemy is removed. The particle system moves to instanced sprites so
bursts stay cheap: dust puffs, footsteps, smoke.

### 3. Post-processing with a quality switch (M)

Half-resolution bloom (about 75% fewer pixels for a blur that hides the loss), a vignette and a light colour
grade, in one pass if possible. Fall back automatically on a slow device (watch the smoothed frame rate that
`src/gameLoop.js` already keeps). Keep the pixel-ratio cap.

### 4. Audio pass (M)

Ambient beds (wind, insects, a distant howl), footsteps, three or four variants per gunshot with a random pitch,
music layers that follow Heat, a mix or limiter, and a listening check for clipping (also on `RELEASE_CHECKLIST.md`).
Sounds are made with `tools/elevenlabs.mjs` from the list in `src/audioManifest.js`.

### 5. UI polish (M)

One consistent look, count-up numbers, animated reward reveals, safe-area handling on notched phones, and
accessibility options (text size, reduced motion, colour-blind aim line).

### 6. Art coherence (S to L)

A one-page style guide (palette, outline width, proportions), then re-generate or retouch the characters and props
that do not match. The snake and the horse with rider still need rigging (`tools/blender/README.md`).

### 7. Tech health (as needed)

Compress model textures (KTX2) and geometry (meshopt) if downloads matter; consider upgrading three from 0.160
only for a feature you need (colour management changed in later versions). Not needed: more triangles, realistic
PBR. The toon style is the right call for phones.

## Open items already in the docs

These are not polish; they were found while checking the docs on 2026-09-29.

**Gates before Stage 2 or a release** (`STAGE0_BASELINE.md`, `RELEASE_CHECKLIST.md`):
- Observe 12 first-time players: at least 8 understand the Heat tradeoff and at least 6 replay on their own.
- Real frame pacing on a target phone, and a listening check for audio clipping and broken loops.
- Three uninterrupted full runs; a known-issues list; the build marked as a candidate.
- Unchecked on the release checklist: fair enemy scaling through wave 10, loot effects visible and correct, no
  console errors in a normal run, no severe frame drops in heavy combat, no state leaking across restarts.

**Business and legal** (`GROWTH_PLAN.md`, `MONETIZATION.md`, `IOS.md`; these need your accounts):
- Generate and publish the privacy policy and terms, then set `VITE_PRIVACY_URL`, `VITE_TERMS_URL`,
  `VITE_SUPPORT_EMAIL`. A lawyer's review before spending on marketing.
- Trademark search for "Red West" (US and EU). Stripe Tax, or a merchant of record for web sales.
- Server hosting is undecided, so real-money items stay "SOON" and analytics, account deletion, leaderboards and
  name reports stay local until `VITE_API_BASE` is set.
- Not built: vertical videos (final clips should be recorded on a phone), rank titles for the weekly event, and
  rewarded ads (decided against for now). Event targets need playtesting.
- iPhone app: signing, device testing and App Store submission need a Mac; App Review expects a complete game.

**Assets** (`ASSETS.md`): confirm the wolf model was made on the paid Meshy plan.

## Sources

- [100 Three.js Tips That Actually Improve Performance (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Optimize Three.js for mobile](https://digitalstrategyforce.com/journal/how-do-you-optimize-threejs-performance-for-mobile-devices/)
- [Three.js performance checklist](https://marceloretana.com/checklist/threejs-performance-checklist)
- [Game feel on the web: squash, shake, and the art of juice](https://valdemird.com/blog/game-feel-on-the-web/)
- [Juice is the difference between a game that feels alive and one that doesn't](https://tigerabrodi.blog/juice-is-the-difference-between-a-game-that-feels-alive-and-one-that-doesn-t)
