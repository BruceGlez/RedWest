// What lives in the Hollow Claim, and when you meet it. A new monster on every floor: the deeper you go, the stranger the pursuit. The
// ladder interleaves the Wanted Road's own enemies with four that live only down here (cave bats, crawlers, stonekin, lantern wraiths).
// No rendering here, so the rules and tests/mineMonsters.test.js use it as it is; src/assets.js draws them and src/enemySystem.js runs them.
import { ENEMY_TYPES } from './enemyTypes.js';

// Mine-only monsters. Behaviours are the ones the Wanted Road's enemies already have (src/enemySystem.js): a bat flits (zigzag), a
// crawler rushes (chase), stonekin charge after a shake (charger), a wraith fades and reappears beside you (phantom).
export const MINE_MONSTERS = {
    bat: {
        name: 'CAVE BAT', cost: 0.8, weight: 1.6, cap: 6, hp: 1, speed: 13, behavior: 'zigzag', danger: 2,
        blurb: 'Hangs from the roof until you walk under it, then flits about like a thrown rag.',
        tip: 'It never goes straight. Shoot where it will be.'
    },
    crawler: {
        name: 'CRAWLER', cost: 1.1, weight: 1.9, cap: 9, hp: 2, speed: 8.5, behavior: 'chase', danger: 2,
        blurb: 'A pale thing that lives in the old workings. It comes in numbers and it does not tire.',
        tip: 'Two hits each. Back up and keep your distance.'
    },
    stonekin: {
        name: 'STONEKIN', cost: 3.4, weight: 0.9, cap: 2, hp: 9, speed: 3.4, behavior: 'charger', danger: 3, heavy: true, hitRadius: 2.4,
        blurb: 'A man-shaped slab of the mountain. It shakes before it charges, and it cannot turn mid-charge.',
        tip: 'When it shakes, sidestep.'
    },
    wraith: {
        name: 'LANTERN WRAITH', cost: 2.2, weight: 1.0, cap: 3, hp: 2, speed: 7, behavior: 'phantom', danger: 3,
        blurb: 'What is left of a miner who went looking for the way up. It carries a light and it fades from sight.',
        tip: 'Bullets pass through while it is faded. Fire when it flickers back.'
    }
};

// What is new on each floor (index = floor - 1). Floor 1 is the Wanted Road's three first enemies; every floor below brings one more.
export const MINE_LADDER = [
    [], ['bat'], ['rattler'], ['crawler'], ['rifleman'], ['dynamiter'], ['stonekin'], ['brute'], ['wraith'], ['rider'], ['duelist'], ['ghost'], ['knifer'], ['trooper']
];
export const BASE_ROSTER = ['bandit', 'wolf', 'gunslinger'];

export const monsterDef = id => ENEMY_TYPES[id] ?? MINE_MONSTERS[id] ?? null;
export const isMineMonster = id => id in MINE_MONSTERS;
export const monsterCost = id => monsterDef(id)?.cost ?? 1;

// What first appears on this floor (usually one), and everything that can appear on it.
export function newOn(floor) {
    return MINE_LADDER[Math.max(1, Math.floor(floor)) - 1] ?? [];
}
export function mineRoster(floor) {
    const depth = Math.max(1, Math.floor(floor));
    return [...BASE_ROSTER, ...MINE_LADDER.slice(0, depth).flat()];
}

// How the pursuit is run on a floor: not in waves but all the time. `threatCap` is how much danger (the sum of the costs of
// everyone chasing) the cave keeps around the marshal; `interval` is how often it tops that up. New monsters come more often.
export function mineWave(floor) {
    const depth = Math.max(1, Math.floor(floor));
    const fresh = new Set(newOn(depth));
    const weights = {}, caps = {};
    for(const id of mineRoster(depth)) {
        const def = monsterDef(id);
        let weight = def.weight;
        if(id === 'bandit') weight = Math.max(0.8, 2.4 - depth * 0.14);
        if(id === 'wolf') weight = Math.min(2.0, 0.8 + depth * 0.12);
        if(id === 'gunslinger') weight = Math.min(2.0, 0.3 + depth * 0.16);
        weights[id] = weight * (fresh.has(id) ? 2.4 : 1);
        caps[id] = Math.max(1, Math.min(def.cap * 2, Math.round(def.cap * (0.7 + depth * 0.07))));
    }
    return {
        threatCap: Math.min(110, 13 + depth * 5),
        interval: Math.max(0.55, 1.5 - depth * 0.06),
        weights, caps
    };
}

// Tougher below the Wanted Road's own ladder: one more hit for anything that takes more than one, every few floors past the eighth.
export function mineHpBonus(floor) {
    return Math.max(0, Math.floor((Math.floor(floor) - 5) / 4));
}
