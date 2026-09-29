# Red West store: how it works and how to switch on real money

Status:

| Step | What | State |
|---|---|---|
| 1 | Bounty Dollars (earned), cosmetics shop, daily jobs, earnings on the result screen | **Working now** (local playtest wallet) |
| 2 | Accounts + server-side wallet (`server/`) | Built and tested; **needs hosting** |
| 3 | App Store / Google Play purchases via RevenueCat | Wired in the app; **needs your RevenueCat + Apple accounts** |
| 4 | Web purchases via Stripe Payment Links | Wired in the game and server; **needs your Stripe account** |

## Design rules (from the research)

- **Two currencies.** Bounty Dollars ($) are earned by playing: score, collected bounties, new stars, daily
  jobs. Gold Nuggets (◆) are the paid currency, with a small free trickle from finishing all daily jobs.
- **No pay-to-win.** Gold Nuggets only buy cosmetics: hats, coats, pants, bullet colours
  (`src/cosmetics.js`). Guns (`src/weapons.js`) change gameplay, so they cost earned Bounty Dollars only,
  and each is a side-grade with a trade-off. A unit test fails if a gun is ever priced in nuggets.
- **No paid loot boxes.** Everything is shown with a fixed price, so no odds disclosure is needed.
- **No dark patterns** (FTC v. Epic, 2022). Every spend needs two taps (price → CONFIRM). Real-money packs
  also go through the App Store sheet or Stripe checkout. The store shows "Under 18? Ask a parent first."
- **Paid currency is server-authoritative.** Gold Nuggets bought with money are credited only by a
  verified store webhook on the server, never by the game client. Each transaction is credited once.

## How the pieces talk

```
Game (browser / iOS / Android)
  ├─ /api/account, /api/profile, /api/run, /api/buy, /api/equip,
  │  /api/name, /api/leaderboard ──────────────────────────────► Red West server (server/)
  ├─ iOS/Android: RevenueCat SDK ──► App Store / Google Play
  │                        RevenueCat ──webhook──► /webhooks/revenuecat ──► credits ◆
  └─ Web: Stripe Payment Link (?client_reference_id=<player id>)
                           Stripe ──webhook──► /webhooks/stripe ──► credits ◆
```

Without `VITE_API_BASE`, the game uses a **local playtest wallet** in the browser. It only holds earned
currency, and real-money packs show "SOON". Local balances are not moved to the server when you switch
over, so reset testers' balances at launch.

The same server runs the **leaderboards**. They rank accounts, not typed-in names: each account picks
one unique outlaw name, and every reported run updates that account's records. The boards are This Week
(best single run, resetting Monday UTC), Wanted Stars (all-time) and one per outlaw. A run only counts
if its score is plausible for its length and the outlaw was unlocked on that account. Without the
server, the Records screen shows the player's own records and says the boards need the server.

## 1. Host the server

The server is plain Node 20+ with no dependencies: `npm run server` (listens on `PORT`, default 8787).
It stores data in one JSON file (`DATA_FILE`, default `./data/redwest.json`). Use a persistent disk, and
move to a real database before many players join.

Any Node host works (Render, Railway, Fly.io, a VPS). Set these environment variables:

| Variable | Value |
|---|---|
| `ALLOWED_ORIGIN` | `https://bruceglez.github.io` (the game's origin) |
| `REVENUECAT_WEBHOOK_AUTH` | A long random string, e.g. `Bearer 7f3c…`. The same value goes in RevenueCat's webhook "Authorization header". |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the Stripe webhook endpoint |
| `STRIPE_PAYMENT_LINKS` | JSON mapping Payment Link ids to products, e.g. `{"plink_abc":"nuggets_100","plink_def":"nuggets_550","plink_ghi":"nuggets_1200"}` |
| `DATA_FILE` | Path on the persistent disk |
| `REVENUECAT_SECRET_KEY` | RevenueCat secret API key (`sk_…`), used only by the server for **Restore purchases** of the Deputy's Kit. |
| `ADMIN_TOKEN` | A long random string for moderation (below). Never put it in a `VITE_*` variable. |

Then point the game at it. In GitHub go to **Settings → Secrets and variables → Actions → Variables** and
add `VITE_API_BASE` = your server URL (e.g. `https://redwest-api.onrender.com`). The next Pages deploy
picks it up. These `VITE_*` values are public (they ship in the game), so never put secret keys in them.

The server also handles the Phase 0 privacy features ([GROWTH_PLAN.md](GROWTH_PLAN.md)): `/api/privacy`
(age band and statistics consent), `/api/events` (statistics, only with consent), `/api/report` (name
reports) and `/api/account/delete`. To review reported names:

```
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<server>/admin/reports
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
     -d '{"userId":"rw_...","action":"reset"}' https://<server>/admin/name   # or "keep"
```

`node tools/retention.mjs /path/to/redwest.json` prints day-1/7/30 return rates from the data file.

## 2. Apple (iPhone app) with RevenueCat

1. Apple Developer Program ($99/yr). In **App Store Connect**, create the app (bundle id
   `com.bruceglez.redwest`). Add three **Consumable** in-app purchases with the product ids
   `nuggets_100`, `nuggets_550`, `nuggets_1200` and prices ($0.99, $4.99, $9.99), and one
   **Non-Consumable** `starter_pack` ($1.99, the Deputy's Kit: three looks + 200 nuggets, once per player;
   the shop's RESTORE PURCHASES button gives the looks back on a new device). Complete the Paid
   Applications agreement.
2. **RevenueCat** (free to start): create a project, add the iOS app, and connect App Store Connect
   (in-app purchase key). Import the three products.
3. RevenueCat → Integrations → **Webhooks**: URL `https://<your server>/webhooks/revenuecat`,
   Authorization header = your `REVENUECAT_WEBHOOK_AUTH`.
4. Copy the **public Apple SDK key** (`appl_…`) into the GitHub variable `VITE_REVENUECAT_APPLE_KEY`.
5. Build the app with those variables set (`npm run ios:sync`, then Xcode or the TestFlight pipeline) and
   test with a **Sandbox** Apple account on TestFlight. Sandbox purchases are free.

Players are identified by the server account id, so RevenueCat's `app_user_id` is the same id the
server credits.

## 3. Web checkout with Stripe

1. Create a Stripe account. Make one **Payment Link** per pack (one-time price, same amounts).
2. On each link, set the after-payment redirect to `https://bruceglez.github.io/RedWest/?purchase=success`.
3. Add a **webhook endpoint** `https://<your server>/webhooks/stripe` for the event
   `checkout.session.completed`. Put its signing secret in `STRIPE_WEBHOOK_SECRET` and the
   `plink_…` → product mapping in `STRIPE_PAYMENT_LINKS`.
4. Put each link's URL in the GitHub variables `VITE_STRIPE_LINK_NUGGETS_100` / `_550` / `_1200` and
   `VITE_STRIPE_LINK_STARTER_PACK` (and map its `plink_…` to `starter_pack` in `STRIPE_PAYMENT_LINKS`).
5. Test in Stripe **test mode** first (card 4242 4242 4242 4242).

Note: inside the iOS app, Apple requires its own In-App Purchase for digital goods. Links out to web
checkout are only allowed in some regions (e.g. the US after Epic v. Apple) and Apple may take a
commission. The game uses RevenueCat whenever it runs as the native app.

## 4. Google Play (later)

The same RevenueCat plugin covers Google Play: add an Android app in RevenueCat, create the same product
ids in Play Console, and set `VITE_REVENUECAT_GOOGLE_KEY`. Building the Android app is a separate step.

## Before the first real sale

- A **privacy policy** URL (accounts, purchases) and a support contact, for both stores.
- Apple and Google refunds reach RevenueCat as events. This server does not claw back refunded
  nuggets yet; decide a policy and add it before scale.
- Keep the server's data file backed up. It holds everyone's paid balances.

## Testing

`npm test` covers the economy rules (`tests/profile.test.js`) and the server, including webhook auth,
Stripe signatures and duplicate deliveries (`tests/server.test.js`). `npm run test:store` plays a run,
buys and equips in the browser, then repeats against a live server and simulates a RevenueCat webhook
credit.
