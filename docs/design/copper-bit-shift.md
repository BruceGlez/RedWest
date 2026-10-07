# Copper Bit: the shift as a fast time-management game

Lane: `design` (advisory). Asked by the owner: make the Copper Bit shift feel like Cake Mania, meaning fast, readable, fun time management in two-minute bursts. Nothing here is built until the owner decides. Code read: `src/saloon.js` (rules and settling), `src/saloonShift.js` (the shift), `src/saloonShiftView.js` (the screen), `src/places/saloon.js` (the bar's card), `styles/townSaloon.css`, `tests/saloon*.test.js`, and `PLACES.md` section 8.

"Cake Mania" is named here only to describe the kind of game (a mechanic, not a look). Nothing in the build may use its names, art or characters (`AGENTS.md` rule 6, `ASSETS.md`).

## 0. What I measured

I could not play the shift in a browser from this session, so I played it with a bot instead: `createShift()` driven by a greedy player (serve whatever is ready, otherwise cook the seat with the least patience whose station is free) with a fixed delay between actions. 20 seeds per night, farm open unless said. The script is not committed (design owns docs only); the numbers are reproducible from the constants below.

| Fact | Number | Where |
|---|---|---|
| Shift clock | `SHIFT_SECONDS = 120` | `saloonShift.js` |
| Seats / stations | `SEATS = 4`, stations stove, barrel, oven (one job each) | `saloonShift.js` |
| Cook time (s) | sarsaparilla 1.5, beans 3, cornbread 4, eggs 3.5, pie 5 | `COOK_SECONDS` |
| Crowd per night | `min(10, 2 + night)`: 3 on night 1, 10 from night 8 | `crowd()` in `saloon.js` |
| Arrivals | spread over the first `120 x 0.7 = 84 s` | `createShift` |
| Patience | `max(16, 40 - 2 x night)`: 38 s on night 1, 20 s on night 10 | `patience()` |
| Quick serve | at least `QUICK_SHARE = 0.5` of patience left | |
| Door wait | `SEAT_WAIT = 8 s`, then a miss | |
| Tip rates | `[0, 0.25, 0.5]` of the price; farm open x `1.2` | `TIP_RATES`, `FARM_TIP_BONUS` |
| Stars | served share of the crowd: 1/2 = 1 star, 3/4 = 2, all = 3 | `starsFor()` |
| Paid shifts | `PAID_SHIFTS_PER_DAY = 3`, then free practice | `saloon.js` |

What the bot found (this is the headline):

1. **The game is solved on night 1 and never gets hard.** A bot that takes 4 s between every action (a very slow human) gets 3 stars on all 10 nights with 0 misses. It only starts failing at 7 s per action from night 8, and at 10 s from night 5.
2. **There is no juggling.** Peak seats occupied in 20 shifts: 1 on nights 1 to 8, 2 on night 10 (mean 0.12 on night 1, 0.46 on night 10). Four seats and three stations are scenery; one customer is cooked and served, then the next one walks in. Arrivals are about 28 s apart on night 1 and 8.4 s on night 10 against cook times of 1.5 to 5 s.
3. **The shift is not two minutes.** It ends as soon as the last customer is served, so a good player's shift lasts 60 s (night 1) to 79 s (night 10). `SHIFT_SECONDS` never binds.
4. **Combo pays nothing.** `state.combo` and `bestCombo` are only shown in the header and never reach `summary()` or `shiftPay()`. The only tip tiers are "quick" and "quick with no miss in the whole shift".
5. **Pay today** (bot, per shift, no farm / farm): night 1 $11 / $12, night 5 $32 / $50, night 10 $46 / $73. Three paid shifts on night 10 bank at most $139 / $219 a day. The test caps the best day at $400 (a farm check-in) and under one fifth of a jail day: `OUTLAWS` bounties sum to $2,150, times `JAIL_BOUNTY_SHARE = 1/20`, is $107.5 an hour, so $2,580 a day, so $516.

## 1. What Cake Mania has that this shift lacks

| Cake Mania | Copper Bit today | Gap |
|---|---|---|
| Several customers at once, always one more arriving than you can handle | 1 seated customer at a time in practice (section 0, fact 2) | No pressure, so no time management. The whole genre is missing. |
| Customers arrive in waves | Evenly spaced, with 30 percent jitter | No rush, no breathing room, no rhythm. |
| Order icon on the customer, at a glance | Dish name in text inside a card; a text button "COOK ON THE STOVE" | Reading takes longer than acting. |
| Patience shown by a face or colour that changes in steps | A thin bar; turns red under 50 percent only | The bar reads, the thresholds do not. |
| Stations show progress and ready state | Station boxes only turn brown when busy | No progress, no "ready" signal at the station. |
| Combos pay and are loud | Combo is a line of text and pays nothing | The core reward loop is silent. |
| Every level has a clear goal and star targets shown during play | Stars exist (50, 75, 100 percent served) but are shown only as `***` on the result card | The player never knows what they are playing for. |
| Upgrades you buy between levels, each one felt next shift | Not built (`PLACES.md`: "Not built yet: upgrades, regulars...") | No long arc, nothing to spend dollars on. |
| Customer types (hurried, patient, big tippers) | One kind of customer | No reading of the room. |
| A new thing every few levels | Dishes arrive on nights 1, 2, 3, 5 and nothing else changes | The nights feel the same. |
| Thumb-sized targets, one tap per action | Seat card has one button (min about 28 px tall as styled) and a display-only station row | See section 6. |
| Short, repeatable levels with an instant "one more" | Shift ends early and shows a result card with ANOTHER SHIFT (this part is good) | Keep. |

## 2. The moment-to-moment loop

The loop should be: **read the room (1 s) - tap to cook - tap to serve - tip pops - next**, with 2 to 4 customers always on the go and one station usually the bottleneck.

### P1. Fill the two minutes and raise the pressure
Change the shift so a good player is busy from second 5 to second 110.
- `crowd(night)`: `min(14, 4 + night)`: 5 customers on night 1, 14 on night 10 (today 3 and 10).
- Arrivals over `0.75 x 120 = 90 s` (today 84 s) with a real jitter, plus the rushes of P2.
- `patience(night)`: `max(14, round(30 - 1.7 x night))`: 28 s on night 1, 14 s on night 10 (today 38 and 20).
- The clock always runs to 120 s or until the last customer has been served, whichever comes later. The last customer arrives by 90 s, so a shift lasts about 100 to 120 s.
- The numbers are a starting point. Section 8's bot test (P17) is the real acceptance: a 1.5 s-per-action bot must get 3 stars on nights 1 to 3 and mostly not on nights 8 to 10; a 4 s-per-action bot must stop getting 3 stars from about night 4.

Rules check: changes the shift's difficulty only. No money, no timers sold, no combat. Pay ceiling in P15 keeps the income rule.
**Decision for the owner:** approve the new crowd, arrival span and patience numbers as the starting point. Cost: small (three functions and their tests in `saloon.js` and `saloonShift.js`, plus rewriting the asserts in `tests/saloonShift.test.js` that assume 3 to 10 customers). Lane: town.

### P2. Rushes
Customers arrive in bunches, not evenly. From night 3 the arrival list gets 2 rushes of 3 customers within 2 s of each other, at 35 percent and 70 percent of the arrival span; from night 7 there are 3 rushes. The rest arrive evenly. A rush wants different stations on purpose (at most 2 of 3 on the same station), so the player has to choose an order.
- The deterministic stream (`stream(seed * 7919 + night * 104729)`) stays, so a test can still replay a night.

Rules check: no money, no combat, no randomness spend; the same seed still gives the same shift.
**Decision for the owner:** yes or no to rushes (this is what makes it time management; I recommend yes). Cost: small, about 30 lines in `createShift`. Lane: town.

### P3. Show the door
Customers waiting for a seat (`state.queue`, 8 s `SEAT_WAIT`) are invisible today; they walk out and cost a miss without warning. Show them as a row of small door tokens above the seats, each with the dish icon and an 8 s ring. With 4 seats and rushes this is where the "oh no" moments live.
Rules check: display only.
**Decision for the owner:** yes or no. Cost: small. Lane: town (it owns `saloonShiftView.js`); art supplies the icon (P5).

### P4. One tap per action
Today a seat needs a labelled button ("COOK ON THE STOVE", "SERVE") and the station row does nothing. Proposal:
- The whole seat card is the target. Tapping a seat does the next legal thing: cook if the station is free, serve if the plate is ready. A busy station shows the seat dimmed with the station's own colour and a progress bar, not a disabled button with long text.
- If the player taps a seat whose station is busy, the seat is **queued** on that station (a small "next" badge) and starts the moment the station frees. One queued seat per station at most. (This is the thumb-friendly choice and it keeps taps down to about 2 per customer. It also makes the game a little easier, which P1 and P2 already pay for.)
- Each station shows its cook progress ring and "READY" glow; the plate sits on the seat, as today.

Rules check: no timers sold, no money. Same game rules, a better surface.
**Decision for the owner:** one-tap seats and a one-deep queue per station (recommended), or tap-to-cook with no queue. Cost: medium (state for the queue in `saloonShift.js` plus the view). Lane: town for the rule and view, ui to review tap sizes.

### P5. Order readability
- Each dish gets an icon and a **station colour** (stove warm red, barrel blue, oven amber, same colours on the seat edge and the station box). The player reads colour first, icon second, name never.
- Patience becomes three steps with a notch: green above 66 percent, amber 34 to 66, red under 34, and a marked notch at the **quick line** (`QUICK_SHARE = 0.5`). Today only the `late` red appears under 50 percent.
- Customers get a face (happy, waiting, worried) matching the step. Originals only; no characters from other games.
- Dish names stay as text for accessibility (screen readers) and as the aria label.

Rules check: art and HUD only. Original icons and faces, each with a row in `ASSETS.md`.
**Decision for the owner:** order the icon set (5 dishes now, 3 faces, 3 station glyphs: about 11 small drawings) from the art lane. Cost: medium for art, small for the view. Lane: art for the icons, town for the view.

## 3. Stations and upgrades

`PLACES.md` already says upgrades are "bought with dollars you earned (a better stove, taps, stools). They make a shift smoother, never longer, and never touch combat." Proposed list, each one something the player feels in the next shift:

### P6. The upgrade list
| Upgrade | Effect | Where you feel it | Price |
|---|---|---|---|
| Hotter stove I / II | Stove cook times x0.75 / x0.55 (beans 3 s - 2.25 - 1.65; eggs 3.5 - 2.6 - 1.9) | The stove stops being the bottleneck on night 3 | $30 / $90 |
| Two taps (barrel) | The barrel pours 2 at once | Rush nights: 2 drinks at the same time | $30 |
| Bigger oven I / II | Oven times x0.75 / x0.55 (cornbread 4 - 3 - 2.2; pie 5 - 3.75 - 2.75) | Pie becomes a good dish instead of a trap | $40 / $120 |
| Extra stool | `SEATS` 4 to 5 | Fewer `SEAT_WAIT` walk-outs in rushes | $60 |
| Cushioned stools | Patience +3 s | Mistakes are forgiven; lowers stress, does not raise pay | $70 |

Total $440. At the current best day (about $139 without the farm, $219 with it) that is about two to three days of full paid shifts, so the first purchase comes after one day and the full set after roughly a week of play. All five are rule changes inside `createShift` (cook time table, station capacity, seat count, patience), saved as `profile.town.saloon.upgrades`.

Rules check:
- Dollars are the game's earned currency. Nothing costs real money, nothing is a timer, nothing is chance-based. (Rule 6.)
- Upgrades change the saloon only; they read nothing about combat and change nothing outside Copper Bit, same as the existing test "the saloon changes nothing outside itself". They do not change dish prices, tip rates or the pay ceiling (P15), so the income rule holds by construction.
- The server cannot replay the client's shift, so an upgraded shift is not verified; it is bounded by `shiftPay` (served list clamped to the night's crowd and menu) and by P15's ceiling. This is the same trust level as today.

**Decision for the owner:** approve the five upgrades and the prices, or give me a total budget to fit them to. Open question for the town lane: check that $440 does not clash with building prices elsewhere in the town (not read in this task). Cost: medium (state, a `buy` action in `saloonAction`, normalizing, tests). Lane: town. The server route and both wallets already pass the body straight to `saloonAction` (`src/wallet.js:87`, `server/app.js:450`), so **no scale-lane or shared-file change is needed** for a new `upgrade` action.

### P7. Buy order and where you buy
Recommended first-time order (and the order of the shop's list): Hotter stove I - Extra stool - Bigger oven I - Two taps - Hotter stove II - Cushioned stools - Bigger oven II. The felt reason for each: nights 1 to 3 are stove-heavy (beans), the fourth seat fills from night 3 with rushes, the oven matters when cornbread (night 2) and pie (night 5) enter.
- Buy on the **bar's card** (`src/places/saloon.js`), between shifts, never mid-shift. Each upgrade shows what it changes in numbers ("beans 3.0 s to 2.25 s"), the next price, and the dollars you have. No "limited time", no countdown, no discount that expires.
- Show a little "new" tick on an upgrade you can afford. No bounce, no red dot that never clears.

Rules check: no timer, no scarcity, no dark pattern.
**Decision for the owner:** shop on the bar's card (recommended) or a separate shelf in the 3D saloon. The shelf is nicer but it is the art lane's scene and adds build cost. Cost: small on the card, medium for a shelf. Lane: town for the card, art for any shelf.

## 4. Combos, tips, regulars, stars

### P8. Make the combo pay (without changing the server contract)
Today tier 2 (the 0.5 tip) needs **no miss in the whole shift**: one early walk-out removes the best tip from every later serve, and nothing on screen says so. Proposal: tier 2 is earned by a **combo streak of 3 or more quick serves** at the moment of the serve (client-side rule in `serve()`); tier 1 stays "quick"; a miss or a slow serve resets the streak, as the combo already does. `TIP_RATES = [0, 0.25, 0.5]` and the `{ dish, tip }` summary do not change, so `settleShift` and the server need nothing.
- Recoverable after a mistake, readable at all times, and the big tip appears on every third good serve instead of being all-or-nothing.

Rules check: same tip rates and ceiling; money is earned by skill, not bought; no chance involved.
**Decision for the owner:** keep "no miss in the shift" or switch to "streak of 3 or more". I recommend the streak. Cost: small (one condition in `serve()` plus test updates). Lane: town.

### P9. Say it on the screen
- On every serve, a floating "+$3" at the seat in the tier's colour (plain white, quick gold, streak green).
- A combo meter in the header with the **count and the next payoff** ("STREAK 2, ONE MORE FOR BIG TIPS"), shown from the first serve (today it appears only at x2 or more).
- A **star bar** in the header: served count against three notches at the real thresholds from `starsFor` (for a 9-customer night: 5, 7, 9) so the player sees "one more serve is a second star" while it is happening.
- The result card lists: served of crowd, stars with the next star's requirement ("2 more served for three stars"), best streak, tips, dollars, paid shifts left. It already says paid left; keep that line, it is clear and honest.
- Haptics and sounds on serve, tip and walk-out are for the audio lane to name; I only ask that every cue has a visual twin (no information only by sound).

Rules check: pure feedback. The feedback is for the player's own play; nothing is variable-ratio, nothing nudges a purchase.
**Decision for the owner:** approve the HUD pieces (floating tips, streak meter, star bar, richer result card). Cost: medium. Lane: town owns `saloonShiftView.js` and `styles/townSaloon.css` today; the owner may move those two files to the ui lane in `lanes.json` for this work (ui builds HUD, town keeps the rules). Audio cues: audio lane.

### P10. Customer types and regulars
- **Types** (from night 4; `PLACES.md` already lists "patience that differs by customer" as not built): *Hurried* (patience x0.6, tip x1.5 when quick), *Easygoing* (patience x1.4, no tip premium). A small badge on the card tells which. The tip premium is within the existing tiers: it raises the chance of tier 1 and 2 serves only, never the price.
- **Regulars** (from night 6, `PLACES.md` says regulars have a favourite dish): up to 3 named regulars per night. A regular always wants their favourite dish, has patience x1.2, and a flat +$1 when served quick. Serving a regular quickly adds a visit (0 to 3, saved in `profile.town.saloon.regulars`). At 3 visits Pete says a one-line thing about them (story lane) and they tip +$1 more. Regulars never leave for good: no streak resets, no "come back tomorrow or lose them".
- Names and lines are the story lane's job (original only).

Rules check: no dark pattern: visits never decay, nothing is time-limited, nothing is bought. Regulars' extra tips are inside the P15 ceiling.
**Decision for the owner:** yes or no to customer types; yes or no to regulars. I recommend types now (cheap, makes reading the room real), regulars after upgrades. Cost: types small, regulars medium (state, data, copy). Lane: town for rules, story for names and lines, art for faces.

### P11. Stars
Keep the star rule (1/2, 3/4, all served) and the "a night opens with a star on the one before it" lock. Add two things, both display only: the star bar (P9), and on the bar's card show each night's best stars next to what 3 stars needs ("serve all 9"). The existing free-practice rule stays: a fourth shift still earns stars.
**Decision for the owner:** none beyond P9; listed so the star rule is not changed by accident. Cost: small. Lane: town.

## 5. Night-by-night curve and the first five minutes

### P12. The curve (proposed)
Numbers use P1's formulas. "New" is what the player meets on that night.

| Night | Crowd | Patience | Rushes | New thing |
|---|---|---|---|---|
| 1 | 5 | 28 s | 0 | Guided (P13). Sarsaparilla and beans. |
| 2 | 6 | 27 s | 0 | Cornbread: the oven. Two jobs at once for the first time. |
| 3 | 7 | 25 s | 2 | First rush; egg plate (farm). |
| 4 | 8 | 23 s | 2 | Hurried customers (P10). |
| 5 | 9 | 22 s | 2 | Pumpkin pie (farm): the long cook. |
| 6 | 10 | 20 s | 2 | First regular (P10). |
| 7 | 11 | 18 s | 3 | Three rushes. |
| 8 | 12 | 16 s | 3 | Mixed types in every rush. |
| 9 | 13 | 15 s | 3 | Two regulars at once. |
| 10 | 14 | 14 s | 3 | Saturday night: everyone, every rush. |

Problem to flag: with the farm shut the menu is only sarsaparilla, beans and cornbread (from night 2 on), so the "new dish" beats at nights 3 and 5 do not exist. The other novelties (rushes, types, regulars) still arrive, so the saloon still works on its own, as `PLACES.md` requires.
**Decision for the owner:** approve this curve as the target, and say whether a farm-free dish should join the menu around night 5 (for example a stew on the stove, original name, price within the ceiling) so a player without the farm still gets a new dish. Cost: small for the table, small to medium for a dish. Lane: town for rules and prices; story for the dish name.

### P13. The first five minutes
Today: walk in, read the bar card (night chips, menu chips, paid shifts text, a list of buttons), tap START NIGHT 1. Night 1 has 3 customers, 38 s of patience, and takes 60 s of mostly waiting. A new player has no goal on screen, no idea what a tip is, and ends with `***` on a result card.

Target script (about 5 minutes from walking through the gate):
1. **0:00 to 0:20.** The bar card is short: one sentence from Pete, ONE big START NIGHT 1 button, paid shifts left as a single line. Replays and the menu list sit behind a "more" fold.
2. **0:20 to 1:50.** Night 1 is guided: the first customer pulses once ("TAP TO COOK"), then the plate pulses ("TAP TO SERVE"), then nothing more. The star bar and the first floating tip teach the loop. 5 customers, all sarsaparilla or beans, one rush-free minute and a half. First dollars on the result card.
3. **1:50 to 2:10.** Result card: ANOTHER SHIFT is the large button; DONE is small. The next star is named.
4. **2:10 to 3:50.** Night 2: cornbread appears, so the oven and the stove run at once. This is the first time the player juggles.
5. **3:50 to 5:00.** Night 3: the first rush. The first upgrade (Hotter stove I, $30) is nearly affordable from the first two paid shifts, and the bar card says so once.

The three-paid-shifts-a-day rule is told on the card, not by an interruption.
Rules check: no dark pattern; nothing is hidden about the free-practice rule; no forced replay.
**Decision for the owner:** approve the script and the guided night 1. Cost: medium (guide hints in the view, a smaller bar card). Lane: town for the card and rules; ui for the hint look.

## 6. Phone play

What the view does now (`styles/townSaloon.css`, `saloonShiftView.js`): seats in `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))` with a 120 px minimum height (2 columns on a 360 px phone); each seat has one `shop-action` button at full width; the station row is display only at the bottom; CLOSE UP is a small button (`padding: 4px 12px`) at the top right of the header that ends the shift at once, with no confirmation.

### P14. Layout for one hand
- Portrait: customers in a 2x2 grid in the **lower** 60 percent of the screen (the thumb zone). Stations and the door queue sit above them. The header (time, streak, star bar) is read-only and stays at the top.
- Landscape: seats in one row of 4 (or 5 with the stool), stations beneath.
- Every action is a **single tap** on a target of at least 48x48 px (a whole seat is about 160x120). No drag, no hold, no swipe, no two-finger input, no hover.
- CLOSE UP moves to the top-left, becomes a pause button, and asks "Close up? Served customers still count." before ending the shift. Pause stops the clock and is free (no timer is sold; the server never sees the clock).
- Keep the existing `Math.min(0.25, ...)` per-frame clamp (a sleeping tab never costs a customer) and add `visibilitychange` auto-pause.
- Respect `prefers-reduced-motion` for the glow and floating text; colour is never the only signal (icon and shape too, see P5).
- On desktop, number keys 1 to 5 tap seats.

Rules check: input and layout only.
**Decision for the owner:** approve the portrait layout, the confirm on CLOSE UP and auto-pause. Cost: medium. Lane: town today (it owns the files); ui is the right owner for the layout work if the owner moves `saloonShiftView.js` and `styles/townSaloon.css` (see P9).

## 7. Session length against the income rule

The rule (`PLAN.md`, `PLACES.md`): a place never earns more than the jail's top rate; Copper Bit's three paid shifts a day are tested to stay at or under $400 a day (a farm check-in) and under one fifth of the jail's top day.

Honest flag: `PLACES.md` words the rule as "a place's best **hour** stays below the jail's top rate" (the jail pays $107.5 an hour at the top). Three paid shifts take about 6 minutes, so if you divided a paid day by the minutes played, the saloon is "more than $108 an hour" (today: $219 over about 4 minutes). What the saloon test actually enforces is the **day** (it is a check-in, like the jail). I read the owner's brief ("best day under the jail's top rate") as the intended wording, and I propose we say so in `PLACES.md` (that doc belongs to the town lane).

### P15. A hard ceiling per shift, and keep the three paid shifts
- Add `SHIFT_PAY_CEILING = 130` to `shiftPay()` (clamp the dollars). Three paid shifts make at most $390 a day, under the test's $400, which is about 15 percent of the jail's $2,580 top day. The clamp means the income rule holds whatever the shift does later (more customers, regulars, upgrades): the test cannot be broken by a balance change, only by raising the constant.
- Projected honest pay with P1 (14 customers on night 10): about $63 without the farm and $99 with it for a perfect shift, so the ceiling is almost never reached; it is a guard, not a cap players hit. Day total at most about $297 with the farm.
- Keep `PAID_SHIFTS_PER_DAY = 3`. At 100 to 120 s a shift, a paid day is 5 to 6 minutes of play: a deliberate "once or twice a day" check-in, like the jail and the farm.

Rules check: this is the income rule made structural. No real money, no sold timer.
**Decision for the owner:** approve the $130 ceiling (and reword the rule to "best day"), or choose another number; any value up to $133 keeps three shifts under the existing $400 test. Cost: small. Lane: town (tests in `tests/saloon.test.js`).

### P16. Free practice must be worth doing, and never a hook
After three paid shifts, more shifts earn **no dollars**. They can still earn what already exists (stars) and records: best streak per night, regular visits (P10). Rules for this:
- No daily login streak, no "play tomorrow to keep your regulars", nothing that decays.
- No ad, no purchase, no second currency anywhere near the shift (monetization lane's rules; this lane only checks).
- The bar card keeps saying plainly "N of 3 paid shifts left today", as it does now.

Rules check: this is the "no dark patterns" rule applied. Free practice already exists.
**Decision for the owner:** confirm "practice earns stars, records and regular visits but never dollars". Cost: small (it is mostly already true). Lane: town.

## 8. Build PRs (small, one lane each, data contract first)

Order matters: contract first, then consumers. Each PR keeps `npm test`, `npm run build` and the lane's checks green. Everything marked town touches only town-lane files (`saloon*.js`, `src/places/saloon.js`, `styles/townSaloon.css`, tests); none touches a shared file.

1. **town: the data contract (P6 state, P10 regulars state, P15).** In `src/saloon.js`: `upgrades` and `regulars` in `createSaloon`/`normalizeSaloon`, `SHIFT_PAY_CEILING`, an `upgrade` action in `saloonAction` (check dollars, one level at a time, clamp). Tests in `tests/saloon.test.js` including a "ceiling keeps three paid shifts under $400" case and "upgrades touch nothing outside the saloon". No wallet or server change.
2. **town: the shift rules (P1, P2, P8).** `crowd`, `patience`, arrivals with rushes, streak-based tier 2, shift clock to 120 s. Tests replay seeds. Move `crowd`/`patience` numbers behind named constants so P12's table is data.
3. **town: the balance bot test (P17).** `tests/saloonBalance.test.js`: a bot with 1.5 s and 4 s per action over 20 seeds; assert the targets from P1 (1.5 s: 3 stars on nights 1 to 3 in at least 90 percent of seeds; 4 s: no better than 2 stars on average from night 7), peak seats at least 3 on night 5 and later, and mean shift length at least 95 s. This is what turns "feel" into a check. Tune PR 2's numbers with it.
4. **town: upgrades in the shift (P6).** `createShift({ upgrades })` reads cook-time multipliers, station capacity, seats, patience. Extend the bot test with an upgraded bot.
5. **art: the icon set (P5).** 5 dish icons, 3 station glyphs, 3 customer faces, each with an `ASSETS.md` row (append at the end). Delivered as files; no code.
6. **town: the shift screen, readability and one tap (P3, P4, P5, P9).** Seat card as the button, queue, station progress, step colours with the quick notch, floating tips, streak meter, star bar. `styles/townSaloon.css` only. If the owner has moved the view and stylesheet to the `ui` lane, this PR is ui's instead.
7. **ui (or town): phone layout (P14).** Portrait thumb-zone layout, 48 px targets, CLOSE UP confirm, pause, auto-pause, reduced motion, number keys.
8. **town: the bar's card and the shop (P7, P11, P13).** Shorter card, one START button, a fold for the rest, the upgrade list with numbers, next-star text. Guided night 1 hints.
9. **town: customer types (P10 types).** Hurried and Easygoing, from night 4.
10. **story + town: regulars (P10 regulars).** Story supplies names, favourite dishes and Pete's lines as data in the story lane's file; town adds the rule and the badge; art adds faces.
11. **audio: cues for serve, tip, streak, walk-out.** After PR 6 so cues have events to attach to (names agreed in the PR, not by messaging other sessions).
12. **town: docs.** Update `docs/lanes/town.md` and the town plan doc for this slice, and reword the income line in `PLACES.md` ("best day"). `PLAN.md` is the coordinator's.

### P17. The acceptance test is the bot
Without a number a "Cake Mania feel" cannot be checked. PR 3 puts the bot in the test suite so every later balance change (types, regulars, upgrades, crowds) runs against it. Cost: small. Lane: town.
**Decision for the owner:** approve the bot as the gate for balance changes.

## 9. Fixed-rule check, in one table

| Rule (`AGENTS.md` rule 6) | Result across P1 to P17 |
|---|---|
| Money never buys combat power | Unchanged: dollars buy only saloon upgrades (P6). Nothing here reads or writes combat state. |
| No paid loot boxes, no sold timers | None. Upgrades cost earned dollars, are bought in a list with fixed prices, and nothing expires. Cook times are a game rule, not a waiting timer. |
| No dark patterns | No streaks that decay, no fear-of-missing-out, no discount timers, regulars never leave, free practice earns no dollars. |
| Places and buildings never change combat | Unchanged. The saloon test "changes nothing outside itself" stays and is extended for upgrades. |
| Original art, names and story only | Icons, faces, dish and regular names are new work with `ASSETS.md` rows. Cake Mania is a reference for mechanics only. |

## 10. Decisions summary for the owner

| # | Decision | Recommended |
|---|---|---|
| P1 | More customers, 90 s arrivals, shorter patience | Yes |
| P2 | Rushes | Yes |
| P3 | Show the door queue | Yes |
| P4 | One-tap seats, one-deep queue per station | Yes |
| P5 | Icons, station colours, step bars, faces | Yes (art: about 11 drawings) |
| P6/P7 | Five upgrades, $440 total, bought on the bar's card | Yes, check prices against town |
| P8 | Streak of 3 gives the big tip | Yes |
| P9 | Floating tips, streak meter, star bar, better result card | Yes; consider moving the view and its CSS to ui |
| P10 | Customer types now, regulars later | Types yes, regulars after upgrades |
| P11 | Star bar and next-star hints | Yes |
| P12 | The ten-night curve; a farm-free dish around night 5? | Yes / owner's call |
| P13 | Guided night 1 and a shorter bar card | Yes |
| P14 | Thumb-zone layout, confirm on CLOSE UP, pause | Yes |
| P15 | $130 per-shift ceiling and "best day" wording | Yes |
| P16 | Practice earns stars and records, never dollars | Yes (already true) |
| P17 | The bot as the balance gate | Yes |
