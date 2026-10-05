// The Hollow Claim: the mine under the undertaker's cellar (MINE_PLAN.md). Fate-style: a descent with no bottom. Every floor is a bigger
// cave than the last (src/mineMap.js) with a new kind of monster in it (src/mineMonsters.js), a chest or two off the main road, a shaft
// down that is always open, and the lift you came down on, which brings you back up. Practice rules for now: nothing is saved
// (the Arena's rule, src/arena.js). The rules live here with no rendering, so they can be unit tested; src/gameLoop.js plays a floor and
// src/townPanel.js starts the run.
import { floorName } from './mineMap.js';
import { maxOreOnFloor, startFloors } from './mineProgress.js';

export const MINE_ATMOSPHERE_ID = 'mine'; // the look of the mine (src/atmosphere.js), not one of the outlaws' stages

export const mine = {
    enabled: false, // the run being started or played is a mine run
    floor: 1,       // the depth being fought
    startFloor: 1,  // the floor the run began on (floor 1, or a checkpoint of his: src/mineProgress.js)
    ore: 0,         // the ore carried in this run: kept if he rides the lift up, lost if he falls
    shaftDx: 0,     // where the shaft down and the lift up are from the marshal (src/gameLoop.js keeps these up to date), for the HUD
    shaftDz: 0,
    liftDx: 0,
    liftDz: 0,
    liftArmed: false, // the lift only works once the marshal has walked away from it (he arrives standing on it)
    opened: [],       // the chests opened on this floor
    confirm: null,    // 'down' or 'up' while the game is asking whether to take the shaft or the lift
    blocked: null     // 'down' or 'up' after the answer was no: it is not asked again until the marshal has stepped away
};

function reset() {
    mine.floor = 1;
    mine.startFloor = 1;
    mine.ore = 0;
    mine.shaftDx = mine.shaftDz = mine.liftDx = mine.liftDz = 0;
    mine.liftArmed = false;
    mine.opened = [];
    mine.confirm = null;
    mine.blocked = null;
}

// Start a run on the first floor, or on a checkpoint he has reached (`record` is profile.mine). endMineRun() puts the game back to the Wanted
// Road's rules.
export function beginMineRun(floor = 1, record = null) {
    mine.enabled = true;
    reset();
    const start = startFloors(record ?? { checkpoint: 0 }).includes(Math.floor(floor)) ? Math.floor(floor) : 1;
    mine.floor = mine.startFloor = start;
}

export function endMineRun() {
    if(!mine.enabled) return false;
    mine.enabled = false;
    reset();
    return true;
}

// Going down a floor: the new floor's lift and chests are fresh.
export function nextFloor() {
    mine.floor += 1;
    mine.liftArmed = false;
    mine.opened = [];
    mine.confirm = null;
    mine.blocked = null;
    return mine.floor;
}

// How hard the Wanted Road's own numbers (src/outlaws.js) are on this floor: its stage, which stops at the last outlaw's. Past that
// the pursuit grows by what lives in the cave (src/mineMonsters.js), not by the stats of each one.
export function floorStage(floor) {
    return Math.min(9, Math.max(0, Math.floor(floor) - 1));
}

// The pursuit number the stats use for a floor (speed grows a little with it).
export function floorWave(floor) {
    return Math.max(1, Math.floor(floor)) + 1;
}

export function floorTitle(floor) {
    return `DEPTH ${floor}`;
}

export function floorBanner(floor) {
    return `${floorTitle(floor)}\n${floorName(floor)}`;
}

// What the descent pays: a little score for every floor gone down, more the deeper it is.
export const descentScore = floor => 50 * Math.max(1, Math.floor(floor));

// The ore in one chest: the floor's share, so that opening every chest on it never gives more than the floor can hold (maxOreOnFloor).
export function oreInChest(floor, chestsOnFloor) {
    return Math.max(1, Math.floor(maxOreOnFloor(floor) / Math.max(1, chestsOnFloor)));
}

// What a chest gives: score by depth, and a heart if the marshal is hurt, else a spell of triple shot.
export function chestReward(floor, hp, maxHp) {
    const heal = hp < maxHp;
    return { score: 100 * Math.max(1, Math.floor(floor)), heal, tripleShot: !heal };
}

// Up on the screen is north (into the map), so an arrow for where something is: 8 ways, from the offset (dx, dz) to it.
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
export function shaftArrow(dx, dz) {
    const angle = Math.atan2(dx, -dz); // 0 = up the screen, turning clockwise
    return ARROWS[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
}

const meters = (dx, dz) => `${Math.round(Math.hypot(dx, dz))} m ${shaftArrow(dx, dz)}`;

// What the HUD says: how far the way down is, and which way; and, under it, the way up.
export function shaftHint(dx, dz) {
    return `SHAFT ${meters(dx, dz)}`;
}
export function liftHint(dx, dz) {
    return `LIFT UP ${meters(dx, dz)}`;
}

// What the mine asks at the shaft and at the lift. Nothing happens until the answer is yes.
export function confirmText(kind, floor) {
    if(kind === 'up') return { title: 'RIDE THE LIFT UP?', text: `Ride back up from depth ${floor}. This ends the run, and the monsters stay where they are.`, yes: 'RIDE UP', no: 'STAY' };
    return { title: 'GO DOWN?', text: `Take the shaft down to depth ${floor + 1}. Everything on this floor stays behind.`, yes: 'DESCEND', no: 'STAY' };
}

// What the result screen says when the run ends: how deep you got.
export function resultText(result, floor, ore = 0) {
    const carried = ore ? ` ${ore} ore` : '';
    if(result === 'mine-win') return ['LIFT UP', `You rode the lift back up from depth ${floor}${ore ? ` with${carried}` : ''}.`];
    return ['WASTED', `You fell on depth ${floor}${ore ? ` and lost${carried}` : ''}.`];
}

// What the run reports when it ends (src/mineProgress.js, applyMineRun): where it began, how deep, the ore carried, and how it ended.
export function runSummary(result, seconds) {
    return { startFloor: mine.startFloor, depth: mine.floor, ore: mine.ore, outcome: result === 'mine-win' ? 'up' : 'fell', seconds: Math.max(0, Math.round(seconds)) };
}

// The line under the result once the run is saved (`outcome` is what applyMineRun returned).
export function savedText(outcome) {
    const parts = [outcome.newDeepest ? `New deepest floor: ${outcome.depth}.` : `Deepest floor kept.`];
    if(outcome.newCheckpoint) parts.push(`Checkpoint: floor ${outcome.newCheckpoint}.`);
    if(outcome.carried) parts.push(outcome.kept ? `${outcome.kept} ore banked.` : `${outcome.lost} ore lost in the fall.`);
    return `The Hollow Claim gives no stars and no money. ${parts.join(' ')}`;
}

export const PRACTICE_NOTE = 'The Hollow Claim gives no stars and no money. Saving your deepest floor...';
export const SAVE_FAILED_NOTE = 'The Hollow Claim gives no stars and no money. Your deepest floor could not be saved this time.';

// The HUD line for the lift, with the ore carried.
export const statusText = (dx, dz, ore) => ore ? `${liftHint(dx, dz)}  ORE ${ore}` : liftHint(dx, dz);
