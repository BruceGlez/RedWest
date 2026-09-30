// Places in Lantern Rock you walk up to and use, besides the buildings' doors (TOWN_PLAN.md, step A). Each one is
// something walking gives that a card does not: the train out to the next hunt, the jail's cash box, the bounty board.
// Positions, verbs, wording and the small rules live here with no rendering, so they can be unit tested;
// src/townScene.js draws them and src/townPanel.js acts on them.

// object: where the prop stands (x, z) and the box it blocks (half sizes), or null when something else blocks the way.
// stand: where the marshal stands to use it; the prompt shows within reach of this point.
export const SPOTS = [
    { id: 'train', verb: 'RIDE', object: null, stand: [31, -3.7] }, // in front of the locomotive on the depot's rails
    { id: 'cashbox', verb: 'COLLECT', object: { x: -10, z: 9.6, hx: 1.25, hz: 0.85 }, stand: [-10, 11.3] }, // the jail yard
    { id: 'board', verb: 'READ', object: { x: -3.4, z: -1.6, hx: 1.7, hz: 0.5 }, stand: [-3.4, 0] } // main street
];

export const COIN_SLOTS = 8; // coins drawn in the cash box when it is full

export function getSpot(id) {
    return SPOTS.find(spot => spot.id === id) ?? null;
}

// ctx: { outlawName, stored, capacity, jobsLeft }
export function spotLabel(id, ctx = {}) {
    if(id === 'train') return ctx.outlawName ? `RIDE OUT: ${String(ctx.outlawName).toUpperCase()}` : 'RIDE OUT';
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
