# Answers for the privacy policy and terms generator

Use these when a generator (Termly, iubenda or similar) asks about Red West. They describe what the game
actually does as of Phase 0 of [GROWTH_PLAN.md](../GROWTH_PLAN.md). Update them, and regenerate the
documents, whenever the game starts collecting something new (for example ads, if they are ever added).

After generating:
1. Publish the privacy policy and terms (the generator hosts them, or copy them to the Pages site).
2. Set the GitHub Actions variables `VITE_PRIVACY_URL`, `VITE_TERMS_URL` and `VITE_SUPPORT_EMAIL`. The game
   then links them in Settings and on the first-launch screen.
3. Put the same privacy policy URL in App Store Connect (and Google Play later), and fill Apple's privacy
   label from the table below.

## About the app

- **Name:** Red West. **Type:** free-to-play mobile and web game (iPhone app, web app at
  bruceglez.github.io/RedWest).
- **Owner / contact:** your legal name or company, country, and a support email address.
- **Audience:** general audience, **not directed at children**, but children may play. The game asks for a
  birth year on first launch and limits features for players under 13 (see below).
- **Countries:** worldwide (so answer yes to EU/UK GDPR, California CCPA/CPRA and other US state laws).

## What is collected, why, and where it goes

| Data | Collected when | Purpose | Stored where | Shared with |
|---|---|---|---|---|
| Account id and a sign-in token (random, created by the game) | Always, once the Red West server is connected | Keep the player's wallet, items and records | Red West server | Your hosting provider (processor) |
| Age band (under 13 / 13–17 / 18+), not the birth year | First launch | Apply the under-13 rules; legal compliance | Device, and the server once connected | No one |
| Outlaw name (chosen by the player, or generated for under-13s) | When the player sets it | Shown on public leaderboards | Server | Other players see it |
| Game progress: runs, scores, stars, kills, currencies, items owned and equipped | While playing | Run the game, leaderboards | Device (offline) or server | Other players see leaderboard scores |
| Purchase records (product, transaction id, date) | When buying Gold Nuggets | Deliver purchases, prevent double credit, refunds and tax records | Server | Apple / Google via RevenueCat, or Stripe (web), who process the payment |
| Name reports (which account reported which name) | When a player reports a name | Moderation | Server | No one |
| Gameplay statistics: days the game was played and counts of game events (runs started and finished, shop opened, and similar) | **Only if the player opts in** on first launch or in Settings (never for under-13s) | Improve the game (retention, where players stop) | Server | No one |
| Settings (audio, auto-fire) | While playing | Remember preferences | Device only | No one |

**Not collected:** real name, email (unless the player writes to support), phone number, precise or
coarse location, contacts, photos, advertising identifier (IDFA / Android advertising id), and no
cross-app tracking. **No ads and no third-party analytics or advertising SDKs.**

- **Payment card details** are handled entirely by Apple, Google or Stripe; the game and server never see
  them.
- **Cookies / local storage:** the web game stores progress and settings in the browser's local storage
  (strictly necessary), and optional statistics only with consent.

## Players' rights and choices

- **Delete account:** Settings → *Delete my data*. On the server this deletes the account, profile, name,
  leaderboard entries, reports made and statistics. Only purchase transaction ids and dates are kept, for
  tax, refund and fraud obligations (say how long: typically as long as tax law requires, e.g. 7 years).
- **Statistics:** can be switched off at any time in Settings.
- **Access / correction:** by email to support.
- **Retention:** account data is kept until the player deletes it; inactive accounts may be deleted after
  a period you choose (for example 24 months without play).

## Children

- Birth year asked on first launch with a neutral question. Players under 13: no statistics, no typed
  names (a generated name is used on leaderboards), no real-money purchases offered, no ads (the game has
  none anyway).
- If a parent asks, delete the child's account (Settings → *Delete my data*, or by email).

## Terms of service points to include

- Gold Nuggets and all items are a limited licence to use in the game; they have no cash value, cannot be
  exchanged for money, sold or traded, and are not refundable except where the law or the store's refund
  policy requires.
- Purchases on iPhone go through Apple (Apple's standard EULA applies), on the web through Stripe.
- Refunded purchases: the matching Gold Nuggets can be removed.
- Players must not cheat, exploit bugs, or use offensive names; names can be hidden or reset, and accounts
  closed for abuse.
- Weekly events and leaderboards are free to enter; rewards are in-game only, with no cash value.
- The game may change, and may be discontinued with notice.
- Under 18: a parent or guardian should agree to purchases.
- Governing law and contact address: yours.
