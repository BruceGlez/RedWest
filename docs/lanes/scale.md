# Lane: Server and scale to millions

**Mission:** Run the game for millions of players (`server/`).

## Backlog (from `PLAN.md`)
- Replace the JSON file store (`server/store.js`) with a database; make the store interface async
- Several stateless servers behind a load balancer; cache and rate limits shared across them (Redis or similar)
- Load tests in `tools/loadtest/`, monitoring, alerts, backups
- Idempotent purchases and webhooks; keep paid balances server-authoritative

## Rules
The store interface in `server/store.js` is the seam: `app.js` only talks to it. Change both ends together and keep `tests/server.test.js` green. Anything touching purchases is shared with the money lane: say so in the PR.

## You own
- `server/**`
- `render.yaml`
- `tools/retention.mjs`
- `tools/loadtest/**`
- `tests/server.test.js`
- `tests/boards.test.js`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:store`
