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
    return { version: 1, deepest: 0, checkpoint: 0, ore: 0, runs: 0, light: createLightKit() }; // light: the lantern, oil, torches and matches he owns (src/mineLight.js)
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

// A finished mine run: summary = { startFloor, depth, ore, outcome: 'up' | 'fell', seconds, used: { oil, torches, matches } } (what the light used, src/mineLight.js).
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
    const carried = Math.min(whole(summary?.ore), maxOreForRun(startFloor, depth));
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
