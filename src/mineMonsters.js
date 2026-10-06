// What lives in the Hollow Claim, and when you meet it. A new monster on every floor: the deeper you go, the stranger the pursuit. The
// ladder interleaves the Wanted Road's own enemies with four that live only down here (cave bats, crawlers, stonekin, lantern wraiths).
// No rendering here, so the rules and tests/mineMonsters.test.js use it as it is; src/assets.js draws them and src/enemySystem.js runs them.
import { ENEMY_TYPES } from './enemyTypes.js';
import { isOpen } from './mineMap.js';

// Mine-only monsters. Behaviours are the ones the Wanted Road's enemies already have (src/enemySystem.js): a bat flits (zigzag), a
// crawler rushes (chase), stonekin charge after a shake (charger), a wraith fades and reappears beside you (phantom).
export const MINE_MONSTERS = {
    bat: {
        name: 'CAVE BAT', sense: 50, cost: 0.8, weight: 1.6, cap: 6, hp: 1, speed: 13, behavior: 'zigzag', danger: 2,
        blurb: 'Hangs from the roof until you walk under it, then flits about like a thrown rag.',
        tip: 'It never goes straight. Shoot where it will be.'
    },
    crawler: {
        name: 'CRAWLER', sense: 30, cost: 1.1, weight: 1.9, cap: 9, hp: 2, speed: 8.5, behavior: 'chase', danger: 2,
        blurb: 'A pale thing that lives in the old workings. It comes in numbers and it does not tire.',
        tip: 'Two hits each. Back up and keep your distance.'
    },
    stonekin: {
        name: 'STONEKIN', sense: 22, cost: 3.4, weight: 0.9, cap: 2, hp: 9, speed: 3.4, behavior: 'charger', danger: 3, heavy: true, hitRadius: 2.4,
        blurb: 'A man-shaped slab of the mountain. It shakes before it charges, and it cannot turn mid-charge.',
        tip: 'When it shakes, sidestep.'
    },
    wraith: {
        name: 'LANTERN WRAITH', sense: 55, cost: 2.2, weight: 1.0, cap: 3, hp: 2, speed: 7, behavior: 'phantom', danger: 3,
        blurb: 'What is left of a miner who went looking for the way up. It carries a light and it fades from sight.',
        tip: 'Bullets pass through while it is faded. Fire when it flickers back.'
    },
    // Deeper still (floors 15 to 20). These have no model of their own yet: `look` borrows an existing one (src/enemySystem.js) and the
    // behaviour is the one named. The art prompts for their own models are in MINE_PLAN.md.
    slagadder: {
        name: 'SLAG ADDER', cost: 1.0, weight: 1.6, cap: 7, hp: 2, speed: 13.5, behavior: 'zigzag', danger: 2, look: 'rattler', hitRadius: 1.5,
        blurb: 'A snake that crawled into the smelter and came out glowing. It strikes from side to side.',
        tip: 'It takes two hits. Back up and shoot where it will be.'
    },
    slaglobber: {
        name: 'SLAG LOBBER', cost: 2.4, weight: 1.1, cap: 2, hp: 3, speed: 5, behavior: 'lobber', danger: 3, look: 'dynamiter',
        blurb: 'A blaster who never left the face. He throws lit charges from the dark.',
        tip: 'Leave the ring before the fuse runs out.'
    },
    sentry: {
        name: 'CAIRN SENTRY', cost: 2.6, weight: 1.0, cap: 2, hp: 3, speed: 4, behavior: 'sniper', danger: 3, look: 'rifleman',
        blurb: 'A watcher posted at the old gallery. The red line shows where it will fire.',
        tip: 'Step off the line before the shot.'
    },
    hollowhide: {
        name: 'HOLLOWHIDE', cost: 3.8, weight: 0.8, cap: 2, hp: 11, speed: 3.4, behavior: 'charger', danger: 3, heavy: true, hitRadius: 2.4, look: 'stonekin',
        blurb: 'The mountain\'s own weight, walking. It shakes, then comes straight through whatever is in the way.',
        tip: 'When it shakes, sidestep. It cannot turn mid-charge.'
    },
    choir: {
        name: 'PALE CHOIR', cost: 2.8, weight: 1.0, cap: 3, hp: 3, speed: 5.5, behavior: 'volley', danger: 3, look: 'trooper',
        blurb: 'Miners who still sing the shift change, and fire on every beat.',
        tip: 'Close in between bursts: they reload before the next.'
    },
    ghoul: {
        name: 'GALLERY GHOUL', cost: 2.4, weight: 1.1, cap: 3, hp: 3, speed: 7.5, behavior: 'phantom', danger: 3, look: 'ghost',
        blurb: 'It fades into the timbers of the gallery and steps out beside you.',
        tip: 'Bullets pass through while it is faded. Fire when it flickers back.'
    }
};

// What is new on each floor (index = floor - 1). Floor 1 is the Wanted Road's three first enemies; every floor below brings one more.
export const MINE_LADDER = [
    [], ['bat'], ['rattler'], ['crawler'], ['rifleman'], ['dynamiter'], ['stonekin'], ['brute'], ['wraith'], ['rider'], ['duelist'], ['ghost'], ['knifer'], ['trooper'],
    ['slagadder'], ['slaglobber'], ['sentry'], ['hollowhide'], ['choir'], ['ghoul']
];
export const BASE_ROSTER = ['bandit', 'wolf', 'gunslinger'];

// ---------- how far each one senses the marshal ----------
// A monster is asleep until the marshal comes within its sense radius (src/combatMath.js, senseStep) and gives up past its leash. The radius
// is the monster's own, `sense` on its entry, or the usual one for how it fights: a sniper sees a long way, a slab of stone wakes late.
// Units are the cave's (a chamber is 22 to 30 wide and a tunnel about 20). Every number is a guess to tune by playing.
export const SENSE_BY_BEHAVIOR = { chase: 36, zigzag: 34, charger: 26, phantom: 44, sniper: 60, shooter: 48, lobber: 46, rider: 44, scattergun: 38, knives: 40, volley: 48 };
export const MIN_SENSE = 18, MAX_SENSE = 70;
export const senseRadius = id => {
    const def = monsterDef(id);
    return Math.max(MIN_SENSE, Math.min(MAX_SENSE, def?.sense ?? SENSE_BY_BEHAVIOR[def?.behavior] ?? 36));
};
// How far the marshal must get before it gives up and goes back: twice the radius, and never less than 40 beyond it.
export const leashRadius = id => Math.max(senseRadius(id) * 2, senseRadius(id) + 40);

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

// What a floor holds: how much danger (the sum of the costs of the monsters) a chamber of the standard size has, and how often each kind
// comes. New monsters come more often on their own floor.
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
        weights, caps
    };
}

// Tougher below the Wanted Road's own ladder: one more hit for anything that takes more than one, every few floors past the eighth.
export function mineHpBonus(floor) {
    return Math.max(0, Math.floor((Math.floor(floor) - 5) / 4));
}

// ---------- who lives where ----------
// Each chamber, alcove and treasure room has its own monsters. They are there when the marshal comes near (WAKE_DISTANCE from its edge),
// and they do not come back while he stays: kill them and the chamber is quiet. When he has gone far away (LEAVE_DISTANCE) the survivors
// go back to sleep and the chamber fills again for the next time he comes. So there is no endless stream, and nowhere is ever cleared for good.
export const WAKE_DISTANCE = 45;
export const LEAVE_DISTANCE = 100;
const SAFE_LANDING = 20; // nobody is put closer than this to the lift

// How much danger a chamber holds: more in a bigger one, more in a treasure room (it is guarded), less in an alcove, and little around the
// lift, where the marshal arrives.
export function nodeBudget(layout, index, floor) {
    const node = layout.nodes[index];
    const size = (node.r / 30) ** 2;
    const kind = node.kind === 'room' ? 1.3 : node.kind === 'alcove' ? 0.5 : 1;
    const landing = index === 0 ? 0.35 : 1;
    return mineWave(floor).threatCap * 0.55 * size * kind * landing;
}

// The monsters to put in one chamber, as [{ type, x, z }]: the budget spent on kinds of the floor's roster by its weights and caps, each
// at one of the chamber's open mouths.
export function planNode(layout, index, floor, rand = Math.random) {
    const wave = mineWave(floor);
    const sites = layout.spawns.filter(([x, z, node]) => node === index && Math.hypot(x, z) >= SAFE_LANDING);
    if(!sites.length) return [];
    let remaining = nodeBudget(layout, index, floor);
    const placed = [];
    const count = {};
    for(let guard = 0; guard < 60; guard++) {
        const candidates = Object.keys(wave.weights).filter(id => monsterCost(id) <= remaining && (count[id] || 0) < wave.caps[id]);
        if(!candidates.length) break;
        let roll = rand() * candidates.reduce((sum, id) => sum + wave.weights[id], 0);
        let type = candidates[candidates.length - 1];
        for(const id of candidates) { roll -= wave.weights[id]; if(roll <= 0) { type = id; break; } }
        const [sx, sz] = sites[Math.floor(rand() * sites.length)];
        let x = sx, z = sz;
        for(let attempt = 0; attempt < 4; attempt++) { // a little scatter, never into the rock
            const tx = sx + (rand() - 0.5) * 6, tz = sz + (rand() - 0.5) * 6;
            if(isOpen(layout, tx, tz, 4)) { x = tx; z = tz; break; }
        }
        placed.push({ type, x, z });
        count[type] = (count[type] || 0) + 1;
        remaining -= monsterCost(type);
    }
    return placed;
}
