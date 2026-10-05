# Lane: Server and scale to millions

**Mission:** Run the game for millions of players (`server/`).

## Backlog (from `PLAN.md`)
- Replace the JSON file store (`server/store.js`) with a database; make the store interface async
- Several stateless servers behind a load balancer; cache and rate limits shared across them (Redis or similar)
- Load tests in `tools/loadtest/`, monitoring, alerts, backups
- Idempotent purchases and webhooks; keep paid balances server-authoritative

## Done
- `POST /api/mine/run`: applies `applyMineRun` (src/mineProgress.js) to `profile.mine`. Same 20 s minimum between reports as `/api/run`, tracked separately (`user.lastMineRunAt`) so the mine and the Wanted Road do not block each other. Touches nothing but `profile.mine`.

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

## Built: hosting-ready
- `GET /healthz`: process up and `store.ping()` answers (the file store checks its folder is writable). 200 `{ ok, store }` or 503; no auth, no paths or secrets. `/health` stays for Render.
- `Dockerfile` (non-root, `NODE_ENV=production`, `/data` volume, `HEALTHCHECK` on `/healthz`) and `.dockerignore`. The image holds only `server/` and `src/`; the web game is still a static build elsewhere.
- `docs/DEPLOY.md`: Coolify steps, env var names, volume, backups, verifying the first deploy. Run one instance until the store is not a JSON file.
