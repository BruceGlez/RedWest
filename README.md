# Red West

Red West is a browser-based Western arena shooter. `main` contains the Stage 1 Heat prototype described in [REFACTOR_PLAN.md](REFACTOR_PLAN.md). The original endless-survival build is commit `a0a68e5` in the history (`git checkout a0a68e5`) if you need it for comparison.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. The home screen shows the next outlaw's WANTED poster: press **PLAY** (or Space) to hunt them. The **Wanted Road** lists eight outlaws, each a harder stage with its own signature threat (wolf packs, sharpshooters, swarms, heavy hitters, then combinations) and a bigger bounty. Every stage after the first also brings a new enemy with its own tactics: Rattlers, Riflemen, Dynamiters, Brutes, Riders, Duelists and Ghosts. The **Bounty Book** collects every enemy you meet (picture, how it fights, a tip, stats, kills) and the outlaws you have faced. Each outlaw fights with a signature attack, shown on their WANTED poster and announced with a tip when they ride in: Dusty Pete charges, Rattlesnake Rosa howls in wolves, Deacon Graves fires a laser-marked triple shot, the three Calloway brothers come at once, Iron Jack Harlan's iron front deflects bullets (get behind him), Mad Mesa Morgan throws three sticks of dynamite, Silas Vane fans six shots then reloads, and El Espectro vanishes and reappears with a ring of bullets. To practise a boss, open the **Boss Arena** (the BOSS ARENA link at the bottom of the home screen, or https://bruceglez.github.io/RedWest/?arena): pick any outlaw and fight them at once, optionally with CAN'T DIE (hearts refill) and their GANG; nothing there is saved. Beating an outlaw unlocks the next; each outlaw has three stars to earn: defeat them, collect the bounty at Heat 2+, and ride on and escape. Progress is saved on the device. **Records** shows your account's outlaw name (picked once, editable), your best run and stars for each outlaw, and lifetime totals. With the Red West server connected it also has leaderboards that rank accounts: This Week, Wanted Stars and one per outlaw, with your own rank always shown. Use WASD to move, mouse to aim and shoot, Shift to dash, Q to change weapons, and P or Escape to pause. Chain accurate kills to raise Heat: points and enemy pressure both rise, while missed shots and hits taken cool it. Defeat the outlaw in pursuit 3, then choose: **bank it** (safe: take the Heat-scaled bounty and end the run) or **ride on** (risky: survive 30 more seconds for the bounty, extra points and a star; die and lose the bounty and the extra points). The choice screen shows both outcomes in points and stars, and a countdown stays on screen while riding on.

The source page also works from a plain local HTTP server such as VS Code Live Server, using the Three.js CDN import map. Opening `index.html` as a `file://` URL may be blocked by browser module security; use an HTTP server.

## Phones and tablets

The same build plays on phones. Open the Pages link and press PLAY, held upright or sideways (upright pulls the camera back so you still see the arena). The left thumb moves. On the right, **tap** to quick-fire at the nearest enemy, or **drag** to aim (an aim line shows the shot and snaps onto enemies near it) and push past about a third of the way to fire. Settings has an optional **auto-fire when still** mode for one-thumb play. DASH (with a cooldown ring), SWAP and pause sit on the right; arrows at the screen edge point to off-screen enemies, with a gold arrow for the outlaw. Hits shake the screen, kills pop score numbers, and the phone vibrates (Android browsers and the iOS app). For a full-screen app with its own icon, use **Add to Home Screen** (Safari share menu on iPhone; browser menu or the install prompt on Android). After the first visit it also works offline.

## Store

Runs pay **Bounty Dollars** (score, collected bounties, new stars, daily jobs). Spend them in the **General Store** on guns and on cosmetic hats, coats, pants and bullet colours (with a live try-on preview). You carry two guns, a sidearm and a long gun, and SWAP between them; shop guns (Twin Pistols, Repeater Rifle, Sawed-Off, Buffalo Gun) each trade one strength for another and are sold only for earned Bounty Dollars. **Daily Jobs** give three goals a day plus a Gold Nugget bonus. Real-money Gold Nugget packs (App Store / Google Play via RevenueCat, web via Stripe) are built but switched off until the server and store accounts are set up: see [MONETIZATION.md](MONETIZATION.md).

## Frontier Town

The **TOWN** button (next to SHOP) opens the town between runs: a 3D frontier town at dusk (gaslight, chimney smoke, a steam train, townsfolk in flat caps and long coats; built in code in `src/townScene.js`, look chosen from `art/town/dusk-gang-town.jpg`). Drag to look around, pinch or scroll to zoom, and tap a building or its sign to open its card. Buildings grow as they are upgraded, and more windows light up as the town grows; the gunsmith shows the guns you own and the tailor's window fills with mannequins as you collect looks. The railway depot holds the weekly Most Wanted event, the saloon sells the season pass, and the **Bank** raises how much one run can pay out ($600, then $750, then $900). A stable and the undertaker's are scenery. The **Jail** holds every outlaw you have beaten; each pays a tenth of their bounty in Bounty Dollars every hour you are away, stored for up to 8 hours, and the TOWN button shows what is waiting. The **Sheriff's Office** posts the daily jobs, the **Gunsmith** and **Tailor** open the shop. Upgrading the Jail (more per hour, longer storage) or the Sheriff's Office (jobs pay more) costs earned Bounty Dollars only and finishes at once: there are no build timers and nothing to speed up with money, and buildings never change combat (a unit test checks this). With the server connected, the server's clock decides what the Jail has earned. Rules in `src/town.js`, screen in `src/townPanel.js`.

### Jail reminders and playable outlaws

In the iPhone app, the first jail collect offers a **reminder when the jail is full** (local notifications, no server): at most one a day, never between 9 pm and 9 am, only about the jail, and switchable in Settings. Earning **all three stars** on an outlaw unlocks them as a **playable character** in the shop's CHARACTERS tab, each with one perk and one drawback (for example Silas Vane fires 30% faster but reloads after six shots; Iron Jack has two extra hearts but moves slower). They are earned only, never sold (unit tests check that every perk has a drawback and that none can be bought). Perks live in `src/perks.js`.

### Deputy's Kit and the Wanted Poster Pass

Real-money items, all showing "SOON" until the server and stores are connected ([MONETIZATION.md](MONETIZATION.md)), and all hidden for players under 13:

- **Deputy's Kit** ($1.99, once per player, in SHOP → NUGGETS): three looks only it gives plus 200 Gold Nuggets, contents and price listed in full, no countdown. It is mentioned once on the result screen after the first outlaw win. RESTORE PURCHASES (app) gives the looks back on a new device.
- **Wanted Poster Pass** (in the Frontier Town **saloon**): 30-day seasons, 30 tiers earned by playing (finish a run +20, collect a bounty +10, each daily job +30, each Most Wanted target +50). The free track pays Bounty Dollars, nuggets and a season look; the $4.99 pass adds the season's four looks and nuggets. It never pays Bounty Dollars (they buy guns), never renews, and buying late pays every tier already reached. Rules in `src/pass.js`.
- Every nugget price shows roughly what it costs in real money, and nugget items are priced so the packs divide into them.

### Weekly Most Wanted event

Every week (Monday to Sunday, UTC) one outlaw is **Most Wanted** with a twist (Wolf Moon, Deadeye Week, Iron Posse or Hot Trail), shown at the top of Frontier Town. **RIDE OUT** fights them with the twist, even before they are unlocked on the Wanted Road; event runs do not move the road. It is free to enter as often as you like. Prizes come from your own best score reaching three targets (Bounty Dollars, and at the top a collectible hat, bullet colour, coat or pants, in order), never from rank, and have no cash value; the event prizes can never be bought. With the server connected there is also a MOST WANTED leaderboard. Rules in `src/events.js`.

### Playable ad

`npm run build:demo` builds a playable ad into one self-contained file, `dist-demo/red-west-playable.html` (about 4 MB, under the usual 5 MB limit; nothing is loaded from the network). It skips the home screen: a tap starts the fight with Dusty Pete and his gang, and when the outlaw falls, the player dies, or after 45 seconds an end card offers the full game. Its button opens the store through the ad network's MRAID `open()` when present (set the store address with `VITE_STORE_URL`). It shows only real gameplay. `npm run test:demo` checks all of this. Code in `src/demo.js` and `tools/inline-demo.mjs`.

## Privacy and players under 13

On first launch the game asks a neutral question, "What year were you born?", and offers optional gameplay statistics (unticked by default). Only the age band is kept (under 13, 13–17, 18+), never the year. Players under 13 get no statistics, a generated outlaw name instead of a typed one, and no real-money packs. **Settings** has the statistics switch, links to the privacy policy, terms and support (set `VITE_PRIVACY_URL`, `VITE_TERMS_URL`, `VITE_SUPPORT_EMAIL`), and **Delete my data**, which removes everything on the device and, with the server connected, the account (keeping only purchase transaction ids). Leaderboard names can be reported; a name reported by three accounts is hidden until reviewed. Statistics are first-party only (no third-party SDK or advertising id), stored as days played and event counts; `node tools/retention.mjs` prints return rates. See [GROWTH_PLAN.md](GROWTH_PLAN.md) (Phase 0), [docs/POLICY_GENERATOR_ANSWERS.md](docs/POLICY_GENERATOR_ANSWERS.md) and [ASSETS.md](ASSETS.md).

## Characters

The player (**Marshal Flint Reed**) and all eight outlaws are animated 3D characters: front-view pictures made with the OpenAI Images API (`tools/character-picture.mjs`, prompts in `tools/character-prompts.mjs`, pictures in `art/characters/`), turned into rigged, animated models through the Meshy API (`tools/meshy.mjs`) and saved in `public/models/`. The game loads the selected outlaw's model (about 1 MB) and draws their WANTED poster from it. The original box-built cowboy is still available as **The Drifter** in the shop's CHARACTERS tab, and is the one the hat, coat and pants colours apply to. To add another character:

- **With the Meshy API** (needs `MESHY_API_KEY` in the environment and network access to `api.meshy.ai`): `node tools/meshy.mjs front-view.png dusty-pete` runs image to 3D, auto-rig and the four animations (Idle, Running, Run and Shoot, Dead), then shrinks the result into `public/models/dusty-pete.glb`. It needs the model tools once: `npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp`.
- **From the Meshy website**: export a rigged GLB (Mixamo skeleton, those animations, single file) and shrink it with `node tools/optimize-model.mjs input.glb public/models/name.glb`.

Then add it as a player character in `CHARACTERS` (`src/cosmetics.js`), or give an outlaw `model: 'models/name.glb'` in `src/outlaws.js`: that outlaw then fights as the animated model (same attacks) and gets a WANTED poster drawn from it. Until then the box-built figure is used.

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
npm run test:bosses
npm run test:characters
npm run test:event
npm run test:demo
```

The browser smoke tests look for an installed Chrome or Chromium in the usual location for Windows, macOS, or Linux. Set `CHROME_PATH` to use a different Chromium executable. Player feel, balance, and frame pacing still require hands-on playtesting.
