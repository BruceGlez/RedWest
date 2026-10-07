# Lane: Game design and specs (advisory)

**Mission:** Answer "how do we make this area better?" with analysis and written specs, so the building lanes (`town`, `mine`, `combat`, `ui`, `art`) can implement them. The owner asks this lane questions; it does not build.

## First brief: Copper Bit as a Cake Mania style shift game
Copper Bit (`PLACES.md` section 8, `src/saloon.js`, `src/saloonShift.js`, `src/saloonShiftView.js`) is a serve-the-customers shift game. The owner wants it to feel like Cake Mania: fast, readable time management that is fun in two-minute bursts. Start by reading the built shift, playing it (`npm run dev`, then walk to Copper Bit), and listing what makes Cake Mania work that this one lacks. Then write the spec.

Things to analyse and spec (propose, do not assume the owner agrees):
- The moment-to-moment loop: customer arrival, patience bars, order readability, how many things the player juggles at once.
- Stations and upgrades: what each upgrade changes you can feel, and the order the player buys them.
- Combos, tips, regulars and star ratings: what is rewarded and how clearly the screen says so.
- Night-by-night difficulty curve and the first 5 minutes for a new player.
- Phone play: thumb reach, tap targets, one-handed use.
- Pace and session length against the income rule (three paid shifts a day).

## Rules
- **Specs and analysis only.** Write them under `docs/design/` (one file per topic, for example `docs/design/copper-bit-shift.md`). Do not edit game code, tests, `PLAN.md`, `PLACES.md` or any other lane's file. If a plan doc needs a line, put it in the spec and say which lane owns that doc.
- **The game rules do not move** (`AGENTS.md` rule 6): money never buys combat power, no sold timers, no paid loot boxes, no dark patterns; places never change combat; original art, names and story only. Every proposal checks itself against these and says so.
- **Every proposal is numbered and has a "decision for the owner"** line (what, why, cost to build, which lane builds it). The owner decides; nothing is built until he says so.
- **Ground it in numbers.** Quote the real constants from the code (crowd sizes, prices, patience, tip rates) and say what would change.
- Splitting into build PRs: each spec ends with an ordered list of small PRs, one lane each, following `AGENTS.md` rule 5 (data contract first, consumer after).

## You own
- `docs/design/**`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
