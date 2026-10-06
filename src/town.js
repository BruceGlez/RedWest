import { OUTLAWS } from './outlaws.js';
import { EconomyError } from './economyError.js';
import { createFarm, normalizeFarm } from './farm.js';
import { createOrders, normalizeOrders } from './farmOrders.js';
import { createSaloon, normalizeSaloon } from './saloon.js';
import { createChapel, normalizeChapel } from './vigil.js';

// Frontier Town (GROWTH_PLAN.md, Phase 1.1): buildings between runs.
// - The Jail holds every outlaw you have beaten; they pay a bounty each hour, collected when you
//   come back. It stores a limited number of hours, so checking in once or twice a day gets it all.
// - Upgrades cost earned Bounty Dollars only and finish at once: no build timers, so nothing to sell
//   as a speed-up. Buildings only change income, never combat (tests/town.test.js checks this).

// Every effect a building level may have. Anything that touches a fight must never be added here.
export const TOWN_EFFECTS = ['jailRate', 'jailHours', 'jobRewards', 'runCap'];

export const BUILDINGS = [
    {
        id: 'jail', name: 'JAIL', blurb: 'Every outlaw you beat sits here and pays a bounty each hour.',
        levels: [
            { cost: 0, effects: { jailRate: 1.0, jailHours: 8 } },
            { cost: 300, effects: { jailRate: 1.1, jailHours: 9 } },
            { cost: 700, effects: { jailRate: 1.2, jailHours: 10 } },
            { cost: 1200, effects: { jailRate: 1.3, jailHours: 11 } },
            { cost: 2000, effects: { jailRate: 1.4, jailHours: 12 } }
        ]
    },
    {
        id: 'sheriff', name: "SHERIFF'S OFFICE", blurb: 'Posts the daily jobs. Upgrades raise what jobs pay.',
        levels: [
            { cost: 0, effects: { jobRewards: 1.0 } },
            { cost: 500, effects: { jobRewards: 1.15 } },
            { cost: 1200, effects: { jobRewards: 1.3 } }
        ]
    },
    {
        id: 'bank', name: 'BANK', blurb: 'Keeps your bounty money. Upgrades raise how much one run can pay out.',
        levels: [
            { cost: 0, effects: { runCap: 600 } },
            { cost: 800, effects: { runCap: 750 } },
            { cost: 1800, effects: { runCap: 900 } }
        ]
    },
    { id: 'gunsmith', name: 'GUNSMITH', blurb: 'Sells side-arms and long guns.', opens: 'primary', levels: [{ cost: 0, effects: {} }] },
    { id: 'tailor', name: 'TAILOR', blurb: 'Hats, coats, pants and bullet colours.', opens: 'hat', levels: [{ cost: 0, effects: {} }] }
];

const BY_ID = new Map(BUILDINGS.map(b => [b.id, b]));
const HOUR = 3600000;

export function getBuilding(id) {
    return BY_ID.get(id) ?? null;
}

export function createTown(now = new Date()) {
    return { levels: Object.fromEntries(BUILDINGS.map(b => [b.id, 1])), jailCollectedAt: now.toISOString(), farm: createFarm(now), orders: createOrders(now), saloon: createSaloon(now), chapel: createChapel(now) };
}

export function normalizeTown(raw, now = new Date()) {
    const town = createTown(now);
    if(!raw || typeof raw !== 'object') return town;
    for(const b of BUILDINGS) {
        const level = Math.floor(Number(raw.levels?.[b.id]));
        if(level >= 1) town.levels[b.id] = Math.min(level, b.levels.length);
    }
    const collected = Date.parse(raw.jailCollectedAt);
    if(Number.isFinite(collected)) town.jailCollectedAt = new Date(collected).toISOString();
    town.farm = normalizeFarm(raw.farm, now); // Calloway Farm (src/farm.js)
    town.orders = normalizeOrders(raw.orders, now); // Vane's Crossing (src/farmOrders.js)
    town.saloon = normalizeSaloon(raw.saloon, now); // Copper Bit (src/saloon.js)
    town.chapel = normalizeChapel(raw.chapel, now); // Hollow Hill's vigil (src/vigil.js)
    return town;
}

export function buildingEffects(town, id) {
    const b = getBuilding(id);
    return b.levels[(town.levels[id] || 1) - 1].effects;
}

// Outlaws beaten (first star) on this account.
export function jailedOutlaws(profile) {
    return OUTLAWS.filter((_, i) => profile.stats.stageStars[i] & 1);
}

// Bounty Dollars per hour: a twentieth of each jailed outlaw's bounty, raised by Jail upgrades. With all ten
// that is $108 an hour, so a full 8-hour jail is worth about one top run (balance pass, GROWTH_PLAN.md).
export const JAIL_BOUNTY_SHARE = 1 / 20;
export function jailRate(profile) {
    const base = jailedOutlaws(profile).reduce((sum, outlaw) => sum + outlaw.bounty, 0) * JAIL_BOUNTY_SHARE;
    return Math.round(base * buildingEffects(profile.town, 'jail').jailRate);
}

export function jailCapacity(profile) {
    return jailRate(profile) * buildingEffects(profile.town, 'jail').jailHours;
}

// What is waiting in the jail now. A clock that moved backwards counts as no time passing.
export function jailStored(profile, now = new Date()) {
    const hours = Math.max(0, (now.getTime() - Date.parse(profile.town.jailCollectedAt)) / HOUR);
    return Math.min(jailCapacity(profile), Math.floor(jailRate(profile) * hours));
}

// Hours until the jail is full (0 when full or earning nothing).
export function hoursUntilFull(profile, now = new Date()) {
    const rate = jailRate(profile);
    if(!rate) return 0;
    return Math.max(0, (jailCapacity(profile) - jailStored(profile, now)) / rate);
}

export function collectJail(profile, now = new Date()) {
    const dollars = jailStored(profile, now);
    // Also resets a clock set in the future, so moving it forward and back again gains nothing.
    profile.town.jailCollectedAt = now.toISOString();
    profile.balances.dollars += dollars;
    return dollars;
}

export function upgradeCost(profile, id) {
    const b = getBuilding(id);
    if(!b) return null;
    const next = b.levels[profile.town.levels[id]];
    return next ? next.cost : null;
}

export function upgradeBuilding(profile, id, now = new Date()) {
    const b = getBuilding(id);
    if(!b) throw new EconomyError('unknown_building', 'That building does not exist.');
    const cost = upgradeCost(profile, id);
    if(cost === null) throw new EconomyError('max_level', 'Already at the top level.');
    if(profile.balances.dollars < cost) throw new EconomyError('funds', 'Not enough bounty dollars.');
    // The Jail keeps what it stored at the old rate: collect first so an upgrade never loses income.
    if(id === 'jail') collectJail(profile, now);
    profile.balances.dollars -= cost;
    profile.town.levels[id]++;
    return profile.town.levels[id];
}
