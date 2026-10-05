# Working on Red West with several agents

The repo is split into **11 lanes**. Each lane owns a set of files (`lanes.json`), has a short brief in `docs/lanes/<id>.md`, and a list
of checks to run. Agents in different lanes should almost never touch the same file. Start with `PLAN.md` for the big picture.

| Lane | Id | Brief |
|---|---|---|
| 1 Art and 3D | `art` | [docs/lanes/art.md](docs/lanes/art.md) |
| 2 Mine floors and monsters | `mine` | [docs/lanes/mine.md](docs/lanes/mine.md) |
| 3 Farm, town and places | `town` | [docs/lanes/town.md](docs/lanes/town.md) |
| 4 Server and scale to millions | `scale` | [docs/lanes/scale.md](docs/lanes/scale.md) |
| 5 Combat and balance | `combat` | [docs/lanes/combat.md](docs/lanes/combat.md) |
| 6 Audio | `audio` | [docs/lanes/audio.md](docs/lanes/audio.md) |
| 7 UI, UX and accessibility | `ui` | [docs/lanes/ui.md](docs/lanes/ui.md) |
| 8 Story and content | `story` | [docs/lanes/story.md](docs/lanes/story.md) |
| 9 Monetization, legal, App Store | `money` | [docs/lanes/money.md](docs/lanes/money.md) |
| 10 QA and release | `qa` | [docs/lanes/qa.md](docs/lanes/qa.md) |
| 11 Growth and live ops | `growth` | [docs/lanes/growth.md](docs/lanes/growth.md) |

## Rules

1. **One lane per branch and PR.** Name the branch `<lane>/<what>` (for example `mine/ore`). Keep PRs small and merge them often.
2. **Stay in your files.** `node tools/lanes.mjs who <path>` says who owns a path; `node tools/lanes.mjs diff` shows which lanes your branch
   touches (`--strict` fails when it is more than one). New files in your lane's folders or patterns are yours; a file no lane claims fails
   `npm test` until it is added to `lanes.json`.
3. **Shared files** (listed under `shared` in `lanes.json`: `main.js`, `gameLoop.js`, `uiManager.js`, `townPanel.js`, `profile.js`,
   `index.html`, `package.json`, ...) are where lanes meet. Change them in a *small separate PR*, only to add a hook your lane needs,
   and rebase on `main` first. Prefer adding a new module and a one-line call over editing the big files.
   CI enforces this: the `lanes` workflow fails a PR that changes more than 120 lines in shared files (`node tools/lanes.mjs shared`).
   A PR that deliberately changes shared code goes in on its own and carries the `shared-change` label, which lifts the limit.
4. **Styles are per area.** `style.css` only lists `@import`s of `styles/*.css`. Add or edit rules in your lane's file; a new area gets a new
   file and one import line. Order of imports matters for the cascade.
5. **Cross-lane work** (for example the mine saving a floor needs the server) is split: the data contract goes first in the owning lane's PR,
   the consumer follows. Say in the PR description which lane you are waiting on.
6. **The game rules do not move:** money never buys combat power; no paid loot boxes, no sold timers, no dark patterns; places and buildings
   never change combat; original art, names and story only; every asset gets a row in `ASSETS.md`.
7. **Green before you push:** `npm test` (includes the ownership check), `npm run build`, and your lane's checks. A red `main` is everyone's
   first priority.
8. **Docs:** update `PLAN.md` (status) and your own plan doc in the same PR as the change. Do not create new top-level plan files.

## Adding a run mode or a place (no edits to the big files)

- **A run mode** (the Wanted Road, the Arena, the mine, a future farm-defence mode): write `src/modes/<name>.js` exporting one object and
  register it in `src/modes/index.js`. The hooks (HUD words, look, begin, update, result text, reset, ...) are listed at the top of
  `src/modes/registry.js`; anything a mode leaves out comes from the Wanted Road (`src/modes/road.js`). `gameLoop.js` and `uiManager.js`
  only ask `activeMode()`.
- **A place you walk into** (Foundry Yard, Fort Pell, ...): write `src/places/<name>.js` exporting a factory `createXPlace(host)` and
  register it in `src/places/index.js`. The place shape and the `host` it is given are at the top of `src/places/registry.js`.
  `townPanel.js` only asks the registry.

## Art and function on the same area (town, farm, mine, and every place to come)

Every area has two kinds of agent working on it at once: the **art agent** (lane `art`) makes it look right, and a **function agent**
(lane `town` or `mine`) makes it work. They split the area's files like this:

| | Function agent (`town`, `mine`) | Art agent (`art`) |
|---|---|---|
| Owns | the **layout** (`farmLayout.js`, `undertakerLayout.js`, `mineMap.js`, `townSpace.js`, `townSpots.js`, `townDistricts.js`), the **rules**, the **cards and prompts** (`src/places/*.js`, `src/modes/*.js`), the tests | the **scene builders** (`placeFarm.js`, `placeUndertaker.js`, `mineScene.js`, `townScene.js`, and every `src/place*.js`), models, textures, materials, lighting, `styles/` for looks |
| Decides | what is where: ids, doors, plot positions, footprints, what each thing does | how it looks: shapes, models, colours, animation, glow, props that do nothing |

The contract between them:

1. **The scene reads the layout, it never invents it.** Door ids, positions and footprints come from the layout file. The art agent may add
   decoration anywhere it does not block the walkable map.
2. **`walkMap()` stays valid.** A scene builder returns the same shape the registry expects (see `src/places/registry.js`), and every
   door must still be reachable. `npm run test:town` and `npm run test:mine` check this. If a look needs a different footprint, the art agent
   asks for the layout change (in the PR description or a comment), the function agent changes the layout file first, and the scene follows.
3. **A new place is a pair.** The function agent's PR adds the layout, rules, card and registry line, and ONE deliberately cross-lane file: a
   plain box-built placeholder scene (`src/place<Name>.js`), so the place works at once. After that merges, every look change to that
   scene is the art agent's. Say "cross-lane on purpose: placeholder scene" in that PR.
4. **Budgets belong to art.** Town about 90 draw calls, a place under about 130, a fight under about 50 (`node tools/perf.mjs`, three runs, middle
   value). A function agent that adds objects keeps them few and merged (`src/meshMerge.js`).
5. **Never edit the other's file for a quick fix.** Leave a note in the PR description for the other agent instead.

## Commands

```
node tools/lanes.mjs list            the lanes and their checks
node tools/lanes.mjs check           every tracked file is owned (also run by npm test)
node tools/lanes.mjs who <path>...   which lane owns a path
node tools/lanes.mjs diff            which lanes your branch touches
node tools/lanes.mjs shared          lines changed in shared files (CI limit 120, label `shared-change` lifts it)
```
