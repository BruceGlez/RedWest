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

First, cut the enemy draw calls (see the baseline below); then build the world around a fixed budget.

**Baseline (measured 2026-09-29, `node tools/perf.mjs`, an 844x390 phone-sized screen, software rendering).** Frame
times in software rendering are far slower than a phone: only compare before and after.

| Scene | Draw calls | Triangles | Shader programs | Median frame |
|---|---|---|---|---|
| Frontier Town | 85 to 86 | about 5,700 | 23 | 50 ms |
| A fight, paused, 15+ enemies | 176 in one run, 336 in another | about 29,000 to 31,000 | 23 | 83 to 117 ms |

The fight number moves between runs because it depends on how many enemies had spawned. Run the tool three
times and take the middle value. The `--detail` run counted 165 body meshes and 75 outlines for the bandits alone,
against 16 scenery-type meshes, so **in a fight the enemies, not the scenery, use most of the draw calls.**
The phone target from the research is under about 50 draw calls (a first guess), so the first job is to merge each
enemy's box parts into fewer meshes (`src/meshMerge.js` already does this for the town) or draw the crowd with
instancing, before adding anything to the world.

**Done 2026-09-29: enemy draw calls.** Every box-built enemy (bandit, gunslinger, the boss figure, all the
`createHumanoid` types, the snake, the horse with rider and the fallback box wolf) is now baked once, when it is
built, into **one skinned mesh plus one skinned outline** (`bakeSkinned` in `src/meshMerge.js`, called from
`src/assets.js`). Colours moved into vertex colours, so one shared material serves every enemy. The nodes that
`animateCharacter` looks up (`leftLeg`, `rightLeg`, `leftArm`, `rightArm`, `fl`..`br`, the snake's `seg0`..`seg4`)
became bones with the same names and transforms, so the animation code did not change. The hp bar and aim laser
stay ordinary meshes; the muzzle marker stays where it was. Ghosts get one see-through baked material of their own,
which the fade code already expected. Baked geometry and bone textures are freed when an enemy is removed
(`disposeBaked`). Same seeded map, `node tools/perf.mjs`, three runs each (`enemies` is now printed too):

| Scene | Before (3 runs) | After (3 runs) |
|---|---|---|
| Frontier Town, draw calls | 86, 86, 86 | 86, 86, 86 (not touched) |
| Fight, 15 enemies, draw calls | 122, 184, 285 (middle 184; the crowd size varied) | 94, 72, 73 (middle 73) |
| Fight, triangles | 27,800 to 30,600 | 28,700 to 30,600 (the same enemies, now with hidden-surface parts no longer culled one by one) |
| Shader programs | 23 | 24 to 26 (skinned versions of the toon and outline shaders) |
| Median frame, software rendering | 183 ms | 183 to 217 ms (no change; software rendering is fill bound, so this says nothing about phones) |

A bandit went from 11 body meshes and 5 outlines to 1 body and 1 outline. What is left in a fight is scenery and the
player: **the world pass below has to bring the 73 down** (under about 50 is the first-guess phone target, still to be
checked on a real phone). Not done: the imported wolf and outlaw models are separate skinned meshes (one per
model, plus an outline), which is already few. Test change: `tests/boss-smoke.mjs` looked for the first skinned mesh
on the outlaw, which is now the box figure's hidden baked body; it looks inside the imported model instead.
`npm run test:demo` fails the same way on `main` (the ad fetches outlaw models; not touched here).

**Done 2026-09-29: world and props, first pass.**
- **Instanced scenery.** Rocks, dead trees, crates, cacti and fences are one `InstancedMesh` each (`src/scenery.js`,
  five draw calls for about 125 props). Every prop is still an entry in `obstacles`; its `mesh` is an empty marker in the
  scene, and taking the marker out of the scene frees the instance, so collision, destruction, respawn and the smoke tests
  are unchanged. Per-instance colour, size and turn give the variety. **Fight, 15 enemies: 73 draw calls before this, about
  30 to 40 after** (runs of 30, 34, 35, 38, 40, 42, 46: the crowd size still varies). Triangles rose from about 29,000 to
  about 39,000 because unused instance slots and the shadow pass are counted; capacities are kept tight to limit that.
- **Stage atmosphere** (`src/atmosphere.js`, applied by `setAtmosphere` in `src/world.js`): each outlaw's home ground sets
  sky, fog, sun or moon, hemisphere light, a sand tint and a scenery tint. Only colours and numbers change, so no shader is
  rebuilt. The start screen shows the selected outlaw's look. A unit test keeps every look complete and readable.
- **Wind and life** (`src/ambience.js`): 700 grass tufts that sway in the wind, up to four tumbleweeds, and drifting motes
  (dust, ash, embers, mist, snow per stage). Three draw calls in all. The shader count went from 23 to about 30 (skinned and
  instanced variants), which makes a cold load in software rendering slower; not measured on a phone.
- **Done 2026-09-30: every world is its own.** Each stage now has its own ground (`terrain` in `src/atmosphere.js`, drawn by
  `createGroundTexture`: wheel ruts at Copper Bit, dried gravel and mud at Whisper Wash, graveyard grass, furrowed farmland,
  glowing cinder at Slagtown, red rock, bleached hardpan, overgrown ruins, deck planks on the Silver Belle, dirty snow at
  Fort Pell), its own prop mix (`kit`: new barrels, tombstones, haystacks, mesa spires and wall lengths beside the rocks,
  trees, crates, cacti and fences) and its own prop colours (`palette`). The map is rebuilt when the stage changes on the
  start screen; a prop kind nobody uses draws nothing. Only one ground texture lives at a time. Cost: a fight with 15
  enemies is now 45 to 51 draw calls (was 30 to 40), about 53,000 triangles, 36 shader programs: at the edge of the
  first-guess budget, so check frame pacing on a phone before adding more.
- **Not done:** footprints and scorch decals, sway for cacti and dead trees, modelled props (wagon wheels, bones, signs),
  hero props per stage (Pete's piano, the stopped clock), the horizon ring of mesas, and a real-phone check of the colours (red ground under red-coated enemies) and of frame pacing.

- **Instance the scenery (M).** `src/world.js` makes about 60 rocks, 15 trees, 15 crates, 20 cacti and 15 fence
  pieces, each its own mesh. Turn each kind into an `InstancedMesh` (or `BatchedMesh`, in three r160) with per-instance
  colour and scale variation. Collision stays as it is (`obstacles` in `src/physics.js`).
- **Better props (M).** Replace the plainest box props with small modelled versions that keep the toon style:
  varied rocks, barrels, wagon wheels, bones, signs, cacti with arms and flowers. Same outline width everywhere.
- **Ground detail (M).** Instanced grass tufts, pebbles and dry scrub; a second ground texture for dirt patches;
  footprints or tracks and scorch marks as small pooled decals.
- **Wind and life (S to M).** A vertex shader sway for cacti and grass, tumbleweeds rolling across, dust drifting
  low, a few birds. All cheap, all far from the player culled.
- **Stage atmosphere (M).** Each of the ten outlaws gets its own sky, fog colour, sun angle and light colour
  (dusk, noon, night with a moon, storm), set from `src/outlaws.js`. Biggest look change for the least cost.
  [STORY_BIBLE.md](STORY_BIBLE.md) (section 5) proposes each outlaw's home ground, mood and props, so this work
  and the story work are the same work.
- **Horizon (S).** A distant mesa and mountain ring, and a heat-haze band, so the world edge is not a flat fog wall.

### 2. Combat feel (M)

**Done 2026-09-30: aim.** Shots left the character's gun hand but were aimed along the body, so they passed to one side of the target, and they went to where an enemy stood, not where it would be. Now every shot goes from the muzzle to the aim point, quick-fire and drag-aim lead a moving enemy by its speed (`leadPoint` in `src/aimAssist.js`, capped at 0.6 s), and the drag snap cone is 20 degrees instead of 14. Unit tests cover both; the feel on a real phone still needs a check, and the numbers (cone, lead cap) are first guesses.

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

**Assets** (`ASSETS.md`): the wolf model was confirmed as made on the paid Meshy plan (2026-09-30).

## Sources

- [100 Three.js Tips That Actually Improve Performance (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Optimize Three.js for mobile](https://digitalstrategyforce.com/journal/how-do-you-optimize-threejs-performance-for-mobile-devices/)
- [Three.js performance checklist](https://marceloretana.com/checklist/threejs-performance-checklist)
- [Game feel on the web: squash, shake, and the art of juice](https://valdemird.com/blog/game-feel-on-the-web/)
- [Juice is the difference between a game that feels alive and one that doesn't](https://tigerabrodi.blog/juice-is-the-difference-between-a-game-that-feels-alive-and-one-that-doesn-t)
