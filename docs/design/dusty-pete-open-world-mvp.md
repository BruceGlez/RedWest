# Dusty Pete: Open-World Pursuit & Boss Battle (MVP Specification)

Lane: `design` (advisory).
Scope: **The Red West Vertical Slice / MVP**.

---

## 1. Executive Summary & Design Vision

Red West's current Wanted Road runs use a timer-based horde survival mechanic: the player is dropped into a flat arena bounded by invisible walls while endless rings of enemies spawn directly around them until a 35-second timer summons a boss. 

This specification fundamentally overhauls the run structure into an **objective-driven Open-World Bounty Pursuit**:
1. **Explore a Dedicated Open-World Territory:** Rather than an enclosed survival box with endless mob spawners, each outlaw occupies a distinct open-world region (starting with Outlaw 1: **Dusty Pete** in the mining canyon settlement of **Copper Bit**).
2. **Save & Return Checkpoints:** Runs feature physical waystations and cleared campfires that save progress (`localStorage`). Players can leave to town and resume their run at the last activated checkpoint.
3. **Structured Investigation Missions:** The player must complete exploration tasks and eliminate outpost guards to uncover clues (e.g. the Meridian Land & Rail $50 receipt) before Dusty Pete's showdown is unlocked.
4. **Magicka-Style Multi-Phase Boss Battle:** Dusty Pete is transformed from a basic 1-pattern charging enemy into a multi-phase mechanical encounter utilizing environmental collision stuns, thrown hazard barrels, and telegraphed shockwaves.
5. **Limited Ammo & Resource Scavenging:** Ammunition is no longer infinite. Players start with a finite cartridge pool, scavenge ammo from world freight crates (Minecraft/PUBG style), and purchase ammunition boxes from Ada Pruitt at the General Store in town.
6. **Story Comic Intros:** Runs kick off with an illustrated comic sequence establishing the setting, the villain's tragic motive, and the investigation goals.
7. **Strict MVP Scope ("Coming Soon"):** Outlaw 1 (Dusty Pete) is fully playable. All subsequent outlaws (Rosa, Deacon, Calloways, Jack, Morgan, Vane, Espectro, etc.) are prominently stamped with **"COMING SOON"** in the catalog.

---

## 2. World Design: Copper Bit Territory

### World Layout & Zones
Copper Bit is structured as a non-linear mountain valley divided into 4 connected sub-zones:

```
[Zone 1: Canyon Trailhead] ---> [Zone 2: Abandoned Sluice Claims]
             |                                    |
             v                                    v
[Zone 3: Company Enforcer Camp] -> [Zone 4: The Tin Cup Saloon & Plaza]
```

1. **Zone 1: Canyon Trailhead (Starting Zone & Checkpoint Alpha):**
   * Narrow red-rock gorge opening onto the dust plains.
   * Features a telegraph wire pole, an initial ammo crate, and a friendly stranded miner NPC (*Old Man Harlin*) who delivers the opening clue.
   * **Checkpoint 1:** The Trailhead Campfire.
2. **Zone 2: Abandoned Sluice Claims:**
   * Diverted dried riverbed with smashed wooden sluice flumes, ore carts, and narrow bridges.
   * Guarded by 3–4 Company Bandits and a Sniper on an elevated cliff perch.
   * Contains scattered loot crates with revolver ammo and band-aids.
3. **Zone 3: Company Enforcer Outpost (Checkpoint Bravo):**
   * Fortified mining supply yard with log barricades, a Company wagon, and tent shelters.
   * Guarded by an Elite Enforcer (Brute) and 2 Knifers.
   * **Mission Clue Item:** Searching the desk inside the Company wagon reveals the signed $50 receipt stamped with the Meridian Land & Rail seal.
   * **Checkpoint 2:** The Enforcer Lantern Stand.
4. **Zone 4: The Tin Cup Saloon Plaza (Showdown Arena):**
   * The tumbledown western street of Copper Bit.
   * Landmarks: *The Tin Cup Saloon*, hitching posts, spilled whiskey barrels, and the iconic *Outlaw Piano* sitting in the middle of the street.
   * Dusty Pete waits at the front steps of the saloon.

---

## 3. Mission & Progression Flow

Instead of a passive countdown timer, the run is driven by a 4-step mission pipeline:

| Step | Mission Objective | Action Required | Reward / Unlock |
|---|---|---|---|
| **M1** | *Inspect Copper Bit* | Talk to Old Man Harlin at the trailhead and search the checkpoint. | Unlocks the path through the Abandoned Sluice Claims. |
| **M2** | *Clear the Sluice Flumes* | Eliminate the 4 Company enforcers guarding the flume bridges. | Opens the gate to the Enforcer Outpost; drops shotgun ammo. |
| **M3** | *Find Pete's Receipt* | Infiltrate the Company Outpost and search the freight wagon. | Discovers the $50 receipt; unlocks the plaza gate to The Tin Cup. |
| **M4** | *Showdown with Dusty Pete* | Confront Dusty Pete in the saloon plaza and defeat him. | Completes the Bounty ($50 reward, unlocks Barroom Brawler hero). |

The current active objective is displayed in the top-left HUD banner (`INVESTIGATE COPPER BIT`, `SEARCH THE ENFORCER WAGON`, etc.).

---

## 4. Checkpoint & Save State System

### Checkpoint Mechanics
* When the marshal walks within 2.5 meters of a waystation / campfire, a golden lantern ignites and a toast appears: `CHECKPOINT ACTIVATED`.
* Checkpoints persist immediately to `localStorage` under `redWestResume.pete.v1`.
* **Saved Data Contract:**
  ```javascript
  {
      outlawId: 'dusty-pete',
      checkpointId: 'cp_outpost', // 'cp_trailhead' | 'cp_sluice' | 'cp_outpost' | 'cp_saloon'
      position: { x: 34.2, y: 0, z: -12.5 },
      health: 85,
      maxHealth: 100,
      ammo: { revolver: 18, shotgun: 6, rifle: 0 },
      missionsCompleted: ['m1_investigate', 'm2_sluice_cleared', 'm3_receipt_found'],
      cluesFound: ['receipt_50'],
      timestamp: 1728490000000
  }
  ```
* If the player is defeated or chooses to return to Town, selecting "WANTED ROAD" on the main menu presents two choices:
  * **RESUME PURSUIT** (Spawns at Checkpoint with saved health, ammo, and completed tasks).
  * **START AHEAD** / **RESTART RUN** (Clears run save and begins from Trailhead).

---

## 5. Combat Overhaul: Magicka-Style Boss Battle (Dusty Pete)

Dusty Pete is upgraded from a single charge loop into a 3-phase tactical boss battle:

### Phase 1: Heavy Brawler & Environmental Stun (100% – 66% HP)
* **Mechanic:** Pete wears a reinforced thick leather-and-iron brawler coat. Direct frontal shots deal 70% reduced damage and deflect with metallic sparks.
* **Tactic:** Pete initiates a heavy ground-pounding windup (0.8s) followed by a high-speed shoulder charge directly toward the player.
* **The Counter:** The player must position themselves so Pete charges into solid obstacles (the Tin Cup piano, wooden crates, hitching posts, or stone walls).
* **The Vulnerability:** Crashing into an obstacle breaks the obstacle and stuns Pete for 2.5 seconds, exposing his unarmored back for critical vulnerability damage.

### Phase 2: Saloon Brawl & Hazard Toss (66% – 33% HP)
* **Mechanic:** Pete retreats up the saloon steps and roars: *"Bar's closed, Marshal!"*
* **Tactic 1 (Barrel Toss):** Pete picks up whiskey barrels and hurls them in high arcs. Barrels shatter on impact, spreading flammable alcohol pools on the ground that ignite on contact with gunfire.
* **Tactic 2 (Dynamite Flurry):** Pete tosses fused dynamite sticks that tick for 2 seconds before detonating. Players can shoot dynamite mid-air to detonate it early or kick it back.
* **Minions:** 2 Company bouncers spawn from the saloon side doors to flank the player.

### Phase 3: High Noon Desperation (33% – 0% HP)
* **Mechanic:** Pete draws an oversized sawed-off break-action shotgun and ditches his heavy coat. Movement speed increases by 35%.
* **Tactic:** Pete executes a 3-burst spread shot followed by a leaping ground slam that sends a circular dust shockwave outwards (which must be jumped over or dodged with a roll/dash).
* **Vulnerability Window:** After each 3-shot burst, Pete must reload both shells (1.8s reload animation), providing the window for decisive damage.

---

## 6. Limited Ammunition Economy

### Core Rules
* Ammo is strictly finite. Firing with an empty cylinder plays a dry metallic click (`click` sound effect) and displays `OUT OF AMMO`.
* **Starting Loadout:**
  * Revolver: 24 rounds (6 loaded in cylinder, 18 in reserve).
  * Shotgun: 6 shells (if equipped).
* **Loot Crates in the Wild (Minecraft / PUBG Style):**
  * Wooden freight crates scattered throughout Copper Bit can be broken by melee strikes or bullet impacts.
  * Crate Loot Table:
    * 50% chance: Revolver Cartridges (+6 to +12 rounds).
    * 25% chance: Shotgun Shells (+2 to +4 shells).
    * 15% chance: Frontier Salve (+20 Health).
    * 10% chance: Bounty Dollars ($2 to $5 coins).
* **General Store Ammo Purchases (Lantern Rock):**
  * Ada Pruitt at the General Store sells ammunition prior to embarking on runs:
    * **Box of Revolver Ammunition (24 rounds):** $15 Bounty Dollars.
    * **Box of Shotgun Shells (8 shells):** $25 Bounty Dollars.
    * **Bandolier Upgrade (Increases reserve ammo cap by 50%):** $80 Bounty Dollars.

---

## 7. Story Comic Strip Intro

Before the player spawns into Copper Bit, a 4-panel illustrated comic sequence plays with panel-by-panel transitions:

* **Panel 1 (Wide Desert Vista):** Flint Reed riding his mount through the narrow red-rock pass leading into the desolate gulch of Copper Bit.
  * *Caption:* "Copper Bit used to be a boomtown. That was before Meridian Land & Rail decided they owned the bedrock."
* **Panel 2 (The Ruins):** Smashed wooden sluice flumes and eviction notices nailed to abandoned miner shacks with iron spikes.
  * *Caption:* "The Company didn't send lawyers to persuade the holdouts. They sent muscle."
* **Panel 3 (The Shadow):** The sun blazing over the cracked facade of *The Tin Cup Saloon*. Through the swinging batwing doors, the hulking silhouette of Dusty Pete sits beside an unplayed piano.
  * *Caption:* "Dusty Pete broke whatever wouldn't sell. And he kept every receipt."
* **Panel 4 (Action Call):** Flint Reed checking his revolver cylinder as the canyon dust swirls around his boots.
  * *Caption:* "Find Pete. Find out who paid him. Bring the law back to Copper Bit."
  * *Button:* `START PURSUIT`

---

## 8. MVP Catalog Restrictions ("Coming Soon")

To ensure a polished, bug-free vertical slice, all other outlaws are formally locked in the UI:

* **Bounty Catalog Display:**
  * **Card 1 (Dusty Pete):** Active, full color, `HUNT` button active.
  * **Cards 2–10 (Rattlesnake Rosa, Deacon Graves, The Calloways, Iron Jack, Mesa Morgan, Silas Vane, El Espectro, Lucky Lou, Colonel Crane):**
    * Rendered with muted grayscale portraits and a bold diagonal red/gold banner reading: **`COMING SOON`**.
    * Tooltip / Subtitle on click: *"Under investigation by the Territorial Marshals. Available in next chapter."*
* **Code Constraint:** `src/progress.js` enforces `isUnlocked(progress, index) => index === 0`.

---

## 9. Implementation Roadmap & Lane Division

| Milestone | Lane | Target Files | Primary Deliverables |
|---|---|---|---|
| **Phase 1: Story Comic & Catalog Lock** | `story` / `ui` | `src/storyPanels.js`, `src/outlaws.js`, `src/uiManager.js` | Implement 4-panel Dusty Pete intro comic; apply `COMING SOON` locks to outlaws 2–10. |
| **Phase 2: Ammo Inventory & Store Restock** | `combat` / `town` | `src/state.js`, `src/playerSystem.js`, `src/lootSystem.js`, `src/places/store.js` | Finite ammo pools, dry-fire click, loot crate ammo drops, General Store ammo purchases. |
| **Phase 3: Copper Bit Open-World & Checkpoints** | `art` / `town` / `mine` | `src/modes/road.js`, `src/scenery.js`, `src/checkpointSystem.js` | Modular open-world zones, camp placements, proximity aggro guards, checkpoint save/restore. |
| **Phase 4: Investigation Missions** | `story` / `combat` | `src/questSystem.js`, `src/modes/road.js` | 4-step mission state machine, HUD objective tracker, interactive receipt clue. |
| **Phase 5: Magicka-Style Pete Boss Battle** | `combat` | `src/enemySystem.js`, `src/combatMath.js` | 3-phase fight: obstacle charge stuns, thrown barrel/dynamite hazards, shotgun spread & shockwaves. |
