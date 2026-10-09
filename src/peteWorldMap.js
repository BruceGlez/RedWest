// Copper Bit Gulch / Canyon Exploration Map for Outlaw 1 (Dusty Pete).
// Non-endless open-world layout with 4 distinct zones, campfires, supply crates,
// and investigation clue milestones leading to Pete's Stronghold.

import { createCampfire } from './checkpoints.js';
import { createLootCrate } from './ammoEconomy.js';

export const PETE_WORLD_ZONES = {
    mineCamp: { id: 'mineCamp', name: 'Zone A: Abandoned Mine Camp', minZ: -95, maxZ: -40 },
    railSpur: { id: 'railSpur', name: 'Zone B: Old Rail Spur & Depot', minZ: -40, maxZ: 10 },
    sunkenSaloon: { id: 'sunkenSaloon', name: 'Zone C: Sunken Saloon Ruins', minZ: 10, maxZ: 60 },
    stronghold: { id: 'stronghold', name: 'Zone D: Pete\'s Stronghold Arena', minZ: 60, maxZ: 125 }
};

export const INVESTIGATION_CLUES = [
    {
        id: 'clue-manifest',
        zone: 'mineCamp',
        title: "Miners' Payroll Manifest",
        detail: "Found inside the foreman's cabin. Proves the miners were owed $450 before Pete stole the cashbox.",
        x: 8,
        z: -50
    },
    {
        id: 'clue-ledger',
        zone: 'railSpur',
        title: "Pete's Stolen Claim Ledger",
        detail: "Tucked inside an abandoned handcar. Contains the $50 payment receipt from Meridian Land & Rail.",
        x: -12,
        z: -15
    },
    {
        id: 'clue-key',
        zone: 'sunkenSaloon',
        title: "Stronghold Gate Key",
        detail: "Carried by Pete's lookout behind the broken piano bar. Unlocks the palisade gate to the stronghold.",
        x: 0,
        z: 42
    }
];

export const WORLD_CAMPFIRES = [
    createCampfire('camp-mine', 'Mine Entrance Campfire', 'mineCamp', 0, -75),
    createCampfire('camp-depot', 'Rail Depot Campfire', 'railSpur', -5, -20),
    createCampfire('camp-saloon', 'Sunken Saloon Campfire', 'sunkenSaloon', 0, 25),
    createCampfire('camp-stronghold', 'Stronghold Gate Campfire', 'stronghold', 0, 68)
];

export const WORLD_CRATES = [
    // Zone A
    createLootCrate('crate-a1', -10, -65, { type: 'ammo', amount: 20 }),
    createLootCrate('crate-a2', 12, -55, { type: 'health', amount: 1 }),
    createLootCrate('crate-a3', -6, -45, { type: 'ammo', amount: 15 }),
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

export const ENCOUNTER_SPAWNS = [
    { id: 'patrol-1', type: 'bandit', x: -8, z: -35, zone: 'railSpur' },
    { id: 'patrol-2', type: 'bandit', x: 10, z: -25, zone: 'railSpur' },
    { id: 'patrol-3', type: 'rusher', x: -5, z: -10, zone: 'railSpur' },
    { id: 'scout-mini', type: 'brawler', x: 0, z: 38, zone: 'sunkenSaloon', isMiniBoss: true }
];

export const STRONGHOLD_GATE_Z = 74;

// Determine current zone based on player Z coordinate.
export function zoneAt(z) {
    for(const zone of Object.values(PETE_WORLD_ZONES)) {
        if(z >= zone.minZ && z < zone.maxZ) return zone;
    }
    return PETE_WORLD_ZONES.mineCamp;
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
