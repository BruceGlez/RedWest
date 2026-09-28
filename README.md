# Red West

Red West is a browser-based Western arena shooter. `main` contains the Stage 1 Heat prototype described in [REFACTOR_PLAN.md](REFACTOR_PLAN.md). The original endless-survival build is commit `a0a68e5` in the history (`git checkout a0a68e5`) if you need it for comparison.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. The home screen shows the next outlaw's WANTED poster: press **PLAY** (or Space) to hunt them. The **Wanted Road** lists eight outlaws, each a harder stage with its own signature threat (wolf packs, sharpshooters, swarms, heavy hitters, then combinations) and a bigger bounty. Every stage after the first also brings a new enemy with its own tactics: Rattlers, Riflemen, Dynamiters, Brutes, Riders, Duelists and Ghosts. The **Bounty Book** collects every enemy you meet (picture, how it fights, a tip, stats, kills) and the outlaws you have faced. Beating an outlaw unlocks the next; each outlaw has three stars to earn: defeat them, collect the bounty at Heat 2+, and ride on and escape. Progress is saved on the device. Use WASD to move, mouse to aim and shoot, Shift to dash, Q to change weapons, and P or Escape to pause. Chain accurate kills to raise Heat: points and enemy pressure both rise, while missed shots and hits taken cool it. Defeat the outlaw in pursuit 3, then bank the Heat-scaled bounty (B) or ride on (C) into a 30-second bonus pursuit: escape to collect the bounty and bonus earnings, or die and lose both.

The source page also works from a plain local HTTP server such as VS Code Live Server, using the Three.js CDN import map. Opening `index.html` as a `file://` URL may be blocked by browser module security; use an HTTP server.

## Phones and tablets

The same build plays on phones. Open the Pages link, hold the phone sideways, and press PLAY. The left thumb moves. On the right, **tap** to quick-fire at the nearest enemy, or **drag** to aim (an aim line shows the shot and snaps onto enemies near it) and push past about a third of the way to fire. Settings has an optional **auto-fire when still** mode for one-thumb play. DASH (with a cooldown ring), SWAP and pause sit on the right; arrows at the screen edge point to off-screen enemies, with a gold arrow for the outlaw. Hits shake the screen, kills pop score numbers, and the phone vibrates (Android browsers and the iOS app). For a full-screen app with its own icon, use **Add to Home Screen** (Safari share menu on iPhone; browser menu or the install prompt on Android). After the first visit it also works offline.

## Store

Runs pay **Bounty Dollars** (score, collected bounties, new stars, daily jobs). Spend them in the **General Store** on cosmetic hats, coats, pants and bullet colours, with a live try-on preview. **Daily Jobs** give three goals a day plus a Gold Nugget bonus. Real-money Gold Nugget packs (App Store / Google Play via RevenueCat, web via Stripe) are built but switched off until the server and store accounts are set up: see [MONETIZATION.md](MONETIZATION.md).

## iPhone / iPad app

A native iOS app (for TestFlight and the App Store) is built from the same code with Capacitor. See [IOS.md](IOS.md) for building it on a Mac and submitting it.

## Playtest build

Every push to `main` is built and published by `.github/workflows/pages.yml` to
https://bruceglez.github.io/RedWest/ (the repository's Pages source must be set to **GitHub Actions**).

Each finished run is recorded in that browser's playtest log: result, pursuit reached, peak Heat, bank or ride-on choice and the Heat at that moment, bounty, score, time, shots, accuracy, kills, damage taken, and its order in the session. Use **COPY** on the start screen or **COPY RUN LOG** on the result screen to copy the rows as tab-separated text for a spreadsheet, and **CLEAR** on the start screen before the next tester.

## Verify

```powershell
npm test
npm run build
npm run test:smoke
npm run test:static
npm run test:mobile
npm run test:enemies
npm run test:store
```

The browser smoke tests look for an installed Chrome or Chromium in the usual location for Windows, macOS, or Linux. Set `CHROME_PATH` to use a different Chromium executable. Player feel, balance, and frame pacing still require hands-on playtesting.
