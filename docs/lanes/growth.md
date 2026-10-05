# Lane: Growth and live ops

**Mission:** Retention, live events and getting players (`GROWTH_PLAN.md`).

## Backlog (from `PLAN.md`)
- Weekly Most Wanted rank titles
- Vertical videos recorded on a phone; playable ad
- Reminders and analytics (first-party, consent-based)
- Android and Game Center later

## Rules
Analytics only with consent; none for under-13s. No ads for now.

## You own
- `src/events.js`
- `src/analytics.js`
- `src/reminders.js`
- `src/demo.js`
- `tools/inline-demo.mjs`
- `GROWTH_PLAN.md`
- `tests/events.test.js`
- `tests/reminders.test.js`
- `tests/demo-smoke.mjs`
- `tests/event-smoke.mjs`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:event`
- `npm run test:demo`
