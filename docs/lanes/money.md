# Lane: Monetization, legal and App Store

**Mission:** Store, real money, legal and the App Store (`MONETIZATION.md`, `IOS.md`).

## Backlog (from `PLAN.md`)
- Publish policy and terms; set the privacy and support variables
- Apple, RevenueCat and Stripe setup; TestFlight; App Store listing
- Sign in with Apple; refunds paths

## Rules
Real-money goods are cosmetics and nuggets only. No loot boxes, no dark patterns, two taps to spend. Nuggets are credited only by verified server webhooks.

## You own
- `src/wallet.js`
- `src/purchases.js`
- `src/products.js`
- `src/pass.js`
- `src/jobs.js`
- `src/privacy.js`
- `src/appleSignIn.js`
- `src/economyError.js`
- `MONETIZATION.md`
- `IOS.md`
- `docs/**`
- `capacitor.config.json`
- `ios/**`
- `tests/apple.test.js`
- `tests/pass.test.js`
- `tests/starter.test.js`
- `tests/refunds.test.js`
- `tests/privacy.test.js`
- `tests/profile.test.js`
- `tests/store-smoke.mjs`
- `.github/workflows/ios.yml`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:store`
