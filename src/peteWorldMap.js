// Copper Bit Gulch / Canyon Exploration Map for Outlaw 1 (Dusty Pete).
// Non-endless open-world layout with 4 distinct zones, campfires, supply crates,
// and investigation clue milestones leading to Pete's Stronghold.

import { createCampfire } from './checkpoints.js';
import { createLootCrate } from './ammoEconomy.js';
import { AREA1_CLUE_AT } from './stages/peteArea1.js';

export const PETE_WORLD_ZONES = {
    // Area 1 (src/stages/peteArea1.js) replaced the old mine camp; this canyon is now Area 2 and starts at the rail spur.
    railSpur: { id: 'railSpur', name: 'Zone B: Old Rail Spur & Depot', minZ: -48, maxZ: 10 },
    sunkenSaloon: { id: 'sunkenSaloon', name: 'Zone C: Sunken Saloon Ruins', minZ: 10, maxZ: 60 },
    stronghold: { id: 'stronghold', name: 'Zone D: Pete\'s Stronghold Arena', minZ: 60, maxZ: 125 }
};

export const INVESTIGATION_CLUES = [
    {
        id: 'clue-manifest',
        zone: 'miners',
        area: 0, // found in Area 1; the others are in Area 2
        title: "Miners' Payroll Manifest",
        detail: "Found inside the foreman's cabin. Proves the miners were owed $450 before Pete stole the cashbox.",
        x: AREA1_CLUE_AT.x,
        z: AREA1_CLUE_AT.z
    },
    {
        id: 'clue-ledger',
        zone: 'railSpur',
        area: 1,
        title: "Pete's Stolen Claim Ledger",
        detail: "Tucked inside an abandoned handcar. Contains the $50 payment receipt from Meridian Land & Rail.",
        x: -12,
        z: -15
    },
    {
        id: 'clue-key',
        zone: 'sunkenSaloon',
        area: 1,
        title: "Stronghold Gate Key",
        detail: "Carried by Pete's lookout behind the broken piano bar. Unlocks the palisade gate to the stronghold.",
        x: 0,
        z: 42
    }
];

export const WORLD_CAMPFIRES = [
    createCampfire('camp-depot', 'Rail Depot Campfire', 'railSpur', -5, -20),
    createCampfire('camp-saloon', 'Sunken Saloon Campfire', 'sunkenSaloon', 0, 25),
    createCampfire('camp-stronghold', 'Stronghold Gate Campfire', 'stronghold', 0, 68)
];

export const WORLD_CRATES = [
    // Zone B
    createLootCrate('crate-b1', -15, -30, { type: 'ammo', amount: 20 }),
    createLootCrate('crate-b2', 18, -25, { type: 'health', amount: 1 }),
    createLootCrate('crate-b3', -20, -10, { type: 'ammo', amount: 25 }),
    createLootCrate('crate-b4', 10, 0, { type: 'ammo', amount: 15 }),
    // Zone C
    createLootCrate('crate-c1', -18, 20, { type: 'ammo', amount: 25 }),
    createLootCrate('crate-c2', 22, 35, { type: 'health', amount: 2 }),
    createLootCrate('crate-c3', -15, 45, { type: 'ammo', amount: 20 }),
    createLootCrate('crate-c4', 12, 50, { type: 'ammo', amount: 20 })
];

// Guard groups. Each wakes when the marshal walks within `radius` of it, then chases; nobody respawns, so the canyon is
// cleared as you push on. Offsets are from the group's centre. `line` is the words on the banner when they spot you.
export const ENCOUNTERS = [
    {
        id: 'depot-patrol', zone: 'railSpur', x: -4, z: -28, radius: 22,
        line: 'A patrol on the rail spur.',
        enemies: [{ type: 'bandit', dx: -8, dz: 0 }, { type: 'bandit', dx: 8, dz: 2 }, { type: 'gunslinger', dx: 0, dz: 8 }]
    },
    {
        id: 'depot-yard', zone: 'railSpur', x: 6, z: -4, radius: 30,
        line: 'Enforcers guard the depot yard.',
        enemies: [{ type: 'knifer', dx: -7, dz: 0 }, { type: 'knifer', dx: 7, dz: 0 }, { type: 'rifleman', dx: 0, dz: 10 }]
    },
    {
        id: 'saloon-lookouts', zone: 'sunkenSaloon', x: 0, z: 36, radius: 30,
        line: "Pete's lookouts, and a big one.",
        enemies: [{ type: 'bandit', dx: -9, dz: 0 }, { type: 'bandit', dx: 9, dz: 0 }, { type: 'gunslinger', dx: 0, dz: 6 }, { type: 'brute', dx: 0, dz: -6 }]
    },
    {
        id: 'gate-guards', zone: 'stronghold', x: 0, z: 84, radius: 30,
        line: "Pete's gate crew.",
        enemies: [{ type: 'bandit', dx: -10, dz: 0 }, { type: 'bandit', dx: 10, dz: 0 }, { type: 'knifer', dx: -4, dz: 6 }, { type: 'knifer', dx: 4, dz: 6 }]
    }
];

// Flat list of every guard's start point (kept for the map tests and for tools that want to draw them).
export const ENCOUNTER_SPAWNS = ENCOUNTERS.flatMap(group =>
    group.enemies.map((enemy, i) => ({ id: `${group.id}-${i + 1}`, type: enemy.type, x: group.x + enemy.dx, z: group.z + enemy.dz, zone: group.zone, group: group.id }))
);

// What the marshal reads on the banner on first reaching each zone. Serious voice (STORY_BIBLE.md): loss is told, never shown.
export const ZONE_STORY = {
    railSpur: {
        title: 'THE RAIL SPUR',
        line: 'Company freight sits where the miners\' carts used to roll. Pete\'s claim ledger rode through here.'
    },
    sunkenSaloon: {
        title: 'THE TIN CUP',
        line: 'The Tin Cup\'s piano still stands in the street. Pete\'s lookouts hold the key to his gate.'
    },
    stronghold: {
        title: "PETE'S STRONGHOLD",
        line: 'Pete kept every receipt. Now he has to answer for them.'
    }
};

// The one thing to do next, for the HUD.
export function objectiveFor(collectedClueIds = [], bossSpawned = false) {
    if(bossSpawned) return 'DEFEAT DUSTY PETE';
    const next = INVESTIGATION_CLUES.find(clue => !collectedClueIds.includes(clue.id));
    if(!next) return 'BREAK INTO THE STRONGHOLD';
    return `FIND: ${next.title.toUpperCase()}`;
}

export const STRONGHOLD_GATE_Z = 74;

// Determine current zone based on player Z coordinate.
export function zoneAt(z) {
    for(const zone of Object.values(PETE_WORLD_ZONES)) {
        if(z >= zone.minZ && z < zone.maxZ) return zone;
    }
    return PETE_WORLD_ZONES.railSpur;
}

// Check if player has found all required investigation clues to breach the stronghold.
export function canBreachStronghold(collectedClueIds = []) {
    return INVESTIGATION_CLUES.every(clue => collectedClueIds.includes(clue.id));
}

// Check proximity to an investigation clue.
export function isNearClue(clue, playerX, playerZ, radius = 2.5) {
    if(!clue) return false;
    return Math.hypot(clue.x - playerX, clue.z - playerZ) <= radius;
}
