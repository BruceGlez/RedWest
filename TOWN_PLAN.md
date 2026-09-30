# Lantern Rock: making the walkable town make sense

The town can be walked (README, "Walking the town, and the town's look"), but it was still a menu with a 3D skin: eight
doors in a ring, each opening a card. This plan gives walking a purpose. It was written on 2026-09-30 from a review of
Hollow Knight's Dirtmouth, Fate (2005), Township and the mood of Peaky Blinders, and from what the game already has.

## What we take from each reference

| Reference | Lesson | Red West version |
|---|---|---|
| **Hollow Knight** (Dirtmouth) | A tiny hub that is always useful; the way into the world is a place you walk to (the well); NPCs move in as you rescue them, so the town changes because of what you did. | The steam train at the depot is the way out to the Wanted Road. Every beaten outlaw adds a thing and, later, a person to town. |
| **Fate** (2005) | Town, then dungeon; a companion that follows you and grows; shops and side jobs around the descent. | The town is where you prepare for a hunt. A companion (a dog, later a horse) follows the marshal. Daily jobs are the side jobs. |
| **Township** | Visible growth, land that expands, a busy readable town where things happen. | New districts open as outlaws fall (stars, never money). The town is busy: townsfolk with routines, smoke, trains. |
| **Peaky Blinders** (mood only) | Industrial slum after the war: flat caps, charcoal and navy coats, a muted palette, smoke, backstreets, a pub that is the gang's base. | A rail-and-mining boomtown: foundry glow, a saloon with a back room, back alleys and a canal. Dusk by default. |
| **Hub practice** (Hades, Moonlighter) | The hub is where you plan the next run and see its results; NPCs comment on your progress. | The town already has barks. Results are shown in the world: cash in the jail yard, notes on the board. |

House rules: the inspirations are mood only. No names, logos, characters or art from those works (see `ASSETS.md`).
Buildings still never change combat (`tests/town.test.js`), and nothing is sold as a speed-up.

## The rule for every addition

**Walking must give something the tap-overview does not**: a thing you can see change, a place you go to, or someone who
reacts. If a feature could just as well be a button, it does not belong here.

## Steps

| Step | What | Size | Status |
|---|---|---|---|
| **A** | A reason to walk: the train is the gate to the hunt, the jail's cash box shows and pays the income, a bounty board in the square shows the day's jobs | small to medium | **built 2026-09-30** (below) |
| **B** | A second district (the foundry yard) that opens with a star, with its own mood and a few new walkable places | medium | planned |
| **C** | Townsfolk with routines and proximity barks, plus a companion that follows the marshal | medium | planned |
| **D** | Art pass for the new districts: modelled buildings, painted textures (`POLISH_PLAN.md`, section 6) | large | parked on purpose |

### Step A, as built

All three are interaction spots in `src/townSpots.js` (positions, verbs, the wording and the pure rules), drawn in
`src/townScene.js`, and reached by walking up and pressing E, Enter or tapping the prompt. They are not buttons on a card.

- **The train** (depot platform, in front of the locomotive). The prompt reads `RIDE OUT: <next outlaw>`. It starts the
  same hunt as PLAY for the outlaw the Wanted Road has selected. The depot's station house still opens the weekly Most
  Wanted card. PLAY and the Wanted Road stay on the home screen, so nobody is forced to walk.
- **The jail cash box** (in the jail yard). It fills with coins as the jail earns and glows gold when the jail is full.
  Walking up to it collects the money and opens the jail card with the result. The jail's own card still works.
- **The bounty board** (main street). Notes are pinned for each job not yet done today; the card lists the three jobs
  with progress and the reward, and has the DAILY JOBS button.

Rules kept: income and jobs use the existing wallet and profile; nothing here touches combat.

### Step B, planned

- Districts unlock by stars, never by money: the **foundry yard** after Iron Jack (Slagtown), then the canal and
  warehouses, then the ranch after the Calloways. A locked district is fenced off and says which star opens it.
- Each district has its own light and one thing to do (for example the foundry yard: an anvil where Ezra Stone shows
  the guns you own). Walking in is the only way to reach it.
- `walkMap()` already returns boxes, doors and bounds; a district is more boxes, doors and a bounds extension.

### Step C, planned

- Townsfolk follow a short routine between two or three stops (work, saloon, home), at most three stops a day of the
  game clock, and say their bark (`src/barks.js`) when the marshal stands near.
- A companion dog follows the marshal (cosmetic first; a perk later only if it cannot touch combat rules).
- Beaten outlaws move in as people, not only props (`GUESTS` in `src/townScene.js` is the place).

### Step D, parked

See `POLISH_PLAN.md`, section 6. Whatever is built in A to C only needs to keep `walkMap()` (footprints and doors) correct
when its art is replaced.

## How we know it works

- `tests/townSpots.test.js`: spots sit inside the town, clear of buildings, with wording and rules covered.
- `npm run test:town`: each spot can be reached and used in a real browser (the train starts a run, the cash box pays,
  the board opens).
- The mobile draw-call guard (`tests/mobile-smoke.mjs`) still holds, so the town stays cheap on phones.
- Play it and answer one question per step: did I walk somewhere because I wanted to, or because I had to?
