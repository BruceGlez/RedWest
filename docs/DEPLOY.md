# Deploying the Red West server on Coolify

The server (`server/`) is one Node 22 process with no npm dependencies. It stores players in one JSON file until the Postgres store lands
(see `docs/lanes/scale.md`). `render.yaml` still works for Render; this page is for your own VPS with Coolify.

## What runs where

| Part | Where | Notes |
|---|---|---|
| Server | Coolify "Dockerfile" application from this repository | Builds the `Dockerfile` at the repo root. Port 8787. |
| Player data | A Coolify persistent volume mounted at `/data` | Needed now: the JSON file `DATA_FILE=/data/redwest.json` lives there. Without the volume every deploy wipes all accounts. |
| Postgres | Coolify database service | **Not used yet.** Added with the Postgres store. |
| Redis | Coolify database service | **Not needed** with one app instance (rate limits live in memory). Only needed once there is more than one instance. |
| The game (web) | GitHub Pages, as today | A static build (`npm run build`). `VITE_API_BASE` is read at build time, so it is set in the GitHub Actions variables, not on the server. |

Run **exactly one** instance of the server for now. The JSON file store is not safe for two writers.

## Steps

1. In Coolify: New resource, Public/Private repository, this repository, Build pack **Dockerfile**, port **8787**.
2. Storages: add a persistent volume, destination path `/data`.
3. Health check: Coolify reads the `HEALTHCHECK` in the Dockerfile. If you set one by hand: `GET /healthz`, expect 200.
4. Environment variables (set the values in Coolify, never in the repository):
   - `TRUST_PROXY` = `1` (Coolify's proxy sits in front, so the caller address is in `X-Forwarded-For`)
   - `ALLOWED_ORIGIN` the web game's origin and the iPhone app's, comma separated (see `render.yaml` for the shape)
   - `ADMIN_TOKEN` a long random string
   - `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_LINKS`
   - optional Sign in with Apple: `APPLE_CLIENT_IDS`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_REDIRECT_URI`
   - already defaulted by the image: `NODE_ENV`, `PORT`, `DATA_FILE`
   - later, not read yet: `DATABASE_URL` (Postgres), `REDIS_URL`
5. Give the app a domain in Coolify (HTTPS). Put `https://<that domain>` in the GitHub Actions variable `VITE_API_BASE` and rebuild the game.
6. Webhooks: point RevenueCat and Stripe at `https://<domain>/webhooks/...` (see `MONETIZATION.md`).

## Verify the first deploy

```
curl -i https://<domain>/healthz
```

Expect `200` and `{"ok":true,"store":true}`. A `503` with `"store":false` means the process is up but the data folder is missing or not
writable (check the `/data` volume). The answer never contains paths, secrets or player data. Then:

1. Open the game with `VITE_API_BASE` set; it should create an account (`POST /api/account`).
2. Redeploy once and check the account is still there (this proves the volume).

## Backups

The store writes by replacing the file atomically, so copying it at any time gives a whole, valid file.
- Coolify scheduled backups cover databases; for the volume use a scheduled task on the VPS: `cp /data/redwest.json /backups/redwest-$(date +%F-%H).json` (find the volume's host path in Coolify's storage tab), then copy `/backups` off the VPS (S3, another machine).
- Test a restore once: stop the app, put the file back at `/data/redwest.json`, start, check `/healthz` and a login.
- Retained purchase records (for tax and refunds) live in the same file, so back it up before the first sale.
