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
4. **Styles are per area.** `style.css` only lists `@import`s of `styles/*.css`. Add or edit rules in your lane's file; a new area gets a new
   file and one import line. Order of imports matters for the cascade.
5. **Cross-lane work** (for example the mine saving a floor needs the server) is split: the data contract goes first in the owning lane's PR,
   the consumer follows. Say in the PR description which lane you are waiting on.
6. **The game rules do not move:** money never buys combat power; no paid loot boxes, no sold timers, no dark patterns; places and buildings
   never change combat; original art, names and story only; every asset gets a row in `ASSETS.md`.
7. **Green before you push:** `npm test` (includes the ownership check), `npm run build`, and your lane's checks. A red `main` is everyone's
   first priority.
8. **Docs:** update `PLAN.md` (status) and your own plan doc in the same PR as the change. Do not create new top-level plan files.

## Commands

```
node tools/lanes.mjs list            the lanes and their checks
node tools/lanes.mjs check           every tracked file is owned (also run by npm test)
node tools/lanes.mjs who <path>...   which lane owns a path
node tools/lanes.mjs diff            which lanes your branch touches
```
