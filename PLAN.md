# Red West: master plan

Merged 2026-10-05 from every planning doc in the repo. This is the one page to work from. The detail still lives in the
source docs (linked), which are specs and records, not to-do lists.

## Where we are

A free-to-play, mobile-first Western arena shooter (Three.js, Vite, Capacitor iOS, Node server). Direction changed from the
paid-desktop plan (merged below) to **free-to-play with fair monetization** (`GROWTH_PLAN.md`, `MONETIZATION.md`).

**Built:** ten-outlaw Wanted Road with signature bosses and enemies, Heat and bank/ride-on, stars, Bounty Book, Records and
leaderboards, store (Bounty Dollars, cosmetics, guns, daily jobs, starter pack, season pass), playable outlaws, weekly event,
Frontier Town (walkable, jail income, bank, arena, ten districts, train, townsfolk, day/night), Calloway Farm (first full
place), phone controls, haptics, reminders, recorded audio, story cards and barks, own look per stage, instanced scenery and baked enemies for draw
calls, town quality switch, privacy and age handling, account deletion, analytics, refund handling, playable ad build.

**Not live:** real-money sales (server, store products and policy missing), App Store release, rewarded ads (decided no).

## Fixed rules (never break)

1. Money never buys combat power; guns, perks and outlaws are earned. Unit-tested.
2. No paid loot boxes, no timers sold, no dark patterns; two taps to spend.
3. Paid currency is credited only by verified server webhooks.
4. Places and buildings change income and goods, never combat; each place earns below the jail's top rate.
5. Original art, names and story only; every asset gets a row in `ASSETS.md`.
6. No ads for now (no consent or tracking prompts needed).

## Plan, in order

### 1. Launch blockers (needs the owner's accounts, not code)
- Host the server (Render Blueprint is ready; a `Dockerfile` and `docs/DEPLOY.md` cover a Coolify VPS, with `GET /healthz` to check the first deploy), set `VITE_API_BASE`.
- Generate and publish privacy policy and terms (`docs/POLICY_GENERATOR_ANSWERS.md`), set `VITE_PRIVACY_URL`, `VITE_TERMS_URL`,
  `VITE_SUPPORT_EMAIL`. Lawyer review before the first sale. Trademark search. Stripe Tax.
- Apple Developer, App Store Connect products (3 nugget packs, starter pack, season pass), RevenueCat, Stripe links, webhook
  secrets. Sandbox-test on TestFlight. Optional Sign in with Apple. (`MONETIZATION.md`, `IOS.md`)
- App Store listing: screenshots, age rating, privacy label, hide the playtest log in the store build.

### 2. Validation gates (needs real people and a real phone)
- Observe 12 first-time players: 8 understand the Heat tradeoff, 6 replay unprompted.
- Real-phone checks: frame rate in town and in a fight (target under about 50 draw calls), audio listening check (clipping, hot
  loop switch, voice lines, ambience).
- Release checklist leftovers: fair scaling to the later stages, visible loot effects, no console errors, no severe drops in heavy
  fights, no state leaking across restarts, three full runs, a known-issues list, mark a candidate.
- Balance first guesses to tune from data: Heat chain window and decay, bounty sizes, weekly event targets, perk numbers.

### 3. Build next (code)
- **Places H2 to H5** (`PLACES.md`), each shipped alone with unit, server and `npm run test:town` tests:
  H2 Vane's Crossing orders and Morgan's Channel watering the farm (order rules, the Crossing's order board and Morgan's Channel watering the farm built 2026-10-05, placeholder scenes; the bounty-board pointer, the Channel's fishing and warehouse are still to do, see `PLACES.md`); H3 Foundry Yard and Fort Pell (scrap from fights);
  H4 Copper Bit (a serve-the-customers shift game; the rules, saved state, the walk-in place, the server route and wallet method (scale lane) and a first playable shift are built 2026-10-06; upgrades, regulars and the piano tune follow, see `PLACES.md`), Tres Rios, Whisper Wash (taming many kinds of creature); H5 Silver Belle price board and Hollow Hill (the dusk lantern vigil that rebuilds the chapel); the three early places are designed in `PLACES.md` (2026-10-05).
- **Performance and look:** quality switch and bloom for the desert and arena (town has it); cut fight draw calls further; ground
  detail, wind and horizon pieces.
- **3D enemies:** the eight enemy models (bandit, gunslinger, rifleman, dynamiter, knifer, duelist, brute, ghost) are in the fight, loaded on demand and hidden off screen; box figures stay as the fallback (`ENEMY_MODELS`, `src/enemyTypes.js`).
- **Polish:** UI consistency (count-ups, reward reveals, safe areas), accessibility (text size, reduced motion, colour-blind aim
  line), hot-loop crossfade, barks for the stable and undertaker, weekly event rank titles.
- **The Undertaker's Mine** (`MINE_PLAN.md`): built and reworked after the first playtest: the parlour as a place, a mine with no bottom, caves that grow a lot with every floor, a new monster on every floor, chests, a shaft that is always open and a lift back up (practice rules). Floor variety added (twin caverns, long galleries and rockfalls from floor 2 and 3). Six deeper monsters (floors 15 to 20) borrow existing looks until the art lane makes models. The saved deepest floor, checkpoints and ore: the data contract (`src/mineProgress.js`, `profile.mine`) and the mine side (checkpoint floor at the stairs, ore in chests, saved when the run ends) are built; the server endpoint `POST /api/mine/run` is built (scale lane, authenticated, 20 s between reports, applies `applyMineRun` to `profile.mine` only); next boss floors (slice 3). The light rules (`src/mineLight.js`: lantern, oil, torches, matches, prices in Bounty Dollars only, `profile.mine.light`) are built as a pure module; the shops, the buy calls and the mode wiring follow. The floors are now small (3 + floor chambers for the first ten floors, a road of about 270 / 550 / 840 / 1,500 on floors 1 / 5 / 10 / 30), the first part of the dark mine. **Next, the dark mine (owner's brief 2026-10-06, `MINE_PLAN.md` slice 5; the cellar with its hidden door that Deacon Graves's defeat unlocks is built, 2026-10-06):** a lightless mine with a bought lantern and torches, monsters that sense you by distance, light eaters from the deep floors, and a lift and shaft you can always see; assigned by lane; the owner answered the open questions (decisions are in `MINE_PLAN.md`) and approved a quest generator themed on the graves in Deacon Graves's place (slice 6). The shop route `POST /api/mine/buy` and `wallet.buyLight` are built (scale lane); the shop cards (town lane) follow. Monsters in the mine now sense the marshal by distance (part (b), `src/combatMath.js`).
- **Story** (`STORY_BIBLE.md`): story cards, the Case File, town barks and opening/ending panels are built. Open: chapter-two hook, story props in town, and the Drifter legend (decided, not built).

### 4. Later
- Art coherence: one-page style guide, then modelled town buildings and restyled characters (parked by the owner). The snake is modelled and rigged (`public/models/rattler.glb`, not yet loaded by `enemySystem.js`); the horse is still to do.
- Growth: vertical videos recorded on a phone; Android via the same RevenueCat setup; Game Center and controller support.
- Tech health: KTX2 and meshopt compression if downloads matter.

### Parked backlog (noted 2026-10-06, nothing here is started; the owner's usage limits are short)
Done so far in the dark mine and around it: cellar and hidden door, lantern, oil, torches, matches, shops (Mr. Grimsby's and the general store), light eater, thin air from floor 15 (torches fail), small floors, sense radius, grave quests, Hollow Hill vigil rules and server route, load test, leaderboard query. When the open PRs are merged, pick up from here, one lane at a time:
- **Dark mine (mine lane):** wire the oxygen rules (`src/mineAir.js`, `OXYGEN_ENABLED`) into the mine mode once the bar exists; the owner confirmed the defaults (drain by time on a thin floor, refill at the lift and beside a lit torch, slower and dimmer at empty, never a lost heart). Checkpoints and boss floors (slice 3). Quest generator from the graves (slice 6) wiring. A lit marshal sensed from farther.
- **UI lane:** the oxygen bar HUD from floor 15 (spec in `MINE_PLAN.md`, "The oxygen bar: spec for the ui lane"). No ui agent has been started yet.
- **Art lane:** the light eater's own model, the look of the Hollow Hill scene (`src/placeHill.js`) and of the general store (`src/placeStore.js`), torch and lantern polish.
- **Town lane:** shop cards show the exact oil top-up price (`priceOf('oil', shop, kit)`); the vigil's cards and rewards polish; Foundry Yard, Fort Pell, Tres Rios, Whisper Wash, Silver Belle (`PLACES.md`).
- **Scale lane (on hold until the owner says):** Postgres service in CI; unique names. After the owner's own setup (VPS, Coolify, Postgres, `STORE=postgres`, migration dry run, domain), the first deploy.
- **Copper Bit walking kitchen (owner decided 2026-10-08: replace the flat shift):** specs in `docs/design/copper-bit-kitchen.md`; the handoff for whoever codes next is `docs/design/HANDOFF.md`.
- **Owner's own tasks:** VPS and Coolify, domain, secrets, App Store, Stripe and RevenueCat accounts; prices of the light (first guess: lantern 60, oil 15, torches x5 20, matches x5 5) not yet confirmed.

## How we work (lanes)
The repo is split into 11 lanes so several agents can work at once: art, mine, town (farm and places), scale, combat, audio, ui, story, money, qa, growth. Ownership is in `lanes.json`, the rules in `AGENTS.md`, each lane's brief in `docs/lanes/`. One lane per branch and PR; shared files change in small separate PRs.

Server scale: the plan for moving players from the JSON file to Postgres (async store interface, schema, concurrency, migration, and when Redis is needed) is written in `docs/lanes/scale.md`; step 1 (the async store interface and named lookups) is built; the Postgres store and the migration follow.

## How to verify
`npm test`, `npm run build`, then the browser smokes: `test:smoke`, `test:static`, `test:mobile`, `test:enemies`, `test:store`,
`test:bosses`, `test:characters`, `test:event`, `test:story`, `test:town`, `test:demo` (known to fail on main: the ad fetches outlaw
models). `node tools/perf.mjs` gives draw calls and frame times (run three times, take the middle). Blender rigging for animals
is documented in `tools/blender/README.md`.

## Core design and history (merged from the old plans)
- **Pitch:** hunt a notorious outlaw through short, escalating Western shootouts; bank the bounty and escape, or ride on for more
  score and more danger. Signature system: **Heat** (accurate kill chains raise score and pressure; misses and hits cool it).
  Keep manual aim, dash and short sessions. Original direction; nothing copied from other games.
- **Heat balance guesses to tune:** 4 s chain window, 2 kills per Heat level (max 4, x1.5 score each), 5 s decay per level,
  50-point base bounty, 30 s ride-on, dying while riding on forfeits the bounty. Record how often testers ride on and at what Heat.
  Note each tester's aim mode (assist makes chains easier) and loadout.
- **Original paid-desktop idea (set aside):** 15 to 20 minute contract runs, three encounters, reward choices, six weapons, 18 to 24
  run upgrades, Steam page ($100 fee, 30-day wait). Revisit only if free-to-play fails; gate any price on demo playtests.
- **Excluded for now:** multiplayer, open world, procedural levels, custom engine, ads.
- **Size budget:** character models under about 1.5 MB after `tools/optimize-model.mjs`.
- Docs removed on merge: `TODO_V1.md` (old wave-survival scope), `STAGE0_BASELINE.md`, `REFACTOR_PLAN.md`. Their history is in git.

## Source docs
`GROWTH_PLAN` (retention, events, monetization), `MONETIZATION` (store setup),
`POLISH_PLAN` (look, feel, audio), `TOWN_PLAN` and `PLACES` (town and districts), `STORY_BIBLE`, `IOS`, `ASSETS`,
`RELEASE_CHECKLIST`, `README`, `docs/POLICY_GENERATOR_ANSWERS`, `tools/blender/README`.
