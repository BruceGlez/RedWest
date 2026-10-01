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
| Mad Mesa Morgan | **Morgan's Channel** | WATER | planned |
| Silas Vane | **Vane's Crossing** | TRADE | planned |
| El Espectro | **Tres Rios** | TEND | planned |
| Lucky Lou | **The Silver Belle** | MARKET | planned |
| Colonel Crane | **Fort Pell** | PATROL | planned |
| Dusty Pete | **Copper Bit** | COOK | the street is built in town (2026-10-01), the place is planned |
| Rattlesnake Rosa | **Whisper Wash** | SCOUT | the canyon is built in town (2026-10-01), the place is planned |
| Deacon Graves | **Hollow Hill** | BUILD | the chapel is built in town (2026-10-01), the place is planned |

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

**What comes next here.** More plots and a second field with a place upgrade (dollars and goods), and a coop that holds
more. Water from Morgan's Channel makes wheat give one more (step H2).

### 2. Foundry Yard: SMELT (planned)

*Ezra Stone opened the armour with the bolt he found on its back. Jack went to work at the smithy.* Opens with Iron Jack.

**The map.** A yard with the furnace in the middle, an anvil, a slag heap, a rail siding for ore carts, and the smithy.
**What you do.** Scrap drops from fights on the road (a few pieces a run, never from Arena fights). Feed it to the furnace and
it becomes **iron bars** over time; the furnace glows and smokes while it is lit. Bars are spent on town upgrades (the Bank, the
Jail and the Sheriff's levels cost dollars *and* bars) and on place upgrades. **Links:** pumps for the Channel and rails for the
Crossing are made here.

### 3. Morgan's Channel: WATER (planned)

*The dry channel from Redstone Mesa runs here now, with water in it. No blasting after dark.* Opens with Mad Mesa Morgan.

**The map.** The channel across the middle, a footbridge, the warehouse, the fire crew's buckets, and a row of fishing posts.
**What you do.** Open the sluice and the channel waters the **farm**: wheat gives one more, so the places help each other. Cast
from a fishing post and the line pays out after a while: **fish** are goods, sold or cooked at Copper Bit. The warehouse stores
goods beyond the barn's cap.

### 4. Vane's Crossing: TRADE (planned)

*The Crossing is open again, and wagons use it. The clock on the tower stays stopped.* Opens with Silas Vane.

**The map.** The street of false fronts, the clock tower, a wagon yard.
**What you do.** A **wagon train** arrives each day with three orders (for example, "6 eggs and 4 wheat for $40"). Fill them
from the barn; a filled order pays dollars, and an order left unfilled waits a day, then is replaced. This is the Township order
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
comes from the date, so it can be tested). Sell when the price is high; there is nothing to gamble and nothing to lose, only a
better day to sell. The notice post shows tomorrow's prices.

### 7. Fort Pell: PATROL (planned)

*The Colonel's old regiment stands down here. The gatling is oiled and unloaded, pointed at the sky.* Opens with Colonel Crane.

**The map.** The palisade, barracks, parade ground, flagpole, the gatling, and a notice board of patrols.
**What you do.** Send **deputies** out on patrols that take a set time (30 minutes, 4 hours, overnight). They come back with
dollars and scrap. The board shows what each patrol pays and when the deputies return. Patrols never involve combat on the
screen, and the number of deputies grows with place upgrades.

### 8. Copper Bit: COOK (street built, place planned)

*Copper Bit's saloon street is open again. Dusty Pete runs the bar; the broken piano stays broken.* Opens with Dusty Pete.
Southwest of the town (the gate is on the south edge, left of the channel).

**Built now:** a street of weathered false fronts, a SALOON sign, spilled kegs, a hitching rail, and the broken piano, which you
can read about.
**The place:** the saloon kitchen. Turn farm goods into **meals** (bread from wheat, an egg plate, cornbread, pumpkin pie); a
meal sells for more than the goods in it. The **piano** is the one game here: a short tune to play on the broken keys, once a
day, that pays a small tip. It tests timing, not luck, and a bad try only costs the try.

### 9. Whisper Wash: SCOUT (canyon built, place planned)

*Water runs down the old riverbed again. Rosa's wolf pups sleep in the den under the bank.* Opens with Rattlesnake Rosa.
West edge, north of the farm.

**Built now:** a dry riverbed with a thread of water, canyon walls, the den, and three pups.
**The place:** raise the pups. Feed them eggs and they grow; a grown pup can **scout**: it goes out for a set time and returns
with a find (a trinket to sell, a tool, an arrowhead). The farm feeds the Wash, and the Wash pays the farm back.

### 10. Hollow Hill: BUILD (chapel built, place planned)

*The Deacon rebuilt the chapel from the burnt beams. The bell rings once at dusk for everyone the road took.* Opens with
Deacon Graves. North edge, between Tres Rios and the Foundry.

**Built now:** the chapel with a bell tower, the bell on a frame, graves under the hill, and lamps.
**The place:** a **project board** of things the town builds together: the bell tower, a new pew, a school bench. Each takes goods
from several places (iron bars, wheat, fish). A finished project shows in the town for good, and the bell rings at dusk. This
is the long game that gives goods from every place somewhere to go, and it is where "the town changes because of what you
did" is clearest.

## Order of work

1. **H1** (built): the place shell and Calloway Farm. Three new districts so every outlaw has one.
2. **H2:** orders (Vane's Crossing) and the Channel watering the farm; the bounty board points to waiting orders.
3. **H3:** Foundry Yard and Fort Pell, with scrap dropping from fights.
4. **H4:** Copper Bit, Tres Rios, Whisper Wash.
5. **H5:** The Silver Belle's price board and Hollow Hill's projects.

Each step ships on its own, with its rules tested in `tests/` and a walk-through in `npm run test:town`.

## How we know a place works

- A unit test for its rules: the shut state, every action and its refusals, a clock that moves backwards, and the income cap.
- A unit test for its map: every door can be stood at and is the one offered there, and every door can be reached from the gate.
- A server test for each action, so the server clock and the lock hold.
- `npm run test:town` walks in through the gate, uses each thing, and walks out, and checks the draw calls.
- Play it and answer one question: did I come back to see something, or only to press something?
