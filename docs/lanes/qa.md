# Lane: QA and release

**Mission:** Tests, CI and release readiness.

## Backlog (from `PLAN.md`)
- Playtest gate: 12 first-time players, 8 understand Heat, 6 replay
- Real-phone frame and audio checks; known-issues list; release candidate
- Keep `RELEASE_CHECKLIST.md`, CI and `AGENTS.md`/`lanes.json` current
- Built 2026-10-09: coordinator and managing agent guide (`docs/lanes/coordinator.md`) detailing multi-lane task delegation and recommended AI model allocation to preserve token quotas


## Rules
A red check on `main` is everyone's first priority. Never skip or quarantine a test to get green.

## You own
- `tests/smoke.mjs`
- `tests/static-smoke.mjs`
- `tests/chrome-path.mjs`
- `tests/privacy-seed.mjs`
- `tests/runLog.test.js`
- `tests/lanes.test.js`
- `tools/lanes.mjs`
- `src/runLog.js`
- `RELEASE_CHECKLIST.md`
- `.github/workflows/checks.yml`
- `lanes.json`
- `AGENTS.md`
- `docs/lanes/**`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run build`
- `npm run test:smoke`
- `npm run test:static`
