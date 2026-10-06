# Places: every district is somewhere you step into

Written 2026-10-01. The town (`TOWN_PLAN.md`) is the map. A **place** is a district you walk into: the gate opens a whole
new map, with its own ground, buildings, things to make and things to do, and a way back to the street. Calloway Farm is
the first one built; the other nine are described here so they can be built one at a time, each in the same way.

## Rules for every place

- **Shut until its outlaw is beaten.** A place opens with the first star on its outlaw, the same rule the jail, the Arena and
  the districts use. Shut, it is a fenced gate with a LOCKED sign that names the outlaw. The rule is in the code
  (`farmOpen`, `src/farm.js`) and on the server, not only in the picture of the gate.
- **A place only changes income and goods, never combat** (`TOWN_EFFECTS` in `src/town.js`; `tests/town.test.js`).
- **No timer is ever sold.** Things grow, cook or travel in real time, wait for you, and never spoil. Checking in once or
  twice a day gets everything (the jail's rule). Nothing is bought with real money, and nothing is chance-based spending.
- **Every place is a side income.** A tended place never earns more than the jail's top rate; `tests/farm.test.js` keeps the
  farm to that and each new place gets the same test.
- **Walking must give something a menu would not.** A place is somewhere you see things change: crops in the beds, a furnace
  that glows when it is lit, a pier with a wagon on it.
- **Mood only from the inspirations.** No names, art or characters from other games or films (`ASSETS.md`).

## How the places fit together

The ten places are one game, not ten side games. Two rules hold them together: **the story and the road set the order**, and
**no place ever depends on another**.

### The road is the spine

The Wanted Road is the story, and the town is what the road rebuilds. Every place is its outlaw's own ground being put right
(`STORY_BIBLE.md`, the epilogues), so a place opens for the same reason the outlaw fell. They open in the order you beat them,
and the places a player has early are the plain, basic ones; the later ones are bigger and make more of the goods.

| Road | Outlaw | Grievance, as the place tells it | Place | Verb | Tier |
|---|---|---|---|---|---|
| 1 | Dusty Pete | A saloon street gone to ruin | Copper Bit | SERVE | 1: the basics |
| 2 | Rattlesnake Rosa | A dry canyon and an unlucky pack | Whisper Wash | TAME | 1 |
| 3 | Deacon Graves | A burnt chapel | Hollow Hill | KEEP | 1 |
| 4 | The Calloways | A farm lost on the small print | Calloway Farm | GROW | 1 |
| 5 | Iron Jack Harlan | A man the smithy would not hire | Foundry Yard | SMELT | 2: make and move |
| 6 | Mad Mesa Morgan | A dry channel | Morgan's Channel | WATER | 2 |
| 7 | Silas Vane | A road closed for pay | Vane's Crossing | TRADE | 2 |
| 8 | El Espectro | A name struck from the records | Tres Rios | TEND | 3: refine |
| 9 | Lucky Lou | A crooked ledger | The Silver Belle | MARKET | 3 |
| 10 | Colonel Crane | A regiment stood down | Fort Pell | PATROL | 3 |

Goods and prices follow the same tiers: what an early place makes is cheap and plain (wheat, eggs), and what a late place makes is
dear (chilli, iron bars, a patrol's pay). A place's best hour always stays below the jail's top rate.

### A place grows with its outlaw's stars

A place has a level, and the level is the outlaw's stars: **1 star opens it, 2 stars (the bounty collected) make it level 2, 3
stars (rode on) make it level 3**. The Calloway Farm does this now (`farmLevel`, `FARM_LEVELS` in `src/farm.js`):

| Level | Calloways' stars | Egg basket | The stand pays | The farm's story |
|---|---|---|---|---|
| 1 | beaten | 8 | base price | The fences are up again and the dog is fed. |
| 2 | and the bounty collected | 10 | +10% | The barn has a new roof. |
| 3 | and ridden on | 12 | +20% | The paper they lost the farm to is burned. |

A level only ever changes **capacity and prices, plus a line of the story**. It never makes anything grow faster and never
touches a fight. So the way to improve your town is the way you already play: beat outlaws, and beat them well. A place
that is shut is level 0 and shows its outlaw's name.

### No place depends on another

This is the hard rule, and it holds in both directions:

1. **A place reads only its own outlaw's stars.** The farm checks the Calloways and nothing else. Beating Jack or failing against
   Lou cannot open it, shut it or level it.
2. **A place writes only its own state, and the wallet.** The farm changes the farm and the dollars. It never touches stars, the
   jail, the buildings, or the other districts (`tests/farm.test.js` checks this).
3. **A link between two places is a bonus, never a need.** It exists only while both ends are open. Take one end away and the
   other goes back to exactly what it does alone. Each link is a small pure function of "is the other place open", so a test can
   run the place with its partner shut and open and compare.
4. **Nothing can ask for something that is shut.** Orders name only goods from open places. A chapel piece (Hollow Hill) lists what it
   can use, and a need from a shut place reads "Iron Jack's yard is shut", never blocks the other projects, and always has at least
   one route that uses only tier 1 places. Prices (Silver Belle) and patrols (Fort Pell) count only open places.
5. **Shut places add nothing and take nothing away.** They are not in totals, prices or orders, and the town simply shows the
   gate.

The test for it is the one already in `tests/farm.test.js`: play the place with every other outlaw beaten and with none, and
the results must be identical.

### The links (bonuses only)

| Link | When both are open | When the other end is shut |
|---|---|---|
| Channel to Farm | Crops grow 10% sooner ("watered") | The farm grows at its normal speed |
| Farm to Copper Bit | Pete cooks with your farm goods: more dishes on the menu and bigger tips | Pete cooks from his own stock, a smaller menu, so the shift still works |
| Farm to Whisper Wash | Your pets can follow you out of the Wash, and farm food (eggs) wins trust sooner | The Wash works on wild food; pets stay in the Wash |
| Foundry to the town | Iron bars lower the dollar cost of an upgrade | Upgrades cost the plain dollars, as now |
| Foundry to Fort Pell | Patrols also bring back scrap | Patrols pay dollars only, a little more of them |
| Crossing to everywhere | Orders name goods from the open places | Orders name only the goods you can make |
| Silver Belle | The price board covers the goods of every open place | It covers the goods of the places that are open |
| Hollow Hill | Other places' goods can speed a chapel piece (meals for the volunteers, finds for the bell) | The hill needs none of them; each piece shows what could help and the others go on |

### What the player sees

- The barn card on the farm already says its level, the story line for it, and what the next star would do. Every place gets the
  same card (`THE BARN: LEVEL 2`).
- Planned: a **town ledger** on the bounty board, one row for each of the ten places: shut (and whom to beat), or level 1 to 3
  (and what the next star adds). It reads from the stars alone, so it is always true.
- The banner that tells you a place has opened (`src/townNews.js`) says which outlaw opened it, and the townsfolk talk about it
  until you have been in.

## How a place is built

| Part | Where | What it holds |
|---|---|---|
| The rules | `src/farm.js` (a new file for each place) | State, what you can do, the numbers. Pure code with no rendering, run by the server and by the offline wallet, so the two agree. |
| The map | `src/farmLayout.js` | Ground, where buildings stand, doors, the prompt wording. Pure, so tests can walk it. |
| The picture | `src/placeFarm.js` | A 3D scene made of boxes in code, merged by material (about 48 draw calls on the farm). It has the same few parts as the town scene, so `src/townWalk.js` walks it as it walks the town. |
| The way in | `src/townDistricts.js` | `interior: 'farm'` on the district. Its gate becomes an `enter-ranch` door and the district adds no ground to the town. |
| Saving | `profile.town.farm` (`src/town.js`) | Part of the profile. The wallet (`wallet.farm`) and the server (`/api/town/farm`) run the same `farmAction`. |
| The cards | `src/townPanel.js` | The same sheet the town uses: plant a crop, sell at the stand, meet the dog. |
| LOOK | `src/townLook.js` `setScene` | The painted shading, bloom and grade follow you in, with a day sky instead of the town's dusk. |

Stepping in stops the town's walk where the marshal stood. Stepping out starts it again at the gate. `?walk=off` keeps the
town as an overview, and then the places cannot be entered (they need walking).

## The ten places

| Outlaw | Place | Verb | Status |
|---|---|---|---|
| The Calloways | **Calloway Farm** | GROW | **built 2026-10-01** |
| Iron Jack Harlan | **Foundry Yard** | SMELT | planned |
| Mad Mesa Morgan | **Morgan's Channel** | WATER | **built 2026-10-05** (waters the farm; placeholder scene) |
| Silas Vane | **Vane's Crossing** | TRADE | **built 2026-10-05** (order board; placeholder scene) |
| El Espectro | **Tres Rios** | TEND | planned |
| Lucky Lou | **The Silver Belle** | MARKET | planned |
| Colonel Crane | **Fort Pell** | PATROL | planned |
| Dusty Pete | **Copper Bit** | SERVE | **built 2026-10-06** (the place and a playable shift; upgrades, regulars and the piano tune are next) |
| Rattlesnake Rosa | **Whisper Wash** | TAME | the canyon is built in town (2026-10-01), the place is designed below, not built |
| Deacon Graves | **Hollow Hill** | KEEP | the chapel is built in town (2026-10-01), the place is designed below, not built |

Until a place is built it is ground you walk on in the town, with one plaque to read (`TOWN_PLAN.md`, steps B and E). Copper
Bit, Whisper Wash and Hollow Hill were added on 2026-10-01 so that all ten outlaws have a place: they open with the first
star on Dusty Pete, Rosa and the Deacon.

### 1. Calloway Farm: GROW (built)

*The Calloways rebuilt these fences themselves. They keep one dog more than they can feed.* Opens with the first star on the
Calloways. West edge of the town; the gate is an arch with the farm's name.

**The map.** A 60 by 50 field with the road in at the south. Two rows of three **plots** in the middle, a scarecrow between
them. The **barn** (north-west) holds the goods and the story. The **coop** (north-east) has two hens that wander its pen.
The **farm stand** (south-west) buys goods. The **kennel** (east) is where the dog is. A windmill turns, a well stands at the
west edge, and a fence and trees close it in.

**What you do.**
- **Plant and harvest.** Walk to a plot and pick a crop; it grows in real time and waits when ready (a gold lantern floats over
  a bed that is ready). Harvest by walking up to it. The prompt always says what the plot is doing.

  | Crop | Grows in | Gives | Sells for |
  |---|---|---|---|
  | Wheat | 20 minutes | 2 | $2 each |
  | Corn | 1 hour 30 | 3 | $6 each |
  | Pumpkin | 8 hours | 4 | $12 each |

- **Eggs.** One every 30 minutes, up to 8 in the basket. Walk to the coop to collect. $2 each.
- **Sell** at the stand for a fixed price, every day the same. **The dog** is taken or sent home at the kennel and trots after
  the marshal in the town and on the farm.

**What it earns.** Six tended wheat plots would make $72 an hour, under the jail's $108 (the test holds it there). A real
check-in, a pumpkin on every plot and a full basket, is about $400 a day at most.

**Levels.** Level 1 is the table above. Level 2 (the bounty collected) and level 3 (ridden on) give a bigger egg basket and a
better price at the stand (see "A place grows with its outlaw's stars"). The farm never needs another place. **What comes
next here:** a second field as a place upgrade. Water from Morgan's Channel makes crops grow 10% sooner, but only while the
Channel is open (step H2).

### 2. Foundry Yard: SMELT (planned)

*Ezra Stone opened the armour with the bolt he found on its back. Jack went to work at the smithy.* Opens with Iron Jack.

**The map.** A yard with the furnace in the middle, an anvil, a slag heap, a rail siding for ore carts, and the smithy.
**What you do.** Scrap drops from fights on the road (a few pieces a run, never from Arena fights). Feed it to the furnace and
it becomes **iron bars** over time; the furnace glows and smokes while it is lit. Bars lower the dollar cost of town upgrades
(never required: the plain dollar price always works) and of place upgrades. **Links:** see the table of links; the Foundry
works fully alone.

### 3. Morgan's Channel: WATER (built 2026-10-05: the watering; fishing and the warehouse are still to come)

*The dry channel from Redstone Mesa runs here now, with water in it. No blasting after dark.* Opens with Mad Mesa Morgan.

**The map.** The channel across the middle, a footbridge, the warehouse, the fire crew's buckets, and a row of fishing posts.
**What you do.** Open the sluice and the channel waters the **farm**: crops grow 10% sooner while both are open, so the places help each other
and neither needs the other. Cast
from a fishing post and the line pays out after a while: **fish** are goods, sold or cooked at Copper Bit. The warehouse stores
goods beyond the barn's cap.

### 4. Vane's Crossing: TRADE (built 2026-10-05)

*The Crossing is open again, and wagons use it. The clock on the tower stays stopped.* Opens with Silas Vane.

**The map.** The street of false fronts, the clock tower, a wagon yard.
**What you do.** A **wagon train** arrives each day with three orders (for example, "6 eggs and 4 wheat for $40"). Orders name only goods
from places that are open. Fill them from the barn; a filled order pays dollars, and an order left unfilled waits a day, then is replaced. This is the Township order
board, and the bounty board in the square points here when orders are waiting.

### 5. Tres Rios: TEND (planned)

*Don Rafael Ibarra has his name back in the town records and the land grant is framed in the hacienda.* Opens with El Espectro.

**The map.** The hacienda, a walled garden, the well, and the old stone with the struck-out date.
**What you do.** A second, slower garden with crops the farm does not have: **chilli** and **agave**, each worth more per
harvest and slower to grow. The well waters it. Chilli goes into meals at Copper Bit, and a few harvests fill in the record
on the stone (a small story line, with no reward beyond the words).

### 6. The Silver Belle: MARKET (planned)

*The riverboat is tied up here for good. The ledger Lou kept went to the court. Every game aboard is played straight.* Opens
with Lucky Lou.

**The map.** The pier, the boat, the notice post, crates, a price board on the gangway.
**What you do.** A **price board**: each good sells for a little more or less each day, the same for everybody (the day's number
comes from the date, so it can be tested). The board lists only the goods of open places. Sell when the price is high; there is nothing to gamble and nothing to lose, only a
better day to sell. The notice post shows tomorrow's prices.

### 7. Fort Pell: PATROL (planned)

*The Colonel's old regiment stands down here. The gatling is oiled and unloaded, pointed at the sky.* Opens with Colonel Crane.

**The map.** The palisade, barracks, parade ground, flagpole, the gatling, and a notice board of patrols.
**What you do.** Send **deputies** out on patrols that take a set time (30 minutes, 4 hours, overnight). They come back with
dollars and scrap. The board shows what each patrol pays and when the deputies return. Patrols never involve combat on the
screen, and the number of deputies grows with place upgrades.

### 8. Copper Bit: SERVE (built 2026-10-06: the rules, the place and a first playable shift)

*Copper Bit's saloon street is open again. Dusty Pete runs the bar; the broken piano stays broken.* Opens with Dusty Pete.
Southwest of the town (the gate is on the south edge, left of the channel).

**Built now:** a street of weathered false fronts, a SALOON sign, spilled kegs, a hitching rail, and the broken piano, which you
can read about.

**The game: a shift behind Pete's bar** (a serve-the-customers game, played on one screen).
- A **shift** lasts about two minutes. Customers come in and sit at the bar or the tables. Each shows what they want (a drink,
  beans, cornbread, pumpkin pie) and a **patience bar** that runs down.
- You work three stations, the stove, the barrel and the oven, in a few quick steps each (cook, pour, bake), carry the plate to the
  right seat and take the money. A quick, right serve earns a **tip**, and serving without a miss builds a **combo**.
- **Nights** are the levels: each one has a bigger crowd, more dishes and more stations. **Regulars** have a favourite dish, and a
  happy regular tips more and comes back. Reading the room (who is about to leave) is the skill.
- **Upgrades** are bought with dollars you earned (a better stove, taps, stools). They make a shift smoother, never longer, and
  never touch combat.
- **The piano** is a small separate game between shifts: a short tune of timed keys on the broken piano that pays a small tip,
  once a day. It tests timing, not luck, and a bad try only costs the try.
- **The farm is a bonus.** With the farm open Pete cooks with your farm goods: more dishes on the menu and bigger tips. Without it
  he cooks from his own stock with a smaller menu, so Copper Bit works on its own.
- **The income rule.** The first **three shifts of a day** pay their wages and tips. Further shifts are free practice that still
  earn stars for the nights but no dollars, the same once-or-twice-a-day check-in the jail and the farm use. The best a day can
  bank is tested to stay under the jail's top rate. No shift is sold, sped up or bought back.

**Built so far (slice 1, the data contract, 2026-10-05).** `src/saloon.js` has the rules and `profile.town.saloon` the saved state
(`tests/saloon.test.js`). The shift is played on the client; its summary `{ night, served: [{ dish, tip }] }` is settled by the
server, which never trusts more than a night's crowd (`crowd(night)`, 3 to 10) or a dish that is not on that night's menu. Prices:
sarsaparilla $2, beans $3, cornbread $4 (from night 2), egg plate $5 (night 3) and pumpkin pie $8 (night 5) only with the farm open.
A tip adds 0, a quarter or a half of the price (a fifth more with the farm). Three paid shifts a day, by the server's clock
(a clock moved back brings none back); later ones pay nothing and still earn the night's stars (half, three quarters, all of the
crowd). A night opens with a star on the one before. The test holds a whole day's best (3 shifts) to $400, like a farm check-in.
**Waiting on lanes:** `server/app.js` (scale) `POST /api/town/saloon` calling `saloonAction(user.profile, body, now())`, and
`saloon(body)` on both wallets in the shared `src/wallet.js`, the same way as `orders`.

**Slice 2 (built 2026-10-05): the place.** The gate in the town opens Copper Bit (`interior: 'saloon'`, shut with a LOCKED sign naming Dusty Pete until his first star). `src/saloonLayout.js` is the map (the saloon at the back, the broken piano out front, kegs, a rail, the way out), `src/places/saloon.js` the bar's card (tonight's night, the stars on each night, the menu with prices, the paid shifts left) and the piano's card, and `src/placeSaloon.js` a plain box-built **placeholder scene** (the art lane's from here on). Tests: `tests/saloonLayout.test.js` and the Copper Bit walk-through in `tests/town-smoke.mjs`.

**Slice 3 (built 2026-10-06): a playable shift.** The bar's card has a START NIGHT button for the newest night and REPLAY NIGHT for each earlier one. `src/saloonShift.js` is the game with no rendering (`tests/saloonShift.test.js` plays whole shifts): two minutes, up to four seats, customers who each want a dish and have a patience bar, and three stations (the stove, the barrel, the oven) that cook one thing at a time, so what you cook first is the game. COOK a seat's dish, then SERVE it; serve with half the patience left for a **tip**, and with nobody having walked out yet for the **big tip**. A customer who runs out of patience walks out (a miss, and the combo starts again). The same night, farm and seed give the same crowd, and a night's crowd, menu and patience come from the rules in `src/saloon.js`. `src/saloonShiftView.js` is the screen. When the shift ends it goes to `wallet.saloon({ action: 'shift', night, served })` (the server route and the wallet method are built by the scale lane), which settles it: three paid shifts a day, then free practice for stars. A shift in which nobody was served is not sent, so it never uses up a paid shift. A failed save keeps the shift and offers TRY AGAIN. **Not built yet:** upgrades, regulars with favourite dishes, the piano tune, patience that differs by customer, and real art.

### 9. Whisper Wash: TAME (canyon built, place designed 2026-10-05)

*Water runs down the old riverbed again. Rosa's wolf pups sleep in the den under the bank.* Opens with Rattlesnake Rosa.
West edge, north of the farm.

**Built now:** a dry riverbed with a thread of water, canyon walls, the den, and three pups.

**The game: a sanctuary where you win the trust of wild creatures** (taming and raising).
- **Many kinds, not only wolves.** Wolf pups first, then coyotes, jackrabbits, owls, lizards, a badger and snakes. Each lives on a
  different part of the Wash: the riverbed, the canyon wall, the rocks, the den. Rosa's notes say what each one likes to eat.
- **Taming is trust, never luck.** Feed a creature what it likes and spend quiet time near it. It takes a fixed number of visits for
  each creature, so there is no roll, no loot box and nothing to buy. A shyer creature needs more trust or one particular food.
- **Bond levels.** A tamed pet has a bond level. A higher bond means it can scout further and bring back better finds (a trinket to
  sell, a tool, an arrowhead), and it earns a cosmetic change such as a collar or markings. Scouting takes real time and waits for
  you; it is never sped up for money.
- **A pet that follows you.** Once the farm is open, one tamed pet at a time can follow the marshal out of the Wash, in the town and
  in the other places, as the dog does now. Pets are cosmetic and finders only: they never help in a fight.
- **The farm is a bonus.** Farm food (eggs) wins a creature's trust sooner and lets a pet leave the Wash. The Wash itself opens on
  Rosa's star and works on wild food, so the Wash never needs the farm.

### 10. Hollow Hill: KEEP (chapel built, place designed 2026-10-05)

*The Deacon rebuilt the chapel from the burnt beams. The bell rings once at dusk for everyone the road took.* Opens with
Deacon Graves. North edge, between Tres Rios and the Foundry.

**Built now:** the chapel with a bell tower, the bell on a frame, graves under the hill, and lamps.

**The game: the dusk vigil** (a lamplighter puzzle, gentle and fit for every age).
- Each evening the bell rings once and the hill goes dark. You **walk the hill and light the lanterns** on the paths and graves
  before the bell's echo fades.
- The route is the puzzle. Some lanterns need oil from a stand, some are out of reach until you have lit another, and the order
  changes each night, so you plan a path rather than race.
- **What it earns.** Each lantern lit adds light to the chapel's rebuilding, and a finished night pays a small amount. The Deacon
  rebuilds the chapel from the burnt beams one piece at a time: a window, the pews, the bell tower, the roof.
- **Every finished piece is permanent.** It shows in the town for good and the bell rings at dusk. This is where "the town changes
  because of what you did" is clearest.
- **The other places are a bonus.** Pete's meals for the volunteers and the Wash's finds for the bell can speed a piece along, but
  the hill needs none of them: each piece shows what could help, and the others go on.
- Nothing is timed for pay. The vigil waits for you each evening, and a missed night costs nothing but the night.
- **The graves (slice 6, `MINE_PLAN.md`).** The graves stand on the hill and appear once Deacon Graves has a star, the same unlock as the hidden door in the cellar. Each gives a small job for a fallen soul: bring up ore, kill a named creature or a number of one kind, or both; one grave a day is the main one (a bigger, tougher creature deep down). The jobs are done in the mine, so the hill never changes a fight. A job pays earned Bounty Dollars, ore and for the main one a cosmetic rank title, and pays more the deeper it goes (the table is in `MINE_PLAN.md`). The generator is built (`src/graveQuests.js`).

## Order of work

1. **H1** (built): the place shell and Calloway Farm. Three new districts so every outlaw has one.
2. **H2:** orders (Vane's Crossing) and the Channel watering the farm; the bounty board points to waiting orders.
   - **Slice 1 (built 2026-10-05): the order rules.** `src/farmOrders.js`, saved as `town.orders`, tested in `tests/farmOrders.test.js`
     (shut state, refusals, daily orders, waiting a day, a clock moved back, the income cap). Three orders a day from the date,
     goods of open places only (the farm's, today), $ paid at 1.15 x the stand price. A new player sees only today's three; from their
     second day an unfilled order waits one more day, so the board then holds up to six. The first `visit` (or fill) starts the player's days.
   - **Slice 2 (built 2026-10-05): the place.** The gate in the town opens the Crossing (`interior: 'vane'` in `src/townDistricts.js`, shut with a LOCKED sign naming Silas Vane until his first star). `src/vaneLayout.js` is the map (the wagon, the stopped clock, the order board, the way out), `src/places/vane.js` the board card (today's orders, FILL buttons through `wallet.orders`, the first-visit `visit`) and prompts, `src/placeVane.js` a plain box-built **placeholder scene** (the art lane's from here on; a gold lantern floats over the board while orders wait). Tests: `tests/vaneLayout.test.js` and the Crossing walk-through in `tests/town-smoke.mjs`. **Not built yet:** the bounty-board
     pointer, the Channel watering the farm, and real art.
   - **Slice 3 (built 2026-10-05): Morgan's Channel and the watering.** The gate in the town opens the Channel (`interior: 'channel'`, shut with a LOCKED sign naming Mad Mesa Morgan until his first star). `src/farmWater.js` is the rule (10% sooner, `WATER_FACTOR` 0.9, only while the Channel and the farm are both open; `farmWatered(profile)` in `src/farm.js` threads it through `plotState`, so the server and the offline wallet run the same code), `src/channelLayout.js` the map (the channel with a footbridge, the sluice, the warehouse log, the way out), `src/places/channel.js` the sluice card, and `src/placeChannel.js` a plain box-built **placeholder scene** (the art lane's from here on). The water is simply there: no wallet call, no new saved state and nothing to buy or wait for. The farm's crop buttons, plot cards and prompts show the watered times. Tests: `tests/farmWater.test.js` (the link, the cap, the shut state), `tests/farmWater.server.test.js` (the server clock), `tests/channelLayout.test.js`, and the Channel walk-through in `tests/town-smoke.mjs`. **Not built yet:** fishing posts (they are scenery), the warehouse's extra storage, and real art.
   - **Done (contract, kept for reference):** filling an order changes the profile, so it needs a route and a wallet method, like the farm's.
     `server/app.js` (scale): `POST /api/town/orders` calls `ordersAction(user.profile, body, now())` from `src/farmOrders.js`, the same
     way `/api/town/farm` calls `farmAction`, and returns `{ result, profile }`. `src/wallet.js` (shared): `orders(body)` on both wallets,
     offline `ordersAction(profile, body, new Date()); persist()`, online `call('/api/town/orders', body)`. Body: `{ action: 'visit' }` (once, when the player first walks in) or `{ action: 'fill', order: '<day>:<slot>' }`.
     Errors are `EconomyError` codes `locked`, `no_order`, `not_enough`, `bad_action`. Needs a server test for the lock and the clock.
3. **H3:** Foundry Yard and Fort Pell, with scrap dropping from fights.
4. **H4:** Copper Bit, Tres Rios, Whisper Wash.
5. **H5:** The Silver Belle's price board and Hollow Hill's chapel.

Each step ships on its own, with its rules tested in `tests/` and a walk-through in `npm run test:town`.

## How we know a place works

- A unit test for its rules: the shut state, every action and its refusals, a clock that moves backwards, and the income cap.
- A unit test for its map: every door can be stood at and is the one offered there, and every door can be reached from the gate.
- A server test for each action, so the server clock and the lock hold.
- `npm run test:town` walks in through the gate, uses each thing, and walks out, and checks the draw calls.
- Play it and answer one question: did I come back to see something, or only to press something?
