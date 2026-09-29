# Red West growth plan: retention, live events and fair monetization

**Prepared:** 2026-09-29
**Status:** Decisions made (see the end). Phase 0 in progress.
**Assumes:** Red West becomes a free-to-play mobile game (iOS app plus the web build), with the paid-desktop
plan in [REFACTOR_PLAN.md](REFACTOR_PLAN.md) set aside. If it stays a paid game, only the Frontier Town,
playable outlaws, weekly event and analytics apply.

> **Not legal advice.** This plan is written to stay clear of the known legal problems in mobile games, but
> laws differ by country and change. Before the first real-money sale or the first ad, have a lawyer who
> works with games review the privacy policy, terms, age handling and store setup (a few hours of review
> is typical). Each **Legal guardrails** list below says what to do and why.

## Why this plan, in one paragraph

Kingshot (about $812M in its first 12 months) and Whiteout Survival earn most of their money from two
things Red West will not copy: advertising budgets in the hundreds of millions, and pay-to-win spending
(random hero draws, paid speed-ups, buyable power, alliance wars). What does transfer is **why players open
those games every day**: a base that keeps producing while you are away, a roster to collect, a calendar of
events, and purchases that are easy to understand. This plan adds those to Red West's existing short
outlaw runs, inside the rules already set in [MONETIZATION.md](MONETIZATION.md): no pay-to-win, no paid
loot boxes, no dark patterns.

## Rules every feature must follow

These extend the rules in MONETIZATION.md. Where possible each one is enforced by a unit test, like the
existing test that fails if a gun is priced in Gold Nuggets.

1. **Money never buys combat power.** Nuggets, the starter pack and the season pass buy cosmetics and
   nuggets only. Anything that changes a fight (guns, perks, playable outlaws) is earned by playing.
2. **No random paid rewards.** Every paid item has a fixed, shown content. No loot boxes, no gacha, no
   "mystery" packs, even for cosmetics. (Paid loot boxes are treated as gambling in Belgium, need odds
   disclosure on the App Store, and are under review in many countries. Avoiding them removes the issue.)
3. **Real-money price is always visible.** Every nugget price also shows its approximate real cost
   (for example "60 ◆ (≈ $0.60)"). Nugget packs are sized so items can be bought without leftover
   nuggets that force another purchase. (EU consumer authorities' 2025 principles on in-game currencies ask
   for exactly this.)
4. **No pressure tactics.** No countdown timers on offers, no "only 2 left", no pop-ups during or right
   after a loss, no confirm buttons that are easier to hit than cancel. Every spend keeps the existing
   two-tap confirm. (The FTC's 2022 case against Epic Games, $245M in refunds, was about purchase flows
   like these.)
5. **Free entry to every competition, and prizes with no cash value.** Event and leaderboard rewards are
   in-game only, cannot be traded or sold, and no paid item ever improves a ranked result. (Paid entry plus
   a prize can make a contest an illegal lottery or gambling in some places.)
6. **Ads are always the player's choice.** Only opt-in rewarded ads, never forced ads, never during a fight.
7. **Children are protected by default.** A neutral age question comes before accounts, purchases, ads and
   public names (see Phase 0).
8. **Ads show the real game.** Marketing uses real gameplay only. (The UK advertising regulator has banned
   mobile game ads that showed gameplay the game did not have.)

---

## Phase 0: foundations (before any new feature ships to the public)

These are mostly one-time and protect you legally. They are also what Apple checks in review.

### 0.1 Documents
- **Privacy policy** (what is collected: account id, chosen outlaw name, runs, purchases, analytics
  events; who processes it: your host, Apple, RevenueCat, Stripe, and later the ad network; how to delete
  it). Host it on the Pages site and link it in the game's Settings and in both store listings.
- **Terms of service / EULA:** virtual items are a licence, not property; no cash value; no trading; you
  may change or end the game; refunds follow Apple/Google/Stripe rules. Apple's standard EULA covers the
  iOS app if you add nothing extra.
- **Support contact** (an email address) in Settings and the store listings.

### 0.2 Age question (neutral age screen)
- On first launch, before any account, purchase, ad or public name: "What year were you born?" with no
  hint about which answer unlocks what (a neutral age screen, as the COPPA rule expects).
- **Under 13:** no ads at all, no typed outlaw name (a generated name like "Dusty Rider 4821" instead), no
  analytics beyond what the game needs to work, and real-money purchases hidden. On iOS, Apple's Ask to
  Buy already covers family accounts.
- **13–17:** full game; keep the existing "Under 18? Ask a parent first." line on real-money items.
- Store the answer on the device and the server account only as an age band (under 13 / 13–17 / 18+).
- Set the App Store age rating honestly in the questionnaire (cartoon violence with guns, probably 12+).

### 0.3 Account deletion (Apple requirement)
Apple requires apps that create accounts to let players delete them inside the app. The server
(`server/app.js`) has no delete route yet.
- Add `POST /api/account/delete`: removes the account, its profile, leaderboard entries and analytics
  events, and keeps only what law requires for purchases (transaction ids, for tax and refund handling).
- Add "Delete my account" in Settings with a clear warning that purchased nuggets and items are lost.

### 0.4 Names on leaderboards
Outlaw names are user-generated content shown to everyone. `src/names.js` already notes its blocklist is
"intentionally small".
- Use a maintained profanity list (several languages) on the server, not only in the client.
- Add a "Report name" button on leaderboards; reported names are hidden until reviewed and can be reset
  to a generated one. (App Store guideline 1.2 expects filtering, reporting and blocking for
  user-generated content.)

### 0.5 First-party analytics (so every later phase can be measured)
- `POST /api/events` on your own server, batched, with: account id, age band, platform, app version,
  event name, time. No advertising id, no third-party analytics SDK, so no App Tracking Transparency
  prompt is needed.
- Events: `first_open`, `age_answered`, `run_start`, `run_end` (outlaw, result, seconds, score),
  `outlaw_first_win`, `town_collect`, `building_upgrade`, `shop_open`, `purchase_start`,
  `purchase_done`, `event_entry`, `pass_tier`, `ad_offer_shown`, `ad_watched`, `notification_open`.
- A small script that prints day-1 / day-7 / day-30 return rates and where new players stop.
- Players can switch analytics off in Settings; under-13 accounts send only crash-level events.
- Deleted with the account (0.3). Mention it in the privacy policy (0.1).

### 0.6 Paperwork checks
- **AI-made assets:** confirm each service's plan allows commercial use and keep a record in an
  `ASSETS.md` (what, which service, which plan, date).
  - **ElevenLabs:** the free plan does not allow commercial use and requires credit. The game's audio
    needs to come from a paid plan (Starter or above), or be regenerated on one.
  - **Meshy:** free-plan models are public and come with a credit requirement. Check the plan used for
    the character models.
  - **OpenAI images:** outputs belong to you under OpenAI's terms. Keep the prompts (they are in
    `tools/character-prompts.mjs`).
  - Voices: use only stock voices (as the audio script now does), never a clone of a real person.
- **Name and trademark:** run a trademark search on "Red West" (US and EU) before spending on marketing.
  Never use competitors' names (Kingshot, Whiteout, Red Dead) in the store listing, keywords or ads.
- **Web sales tax:** Stripe sales need sales tax and VAT handled. Turn on Stripe Tax, or switch the web
  store to a "merchant of record" such as Paddle or Xsolla, which handles tax for you. App Store and
  Google Play already handle tax for their sales.
- **Refunds:** MONETIZATION.md notes refunded nuggets are not taken back yet. Handle RevenueCat and
  Stripe refund events: remove the refunded nuggets, never letting the balance go below zero (if some
  were already spent, record the debt rather than removing bought items).

**Built (2026-09-29):** age question (0.2), account deletion (0.3), name reports and a larger blocklist
(0.4), first-party analytics and `tools/retention.mjs` (0.5), [ASSETS.md](ASSETS.md) (0.6), legal links in
Settings once `VITE_PRIVACY_URL` / `VITE_TERMS_URL` / `VITE_SUPPORT_EMAIL` are set, and the generator
answers in [docs/POLICY_GENERATOR_ANSWERS.md](docs/POLICY_GENERATOR_ANSWERS.md). **Still to do:** generate
and publish the policy and terms, trademark search, Stripe Tax, and refund handling (all need your
accounts or the hosted server).

**Phase 0 done when:** policy, terms and support links are live; age question, account deletion, name
reports and analytics are working; asset licences are recorded.
**Size:** medium (about 1–2 weeks). Unblocks everything else.

---

## Phase 1: reasons to come back every day

### 1.1 Frontier Town (borrowed from their city building)

A new **TOWN** screen next to the Wanted Road. Flat illustrated cards to start (no 3D town needed), each a
building with a level:

| Building | What it does | Uses existing code |
|---|---|---|
| **Jail** | Every outlaw you have beaten sits in the jail and pays a bounty each hour you are away. Collect it when you come back. | New; income goes to Bounty Dollars |
| **Sheriff's Office** | Daily jobs board (existing) and the weekly event poster (Phase 2) | `src/jobs.js` |
| **Gunsmith** | The gun shop (existing guns tab) | `src/weapons.js` |
| **Tailor** | The cosmetics shop (existing tabs) | `src/cosmetics.js` |
| **Saloon** | Season pass (Phase 3), locked until then | New |

**Jail income:**
- Rate per hour = sum of the beaten outlaws' bounties ÷ 20 (Dusty Pete 50 → 3 $/h; all eight → 65 $/h).
  (Was ÷ 10 until the balance pass below.)
- It stores at most **8 hours** of income, so checking in once or twice a day gets it all and nobody is
  punished for sleeping. Upgrading the Jail raises the cap (8 → 10 → 12 h) and the rate (+10% per level).
- Server clock only when the server is connected; the local wallet ignores a device clock moved
  backwards and caps a single collect at the storage limit (no clock-change exploits).
- Balance: 8 hours of all-eight income (520 $) is worth roughly two good runs. The town adds a daily
  habit; it does not replace playing.

**Upgrades:**
- Paid in **Bounty Dollars only**, and they finish **instantly**. There are no build timers, so there is
  nothing to sell as a speed-up. This is the main deliberate difference from Kingshot/Whiteout.
- A unit test fails if any building level changes combat stats.

**Data:** add `town: { levels: { jail: 1, sheriff: 1, gunsmith: 1, tailor: 1, saloon: 0 }, jailCollectedAt }`
to the profile (`src/profile.js`, bump `version` and migrate in `normalizeProfile`). Server: `POST
/api/town/collect` and `POST /api/town/upgrade` using the same wallet rules as `/api/buy`.

**Built (2026-09-29):** Jail (5 levels: +10% rate and +1 hour storage each), Sheriff's Office (3 levels:
daily jobs +15% / +30%), Gunsmith and Tailor as shortcuts into the shop, TOWN button with a waiting-money
badge, server routes `/api/town/collect` and `/api/town/upgrade`, and statistics events `town_open`,
`town_collect`, `building_upgrade`. The Saloon comes with the season pass (Phase 3).

**Measure:** share of players who collect on day 2; day-1 and day-7 return before vs after.
**Size:** medium.

### 1.2 Beaten outlaws become playable characters (a roster without random draws)

- Three-starring an outlaw unlocks them as a player character in the shop's CHARACTERS tab (the
  character system in `src/cosmetics.js` already loads models; the eight outlaw models exist).
- Each has **one perk with a trade-off**, a side-grade like the shop guns. Examples:

  | Outlaw | Perk | Trade-off |
  |---|---|---|
  | Dusty Pete | Dash knocks enemies back | Dash cooldown +0.5 s |
  | Rattlesnake Rosa | A wolf companion fights for you | 1 less heart |
  | Deacon Graves | Every 6th shot is a triple shot | Lower fire rate |
  | Iron Jack | Blocks one bullet every 5 s from the front | Moves 15% slower |
  | Silas Vane | Fires 25% faster | Reload pause every 6 shots |
  | El Espectro | Short invisibility after a dash | Less loot drops |

- **Earned only, never sold** (a unit test, like the gun one). Paid skins *for* these characters can come
  later, as cosmetics.
- Leaderboards record which character was used; per-outlaw boards stay comparable because perks are
  side-grades.

**Built (2026-09-29):** all eight outlaws, perks as in the table except Dusty Pete (dashes twice as far,
recharges in 2.8 s instead of a knock-back), Rosa (15% faster instead of a wolf companion), Iron Jack (two
extra hearts, slower, instead of a frontal shield) and Mesa Morgan (40% bigger bullets, 25% less range),
which reuse existing systems. Shop cards show the perk and "EARN ★★★ ON STAGE n" until unlocked.
Leaderboards do not record the character yet.

**Measure:** share of players who reach three stars on outlaw 1 and 2; runs per player after unlocks.
**Size:** medium (perks need balancing in playtests).

### 1.3 Reminder notifications (iOS app)
- `@capacitor/local-notifications`, scheduled on the device (no push server needed).
- Ask permission **after** the player's first jail collect, with a short explanation, never at launch.
- At most one a day: "Your jail is full ($X to collect)" or "New daily jobs are up". Never ads, never
  offers. A Settings switch turns them off.
- (App Store guideline 4.5.4: notifications must not be used for marketing without separate consent.
  This plan sends none.)

**Built (2026-09-29):** `@capacitor/local-notifications`, offered after the first jail collect, at most one
per 20 hours, moved out of 9 pm–9 am, Settings switch, cancelled by *Delete my data*.

**Size:** small.

---

## Phase 2: live events

### 2.1 Weekly "Most Wanted"
- Each week (Monday to Sunday, UTC, matching the existing weekly board) one outlaw is **Most Wanted**,
  with a twist from a fixed list: extra wolves, only rifles, double Heat gain, night (shorter view),
  armoured gang, dynamite rain. The twists reuse outlaw modifiers already in `src/outlaws.js`
  (`FAST_WOLVES`, `SHARPSHOOTERS`, `SWARM`, `HEAVY_HITTERS`).
- The week's event is picked from the date the same way daily jobs are (`src/jobs.js`), so it works
  offline; the server keeps the event leaderboard (`weekly:<week>:event`).
- **Rewards by your own score, not by rank:** three score targets give an event badge, a cosmetic and
  Bounty Dollars. Rank only earns a title shown on the board. Score targets mean everyone can earn the
  prizes, and cheating to climb the rankings wins nothing of value.
- Free to enter as often as you like. Nothing paid affects the score (rule 5). Runs that used an ad
  revive (Phase 3) do not count.
- The Sheriff's Office shows the poster and the time left in the week (a real end date, not a pressure
  timer).

**Built (2026-09-29):** four twists (Wolf Moon, Deadeye Week, Iron Posse, Hot Trail = Heat twice as fast),
the event card and RIDE OUT in Frontier Town, targets 400 / 1,000 / 1,800 for every outlaw, $100 / $200 / $300 plus four
collectibles in order (then +$300), prizes paid on top of the per-run cap, a MOST WANTED board, and event
runs kept off the Wanted Road and the other boards. Rank titles are not built. Targets need playtesting.

**Measure:** share of weekly players who enter; runs per entrant; return rate on event weeks vs others.
**Size:** medium.

---

## Phase 3: fair monetization

All real-money items go through the existing flow: RevenueCat on iOS/Android, Stripe on the web, credited
only by verified server webhooks (MONETIZATION.md).

### 3.1 Starter pack (one time)
- **Deputy's Kit, $1.99:** a cosmetic set (hat, coat, bullet colour) + 200 nuggets. Contents and real
  price shown in full.
- Offered once, calmly, on the result screen **after the player's first outlaw win** (a good moment, not a
  loss), then always available in the shop until bought. No countdown (rule 4).
- Store setup: sell it as a **non-consumable** product so it can be restored, with the nuggets granted
  once by the server on the first verified purchase. Non-consumables need a "Restore purchases" button on
  iOS (Apple requires it).

### 3.2 Season pass ("Wanted Poster Pass")
- **30-day seasons.** Playing earns pass points: finishing a run, daily jobs, event score targets.
  30 tiers, reachable with about 20 minutes of play a day.
- **Free track:** Bounty Dollars, a few cosmetics, some nuggets.
- **Paid track, $4.99:** season-exclusive cosmetics (a themed outfit, bullet colour, a character skin)
  and nuggets. **Cosmetics only** (rule 1).
- **One-time purchase per season, never auto-renewing.** Auto-renewing subscriptions bring cancellation
  and renewal-notice laws (US state laws, the FTC's rules on subscriptions, EU rules) that a one-time pass
  avoids entirely. On iOS this is a *non-renewing subscription* or a consumable credited per season by the
  server.
- Buying mid-season grants every tier already reached. The season's end date is real and shown.
- No paid tier skips in the first seasons (keeps it clearly fair; revisit with data).

### 3.3 Nugget prices tidy-up (rule 3)
- Show the real-money estimate next to every nugget price.
- Reprice nugget items so the packs divide into them without leftovers, or add item bundles priced to
  match the packs exactly. Current items cost 40, 60 and 80 ◆ against packs of 100, 550 and 1,200 ◆.

### 3.4 Optional rewarded ads (last, and only if you want ads)
Ads bring the most legal work, so they come last and are optional.
- Two offers only: **double this run's Bounty Dollars** (on the result screen) and **one revive per run**
  (on death). Both say exactly what you get before the ad. At most 5 ads a day. No banners, no forced
  ads.
- Revived runs never count for leaderboards or the weekly event.
- **Non-personalized ads only**, to start: no App Tracking Transparency prompt needed, far less privacy
  risk.
- **EEA and UK:** a Google-certified consent tool is required for ads there (AdMob/UMP provides one).
- **Under 13:** no ads at all (from the age question).
- Update the App Store privacy label and the ad SDK's privacy manifest.
- Web build: no ads at first.

**Measure (all of Phase 3):** share of players who pay, revenue per daily player, starter-pack
conversion, pass purchase rate and tier completion, and whether day-7 return drops after ads start (if it
does, cut the ads).
**Size:** starter pack and prices: small. Season pass: large. Ads: medium plus the compliance setup.

---

## Phase 4: getting players

### 4.1 A playable ad from the web build
Red West already runs in a browser, which is its biggest marketing advantage: most studios build playable
ads separately.
- A `?demo` mode: one 30–45 second fight with Dusty Pete's gang, ending on the bank-or-ride-on choice and
  an end card with the store buttons.
- Package it as one HTML file within the ad networks' limits (commonly about 5 MB, MRAID-compatible;
  check each network's current spec). It needs lighter assets: no music, compressed model.
- **Only real gameplay** (rule 8).

### 4.2 Short vertical videos
- Screen recordings of real runs (outlaw signature attacks, the ride-on escape, Iron Jack's clang) for
  TikTok, Reels and Shorts, and for the App Store preview video. The same rule: only what the game does.

**Size:** medium.

---

## Phase 3 and 4 status (2026-09-29)

**Built:** the Deputy's Kit starter pack (3.1), nugget prices with real-money estimates and pack-friendly
prices (3.3), the Wanted Poster Pass in the saloon (3.2; paid track never pays Bounty Dollars), the bank,
stable and undertaker, and the playable ad (4.1, `npm run build:demo`). Not built: rewarded ads (3.4, decided
against for now) and the vertical videos (4.2): rough 16:9 gameplay and town clips were recorded in a
headless browser for reference; final clips should be recorded on a phone. Real-money items stay "SOON"
until the server, the policy and the store products exist (MONETIZATION.md).

## Balance pass (2026-09-29)

No playtest notes yet, so a simple bot played real runs in a headless browser (stands and auto-aims,
backs away from close enemies, dashes, banks the bounty). It stands in for a weak new player:

| Stage | Result | Score | Run time | Earned |
|---|---|---|---|---|
| 1 Dusty Pete | won, banked | 550 | 75 s | $202 |
| 3 Deacon Graves | died in pursuit 2 | 170 | 37 s | $42 |
| 5 Iron Jack | died in pursuit 2 | 315 | 49 s | $78 |
| 8 El Espectro | died in pursuit 1 | 310 | 21 s | $77 |

Changes:
- **Event targets** were 500 / 1,200 / 2,200 rising 15% per stage (4,200 at the top for Silas Vane). Later
  outlaws are harder, so the same player scores less against them: targets are now **400 / 1,000 / 1,800
  for every outlaw**. A plain win reaches the first; the top one needs a strong Heat run.
- **Jail income** was a tenth of each bounty per hour ($130/h with all eight, a full jail worth about five
  winning runs). It is now **a twentieth** ($65/h, a full jail worth about two good runs), as planned.
- Unchanged: run earnings (about $200 for a win), upgrade costs ($300 first jail upgrade = about two
  runs), event prizes, perks. Revisit with real playtest numbers: the run log's COPY button gives them.

## Order and dependencies

```
Phase 0 (foundations: legal + analytics)
   └─► Phase 1 (town, playable outlaws, notifications)
          └─► Phase 2 (weekly event)
                 └─► Phase 3 (starter pack → prices → season pass → optional ads)
Phase 4 (playable ad, videos) can start after Phase 1, once the game keeps players.
```

Spend on advertising only after analytics show players coming back (for example day-1 return above
roughly 35% and day-7 above roughly 12%; treat these as rough goals, not industry facts). Paying for
players who do not return wastes the budget.

## Decisions (answered 2026-09-29)

| Question | Decision | What it changes |
|---|---|---|
| Business model | **Free-to-play mobile** (iOS app + web) | The whole plan applies; the $4.99 desktop plan is set aside. |
| Ads | **No ads for now** | 3.4 is not built. Revisit only if analytics show purchases alone cannot sustain the game. No ad SDK means no consent tool, no App Tracking Transparency prompt and a simpler privacy label. |
| Server hosting | **Decide later** | Phase 0 is built so it works on the local wallet; the server parts (analytics, account deletion, name reports) switch on when `VITE_API_BASE` is set. Real-money sales and leaderboards still need the server. |
| Legal review | **Policy generator** (e.g. Termly or iubenda) | Answers for the generator's questionnaire are in [docs/POLICY_GENERATOR_ANSWERS.md](docs/POLICY_GENERATOR_ANSWERS.md). Put the generated URLs in `VITE_PRIVACY_URL` and `VITE_TERMS_URL`. A generator does not replace a lawyer: get a one-off review before spending on marketing or if a complaint arrives. |
| ElevenLabs plan | **Paid** | Commercial use allowed; recorded in [ASSETS.md](ASSETS.md). |
| Meshy plan | **Paid** | Commercial use allowed; recorded in [ASSETS.md](ASSETS.md). |
| First build step | **Phase 0, working offline first** | Age question, analytics, account deletion, name reports and legal links. |

## Sources

- Kingshot revenue: [Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/kingshot),
  [Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/century-games-kingshot-hits-500m-revenue-in-2025)
- Whiteout Survival advertising and monetization:
  [Insightrackr](https://blog.insightrackr.com/en/docs/WhiteoutSurvivalIntelligence),
  [FoxData](https://foxdata.com/en/blogs/how-whiteout-survival-generated-15-billion-through-creative-monetization-strategies/)
- Century Games strategy: [Naavik](https://naavik.co/digest/century-games-4x-portfolio-strategy/)
- The legal points above (FTC v. Epic Games 2022, COPPA, Apple App Review Guidelines 1.2, 3.1.1, 4.5.4 and
  5.1.1, Belgian loot-box position, EU consumer principles on in-game currencies, UK ad rulings, Google's
  consent requirement for EEA/UK ads) are summaries to check with a lawyer, not citations of current text.
