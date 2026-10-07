// What the Hollow Claim remembers about a player (MINE_PLAN.md, slice 2): the deepest floor reached, the checkpoint that gives, and the ore
// banked. Pure rules with no rendering, like src/town.js, so the browser wallet and the server (server/) apply exactly the same ones; on
// the server they are authoritative. It lives in the profile as `profile.mine` (src/profile.js).
//
// House rules, checked by tests/mineProgress.test.js:
// - The mine never gives stars, Bounty Dollars, score records or leaderboard entries. A mine run touches `profile.mine` and nothing else.
// - Ore is only ever found on the way down. It is not a currency in `CURRENCIES`, no product or shop item gives it, and nothing sells it
//   or a faster descent. (What ore is spent on, later, is cosmetic only and is not part of this slice.)
// - A checkpoint only lets you start lower; it never gives power or items.

import { createLightKit, normalizeLightKit, spendKit } from './mineLight.js';

export const CHECKPOINT_EVERY = 5;     // a checkpoint on floors 5, 10, 15, ...
export const MAX_FLOOR = 500;          // far past anything walkable; a bound for tampered input
export const MIN_SECONDS_PER_FLOOR = 6; // the shortest honest walk from lift to shaft (a floor is at least ~240 units)
export const MAX_ORE = 99999;          // what a profile can bank
export const FALL_KEEPS = 0;           // the share of the ore carried in a run that is kept when the marshal falls (the ride up keeps it all)

const whole = value => Math.max(0, Math.floor(Number(value)) || 0);

export function createMineProgress() {
    return { version: 1, deepest: 0, checkpoint: 0, ore: 0, runs: 0, resume: null, pile: null, light: createLightKit() }; // resume, pile: see below; light: the lantern, oil, torches and matches he owns (src/mineLight.js)
}

// The checkpoint a floor gives: the highest multiple of CHECKPOINT_EVERY that is not deeper than it (0 before the first).
export function checkpointFor(floor) {
    return Math.floor(Math.min(whole(floor), MAX_FLOOR) / CHECKPOINT_EVERY) * CHECKPOINT_EVERY;
}

// Whatever came from storage or the network. The checkpoint is always the one the deepest floor gives, so it cannot be forged.
export function normalizeMineProgress(raw) {
    const mine = createMineProgress();
    if(!raw || typeof raw !== 'object') return mine;
    mine.deepest = Math.min(whole(raw.deepest), MAX_FLOOR);
    mine.checkpoint = checkpointFor(mine.deepest);
    mine.ore = Math.min(whole(raw.ore), MAX_ORE);
    mine.runs = whole(raw.runs);
    mine.light = normalizeLightKit(raw.light);
    mine.resume = normalizeResume(raw.resume, mine.deepest);
    mine.pile = normalizePile(raw.pile, mine.deepest);
    return mine;
}

// The floors a run may begin on: the first, and every checkpoint reached.
export function startFloors(mine) {
    const floors = [1];
    for(let floor = CHECKPOINT_EVERY; floor <= mine.checkpoint; floor += CHECKPOINT_EVERY) floors.push(floor);
    return floors;
}

// The most ore one floor can hold (its chests; deeper floors are bigger and richer). A bound for the server, not a promise to the player.
export function maxOreOnFloor(floor) {
    return 6 + 3 * Math.max(1, Math.floor(Number(floor)) || 1);
}
export function maxOreForRun(startFloor, depth) {
    let total = 0;
    for(let floor = startFloor; floor <= depth; floor++) total += maxOreOnFloor(floor);
    return total;
}

// The ore a run keeps: all of it when the marshal rides the lift up, FALL_KEEPS of it when he falls.
export function oreKept(carried, outcome) {
    const ore = whole(carried);
    return outcome === 'up' ? ore : Math.floor(ore * FALL_KEEPS);
}

// A finished mine run: summary = { startFloor, depth, ore, collected (ore picked up from a death pile, optional), outcome: 'up' | 'fell', seconds, used: { oil, torches, matches } } (what the light used, src/mineLight.js).
// Changes `mine` only (the caller's profile.mine) and returns what the result screen shows. Nothing is rejected: a summary that cannot be
// true is cut down to what could be (a start floor that is not a checkpoint of his is floor 1; a depth no walk could reach, or more ore than
// the floors can hold, is cut), because the client is not trusted.
export function applyMineRun(mine, summary) {
    const outcome = summary?.outcome === 'up' ? 'up' : 'fell';
    const asked = whole(summary?.startFloor);
    const startFloor = startFloors(mine).includes(asked) ? asked : 1;
    const seconds = Number(summary?.seconds);
    const reachable = Number.isFinite(seconds) && seconds > 0 ? startFloor + Math.floor(seconds / MIN_SECONDS_PER_FLOOR) : startFloor;
    const depth = Math.min(Math.max(startFloor, whole(summary?.depth)), reachable, MAX_FLOOR);
    // Ore picked up from a death pile is carried too, but it is not found on the floors: the report names it (`collected`) and the run may carry that
    // much more than the floors hold. The caller that answers a pile collection (the server) should cap `collected` to what it handed out.
    const collected = Math.min(whole(summary?.collected), MAX_ORE);
    const carried = Math.min(whole(summary?.ore), maxOreForRun(startFloor, depth) + collected);
    const kept = oreKept(carried, outcome);
    spendKit(mine.light, summary?.used); // the oil burned and the torches and matches used: they are gone, whatever happened to the marshal
    const before = { deepest: mine.deepest, checkpoint: mine.checkpoint };
    mine.runs++;
    mine.deepest = Math.max(mine.deepest, depth);
    mine.checkpoint = checkpointFor(mine.deepest);
    mine.ore = Math.min(MAX_ORE, mine.ore + kept);
    return {
        startFloor, depth, outcome, carried, kept, lost: carried - kept,
        newDeepest: depth > before.deepest,
        newCheckpoint: mine.checkpoint > before.checkpoint ? mine.checkpoint : 0
    };
}

// ---- Slice 7: coming back up (MINE_PLAN.md). Two saved things, both in profile.mine and both bounded, because the client is not trusted. ----

export const DEATH_THROW = 5;          // floors the marshal is thrown up when he dies (never above floor 1)
export const PILE_TAKE = 0.25;         // the most of what is left a monster takes each time
export const PILE_KEEPS = 0.5;         // the share of the pile as dropped that always survives the monsters
export const MAX_RESUME_TORCHES = 200; // placed torches remembered across the whole mine

const finite = (value, limit) => Number.isFinite(Number(value)) ? Math.max(-limit, Math.min(limit, Number(value))) : 0;

// profile.mine.resume = { floor, torches: [[floor, x, z, lit], ...], clock } or null. Where the lift took him up from, the torches he left
// standing and the seconds the run had taken (so a resumed run cannot claim depth it did not walk, MIN_SECONDS_PER_FLOOR). The floor can
// never be deeper than the deepest he has reached.
export function normalizeResume(raw, deepest = MAX_FLOOR) {
    if(!raw || typeof raw !== 'object') return null;
    const floor = Math.min(whole(raw.floor), MAX_FLOOR, whole(deepest));
    if(floor < 1) return null;
    const torches = (Array.isArray(raw.torches) ? raw.torches : []).slice(0, MAX_RESUME_TORCHES)
        .map(t => Array.isArray(t) ? [Math.min(whole(t[0]), MAX_FLOOR), finite(t[1], 5000), finite(t[2], 5000), t[3] ? 1 : 0] : null)
        .filter(t => t && t[0] >= 1 && t[0] <= floor);
    return { floor, torches, clock: Math.min(whole(raw.clock), 86400) };
}

// profile.mine.pile = { floor, x, z, ore, full } or null. What he dropped where he died. `ore` is what is left; `full` is what was dropped
// (the monsters never take the pile below PILE_KEEPS of it). Ore only today; a dollars field can sit beside it later.
export function normalizePile(raw, deepest = MAX_FLOOR) {
    if(!raw || typeof raw !== 'object') return null;
    const floor = Math.min(whole(raw.floor), MAX_FLOOR, whole(deepest));
    const full = Math.min(whole(raw.full ?? raw.ore), MAX_ORE);
    const ore = Math.min(whole(raw.ore), full);
    if(floor < 1 || ore < 1) return null;
    return { floor, x: finite(raw.x, 5000), z: finite(raw.z, 5000), ore, full };
}

// Riding the lift up does not end the run: carried ore is banked (as always on the way up) and the resume point is saved.
export function applyMineResume(mine, summary) {
    const result = applyMineRun(mine, { ...summary, outcome: 'up' });
    mine.resume = normalizeResume({ floor: summary?.depth, torches: summary?.torches, clock: summary?.seconds }, mine.deepest);
    return { ...result, resume: mine.resume };
}

// Where a death throws him: DEATH_THROW floors up, never above floor 1.
export const thrownTo = floor => Math.max(1, whole(floor) - DEATH_THROW);

// He died: what he carried drops where he fell. An older pile is not lost: its remains join the new one (on the new spot).
// Light is spent as in any run and the depth he reached still counts; the resume point is cleared (he starts again from the stairs).
export function applyMineDeath(mine, summary) {
    const result = applyMineRun(mine, { ...summary, outcome: 'fell' });
    const floor = Math.min(Math.max(1, whole(summary?.depth)), mine.deepest);
    const old = mine.pile;
    const ore = Math.min(MAX_ORE, result.carried + (old ? old.ore : 0));
    mine.pile = normalizePile({ floor, x: summary?.x, z: summary?.z, ore, full: Math.min(MAX_ORE, result.carried + (old ? old.full : 0)) }, mine.deepest);
    mine.resume = null;
    return { ...result, thrownTo: thrownTo(floor), pile: mine.pile };
}

// A monster reaches the pile: it takes at most a quarter of what is left, and the pile never drops below half of what was dropped.
export function monsterTakes(pile) {
    if(!pile) return { pile: null, taken: 0 };
    const floor = Math.ceil(pile.full * PILE_KEEPS);
    const taken = Math.max(0, Math.min(Math.floor(pile.ore * PILE_TAKE), pile.ore - floor));
    return { pile: { ...pile, ore: pile.ore - taken }, taken };
}

// He walks onto the pile: it is his again, as ore carried in the run (not banked until he rides up). Only on its own floor.
export function collectPile(mine, floor) {
    if(!mine.pile || mine.pile.floor !== whole(floor)) return 0;
    const ore = mine.pile.ore;
    mine.pile = null;
    return ore;
}
