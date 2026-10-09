# Red West — Master 3D Asset Creation & Integration Tracker

Comprehensive ledger tracking the status of every 3D model, character, creature, and environmental prop across Red West.

---

## Status Legend
* **`[WIRED]`** — Finished 3D asset (`.glb`) exists in `public/models/` and is fully integrated into gameplay scenes with procedural fallback.
* **`[BUILT-PENDING]`** — 3D asset exists in `public/models/`, but integration is paused or awaiting manual review/rigging check.
* **`[CODE-BUILT]`** — Functional in the game, but currently rendered using procedural primitive geometry (`THREE.BoxGeometry`, etc.). Needs dedicated 3D GLTF asset.
* **`[PLANNED]`** — Planned for future content expansions / milestones.

---

## 1. Characters & Heroes

### Playable Characters & Cosmetics (`src/cosmetics.js`)
| Character | Model File | Triangles / Size | Status | Notes |
|---|---|---|---|---|
| Marshal Flint Reed | `models/marshal.glb` | 8,250 tri / 989 KB | `[WIRED]` | Default playable hero. 6 Meshy animation clips. |
| June Holloway | `models/june-holloway.glb` | 8,280 tri / 1.0 MB | `[WIRED]` | Playable outlaw hero. Fully animated. |
| Ezra Stone | `models/ezra-stone.glb` | 8,260 tri / 950 KB | `[WIRED]` | Playable bounty hero. Fully animated. |
| Lucky Lou | `models/lucky-lou.glb` | 8,300 tri / 1.0 MB | `[WIRED]` | Playable gunslinger hero. Fully animated. |
| Colonel Crane | `models/colonel-crane.glb` | 8,290 tri / 1.1 MB | `[WIRED]` | Playable military hero. Fully animated. |

### Wanted Road Bosses & Outlaws (`src/outlaws.js`)
| Outlaw | Model File | Triangles / Size | Status | Notes |
|---|---|---|---|---|
| Dusty Pete | `models/dusty-pete.glb` | 8,270 tri / 1.0 MB | `[WIRED]` | Boss 1: Saloon outlaw. |
| Rattlesnake Rosa | `models/rattlesnake-rosa.glb` | 8,280 tri / 1.1 MB | `[WIRED]` | Boss 2: Duelist outlaw. |
| Deacon Graves | `models/deacon-graves.glb` | 8,260 tri / 941 KB | `[WIRED]` | Boss 3: Hollow Hill preacher. |
| The Calloways | `models/calloways.glb` | 8,250 tri / 990 KB | `[WIRED]` | Boss 4: Farm gang leader. |
| Iron Jack | `models/iron-jack.glb` | 8,290 tri / 1.0 MB | `[WIRED]` | Boss 5: Heavy armor boss. |
| Mesa Morgan | `models/mesa-morgan.glb` | 8,310 tri / 1.1 MB | `[WIRED]` | Boss 6: Desert bandit chief. |
| Silas Vane | `models/silas-vane.glb` | 8,270 tri / 1.0 MB | `[WIRED]` | Boss 7: Vane's Crossing merchant. |
| El Espectro | `models/el-espectro.glb` | 8,290 tri / 1.0 MB | `[WIRED]` | Boss 8: Phantom gunslinger. |

### Combat Enemies (`src/enemyTypes.js`)
| Enemy Type | Model File | Triangles / Size | Status | Notes |
|---|---|---|---|---|
| Bandit | `models/bandit.glb` | 8,258 tri / 915 KB | `[WIRED]` | Standard revolver mob. |
| Gunslinger | `models/gunslinger.glb` | 8,264 tri / 1,065 KB | `[WIRED]` | Dual revolver shooter. |
| Rifleman | `models/rifleman.glb` | 8,273 tri / 979 KB | `[WIRED]` | Long-range lever rifle enemy. |
| Dynamiter | `models/dynamiter.glb` | 8,288 tri / 989 KB | `[WIRED]` | Explosives tosser mob. |
| Knifer | `models/knifer.glb` | 8,248 tri / 964 KB | `[WIRED]` | Fast melee rush enemy. |
| Duelist | `models/duelist.glb` | 8,309 tri / 1,089 KB | `[WIRED]` | High-accuracy revolver quick-draw mob. |
| Brute | `models/brute.glb` | 8,284 tri / 1,041 KB | `[WIRED]` | Heavy shotgun tank enemy (scale 6.4m). |
| Ghost | `models/ghost.glb` | 8,251 tri / 963 KB | `[WIRED]` | Floating phantom enemy. |
| Cavalry Trooper | — | — | `[CODE-BUILT]` | Uses portrait `art/characters/trooper.jpg`. Needs 3D uniform model. |
| Outlaw Rider | — | — | `[CODE-BUILT]` | Horseback mounted enemy in `src/assets.js`. Needs mounted model. |

### Animals & Creatures
| Creature | Model File | Triangles / Size | Status | Notes |
|---|---|---|---|---|
| Wolf (Enemy) | `models/wolf.glb` | 6,400 tri / 583 KB | `[WIRED]` | 4-legged quadruped rig in Blender. Idle, run, dead clips. |
| Rattler (Snake Enemy) | `models/rattler.glb` | 3,300 tri / 236 KB | `[BUILT-PENDING]` | 12-segment skeletal rig in Blender. Awaiting review. |
| Horse (Western Mount) | `models/horse.glb` | 690 tri / 129 KB | `[BUILT-PENDING]` | 20-bone armature rig with gallop/idle/dead clips. Awaiting review. |
| Light Eater Bug | — | — | `[CODE-BUILT]` | Cave lantern bug in `src/assets.js`. Needs insectoid 3D model. |
| Farm Hens / Chickens | — | — | `[CODE-BUILT]` | Low-poly boxes in `src/placeFarm.js`. Needs stylized chicken model. |
| Farm Guard Dog | — | — | `[CODE-BUILT]` | Low-poly kennel in `src/placeFarm.js`. Needs dog model. |

### Town NPCs & Folk (`src/townFolk.js`, `src/place*.js`)
| NPC | Scene Location | Current Representation | Status | Target Description |
|---|---|---|---|---|
| Mr. Grimsby | Undertaker Parlour | Black-coated box figure | `[CODE-BUILT]` | Gaunt, tall undertaker in Victorian frock coat & top hat. |
| Shopkeeper | General Store | Aproned box figure | `[CODE-BUILT]` | Stout frontier storekeeper with sleeve garters & apron. |
| Saloon Cook / Barkeep | Copper Bit Kitchen | Box chef with apron | `[CODE-BUILT]` | Saloon barman / cook with rolled-up sleeves & mustache. |
| Saloon Patrons | Copper Bit Dining | Seated colored box figures | `[CODE-BUILT]` | 3-4 distinct frontier townsfolk in seated poses. |
| Town Walkers | Main Street | Box walkers on routes | `[CODE-BUILT]` | Miner with pick, bonnet woman, deputy, farmer walking cycles. |

---

## 2. Buildings & Architecture

### Town Buildings (`src/townScene.js`)
| Building | Model File | Triangles / Size | Status | Notes |
|---|---|---|---|---|
| The Saloon | `models/saloon.glb` | 784 tri / 48.3 KB | `[WIRED]` | 2-story brick building, balcony veranda, chimney. |
| Frontier Bank | `models/bank.glb` | 800 tri / 44.4 KB | `[WIRED]` | Ashlar stone portico, 4 columns, reinforced vault annex. |
| Sheriff's Office | `models/sheriff.glb` | 544 tri / 34.7 KB | `[WIRED]` | Timber siding, boardwalk awning, Sheriff's star badge. |
| Town Jailhouse | `models/jail.glb` | 568 tri / 32.9 KB | `[WIRED]` | Stone fortress block, barred windows, watchtower cupola. |
| Gunsmith & Forge | `models/gunsmith.glb` | 404 tri / 27.7 KB | `[WIRED]` | Timber workshop, bay window, forge chimney, rifle trade sign. |
| General Store (Exterior) | `models/house.glb` | 476 tri / 29.6 KB | `[WIRED]` | Clapboard frontier house with porch deck, roof awning. |
| Undertaker Parlour (Exterior) | `models/house.glb` | 476 tri / 29.6 KB | `[WIRED]` | Clapboard frontier building beside the stable. |

### District & Rural Buildings
| Building / Structure | Scene Location | Current Representation | Status | Target Description |
|---|---|---|---|---|
| Calloway Red Barn | `src/placeFarm.js` | Box geometry | `[CODE-BUILT]` | Classic weathered red barn, gambrel roof, hayloft hoist. |
| Farm Windmill | `src/placeFarm.js` | Box lattice tower & planes | `[CODE-BUILT]` | Wooden wind pump tower with 4-blade spinning sail rotor. |
| Chicken Coop | `src/placeFarm.js` | Box shed & fence posts | `[CODE-BUILT]` | Timber hen house with raised ramp, nesting boxes, wire run. |
| Farm Produce Stand | `src/placeFarm.js` | Striped boxes & counters | `[CODE-BUILT]` | Roadside timber produce stall with canvas canopy. |
| Ruined Hill Chapel | `src/placeHill.js` | Burnt timber boxes | `[CODE-BUILT]` | Scorched frontier wooden chapel with bell belfry tower. |
| Canal Warehouse | `src/placeChannel.js` | Box structure | `[CODE-BUILT]` | Freight storage warehouse on the water canal bank. |
| Fort Pell Military Barracks | `src/townScene.js` | Box structure | `[CODE-BUILT]` | Clapboard US Cavalry barracks and headquarters. |
| Fort Pell Log Palisade | `src/townScene.js` | Procedural timber posts | `[CODE-BUILT]` | Heavy pointed cedar log stockade walls and gate. |
| Clock Tower | `src/placeVane.js` | Stone box & cylinder dial | `[CODE-BUILT]` | Frontier municipal square stone clock tower. |

---

## 3. Environment & Combat Props

### Combat Obstacles & Wilderness Cover (`src/scenery.js`)
| Prop | Model File | Triangles / Size | Status | Notes |
|---|---|---|---|---|
| Sandstone Rock Boulder | `models/rock.glb` | 100 tri / 7.6 KB | `[WIRED]` | Faceted desert sandstone boulder (radius 2.45). |
| Western Pine / Cedar Tree | `models/tree.glb` | 252 tri / 16.2 KB | `[WIRED]` | Low-poly frontier evergreen with bark & stepped foliage. |
| Freight Cargo Crate | `models/crate.glb` | 492 tri / 27.8 KB | `[WIRED]` | Timber crate with iron corner straps (radius 1.1). |
| Saguaro Cactus | `models/cactus.glb` | 534 tri / 30.5 KB | `[WIRED]` | Fluted ribs, dual upward arms, desert blossoms (radius 1.5). |
| Oak Whiskey Barrel | `models/barrel.glb` | 496 tri / 28.1 KB | `[WIRED]` | Bulging staves, 4 iron hoop bands, bung stopper. |
| Split-Rail Corral Fence | `models/fence.glb` | 324 tri / 18.4 KB | `[WIRED]` | Rustic split-rail fence with rough pointed cedar posts. |
| Wagon Wheel | `models/wagon_wheel.glb` | 556 tri / 28.2 KB | `[WIRED]` | 12 radial tapered wooden spokes, iron tire rim, chock. |

### Town Street Props (`src/townScene.js`)
| Prop | Scene Location | Current Representation | Status | Target Description |
|---|---|---|---|---|
| Steam Locomotive | `src/townScene.js` | Procedural boxes & cylinders | `[CODE-BUILT]` | 4-4-0 American steam locomotive engine with cowcatcher. |
| Train Passenger Coach | `src/townScene.js` | Procedural green boxes | `[CODE-BUILT]` | Green Western passenger rail coach car with clerestory roof. |
| Train Station Platform | `src/townScene.js` | Timber deck & canopy posts | `[CODE-BUILT]` | Station wooden boardwalk deck and roof awning canopy. |
| Cast Iron Street Lamp | `src/townScene.js` | Procedural boxes & emissive | `[CODE-BUILT]` | Victorian gaslight streetlamp on ornate iron post. |
| Telegraph Pole | `src/townScene.js` | Procedural timber posts | `[CODE-BUILT]` | Utility timber pole with crossbar, glass insulators, wires. |
| Jail Cash Safe Box | `src/townScene.js` | Brass & iron boxes | `[CODE-BUILT]` | Heavy riveted iron safe with combination wheel on stone plinth. |
| Bounty Notice Board | `src/townScene.js` | Timber planks & sign | `[CODE-BUILT]` | Free-standing wooden community notice kiosk with posters. |
| Upright Saloon Piano | `src/townScene.js` | Procedural dark wood boxes | `[CODE-BUILT]` | Weathered Western saloon upright piano with keyboard. |
| Livery Stable Lean-to | `src/townScene.js` | Procedural stall posts | `[CODE-BUILT]` | Weathered wooden stall with hay manger and water trough. |
| Foundry Smelter Chimney | `src/townScene.js` | Procedural brick stacks | `[CODE-BUILT]` | Tall industrial masonry chimney stack with exhaust smoke. |
| Silver Belle Steamboat | `src/townScene.js` | Procedural riverboat boxes | `[CODE-BUILT]` | Paddle steamer riverboat with paddle wheel & twin chimneys. |
| Fort Pell Gatling Gun | `src/townScene.js` | Brass & iron cylinders | `[CODE-BUILT]` | Hand-cranked Gatling gun mounted on wooden artillery carriage. |
| Wall Torch Sconce | `models/wall_torch.glb` | 256 tri / 17.7 KB | `[WIRED]` | Forged iron bracket with torch branch & emissive flame. |

### Mine Environment Props (`src/mineScene.js`, `src/placeTorch.js`)
| Prop | Model File | Triangles / Size | Status | Notes |
|---|---|---|---|---|
| Timber Shoring Arch | `models/mine_arch.glb` | 192 tri / 13.5 KB | `[WIRED]` | Battered drift upright posts, collar beam, knee braces. |
| Ore Hopper Cart | `models/mine_cart.glb` | 760 tri / 43.6 KB | `[WIRED]` | Flared steel hopper, timber frame, 4 flanged wheels, ore chunks. |
| Modular Mine Track Rails | `models/mine_rails.glb` | 408 tri / 24.9 KB | `[WIRED]` | 2m track section, cedar ties, twin steel T-rails, spikes. |
| Treasure Chest | `models/mine_chest.glb` | 226 tri / 16.6 KB | `[WIRED]` | Heavy oak chest, brass bands, articulated animated lid. |
| Cave Mushroom Flora | `models/mine_mushroom.glb` | 420 tri / 31.1 KB | `[WIRED]` | Subterranean bioluminescent cyan mushrooms with glowing gills. |
| Miner Oil Lantern | `models/mine_lantern.glb` | 424 tri / 24.8 KB | `[WIRED]` | Brass reservoir, glass chimney, wire cage guard, bail handle. |
| Mine Elevator Lift Cage | `src/mineScene.js` | Procedural round deck | `[CODE-BUILT]` | Suspended timber/iron circular shaft elevator cage. |
| Mine Hoist Winch Frame | `src/mineScene.js` | Timber A-frame & iron cable | `[CODE-BUILT]` | Overhead cable hoist pulley frame and spool drum. |
| Mine Support Pillars | `src/mineScene.js` | Procedural timber posts | `[CODE-BUILT]` | Rough log cavern uprights with sill blocks & wedge chocks. |

### Farm Props & Flora (`src/placeFarm.js`)
| Prop | Scene Location | Current Representation | Status | Target Description |
|---|---|---|---|---|
| Water Well | `src/placeFarm.js` | Stone cylinder & timber frame | `[CODE-BUILT]` | Stone masonry circular well with bucket, rope & timber canopy. |
| Scarecrow | `src/placeFarm.js` | Procedural cross timbers | `[CODE-BUILT]` | Cross-timber pole, burlap face, felt hat, ragged jacket. |
| Straw / Hay Bales | `src/placeFarm.js` | Golden rectangular boxes | `[CODE-BUILT]` | Rectangular twine-bound agricultural straw/hay bales. |
| Dog Kennel | `src/placeFarm.js` | Small timber box shed | `[CODE-BUILT]` | Rustic wooden doghouse with gabled shingle roof. |
| Wheat Crop (3 Stages) | `src/placeFarm.js` | Procedural thin boxes | `[CODE-BUILT]` | Young green shoots $\rightarrow$ mid stalks $\rightarrow$ golden harvest ears. |
| Corn Crop (3 Stages) | `src/placeFarm.js` | Procedural boxes & leaves | `[CODE-BUILT]` | Short stalks $\rightarrow$ tall fluted stalks with silk and ripe cobs. |
| Pumpkin Vines (3 Stages) | `src/placeFarm.js` | Procedural leaves & boxes | `[CODE-BUILT]` | Sprawling vine leaves $\rightarrow$ green squashes $\rightarrow$ ribbed pumpkins. |

---

## 4. Interior Furniture & Fixtures

### Saloon Kitchen & Dining (`src/placeSaloonInside.js`)
| Fixture | Scene Location | Current Representation | Status | Target Description |
|---|---|---|---|---|
| Saloon Bar Counter | `src/placeSaloonInside.js` | Hardwood boxes & panels | `[CODE-BUILT]` | Long panelled oak bar with brass footrail & order ticket clips. |
| Counter Flap Gate | `src/placeSaloonInside.js` | Brass posts & rail | `[CODE-BUILT]` | Hinged brass/timber swinging staff pass-through gate. |
| Commercial Cook Stove | `src/placeSaloonInside.js` | Cast-iron boxes | `[CODE-BUILT]` | Heavy Victorian commercial 4-burner wood stove with iron pipe. |
| Large Cask Keg Dispenser | `src/placeSaloonInside.js` | Cylinder mesh & brass spigot | `[CODE-BUILT]` | Aged beer/whiskey cask with iron hoops and brass pouring tap. |
| Brick Bake Oven | `src/placeSaloonInside.js` | Masonry box with glow | `[CODE-BUILT]` | Domed red brick bread/roast oven with glowing fire chamber. |
| Saloon Stools & Tables | `src/placeSaloonInside.js` | Wooden pedestals & cushions | `[CODE-BUILT]` | Swivel round bar stools with tufted red leather tops. |
| Kitchen Storage Shelves | `src/placeSaloonInside.js` | Plank wall shelving | `[CODE-BUILT]` | Open wooden shelving with canned provisions, jars, plates. |
| Batwing Saloon Doors | `src/placeSaloonInside.js` | Two angled wooden leaves | `[CODE-BUILT]` | Slatted wooden double louvre swinging saloon doors. |

### Undertaker Parlour (`src/placeUndertaker.js`)
| Fixture | Scene Location | Current Representation | Status | Target Description |
|---|---|---|---|---|
| Display Coffins | `src/placeUndertaker.js` | Boxes on trestle sawhorses | `[CODE-BUILT]` | Octagonal pine and polished mahogany caskets with brass handles. |
| Undertaker Reception Desk | `src/placeUndertaker.js` | Oak counter with brass bell | `[CODE-BUILT]` | Dark oak reception counter, ledger registry book, candleholder. |
| Apothecary Cabinet & Shelves | `src/placeUndertaker.js` | Wall shelves with boxes | `[CODE-BUILT]` | Dark wood cabinet filled with tinted glass chemical bottles. |
| Mantle / Pendulum Clock | `src/placeUndertaker.js` | Box clock with trim | `[CODE-BUILT]` | Carved wooden Victorian mantle clock with brass pendulum. |
| Parlour Waiting Bench | `src/placeUndertaker.js` | Wood bench | `[CODE-BUILT]` | Dark stained wooden church-pew style waiting bench. |
| Cast-Iron Potbelly Stove | `src/placeUndertaker.js` | Cast iron box and pipe | `[CODE-BUILT]` | Round potbelly heating stove with iron stovepipe to wall. |
| Cellar Trapdoor Railing | `src/placeUndertaker.js` | Stone steps & iron posts | `[CODE-BUILT]` | Wrought-iron basement stair railing and safety banister. |

### General Store (`src/placeStore.js`)
| Fixture | Scene Location | Current Representation | Status | Target Description |
|---|---|---|---|---|
| Merchant Counter & Till | `src/placeStore.js` | Timber counter with boxes | `[CODE-BUILT]` | Frontier store counter with ornate brass cash register. |
| Scale & Merchandise | `src/placeStore.js` | Procedural brass box | `[CODE-BUILT]` | Dual-pan brass mechanical balance scale & goods display. |
| Shelves of Provisions | `src/placeStore.js` | Shelves with jar/tin boxes | `[CODE-BUILT]` | Floor-to-ceiling wooden store shelves with dry goods. |

### Outposts & Vigils (`src/placeHill.js`, `src/placeVane.js`, `src/placeChannel.js`)
| Fixture | Scene Location | Current Representation | Status | Target Description |
|---|---|---|---|---|
| Cemetery Headstones | `src/placeHill.js` | Procedural stone boxes | `[CODE-BUILT]` | Carved rounded granite/sandstone gravestones. |
| Wooden Burial Crosses | `src/placeHill.js` | Rough timber cross boxes | `[CODE-BUILT]` | Rough-hewn rustic wooden grave marker crosses. |
| Church Belfry Bell | `src/placeHill.js` | Brass cylinder & frame | `[CODE-BUILT]` | Cast brass chapel bell mounted in wooden yoke. |
| Church Pews | `src/placeHill.js` | Procedural wood benches | `[CODE-BUILT]` | Scorched wooden frontier church pews. |
| Canvas Freight Wagon | `src/placeVane.js` | Procedural canvas boxes | `[CODE-BUILT]` | Heavy Conestoga / prairie schooner wagon with arched canvas cover. |
| Sluice Canal Gate | `src/placeChannel.js` | Timber posts & iron plate | `[CODE-BUILT]` | Wooden/iron irrigation sluice gate with lifting crank. |
| Fire Bucket Stand | `src/placeChannel.js` | Timber rack & metal boxes | `[CODE-BUILT]` | Wooden wall rack holding conical red metal fire buckets. |

