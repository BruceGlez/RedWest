// Places in Lantern Rock you walk up to and use, besides the buildings' doors (TOWN_PLAN.md, step A). Each one is
// something walking gives that a card does not: the train out to the next hunt, the jail's cash box, the bounty board.
// Positions, verbs, wording and the small rules live here with no rendering, so they can be unit tested;
// src/townScene.js draws them and src/townPanel.js acts on them.

// object: where the prop stands (x, z) and the box it blocks (half sizes), or null when something else blocks the way.
// stand: where the marshal stands to use it; the prompt shows within reach of this point.
import { near, spread } from './townSpace.js';

// Each stands where it was designed against its building (the train in front of the depot, the cash box in the jail yard) and
// moves with that building; the board stands in main street and spreads with the town (src/townSpace.js).
const train = near('depot', 31, -3.7);
const cash = near('jail', -10, 9.6);
const cashStand = near('jail', -10, 11.3);
const platform = near('depot', 39.5, -3.5);
const platformStand = near('depot', 37, -3);
const board = spread(-3.4, -1.6);
const boardStand = spread(-3.4, 0);
export const SPOTS = [
    { id: 'train', verb: 'RIDE', object: null, stand: train }, // in front of the locomotive on the depot's rails
    { id: 'platform', verb: 'RIDE', object: { x: platform[0], z: platform[1], hx: 0.3, hz: 0.3 }, stand: platformStand }, // the town train's stop, beside the depot's rails
    { id: 'cashbox', verb: 'COLLECT', object: { x: cash[0], z: cash[1], hx: 1.25, hz: 0.85 }, stand: cashStand }, // the jail yard
    { id: 'board', verb: 'READ', object: { x: board[0], z: board[1], hx: 1.7, hz: 0.5 }, stand: boardStand } // main street
];

export const COIN_SLOTS = 8; // coins drawn in the cash box when it is full

export function getSpot(id) {
    return SPOTS.find(spot => spot.id === id) ?? null;
}

// ctx: { outlawName, stored, capacity, jobsLeft }
export function spotLabel(id, ctx = {}) {
    if(id === 'train') return ctx.outlawName ? `RIDE OUT: ${String(ctx.outlawName).toUpperCase()}` : 'RIDE OUT';
    if(id === 'platform') return 'THE TOWN TRAIN';
    if(id === 'cashbox') return ctx.stored > 0 ? `COLLECT $${Math.round(ctx.stored).toLocaleString()}` : 'JAIL CASH BOX';
    if(id === 'board') return ctx.jobsLeft > 0 ? `BOUNTY BOARD: ${ctx.jobsLeft} LEFT` : 'BOUNTY BOARD';
    return '';
}

// How many coins show in the cash box: none when empty, at least one as soon as there is anything, all when full.
export function coinCount(stored, capacity) {
    if(!(stored > 0) || !(capacity > 0)) return 0;
    return Math.max(1, Math.min(COIN_SLOTS, Math.ceil((stored / capacity) * COIN_SLOTS)));
}

export function cashBoxFull(stored, capacity) {
    return stored > 0 && capacity > 0 && stored >= capacity;
}

// Notes pinned on the board: one for each job not yet done today.
export const BOARD_NOTES = 3;
export function boardNotes(jobsLeft) {
    return Math.max(0, Math.min(BOARD_NOTES, Math.floor(jobsLeft) || 0));
}

export function jobsLeft(profile) {
    return (profile?.jobs?.list ?? []).filter(entry => !entry.done).length;
}
