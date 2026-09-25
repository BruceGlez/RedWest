# Red West — proposed rewrite plan

**Status:** Stage 0–1 approved on 2026-09-24. Stage 2 onward remains subject to the prototype playtest gate.
**Prepared:** 2026-09-24
**Target:** A compact, paid, single-player desktop action game, validated first in the browser.

## Product decision

**Pitch:** *Hunt a notorious outlaw through short, escalating Western shootouts. Take the bounty and escape, or stay longer for a bigger score and greater danger.*

Keep the responsive manual aiming, movement, dash, low-poly Western look, and short arcade sessions. Replace endless survival as the sole objective with a **15–20 minute bounty run** that has a beginning, decisions, a climax, and an ending. The player still faces waves, but each wave advances a named contract and offers a choice that changes the rest of the run.

This is an original direction informed by comparable games, not an attempt to copy their characters, art, balance, or progression systems.

## What the research says

| Game | Verified public signal (2026-09-24 snapshot) | Relevant lesson for Red West |
| --- | --- | --- |
| [Kill The Crows](https://store.steampowered.com/app/2441270/) | $4.99 base price; 96% positive among 1,705 English reviews shown on Steam. Western top-down arena shooter built around one-shot gunfights, a distinctive Showdown ability, enemy patterns, and gear. | A compact Western shooter can sell when its combat identity is immediately clear. Red West needs its **own** signature system and readable enemy behavior. |
| [Brotato](https://store.steampowered.com/app/1942280/Brotato/) | $4.99 base price; 96% positive among 32,350 English reviews shown. Short runs, character traits, many items and weapons, and between-wave shop choices. | Repeat runs need meaningful combinations. Red West should add a focused set of interacting upgrades, not merely more health or damage. |
| [20 Minutes Till Dawn](https://store.steampowered.com/app/1966900/20_Minutes_Till_Dawn/) | $4.99 base price; 91% positive among 12,889 English reviews shown. Manual aim/fire, 10–20 minute runs, weapons, upgrades, and character builds. | Manual shooting can distinguish Red West from automatic-fire survivor games. Weapon feel and build synergy must carry the playtime. |
| [Colt Canyon](https://store.steampowered.com/app/940710/Colt_Canyon/) | $14.99 base price; 90% positive among 1,545 reviews shown. Western roguelike with a rescue objective, multiple weapons, randomized levels, and bosses. | A stronger objective and crafted content can support a higher price, but its broader scope is not the initial target for this rewrite. |

These Steam page observations show that these games found an audience; they do not prove any one feature caused sales. Prices and review counts can change. The proposed initial price to **test**, once the game meets the release gates, is **$4.99–$7.99 USD**. Final pricing needs playtest feedback and an updated comparison near launch.

## Current repository baseline

- A plain browser ES-module game using Three.js from an import map in `index.html`; no package manifest, build pipeline, automated tests, or CI.
- `src/gameLoop.js` coordinates wave spawning, pause/settings, reset, update, render, and debug output. State is shared through `src/state.js` arrays and objects.
- Existing play systems include two weapons, four enemy types, randomized map props, pickups, procedural audio, score persistence, pause/settings, and a run report.
- Most scenery and characters are code-built low-poly meshes in `src/assets.js`. This is useful as a prototype visual language, but art direction and combat readability need playtesting.
- `RELEASE_CHECKLIST.md` still has open gameplay, audio, performance, and playtest gates. This plan is based on code inspection; it does not claim the current build passed those gates.

## Approved scope, if this plan is accepted

### 1. Core run

1. Select one of three bounty contracts. Each names a target, previews its special threat, and sets a risk/reward modifier.
2. Fight through three short encounters in one of two Western arenas. Each encounter has a clear objective: survive, intercept a convoy, hold a position, or eliminate a lieutenant. No separate story campaign.
3. Between encounters, choose one of three rewards. The choice is immediate, visible in combat, and can combine with earlier choices.
4. Face the named outlaw in a telegraphed boss fight. Winning opens an exit; the player may bank the bounty or continue into a harder bonus round for score.
5. Show a run report with contract result, time, build, kills, damage, and best score. Restart directly into another contract.

### 2. Combat identity

- **Signature system: Heat.** Consecutive accurate kills raise the player's wanted level during an encounter. Higher Heat increases the bounty multiplier and sends more dangerous pursuers. Dropping the chain lowers Heat. After the outlaw falls, the player can bank the bounty or carry that Heat into a bonus encounter. Prototype this first; keep it only if testers understand the risk and enjoy choosing when to cash out.
- Preserve manual aiming, movement, and dash. Rework feedback for hits, damage, reloading, enemy windups, and pickups so the player can read combat at a glance.
- Give six weapons distinct roles at full-content target: revolver, shotgun, rifle, dual pistols, lever-action carbine, and a high-risk specialty weapon. Ship the vertical slice with two polished weapons before expanding.
- Target eight regular enemy behaviors and three bosses at full-content target. Introduce enemies in combinations that teach counters; avoid relying on health inflation for difficulty.
- Target 18–24 run upgrades in a small number of understandable families (precision, mobility, reload, explosives, defense). Each family should have at least one deliberate synergy with another. Avoid permanent damage grind that makes early runs feel weak.

### 3. Presentation and usability

- One coherent Western palette, recognizable enemy silhouettes, cleaner HUD, readable pickup and objective markers, impact and reload sounds, and music that supports combat intensity.
- First-time tutorial delivered during play, with no long instruction wall. Keyboard and mouse remain the initial input target. Controller support is a release candidate gate for a desktop storefront, not a vertical-slice blocker.
- Settings for volume levels, fullscreen, screen shake, and readable text. Preserve local scores and settings through a versioned save format.
- English UI first; prepare strings for localization and prioritize Spanish after the English copy and layout stabilize.

## Technical rewrite approach

Keep **JavaScript and Three.js**. Add a lightweight local build workflow (proposed: Vite), pin the dependency, and produce a static browser build. Evaluate a desktop wrapper only after the browser version meets its quality gate. Do not switch engine or add a backend for this scope.

Replace the global-state and monolithic-loop coupling in stages:

1. Define explicit run phases: menu, encounter, reward, boss, extraction, and results. Give each phase one entry and exit path.
2. Split simulation rules from rendering and UI. Use a fixed simulation step for movement, damage, spawn timing, and Heat; render independently. Provide seeded randomness for repeatable balance tests.
3. Move weapons, enemies, contracts, and upgrades into validated data definitions with small behavior modules. Keep one authoritative source for combat numbers.
4. Centralize entity creation/destruction and timers so restart, pause, and scene transitions release pooled objects and pending callbacks safely.
5. Add a versioned persistence layer with migration from the current `localStorage` keys where practical. Do not silently delete player scores/settings.
6. Add focused tests for reward application, run-phase transitions, scoring, and save migration; add a browser smoke test for start → combat → result → restart. Add GitHub Actions build/test checks once the workflow exists.

Existing visuals and systems can be reused when they help the new game. The rewrite proceeds as playable increments merged into `main`; the original build stays available for comparison at commit `a0a68e5`.

## Delivery sequence and review gates

| Stage | Deliverable | Gate before moving on |
| --- | --- | --- |
| 0. Baseline | Record current gameplay, run the existing release checklist, capture performance and obvious bugs. Set up local build and smoke test. | A reproducible starting build and known-issues list. |
| 1. Combat prototype | One arena, revolver and shotgun, Heat prototype, three distinct enemies, one boss. Temporary art is acceptable. | In observed tests, at least 8 of 12 new players understand the Heat tradeoff after one run; at least 6 voluntarily start a second run. If not, revise the mechanic before expanding content. |
| 2. Bounty vertical slice | One complete contract with encounter choices, reward selection, boss, extraction, and report. | A run starts and ends without intervention; 12 fresh testers can explain the goal; at least 8 want another run. Capture reasons for drop-off. |
| 3. Content and polish | Three contracts, two arenas, six weapons, eight regular enemy behaviors, three bosses, 18–24 upgrades, tuned audio and UI. | Three consecutive full runs without a blocking bug; repeat-run variety confirmed by testers; no severe frame drop on a defined target PC. |
| 4. Release candidate | Desktop package, controller pass, accessibility/settings pass, store assets, demo, and updated checklist. | External testers can install, play, quit, relaunch, and retain settings/scores; store page accurately shows the game being sold. |

The tester thresholds are **decision rules for the project**, not industry benchmarks. Record raw observations as well as counts. If Stage 1 or 2 fails, improve the core loop before building the full content list.

## Explicit exclusions for this rewrite

Multiplayer, online accounts or leaderboard, live service features, in-app purchases, open world, full narrative campaign, mobile controls, procedural generation of all levels, and a custom engine. These can be reconsidered only after the paid core game is validated.

## Distribution and commercial gate

Use a free demo to test the pitch before charging. Publish a Steam Coming Soon page when the visual identity and gameplay clip match the expected product. Steam currently states a [$100 Steam Direct fee, a 30-day wait after payment, and at least two weeks for a public Coming Soon page](https://partner.steamgames.com/steamdirect). The first store trailer should show [actual gameplay](https://partner.steamgames.com/doc/store/trailer). Do not commit to a release date or Early Access sale until the vertical slice and playtest evidence justify it.

Before pricing, review the comparable games again, test the demo with the intended audience, and write a clear statement of what the paid version includes beyond the demo. Sales are uncertain; the purpose of the gates is to reduce the chance of spending months expanding a loop players do not want to repeat.

## Approved work boundary

The **bounty-run direction**, **stage gates**, and **full-content targets** were approved for planning. Approval started Stage 0 and Stage 1 implementation only. Stage 2 onward will be adjusted using prototype playtest evidence. The current Stage 1 implementation and outstanding checks are recorded in [STAGE0_BASELINE.md](STAGE0_BASELINE.md).
