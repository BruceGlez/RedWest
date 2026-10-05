# Red West: master plan

Merged 2026-10-05 from every planning doc in the repo. This is the one page to work from. The detail still lives in the
source docs (linked), which are specs and records, not to-do lists.

## Where we are

A free-to-play, mobile-first Western arena shooter (Three.js, Vite, Capacitor iOS, Node server). Direction changed from the
paid-desktop plan (`REFACTOR_PLAN.md`) to **free-to-play with fair monetization** (`GROWTH_PLAN.md`, `MONETIZATION.md`).

**Built:** ten-outlaw Wanted Road with signature bosses and enemies, Heat and bank/ride-on, stars, Bounty Book, Records and
leaderboards, store (Bounty Dollars, cosmetics, guns, daily jobs, starter pack, season pass), playable outlaws, weekly event,
Frontier Town (walkable, jail income, bank, arena, ten districts, train, townsfolk, day/night), Calloway Farm (first full
place), phone controls, haptics, reminders, recorded audio, own look per stage, instanced scenery and baked enemies for draw
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
- Host the server (Render Blueprint is ready), set `VITE_API_BASE`.
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
  H2 Vane's Crossing orders and Morgan's Channel watering the farm; H3 Foundry Yard and Fort Pell (scrap from fights);
  H4 Copper Bit, Tres Rios, Whisper Wash; H5 Silver Belle price board and Hollow Hill projects.
- **Performance and look:** quality switch and bloom for the desert and arena (town has it); cut fight draw calls further; ground
  detail, wind and horizon pieces.
- **Polish:** UI consistency (count-ups, reward reveals, safe areas), accessibility (text size, reduced motion, colour-blind aim
  line), hot-loop crossfade, barks for the stable and undertaker, weekly event rank titles.
- **Story:** `STORY_BIBLE.md` beats are only partly in the game (home grounds, taunts, bios). Add short skippable story screens.

### 4. Later
- Art coherence: one-page style guide, then modelled town buildings and restyled characters (parked by the owner). Rig the snake
  and horse in Blender.
- Growth: vertical videos recorded on a phone; Android via the same RevenueCat setup; Game Center and controller support.
- Tech health: KTX2 and meshopt compression if downloads matter.

## Housekeeping
- `TODO_V1.md`, `STAGE0_BASELINE.md` and `REFACTOR_PLAN.md` describe the old paid-desktop prototype and are historical. Safe to
  archive or delete once you agree; this file replaces them as the plan.
- `RELEASE_CHECKLIST.md` keeps the wave-era wording; its open items are folded into section 2 above.

## Source docs
`REFACTOR_PLAN` (old direction), `GROWTH_PLAN` (retention, events, monetization), `MONETIZATION` (store setup),
`POLISH_PLAN` (look, feel, audio), `TOWN_PLAN` and `PLACES` (town and districts), `STORY_BIBLE`, `IOS`, `ASSETS`,
`RELEASE_CHECKLIST`, `docs/POLICY_GENERATOR_ANSWERS`.
