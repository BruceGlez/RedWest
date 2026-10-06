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

**Done 2026-09-30: aim.** Shots left the character's gun hand but were aimed along the body, so they passed to one side of the target, and they went to where an enemy stood, not where it would be. Now every shot goes from the muzzle to the aim point, quick-fire and drag-aim lead a moving enemy by its speed (`leadPoint` in `src/aimAssist.js`, capped at 0.6 s), and the drag snap cone is 20 degrees instead of 14. Unit tests cover both; **checked on a real phone by the owner (2026-09-30): aim feels good**, so the cone and lead cap stay as they are.

Add a 60 to 100 ms white hit flash on enemies, muzzle flash sprites, impact particles (dust or sparks by surface),
shell casings, a camera kick per weapon (a pistol does not shake like a shotgun), and death reactions: play the
`dead` clip, or a short tumble, before the enemy is removed. The particle system moves to instanced sprites so
bursts stay cheap: dust puffs, footsteps, smoke.

**Done 2026-09-30: combat feel, first pass.**
- **Hit flash.** A shot enemy flashes white for 0.09 s. A baked enemy writes white into its own colour buffer and writes the
  colours back, so no material is cloned; an imported model flashes through its own material's glow (`src/combatFx.js`).
- **Impacts by surface.** Bullets throw what the target is made of: stone chips from rocks, walls and tombstones, splinters
  from crates, fences, trees and barrels, leaves from cacti, straw from haystacks, sparks off an iron front, an orange burst
  on a hit, a cartoon puff where an enemy falls (`IMPACTS` in `src/combatMath.js`). These are silent; the old per-hit boom is gone
  (the hit and break sounds remain), the boom stays for dynamite and the player being hit.
- **Falls instead of vanishing.** A defeated enemy leaves `enemies` at once (so it cannot be hit, aimed at, counted or shoot;
  kills, loot and score are unchanged) and plays a fall: the wolf and imported outlaws play their own `dead` clip (capped at
  1.1 s), box-built enemies tip over, hop once, and pop away (0.6 s). Then their geometry is freed.
- **Muzzle flash, casings, recoil.** One flash block and two sparks at the muzzle, a brass casing thrown out to the side, and a
  camera shove against the shot, sized from the gun's numbers (`weaponKick`, `muzzleFlash`): a pistol barely moves the view, a
  shotgun or buffalo gun shoves it.
- **One draw call for every particle.** `src/particleSystem.js` is now a single `InstancedMesh` (220 slots) instead of a mesh
  per particle, so a fight full of bursts no longer adds draw calls. Fight, 15 enemies: 43 to 49 draw calls, 36 programs (same
  as before this work).
- **Wind sway** for cacti and dead trees (a vertex shader change on the shared prop material, weighted by height and by where
  each one stands, driven by the stage's wind: `src/wind.js`).
- Tests: `tests/combatMath.test.js` (impacts, fall pose and length, kick and flash per gun). Screenshots checked for the fall,
  the puff and the flash.
- **Not done:** footprints and scorch decals, and a feel check on a real phone (flash length 0.09 s, kick sizes and fall
  length are first guesses). No screen shows an enemy dying: the fall is a tumble and a puff, as the under-13 rule needs.

**Done 2026-09-30: polish round two** (one branch, one commit per item).
- **Footprints and scorch marks** (`src/decals.js`, `src/steps.js`): the marshal leaves footprints (left, right, every 1.7 units) and
  dynamite leaves a scorch mark; one instanced layer, 160 slots, each shrinks away (7 s and 30 s), tinted from the stage's ground.
- **A skyline for every stage** (`src/horizon.js`): mesas, peaks, hills, chimney stacks or river banks in a ring beyond the fog, one
  merged mesh, coloured from the stage's haze. The play camera looks steeply down, so the skyline shows on the start screen, whose
  orbit now tilts up to show the stage's sky and skyline; it will also show on any camera that looks toward the horizon.
- **A landmark for every stage** (`src/heroProps.js`): Pete's piano, the well at Whisper Wash, the Hollow Hill bell tower, the
  Calloways' barn and silo, the Slagtown furnace, the Redstone rope bridge, Vane's clock tower, the Tres Rios arch, the Silver Belle's
  paddlewheel, Fort Pell's flagpole and watchtower. One merged mesh each, 26 to 45 units from the start, blocking like a rock.
- **Place sounds** (`src/soundscape.js`, `src/audio.js`), all made from noise and tones, so no new downloads: a bed under each stage
  (wind at the stage's strength; crickets, a far bell, birds, a furnace hum, mist, or water lapping), footsteps that depend on the
  ground (sand, gravel, grass, soil, cinder, rock, planks, snow), a tone variation on every gunshot (pitch and brightness), and a
  limiter on the whole mix so many shots and an explosion together cannot clip. Effects switch off the beds and footsteps too.
- **Town barks** (`src/barks.js`): one line on each building's card from whoever runs it, chosen from the marshal's progress.
- **Numbers:** fight, 15 enemies: 38 draw calls, 38 shader programs, about 52,700 triangles (three runs of `node tools/perf.mjs`).
- **Story pictures (2026-09-30):** the seven opening and ending panels have pictures (`tools/story-picture.mjs`, OpenAI Images, about 30 KB each as webp), shown above the text in the panel reader.
- **Still open here:** a listening check on a real phone (the bed and footstep levels are first guesses; also on the release
  checklist), music layers that follow Heat and more gunshot variants need recorded files (`tools/elevenlabs.mjs`; the key is set in the cloud environment, so this is possible next);
  the stable and the undertaker are scenery, so they have no barks; the horizon is only seen from a tilted camera.

**Done 2026-09-30: recorded audio, town guests, story hint** (ElevenLabs and OpenAI keys are set in the cloud environment).
- **Gunshot and hit variants:** a second recording for every gun (and a third for the revolver) and two more for the enemy hit
  (`tools/elevenlabs.mjs sfx`, keys `shot-revolver-2`, `hit-2`...). The game picks one at random each time (`pickVariant` in
  `src/audio.js`), on top of the pitch and tone variation already there.
- **Music that follows Heat:** a hotter fight loop, `fight-hot` (45 s, 528 KB). From Heat 3 the fight music switches to it, and back
  below Heat 2 (a gap, so it does not flip). The home and showdown loops are untouched. It restarts the loop at the switch (no
  crossfade yet).
- **Outlaw voice lines:** each of the ten outlaws now says their ride-in taunt, so the voice matches the banner
  (`src/audioManifest.js` builds the lines from `src/outlaws.js`; Lucky Lou and Colonel Crane had no voice before). `tests/audioManifest.test.js`
  checks every manifest entry has its file and every taunt matches.
- **The playable ad** is now 4.63 MB (the limit is 5 MB): it carries every effect, so each new effect variant adds to it.
- **Town guests:** each beaten outlaw adds something to Lantern Rock (`GUESTS` in `src/townScene.js`): Pete's piano, Rosa's wolf pups,
  the Deacon's chapel, the Calloways' fence, Jack's anvil and armour, Morgan's fire-crew cart, Silas's shooting gallery, Espectro's
  porch chair, Lou's card table, Crane's flagpole. Merged into a few meshes; built when the list of beaten outlaws changes.
- **A quiet start-here hint:** a pulsing "NEW HERE? READ THE STORY" button under PLAY for a player who has not played and has not
  read the opening; it opens the opening and goes away. It never covers anything or interrupts.
- **Still open:** a listening check of the new recordings and the music switch on a real phone; a crossfade for the hot loop; the
  stable and the undertaker still have no barks (scenery, not tappable); the horse rigging needs Blender on the owner's machine. The snake is done (`public/models/rattler.glb`) and waits for the one-line load in `enemySystem.js`.

### 3. Post-processing with a quality switch (M)

Half-resolution bloom (about 75% fewer pixels for a blur that hides the loss), a vignette and a light colour
grade, in one pass if possible. Fall back automatically on a slow device (watch the smoothed frame rate that
`src/gameLoop.js` already keeps). Keep the pixel-ratio cap.

**Quality switch built for Frontier Town (2026-10-01):** `src/townQuality.js` gives LOOK three levels (high, medium with half-resolution bloom and a capped pixel density, low with no post-processing) and an AUTO mode that steps down when the town runs below about 40 frames a second and remembers where the device ended up; the QUALITY button and `?quality=` set it by hand. What is left: the same pass and switch for the desert and the arena.

**Started for Frontier Town only (2026-09-30):** `src/townLook.js` already does bloom, a colour grade, a vignette, a dusk
sky and painted shading on the town screen, behind its own LOOK switch (see README, "Walking the town, and the town's
look"). What is left: the quality switch and automatic fall-back on slow devices, half-resolution bloom (it is full
resolution now), and the same pass for the desert and the arena. The draw-call guard in `tests/mobile-smoke.mjs` counts
the whole frame, post passes included.

### 4. Audio pass (M)

Ambient beds (wind, insects, a distant howl), footsteps, three or four variants per gunshot with a random pitch,
music layers that follow Heat, a mix or limiter, and a listening check for clipping (also on `RELEASE_CHECKLIST.md`).
Sounds are made with `tools/elevenlabs.mjs` from the list in `src/audioManifest.js`.

### 5. UI polish (M)

One consistent look, count-up numbers, animated reward reveals, safe-area handling on notched phones, and
accessibility options (text size, reduced motion, colour-blind aim line).

### 6. Art coherence (S to L)

A one-page style guide (palette, outline width, proportions), then re-generate or retouch the characters and props
that do not match. The horse with rider still needs rigging (`tools/blender/README.md`); the snake is done.

**Parked on purpose (2026-09-30): the Township-style art for Frontier Town.** The owner chose to leave art for now
and judge the walkable town first. The plan, in order, when it comes back:

1. Write the one-page style guide above first (chunky toy-like proportions, a fixed palette of about a dozen colours,
   warm dust and haze), so every new piece matches.
2. Replace the town's boxes with modelled buildings (saloon, bank, jail, sheriff, gunsmith, depot first), low-poly,
   baked ambient occlusion, hand-painted textures; exported as GLB through the Blender pipeline the wolf used
   (`tools/blender/`, `tools/optimize-model.mjs`). Kits and generated models need a licence check and a row in
   `ASSETS.md` the same day.
3. Hand-painted tileable textures (wood, brick, sandstone, shingles, dirt) in place of the procedural grain in
   `src/townLook.js`; toon or stylised materials; chunky, glossy UI and icon set with bounce and coin-pop feedback.
4. Restyle the characters and townsfolk to the same guide, so models and town belong together.
5. Budget: keep the town near 90 draw calls and check on a real phone before and after.

The walkable town (`src/townWalk.js`) does not depend on any of this: new buildings only need to keep
`walkMap()` (their footprint and a door) correct.

### 7. Tech health (as needed)

Compress model textures (KTX2) and geometry (meshopt) if downloads matter; consider upgrading three from 0.160
only for a feature you need (colour management changed in later versions). Not needed: more triangles, realistic
PBR. The toon style is the right call for phones.

## Open items already in the docs

These are not polish; they were found while checking the docs on 2026-09-29.

**Gates before Stage 2 or a release** (`PLAN.md`, `RELEASE_CHECKLIST.md`):
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
