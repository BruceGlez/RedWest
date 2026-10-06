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

## Built: Copper Bit's route
- `POST /api/town/saloon`: `saloonAction(user.profile, body, now())` (src/saloon.js), same shape as `/api/town/orders`, answers `{ result, profile }`. The server clock decides the day, so paid shifts per day, a night's crowd and the menu are the server's, whatever the client sends. Tested in `tests/server.test.js`.

## Built: hosting-ready
- `GET /healthz`: process up and `store.ping()` answers (the file store checks its folder is writable). 200 `{ ok, store }` or 503; no auth, no paths or secrets. `/health` stays for Render.
- `Dockerfile` (non-root, `NODE_ENV=production`, `/data` volume, `HEALTHCHECK` on `/healthz`) and `.dockerignore`. The image holds only `server/` and `src/`; the web game is still a static build elsewhere.
- `docs/DEPLOY.md`: Coolify steps, env var names, volume, backups, verifying the first deploy. Run one instance until the store is not a JSON file.

## Design: the Postgres store seam (not built yet)

**Goal:** players in Postgres instead of one JSON file, with no change to game rules and the JSON store still the default for dev and tests.

### Where it hurts today
`server/app.js` calls the store synchronously and keeps the whole user in memory:
- Per request it does `getUser`, mutates `user.profile`, then `putUser` + `save()`. `save()` rewrites the whole file, so it grows with the player count, and two instances would overwrite each other.
- Four lookups scan every user with `listUsers()`: Apple `sub`, a Stripe `paymentIntent` (refunds), the name-taken check, and name reports; the leaderboard and account deletion scan too. Fine at playtest size, not at millions.

### The interface (async, small, named for what the app asks)
`store.js` stays the seam; every method returns a promise (the JSON store just returns resolved values). Replace the scans with the questions the app really asks, so Postgres can use indexes:

```
getUser(id) -> user | null
putUser(id, user, { expectedVersion }?) -> { version }     // see "Concurrency"
deleteUser(id)
findUserByTokenHash(hash) -> id | null                     // indexed
findUserByAppleSub(sub) -> { id, user } | null             // indexed
findUserByPaymentIntent(pi) -> { id, user } | null         // indexed (purchases.paymentIntent)
nameTaken(name, exceptId) -> boolean                       // unique index on lower(name)
leaderboard(board, limit) -> rows                          // query, not a full scan
reportsForName(name) / clearReports(name)                  // replaces the report scan
retainPurchases(records) / retainedPurchases()
ping()                                                     // already there (/healthz)
```
`save()` goes away (a write is a write). `listUsers()` stays only on the JSON/memory store for tools and tests. The JSON store implements the new methods with the same scans as today, so behaviour and tests do not change. `app.js` changes mechanically (`await` in front of store calls, the four scans become the new lookups); that is one scale-lane PR, tests green throughout.

### Postgres schema (first version, deliberately plain)
- `users(id text primary key, token_hash text, token_hashes text[], apple_sub text, name text, profile jsonb, meta jsonb, version int not null default 0, created_at, updated_at)`. The profile stays one `jsonb` document: the game rules (`src/profile.js` and friends) own its shape and change often, so we do not mirror it in columns. Only what we look up gets a column and an index: `token_hash`, `apple_sub`, `lower(name)` (unique), and a GIN or expression index for `paymentIntent`.
- Leaderboards: start with an indexed query over a few numeric columns copied from the profile on write (best score per board), later a materialised view or a cache if needed.
- `retained_purchases(transaction_id primary key, deleted_at)`.
- Driver: `pg` (one new dependency, the first the server has; the Dockerfile then needs `npm ci --omit=dev`). That change is part of the Postgres PR, not before.

### Concurrency (the real work)
Read, mutate, write is a race when two requests for one player overlap (a double tap, a retry, the same account on two phones). Today a single process hides it. Options, in order of preference:
1. **Optimistic version:** `putUser` with `expectedVersion` does `UPDATE ... WHERE id=$1 AND version=$2`; on 0 rows the app re-reads and retries the whole action (they are pure functions of the profile and the clock, so a retry is safe). Cheap, no long locks.
2. `SELECT ... FOR UPDATE` in a transaction per request. Simpler to reason about, holds a connection for the request.
Purchases and webhooks must be idempotent on the transaction id inside the same transaction (shared with the money lane); that is a correctness requirement on its own, whatever the store.

### Migration from the JSON file
1. Ship the Postgres store behind `STORE=postgres` + `DATABASE_URL`; default stays the JSON file.
2. `tools/migrate-json-to-postgres.mjs`: reads `redwest.json`, normalises each profile with `normalizeProfile`, inserts in batches, is safe to run twice (`ON CONFLICT DO UPDATE` only if the JSON copy is newer), and prints counts. Dry-run flag first.
3. Cut-over: stop the app, back up the file, run the script, check counts and a few logins, start with `STORE=postgres`. Keep the file for a week as the rollback.
4. Tests: the same store contract test runs against the memory store and, in CI with a Postgres service, the Postgres store.

### When Redis is actually needed
- **One app instance: not at all.** Rate limits (`createRateLimiter`) live in memory and are right for one process. A restart forgets them, which is acceptable.
- **More than one instance:** each instance has its own counters, so the real limit becomes N times larger and per-user checks like "20 s between runs" use `user.lastRunAt` in the store, which is already shared and fine. Only the IP/account request limiters need a shared place: Redis `INCR` with expiry. Cache for the leaderboard becomes useful at the same point.
- Sessions are tokens looked up in the store, not in-process state, so the servers are already stateless apart from the limiter.
- So the order is: Postgres first (fixes the durability and write-amplification problems, and is what lets us run more than one instance at all), Redis only when a second instance is added.

### Proposed PR sequence
1. Async store interface + the new lookups on the JSON store, `app.js` awaited (no new dependency, behaviour unchanged).
2. Postgres store + contract tests + `STORE`/`DATABASE_URL` + Dockerfile `npm ci --omit=dev`.
3. Migration script and the cut-over steps in `docs/DEPLOY.md`.
4. (Only with a second instance) Redis limiter.

## Built: the async store (PR 1 of the Postgres plan, a pure refactor)
- `server/app.js` now `await`s every store call, and the four full-user scans became the lookups the design named: `findUserByAppleSub`, `findUserByPaymentIntent`, `findUserByName(name, exceptId)` (name taken, and name reports; one lookup instead of the design's `nameTaken` plus `reportsForName`), `listReportedUsers`, `listBoardUsers`, `removeReporter`. The interface is written at the top of `server/store.js`.
- The JSON/memory stores still answer at once and still scan (same behaviour, same speed); `await` accepts both. `listUsers()` is not part of the interface and stays for tools and tests. `save()` is still called after writes; the Postgres store makes it a no-op, and it goes away with the JSON store.
- No behaviour change: `tests/server.test.js` and the other suites are unchanged and green.

## Built: the mine shop's route
- `POST /api/mine/buy` `{ id, shop? }`: `buyLight(profile, id, shop)` (src/mineLight.js), Bounty Dollars only, answers `{ result, profile }`. The server whitelists the item and the shop by own name (an id like `constructor` would otherwise reach the price table and make the balance NaN), turns the shop's coded refusals into 400s, and takes no price from the body. 120 buys an hour per account. A refused buy leaves the profile as it was. `wallet.buyLight(body)` is on both wallets.

## Built: the Postgres store (PR 2 of the Postgres plan)
- `server/pgStore.js`: the same interface as the JSON store, selected with `STORE=postgres` and `DATABASE_URL` in `server/index.js` (the JSON file stays the default). `pg` is the server's only dependency and lives in `server/package.json`, so the root `package.json` and the game build are untouched; the Dockerfile installs just that (`npm ci --omit=dev` in `server/`). `pg` is imported only when the Postgres store is created.
- One row per player: `users(id, token_hash, token_hashes, apple_sub, name, data jsonb, version, ...)`. `data` holds the whole user object exactly as the JSON store keeps it (a deliberate simplification of the design, which split `profile` and `meta`: nothing reads them apart), so a new profile field never needs a migration. Only what is looked up has a column and an index: token hashes, the Apple id (unique), the name, and a GIN index on `profile.purchases` for refunds by payment intent. `retained_purchases` has the transaction id as its primary key (the JSON store now keeps one record per transaction too).
- **Concurrency, the part that matters for money.** `store.lock(id)` makes the requests of one player run one at a time: `handle` takes it for every `/api/` request and re-reads the player after waiting; the webhook and admin writes take it too. Without it two quick buys would both read the old balance (the JSON store never interleaved because it answered at once). On top of that `putUser` writes only if the row still has the version it was read at, and throws `StoreConflictError` (answered 409) otherwise, so a second server instance can never silently overwrite an account. Gaps left on purpose: Sign in with Apple and a report that changes another player's row are not under the player's lock in one instance; the version check catches them.
- Not done yet (later PRs): the JSON-to-Postgres migration script (PR 3); the leaderboard still reads every visible player (`listBoardUsers`) and wants a query of its own; the request limits are still in memory (Redis only with a second instance); `name` is indexed, not unique.
- Tests (`tests/storeContract.test.js`): one contract run on the memory, file and (with `TEST_DATABASE_URL`) Postgres stores: lookups, name moves, reports, retained purchases, delete; six simultaneous buys of one lantern cost one price (this fails on Postgres with the lock taken out); a stale write is refused and the data survives a restart; the keyed lock. Checked here against a real Postgres 16.
