# Copper Bit: walk the kitchen

Lane: `design` (advisory). Asked by the owner on 2026-10-08, relayed by the coordinator: make the Copper Bit shift a game where **the marshal walks around the kitchen** (shelf and crates, stove, barrel, oven, counter), picks things up, carries them to customers, and **customers walk in, find a seat and wait**, as in Cake Mania. Today the shift is a flat screen (`src/saloonShiftView.js`: seats, buttons, no walking). Nothing here is built until the owner decides.

This spec builds on `docs/design/copper-bit-shift.md` (approved 2026-10-07, now largely built: crowds, rushes, streak tips, the shelf's upgrades and the balance gate are on `main` as of PR #109). Numbers quoted below come from the code on `main` at `5ea80dc`.

## Owner decisions (2026-10-08)

Recorded by the coordinator from the owner's answers. Nothing is built yet; the build is handed to another coding tool (see `docs/design/HANDOFF.md`).

- **K1, replace or option: REPLACE.** The walking kitchen replaces the flat shift screen. Build the floor first and remove the flat screen only once the floor plays (do not delete the flat shift before its replacement works). This supersedes the "option first, default later" recommendation below; the QUICK SHIFT fallback is dropped. Open risk to handle in the build, not decided: players who cannot steer a character (reduced motion, motor access) and low-end phones; the floor's tap-to-walk and a low-end switch (PR 10) are where this is covered.
- **K8, patience: YES.** Start with +6 s patience and base speed 5.5, tuned by the balance bot (K12).
- **K7 / the shelf: not decided.** The owner asked what "the shelf" means. Two different things were called that: the **upgrade shelf** (the in-world spot where the player buys upgrades; today a plain wall spot at the saloon's front, `SHELF` in `src/saloonLayout.js`) and the **ingredient crates** (K7). Until the owner says otherwise, apply the recommendations: the upgrade shelf lives **inside the kitchen interior** (K9), and the crates are decorative first, farm goods in phase 2 (K7).
- **All other proposals (K2 to K6, K9 to K12):** not individually answered; build the recommended version, which the owner's "replace" and "sure" answers are consistent with.
- **Superseded by this decision:** the flat-screen UI work from `copper-bit-shift.md` (P3 to P5, P9, P14 as flat-screen HUD and phone layout, and the "view passes `profile.town.saloon.upgrades` and draws `shift.seatCount` seats" task) is **not** to be built on the flat screen. The same ideas (readable orders, floating tips, a streak meter, a star bar, a one-hand layout) are built on the floor HUD (build PR 9) instead. The rules already on `main` (crowds, rushes, streak tips, stew, upgrades, the $130 ceiling, the balance bot) carry over.

## 0. The short answer

- **Do it, but as the same game seen from the floor, not a second game.** The rules that matter (the night's crowd, menu, rushes, patience, tips, stars, the $130 shift ceiling, three paid shifts a day) carry over unchanged, and the summary sent to the server stays `{ action: 'shift', night, served: [{ dish, tip }] }`. So **no server, wallet or settling change**: `settleShift` cannot tell the two modes apart.
- **What changes is the middle:** a cook or serve is no longer an instant tap; it needs the marshal *there*. Distance becomes the new resource, next to the stations' cook time and the customers' patience.
- **Replace or option?** Ship it as an **option first** ("WALK THE FLOOR" beside "QUICK SHIFT", the flat screen), make it the **default** once playtested, and **retire the flat screen later** unless the owner wants it kept as the low-end and accessibility fallback (K1). My prototype shows the walking version is a real game (sections 4 and 7), but it is a new 3D interior with the most build cost and risk of anything in the spec (section 9).
- **Walking is input, not a chore.** On a phone, tapping a station or a customer sends the marshal there and the action happens on arrival (K4). A stick and keys also work. Nobody has to steer through a kitchen with a thumb while the clock runs.

## 1. What the genre does (research, short)

I used web search (the page fetches for the paper and Wikipedia were blocked from this environment, so I rely on the search summaries, and say below where a point could not be confirmed).

- **Cake Mania is click-to-direct.** In the original, you do not steer Jill: you touch the oven or station and she goes and does it, then you move the cake to frosting, then to decoration, then deliver and collect payment. One source argues it is "more so a game about task and time management than about baking" ([Wikipedia: Cake Mania](https://en.wikipedia.org/wiki/Cake_Mania); [Gamezebo walkthrough](https://www.gamezebo.com/walkthroughs/cake-mania-3-tips-walkthrough/)). The touch version's controls were called "surprisingly well but also equally frustrating" ([TechCrunch review, iPhone](https://techcrunch.com/2009/04/03/review-cake-mania-3-for-the-iphoneipod-touch)).
- **Customers have heart patience.** Hearts disappear as they wait; at zero they leave. They differ in patience and quirks; items such as cupcakes or a television slow the drain; in Cake Mania 3 the faster you serve, the bigger the tip ([Wikipedia](https://en.wikipedia.org/wiki/Cake_Mania); [WorthPlaying, Cake Mania 3](https://worthplaying.com/article/2009/12/26/reviews/71205-nds-review-cake-mania-3/)).
- **Upgrades are the long arc and walking is one of them.** Between levels you spend earned money. In Cake Mania 3 you can buy a **second oven** (bake two at a time), upgrade ovens to bake faster, and **upgrade Jill's shoes so she "zips around the kitchen faster"**; the game lists 50 upgrades across ovens, shoes, frosters, display stands, TVs and toppers ([WorthPlaying](https://worthplaying.com/article/2009/12/26/reviews/71205-nds-review-cake-mania-3/); [Pocket Gamer](https://www.pocketgamer.com/cake-mania-celebrity-chef-mobile/review/)). Speed and capacity as upgrades is exactly the genre's answer to "walking is the cost".
- **Goals are explicit.** Original: a monthly sales target over 48 levels; Cake Mania 3: a daily dollar goal; too many lost customers ends the level ([Wikipedia](https://en.wikipedia.org/wiki/Cake_Mania)).
- **Diner Dash is the walking benchmark.** Flo seats guests, takes orders, delivers, takes payment and clears tables; speed raises tips; **combos and multipliers** are the scoring heart; the player is expected to run two or three tables at once and plan trips so one walk covers several tasks ([Pocket Gamer review, Diner Dash 2](https://www.pocketgamer.com/diner-dash-2/review/); [Wikipedia: Diner Dash 5](https://en.wikipedia.org/wiki/Diner_Dash_5:_Boom!)). On the DS the owner "can only carry two things at once" and less satisfied customers tip less, which creates a choice between a smaller tip and a combo ([Nintendo Life](https://www.nintendolife.com/reviews/2010/03/diner_dash)). I could **not** confirm a one-item rule for the PC original, so I do not rely on it.
- **A framing for the whole family.** Treanor and Nelson (FDG 2019) group Diner Dash, Tapper, BurgerTime and Overcooked as **order-fulfillment games** with a shared core loop, theme and player experience ([paper abstract](https://www.kmjn.org/publications/OrderFulfillment_FDG19-abstract.html)).
- **Layout is the difficulty dial.** Analyses of Overcooked say the kitchen's layout (a long island, narrow paths, a counter that splits stations) creates both the fun and the frustration: long walks and blocked paths break the rhythm, and time-based scoring makes slow traversal expensive ([Game Maker's Toolkit transcript](https://amara.org/subtitles/1kyGmzeQjsv6/en/3/download/How%20Overcookeds%20Kitchens%20Force%20You%20to%20Communicate%20%20Game%20Makers%20Toolkit.en.srt); [UX Collective](https://uxdesign.cc/the-ux-of-overcooked-from-umami-to-unexpected-design-principles-56e9ea146f7e)). The sources did not discuss carry limits or movement speed as variables, so those two I treat as my own design, tested by the prototype in section 7.
- **What frustrates:** attention that is needed everywhere at once; "levels get way too difficult way too soon" (a Cooking Dash review); rushing causing mistakes that cost more time ([Pocket Gamer on Cooking Dash](https://www.pocketgamer.com/articles/077916/cooking-dash-might-have-gone-free-to-play-but-its-still-as-good-as-it-ever-was/)). Difficulty in this genre is throughput, not enemies; a good curve ramps simultaneous tasks gradually, with easier days after hard ones.

**What I take from it:** (1) let the player *direct* the character by pointing, and keep the character fast enough that walking is a decision and not a wait; (2) make speed, carrying and a second burner the upgrades; (3) keep one walk able to do two jobs (drop one plate, pick up another); (4) no punishing mistakes (no wrong-plate penalty, no burning, no blocking customers); (5) the curve starts with one customer at a time.

## 2. What carries over and what gets replaced

| Piece | Today (`main`) | In the walking version |
|---|---|---|
| Night rules: `crowd(night)` 5 to 14, `menu`, `starsFor`, nights and the star lock | `src/saloon.js` | **Carries over unchanged.** |
| Pay: `shiftPay`, `TIP_RATES [0, .25, .5]`, `FARM_TIP_BONUS 1.2`, `SHIFT_PAY_CEILING 130`, `PAID_SHIFTS_PER_DAY 3`, `settleShift` | `src/saloon.js` | **Unchanged.** The same `{ night, served: [{ dish, tip }] }` goes up. |
| Upgrades: `UPGRADES` (stove, stool, oven, taps, cushions), `cookSeconds`, `COOK_FACTOR`, `seatCount`, `barrelPours`, `EXTRA_PATIENCE 3` | `src/saloon.js`, `src/saloonShift.js` | **Carry over** and are *reinterpreted*; three new ones are added (K9). |
| Arrivals, dishes, rushes: `ARRIVAL_SHARE 0.8` (96 s), `RUSHES`, `RUSH_SIZE 3`, the seeded stream | inside `createShift` | **Reused.** They are not exported today; build PR 2 pulls them into one function with identical output. Customers now *walk in* at the arrival time instead of appearing in a seat. |
| Patience: `patience(night)` 28 s down to 14 s, `QUICK_SHARE 0.5`, `STREAK_FOR_BIG_TIP 3`, `SEAT_WAIT 8` | `src/saloonShift.js` | **Carry over**, plus a kitchen allowance (K8). |
| The shift's brain: `cook(seat)` and `serve(seat)` happen on a tap, stations are boxes, a seat is an index | `createShift` | **Replaced** by a floor simulation (`src/saloonFloor.js`, new): the marshal has a position, speed and hands; stations and seats have positions; actions happen on arrival. `createShift` stays untouched for the flat screen. |
| The screen | `src/saloonShiftView.js` and `styles/townSaloon.css` (ui lane) | **Stays for QUICK SHIFT;** the floor gets its own HUD module. |
| The scene | `src/placeSaloon.js` (art): the **street** outside, with the saloon as a box; ENTER at the bar opens a card | **A new interior scene** (the kitchen and dining room) is added. The street scene is not touched. |
| Layout | `src/saloonLayout.js` (town): street spots | **A new layout file** for the interior (K2). |
| Place wiring | `src/places/saloon.js` (town): the bar card starts the flat shift | The bar card offers WALK THE FLOOR / QUICK SHIFT, and the interior is entered through the bar's door. |
| Walking | `src/townWalk.js`: `WALK_SPEED 7.5`, `PLAYER_RADIUS 0.6`, `DOOR_REACH 2.8`, an on-screen stick, WASD, collision against boxes | **Reused** for stick and keys. Tap-to-walk is new (K3). |

## 3. The room

### K1. Replace or option? (decision)
- **Proposal:** ship WALK THE FLOOR as an *option* beside QUICK SHIFT; after the owner has played it, make it the default; retire QUICK SHIFT later unless wanted as a fallback.
- **Why not replace at once:** it is a new 3D interior plus new controls, so it carries the most risk of the work in these two specs. Low-end phones may struggle with a 3D room under the draw-call budget (`AGENTS.md`: a place under about 130), some players cannot or will not steer a character (motor access, reduced-motion settings), and a flat screen is the cheapest thing to keep alive. Keeping it costs only its view and its tests, which exist.
- **Fairness between the two modes:** one pay formula, one 3-paid-shifts counter, stars take the best of either. For that not to push everyone to the easier mode, the floor is tuned so an *average-skill* player earns within about 15 percent of the flat screen (the balance test enforces it, K12).
- **Rules check:** no change to money, timers or combat; the same settling.
**Decision for the owner:** option now and default later (recommended), or replace the flat screen in the same release (cheaper long term, riskier now). Cost: option is small on top of the build; replacement is smaller still. Lane: town (bar card), ui (fallback toggle).

### K2. Layout: a kitchen behind a bar, a dining room in front
One room, camera from the front like the town's (`YAW 0.52`), about 24 x 19 units. A long **bar counter** crosses the room at `z = -1` with one **flap** (a gap you walk through) at the middle. Behind it is the kitchen, in front is the dining room.

Units are the same as the town's: the marshal is 3.4 tall, `PLAYER_RADIUS 0.6`, a street about 9 wide. Positions are proposals; the town lane finalises them in `src/saloonKitchenLayout.js`.

| Spot | Where (x, z) | What it is | Path from the flap |
|---|---|---|---|
| STOVE | (-7, -7) | beans, egg plate, stew | 8.9 |
| BARREL | (-2.5, -6.5) | sarsaparilla; the nearest station on purpose, because it is the cheapest, most frequent dish | 5.6 |
| OVEN | (6.5, -7) | cornbread, pumpkin pie | 8.5 |
| CRATES | (10, -5) | the ingredient shelf (K7) | 10.6 |
| FLAP | (0, -1.5) | the one way through the bar | 0 |
| SEATS 1 to 4 | (-6, 3), (-2, 3), (2, 3), (6, 3) | the four seats of `SEATS` | 7.5, 5.1, 5.1, 7.5 |
| SEAT 5 (EXTRA STOOL) | (10, 3) | the fifth, from the stool upgrade | 10.7 |
| DOOR | (0, 9) | where customers come in; the marshal never needs to go there | 10.5 |
| SHELF | by the door, (-9, 7) | the upgrade shelf of `copper-bit-shift.md` P7 (see K9) | |

Walk lengths that matter (units, via the flap): stove to seat 1 is 16.4, to seat 4 is 13.8; barrel to the nearest seats 10.5; oven to seat 4 is 13.4. A stove to seat 1 trip is therefore 3.0 s at the base speed of 5.5 and 2.2 s at the town's 7.5. Stove to barrel is 4.5, barrel to oven 9.0, stove to oven 13.5.

Why this shape: one chokepoint (the flap) makes every kitchen-to-seat trip about 11 to 17 units and makes "do two jobs on one walk" the core skill; the barrel being near makes the cheap dish a quick filler; the stove and oven being far apart is what makes cooking order matter. Customers never block the marshal (K6), so the flap is never a traffic jam.
**Decision for the owner:** approve this layout as the starting point (the exact numbers are tuned by the bot, K12). Cost: small for the data file, medium for the scene. Lane: town for the layout file; art for the scene.

## 4. How it plays

### K3. Movement: tap a target, or use the stick
- **Speed:** `SHIFT_WALK_SPEED = 5.5` units a second at the start (the town's `WALK_SPEED` is 7.5 and is too fast for a kitchen of this size; at 7.5 the walking barely costs anything). Boots raise it (K9): 6.5, then 7.5.
- **On a phone, the main control is tap-to-walk:** tap a station, a customer or a seat and the marshal walks there along the shortest route through the flap and acts on arrival (K4). It is the Cake Mania control. Tapping again redirects at once. This needs no steering and works with one thumb.
- **A virtual stick and WASD/arrows also work** (the existing shared stick in `src/townWalk.js`), for players who prefer free movement and for desktop. Free movement and tap-to-walk feed the same rule, "within reach of a spot" (reach 2.0 units, a little less than the town's `DOOR_REACH 2.8` so spots 4 units apart do not both trigger).
- **The rules never depend on the physics.** The floor rules use a small **navigation graph** of named spots with fixed distances (the table above). The 3D view animates the marshal along the path at the speed the rules say. A bot can play the same graph headlessly (K12), and the walking feel can change without touching balance.

Rules check: input only.
**Decision for the owner:** tap-to-walk as the primary phone control with the stick optional (recommended), or stick only (closer to the town, much worse for one-handed play). Cost: medium (path through the flap, input, tests). Lane: ui for the controls; town for the graph and the reach rule.

### K4. Acting by arriving
The marshal never presses "cook" or "serve". Arriving does it:
- **At a station:** (1) pick up every finished plate waiting there that fits in your hands (K5); (2) start the order of the most impatient waiting customer who wants something from that station, if the station has room. One arrival can do both, which is the "two jobs on one walk" skill.
- **At a seat:** hand over the plate for that customer, if you carry it. Plates are tied to the customer they were cooked for (their colour is on the plate and on the ticket), so there is no wrong delivery and no penalty.
- **Plates never spoil and never burn.** A finished plate waits, glowing, at its station until fetched (the project's rule that waiting never costs you something sold; also the least frustrating choice).
- **Orders:** when a customer sits, a short "deciding" beat (1 s), then a **ticket** with the dish icon and the customer's colour appears on the order rail at the flap and a bubble over the customer. Tickets are in order of patience, most urgent first, so the player reads one place.
- **The one-deep queue** of the flat spec's P4 is replaced by this: a station takes the next order only when free, and the marshal chooses where to walk next.

Rules check: no timers sold; nothing hidden; no luck.
**Decision for the owner:** acting by arrival with plates tied to customers (recommended), or an explicit action button at each spot (more taps, and a worse phone game). Cost: medium. Lane: town for the rules; ui for the ticket rail and prompts.

### K5. Carrying
- **Hands hold one plate** to start. A **tray** upgrade lets you carry **two**, then **three** (K9). The carried plates are drawn on the marshal's tray so the player sees what they have.
- If hands are full at a station, the plate stays there; the ticket rail marks it "ready". There is no dropping and no throwing away.
- Why one: with hands = 1, a trip is one plate, so *where you stand when you finish* and *which jobs you chain* become the whole game on night 1; with a tray of 2 or 3, rushes (three customers at once) become manageable and walking efficiency improves. The prototype (section 7) shows the tray moving night 10 from about 0.9 to 2.1 stars together with boots and the fifth stool.
**Decision for the owner:** start at one plate and make the tray an upgrade (recommended). Cost: small. Lane: town.

### K6. Customers walk in, sit, order, leave
- **Arrive:** at the time the shift already gives them (`createShift`'s stream), a customer appears at the DOOR and walks in at 3.5 units a second to the **nearest free seat**, about 2 to 3 s (door to seats: 8.5, 6.3, 6.3, 8.5; the fifth 11.7). They choose their seat; the player does **not** seat them (that is a Diner Dash task I leave out: it adds a trip without adding a decision here).
- **Patience** starts when they sit (as now). The walk-in is free time for the player.
- **No free seat:** they wait at the door and leave after `SEAT_WAIT = 8 s` (a miss), shown as a small line at the door, the P3 queue of the flat spec.
- **Order:** 1 s after sitting a bubble with the dish icon shows and the ticket goes on the rail. Customer types (hurried, easygoing) and regulars from the flat spec's P10 carry over as they were.
- **Served:** a coin pop and tip text, then the customer stands and walks out (cosmetic, 1.2 s; the seat is free at once in the rules).
- **Walks out unserved:** patience hits zero, they stand with a frown and leave: a miss and the streak ends, as now.
- **Customers never block the marshal** (they are not collision objects). The kitchen should never be a traffic puzzle.
**Decision for the owner:** customers pick their own seat, nearest first, and the player does not seat them (recommended), or add a seat-guests task. Cost: small. Lane: town for the rules; art for the walk, sit and leave animations.

### K7. The ingredient shelf and crates (decision with a recommendation)
The owner asked for an ingredient shelf and crates. Options:
- **A. Decorative only.** Pete cooks from his stock; crates are scenery. Simplest; the loop is station then seat.
- **B. A fetch step for every dish.** Walk to the crates, pick an ingredient, take it to the station, wait, carry the plate. It roughly triples walking per customer and loads the thumb; I do **not** recommend it.
- **C. Farm goods only (recommended, as a second phase).** With the farm open the egg plate and the pumpkin pie need a **farm crate** pickup first (a crate from the farm's goods); without the farm they never appear, so the saloon still works on its own. It gives the farm a real role (bigger tips *and* an extra trip), fits "the farm is a bonus and never a need", and keeps B's frustration away from the basic dishes. Hands count: the crate is one of your carried items.
Build order: ship A with the core, add C after the core plays well.
**Decision for the owner:** A first, then C (recommended); or B. Cost: A none, C medium (state, art, bot cases). Lane: town for the rule; art for the crates.

## 5. Rules, numbers and upgrades

### K8. What changes in the rules
New constants (all in the new `src/saloonFloor.js`, none in `saloon.js`, so the server never sees them):
- `SHIFT_WALK_SPEED = 5.5` units a second; `REACH = 2.0`; customer walk `3.5`.
- `KITCHEN_PATIENCE_BONUS = 6` seconds added to `patience(night)` for the floor. Reason: the flat screen's 14 s on night 10 (7 s for a quick serve) cannot be met when one round trip is 5 to 7 s. With the bonus a night-10 customer has 20 s. The prototype needs it: without the bonus nights 8 to 10 are close to unplayable (0.1 to 0.5 stars for the bot).
- Everything else comes from `saloon.js` and `saloonShift.js` as it is: `crowd`, the arrival stream with its rushes, `COOK_SECONDS`, `QUICK_SHARE`, `STREAK_FOR_BIG_TIP`, `SEAT_WAIT`.
- **The summary and the pay are unchanged,** so `shiftPay`, `SHIFT_PAY_CEILING = 130` and `PAID_SHIFTS_PER_DAY = 3` hold by construction; a floor shift cannot pay more than a flat one, only less.

**Decision for the owner:** approve the patience allowance and the base speed as starting values (the bot retunes them, K12). Cost: small. Lane: town.

### K9. Upgrades, reinterpreted
All five already built upgrades keep their effect and their prices; the shelf of P7 is unchanged. Three are added, in the genre's own vocabulary (boots, a bigger tray, a second burner).

| Upgrade | Floor effect | Price | Notes |
|---|---|---|---|
| HOTTER STOVE I/II (built) | cook time x0.75 / x0.55 | $30 / $90 | unchanged |
| BIGGER OVEN I/II (built) | cook time x0.75 / x0.55 | $40 / $120 | unchanged |
| TWO TAPS (built) | the barrel pours two at once | $30 | unchanged |
| EXTRA STOOL (built) | a fifth seat at (10, 3) | $60 | unchanged; the sim treats it as the fifth seat |
| CUSHIONED STOOLS (built) | +3 s patience | $70 | unchanged |
| **FASTER BOOTS I/II (new)** | speed 5.5 to 6.5 to 7.5 | $40 / $100 | the "shoes" upgrade of the genre |
| **BIGGER TRAY I/II (new)** | hands 1 to 2 to 3 | $50 / $130 | the carrying upgrade |
| **SECOND BURNER (new)** | the stove takes two jobs | $80 | the genre's "second oven"; it is also what makes a stove-heavy rush playable |

Total with the new ones: $440 + $400 = $840. Floor shifts pay less than flat ones in the prototype (about $36 to $59 at night 10; the flat bot earned $46 to $73 at night 10 in the earlier run on the old 10-customer crowd, and I estimate up to about $99 for a perfect 14-customer flat shift), so the shelf takes longer to fill. This is for the owner's pace decision, not a rule problem.
Buying and the shelf do not change: bought only with earned Bounty Dollars at the shelf, never mid-shift, nothing sold for real money.
Rules check: no timer is sold, the upgrades change the saloon only, and nothing buys combat power or touches anything outside the place; none changes a price, a tip rate or the $130 ceiling.
**Decision for the owner:** approve the three new upgrades and prices, and say whether the shelf now stands in the *interior* by the door (my recommendation; the street scene only has the bar door) or stays in the street. Cost: small to add to `UPGRADES` (town, `saloon.js` and its tests) plus art for the new pieces. Lane: town for the rule; art for the shelf pieces.

### K10. Difficulty curve for the floor
The flat spec's night table (crowd 5 to 14, rushes from night 3, types from night 4, pie on 5, regulars from 6, three rushes from 7) stays. What walking adds: **night 1 is one customer at a time** (the prototype's peak seats on night 1 is 1), so a new player learns to walk, start, fetch and serve without juggling; night 3 brings the first rush and the first three customers at once; from night 5 four seats are busy together. That is the gradual ramp the genre's reviews ask for.
Easier days after hard ones: nights 9 and 10 are the same crowd family as 8, and the tray and boots make a replay of night 8 easy, which gives the player their mastery moment.
**Decision for the owner:** keep the night table and rely on the walking itself for the new difficulty (recommended). Cost: none. Lane: town.

### K11. Phone play
- **Portrait,** the room seen from the front. The bar counter is mid-screen: kitchen on top, dining below. **Tapping a station, a seat or a ticket** sends the marshal; the rest of the screen is the world, so the thumb always has something to tap.
- **Tap targets at least 48 px:** the stations, the seats and the tickets on the order rail get invisible padded hit areas around the 3D objects (the tap picks the nearest, not the exact pixel).
- **Patience over each customer's head,** a three-step heart or bar (green, amber, red) plus the quick line, the same language as the flat screen. Dish icons on the bubbles. The carried plates show on the marshal and as small icons in a strip at the screen bottom (so the thumb sees what is in the hands).
- **One-handed:** everything is a tap, no drag, no hold. The stick is optional and sits at the bottom corner (already shared with the town).
- **Pause and CLOSE UP** as in the flat spec's P14 (top-left, with a confirm).
- **Camera:** fixed, not player-controlled, high enough that no counter hides a station. The art lane keeps the camera and the walls from covering any spot (a risk, section 9).
- **Reduced motion and QUICK SHIFT** for players who cannot use the floor.
**Decision for the owner:** portrait with tap-to-walk, fixed camera, padded hit areas (recommended). Cost: medium. Lane: ui.

## 6. Income and session length

- **Unchanged and safe by construction:** the floor reports the same summary, so the shift pays by `shiftPay` and is clamped by `SHIFT_PAY_CEILING = 130`, three paid shifts a day at most $390 (the existing test's $400 limit and well under one fifth of the jail's $2,580 top day). A floor shift can pay *less* than the flat one (the prototype), never more.
- **Session length:** the prototype's floor shifts last 105 to 120 s (the flat shifts were designed for about 100 to 120 s by `ARRIVAL_SHARE 0.8`), so a paid day is about 5 to 6 minutes, and a whole day with replays is easily more. Walking adds no waiting at the end: a shift still ends when the last customer is served or gone.
- **The `PLACES.md` wording** ("best hour") still needs the "best day" reword that the previous spec asked for (town's doc).
**Decision for the owner:** none new; the earlier decisions hold. Cost: none. Lane: town.

## 7. Prototype, and what it says

To check that walking does not break the game, I wrote a throwaway simulation (not committed; docs only): the real `createShift` arrival stream (crowd, rushes, dishes, `patience`, `cookSeconds`, the tip streak) with the marshal walking between the positions in section 3, carrying plates, starting cooks and serving on arrival. The bot goes where the most urgent action is cheapest (patience left plus 0.7 x walk time), then chains pick-up and start-cook at every station. 20 seeds a night, farm open, no upgrades unless stated. Stars are the average per shift.

| Setup (speed, patience bonus, hands, seats) | Night 1 | Night 5 | Night 8 | Night 10 |
|---|---|---|---|---|
| 5.5, +0 s, 1, 4 | 3.0 | 1.5 | 0.5 | 0.1 |
| **5.5, +6 s, 1, 4** (the proposed start) | 3.0 | 2.7 | 1.6 | 0.9 |
| 5.5, +6 s, 1, 4, slow bot (1.5 s to decide) | 3.0 | 1.3 | n/a | 0.0 |
| 4.5, +6 s, 1, 4 | 3.0 | 1.8 | n/a | 0.3 |
| 7.5, +0 s, 1, 4 (the town's speed) | 3.0 | 2.9 | 1.7 | 0.8 |
| 6.5, +6 s, 2, 5 (boots I, tray I, stool) | 3.0 | 3.0 | n/a | 1.4 |
| 7.5, +6 s, 3, 5 (boots II, tray II, stool) | 3.0 | 3.0 | n/a | 2.1 |

What it shows (the bot is greedy, not optimal, so a good human beats it; the shape matters, not the numbers):
1. **Walking is a real cost.** The same crowd that the flat screen's slowest bot clears is hard here.
2. **Night 1 has one seat in use at a time; from night 3 three, from night 5 four.** The juggling the flat screen never had appears by itself.
3. **The patience bonus is needed.** Without +6 s the late nights cannot be played at base speed; with it the curve runs about 3, 3, 2.7, 1.6, 0.9 stars at base gear.
4. **The upgrades move the late nights about 1 to 1.2 stars,** and boots alone at 7.5 do about what +6 s patience does: that is the upgrade arc.
5. **Pay is lower than a perfect flat shift** ($18 on night 1 and $36 to $59 on night 10 here; the flat figures are not re-measured, see K9), so the income rule has plenty of room; shift length is 105 to 120 s.

## 8. The balance bot (the P17 approach for a moving character)

### K12. A graph-based bot as the floor's gate

The flat gate (`tests/saloonBalance.test.js`) taps at a fixed pause. A walking bot needs the same discipline with one more rule:

- **The bot plays the navigation graph, not the 3D scene.** It reads positions and distances from `src/saloonKitchenLayout.js`, moves in 0.1 s steps at the rules' speed, and chooses targets with a fixed, documented policy (the one in section 7). It is deterministic given the seed, runs headless in `node --test`, and needs no browser.
- **Two skill settings, like the flat gate:** a "fast" bot (0.5 s to decide) and a "slow" one (1.5 s), and a **human-inefficiency factor** of 1.15 on every walk (people take a longer path than the shortest) so the targets are not tuned to a perfect walker.
- **Assertions** (the starting values; the build PR tunes them): fast bot three-stars nights 1 to 3 in at least 90 percent of seeds; slow bot no better than 2 stars on average from night 7; peak seats occupied at least 3 from night 5; mean shift length at least 95 s; mean pay never above the flat bot's, and an *average* bot within about 15 percent of the flat average bot on nights 1 to 5 (fairness between the modes, K1); and an upgraded bot beats the plain one at night 10 for each upgrade (every upgrade is felt).
- **Pay invariants** reuse the existing tests (clamp, three paid shifts), since the summary is unchanged.
- **The 3D layer gets its own light test:** every spot reachable from the DOOR and the start through the flap (`walkMap()` valid, like `tests/saloonLayout.test.js`), and the walking view's travel time matches the graph within 10 percent.
- **If the bot and a human playtest disagree, the human wins** and the bot's policy is changed, not the assertion.
**Decision for the owner:** approve the graph-based bot as the gate for the floor. Cost: medium. Lane: town.

## 9. Cost and risk

| Risk | Why it matters | Mitigation |
|---|---|---|
| A new 3D interior is the largest piece of work in this spec | A place is a scene, a walk map, a layout, characters and a camera | Layout and rules first and testable without the scene; a plain box-built placeholder scene first (`AGENTS.md`, art and function), art follows |
| Draw calls | The place budget is about 130 with up to six customers, the marshal and a tray | Merged meshes (`src/meshMerge.js`), a handful of low-poly customer figures, run `node tools/perf.mjs` three times |
| Phone control feels bad | The Cake Mania iPhone version was criticised for its touch controls | Tap-to-walk as primary, padded hit areas, the stick as an option |
| Camera hides a station | A wall or counter in front of the stove loses the player the game | A fixed high camera and a test that no spot is hidden |
| Two modes double the balance work | Flat and floor must stay fair and income-safe | A shared summary, one pay formula, two bot gates, and a plan to retire the flat screen (K1) |
| Pathing around customers | Frustration if the marshal gets stuck | Customers never collide with the marshal; one chokepoint with a wide flap |
| Accessibility | Not everyone can walk a kitchen | QUICK SHIFT stays at least for the first release; reduced-motion respected |

Rules check across K1 to K11 (`AGENTS.md` rule 6): money never buys combat power (dollars buy saloon upgrades only, nothing here touches combat); no sold timers and no paid loot boxes (nothing costs real money, nothing expires, plates never spoil); no dark patterns (no decaying streaks, no pressure to return); places never change combat (the saloon test "changes nothing outside itself" stays and covers the new upgrades); original art only (customers, marshal and room are new work with `ASSETS.md` rows appended at the end; Cake Mania, Diner Dash and Overcooked are cited here as reading, and no name, character or look from them is used).

## 10. Build PRs, one lane each, data contract first

Each PR keeps `npm test`, `npm run build` and its lane's checks green. New files are claimed in `lanes.json` (appended at the end) by the lane that makes them. Listed in order.

| # | Lane | PR | Proposals |
|---|---|---|---|
| 1 | town | **Layout data contract.** `src/saloonKitchenLayout.js` (named spots, positions, the navigation graph and distances, door and flap, seats), `tests/saloonKitchenLayout.test.js` (every spot reachable, distances as the table). No behaviour yet. | K2 |
| 2 | town | **Share the arrivals.** Pull the arrival generator out of `createShift` into one exported function with identical output (a test replays old seeds). No change to the flat shift. | K8 |
| 3 | town | **Floor rules.** `src/saloonFloor.js`: marshal position and speed, hands, acting on arrival, customers walking in and out, tickets, the same `summary()`; tests that play whole shifts and the pay/summary shape. | K3 to K6, K8 |
| 4 | town | **Floor balance gate.** `tests/saloonFloorBalance.test.js` with the graph bot and the assertions of section 8; tune the constants of PR 3. | K12 |
| 5 | town | **New upgrades.** Boots, tray, second burner in `UPGRADES` (`saloon.js`), read by the floor; tests that they change nothing outside the saloon and nothing in a price, tip or the ceiling. | K9 |
| 6 | art | **Interior placeholder scene.** `src/placeSaloonInside.js`, box-built, reads PR 1's layout, `walkMap()` valid, a fixed camera, within the draw-call budget; a marshal and customer figures from the town's kit. Cross-lane note in the PR: it never invents the layout. | K2, K11 |
| 7 | art | **Characters and props.** Customers (walk, sit, leave), the marshal with a tray and plates, dish and ticket icons, the crates, boots/tray/second-burner pieces on the shelf; each with an `ASSETS.md` row. | K5, K6, K9 |
| 8 | town | **Place wiring.** `src/places/saloon.js`: the bar card's WALK THE FLOOR and QUICK SHIFT, the way into the interior (a second place registered with `goTo`), starting and settling a floor shift. | K1 |
| 9 | ui | **Floor HUD and controls.** Tap-to-walk with padded hit areas, the stick (shared), the order rail, patience over heads, the carried-plates strip, pause and the CLOSE UP confirm, the result card reused. | K3, K4, K11 |
| 10 | ui | **Fallbacks.** Reduced motion, the QUICK SHIFT choice remembered, a low-end switch. | K1, K11 |
| 11 | audio | **Cues** for footsteps, pick up, hand over, tip, walk-out (each with a visual twin). | K4 |
| 12 | town | **Crates for farm goods** (K7, phase 2), with art for the crate and a bot case for it. | K7 |
| 13 | town | **Docs.** `docs/lanes/town.md` and the town plan doc for this slice. `PLAN.md` is the coordinator's. | |

PRs 1 to 5 are all town and can merge before any art exists: the game is testable headless. From PR 6 the art and ui lanes can work in parallel against the same layout.

## 11. Decisions summary for the owner

| # | Decision | Recommended |
|---|---|---|
| K1 | Replace the flat screen or keep it as an option | Option now, default later, retire when happy |
| K2 | The room: kitchen behind a bar with one flap, dining in front | Yes |
| K3 | Tap-to-walk primary on phone, stick optional | Yes |
| K4 | Acting by arrival; plates tied to customers, never spoil | Yes |
| K5 | Hands hold one plate; the tray is an upgrade | Yes |
| K6 | Customers walk in, pick the nearest seat, order, leave; the player does not seat them | Yes |
| K7 | Crates: decorative first, then farm goods only (phase 2) | Yes |
| K8 | +6 s patience and base speed 5.5 as starting values | Yes |
| K9 | Boots, tray, second burner added ($400 more); the shelf in the interior | Yes |
| K10 | Keep the night table; walking is the new difficulty | Yes |
| K11 | Portrait phone layout, fixed camera, padded hit areas | Yes |
| K12 | The graph-based bot as the floor's balance gate | Yes |
