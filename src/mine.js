// The Hollow Claim: the mine under the undertaker's cellar (MINE_PLAN.md). A run of numbered floors; each floor is a fight, and
// clearing it opens the shaft down. Slice 1 is practice only (nothing is saved), like the Arena (src/arena.js).
// The rules live here with no rendering, so they can be unit tested; src/gameLoop.js plays a floor and src/townPanel.js starts the run.

export const MINE_FLOORS = 5; // slice 1: floors 1 to 5, then the lift back up
export const MINE_ATMOSPHERE_ID = 'mine'; // the look of the mine (src/atmosphere.js), not one of the outlaws' stages

export const mine = {
    enabled: false, // the run being started or played is a mine run
    floor: 1,       // the floor being fought
    shaftDx: 0,     // where the open shaft is from the marshal (src/gameLoop.js keeps these up to date), for the HUD
    shaftDz: 0
};

// Start a run at the first floor. endMineRun() puts the game back to the Wanted Road's rules.
export function beginMineRun() {
    mine.enabled = true;
    mine.floor = 1;
    mine.shaftDx = mine.shaftDz = 0;
}

export function endMineRun() {
    if(!mine.enabled) return false;
    mine.enabled = false;
    mine.floor = 1;
    mine.shaftDx = mine.shaftDz = 0;
    return true;
}

// Floor n has the enemies and the difficulty of stage n (the ladder of src/enemyTypes.js and src/outlaws.js), so every floor
// down brings the next new enemy. The stage is an index into OUTLAWS, which is how the director and the enemies' stats look it up.
export function floorStage(floor) {
    return Math.max(0, Math.floor(floor) - 1);
}

// The pursuit number the wave director uses for a floor: it grows the budget and the caps with depth.
export function floorWave(floor) {
    return Math.max(1, Math.floor(floor)) + 1;
}

// A floor is cleared when the director has nothing left to send and nobody is left standing.
export function floorCleared({ budgetRemaining, enemyCount, minCost }) {
    return !(budgetRemaining >= minCost) && enemyCount <= 0;
}

export const isLastFloor = floor => floor >= MINE_FLOORS;

export function floorTitle(floor) {
    return `FLOOR ${floor} / ${MINE_FLOORS}`;
}

// The prompt on the cellar hatch in town.
export function hatchLabel() {
    return 'THE HOLLOW CLAIM: FLOOR 1';
}

export function floorBanner(floor) {
    return `${floorTitle(floor)}\nTHE HOLLOW CLAIM`;
}

export function clearedBanner(floor) {
    return isLastFloor(floor) ? 'THE LAST FLOOR IS CLEAR\nTHE LIFT UP IS OPEN: WALK TO IT' : `FLOOR ${floor} CLEARED\nTHE SHAFT DOWN IS OPEN: WALK TO IT`;
}

// Up on the screen is north (into the map), so an arrow for where the shaft is: 8 ways, from the offset (dx, dz) to it.
const ARROWS = ['\u2191', '\u2197', '\u2192', '\u2198', '\u2193', '\u2199', '\u2190', '\u2196'];
export function shaftArrow(dx, dz) {
    const angle = Math.atan2(dx, -dz); // 0 = up the screen, turning clockwise
    return ARROWS[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
}

// What the HUD says while the shaft is open: how far, and which way.
export function shaftHint(dx, dz) {
    return `SHAFT ${Math.round(Math.hypot(dx, dz))} m ${shaftArrow(dx, dz)}`;
}

// What the result screen says when the run ends: how far you got.
export function resultText(result, floor) {
    if(result === 'mine-win') return ['LIFT UP', `You cleared all ${MINE_FLOORS} floors of the Hollow Claim and rode the lift back up.`];
    return ['WASTED', `You fell on floor ${floor} of ${MINE_FLOORS}.`];
}

export const PRACTICE_NOTE = 'The Hollow Claim: practice only, nothing is saved yet.';
