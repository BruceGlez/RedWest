import test from 'node:test';
import assert from 'node:assert/strict';
import { mine, beginMineRun, endMineRun, MINE_FLOORS, MINE_ATMOSPHERE_ID, floorStage, floorWave, floorCleared, isLastFloor,
    floorTitle, hatchLabel, floorBanner, clearedBanner, resultText, shaftArrow, shaftHint } from '../src/mine.js';
import { OUTLAWS, outlawDifficulty } from '../src/outlaws.js';
import { rosterFor, featuredFor } from '../src/enemyTypes.js';
import { atmosphereFor, soundFor, MINE_ATMOSPHERE, ATMOSPHERES } from '../src/atmosphere.js';
import { SURFACES, BEDS } from '../src/soundscape.js';

test('a mine run starts at floor 1 and ends back on the Wanted Road rules', () => {
    assert.equal(mine.enabled, false);
    beginMineRun();
    assert.deepEqual({ ...mine }, { enabled: true, floor: 1, shaftDx: 0, shaftDz: 0 });
    mine.floor = 4;
    assert.equal(endMineRun(), true);
    assert.deepEqual({ ...mine }, { enabled: false, floor: 1, shaftDx: 0, shaftDz: 0 });
    assert.equal(endMineRun(), false, 'nothing to end the second time');
});

test('five floors, each down a stage deeper and a pursuit harder', () => {
    assert.equal(MINE_FLOORS, 5);
    assert.deepEqual([1, 2, 3, 4, 5].map(floorStage), [0, 1, 2, 3, 4]);
    assert.deepEqual([1, 2, 3, 4, 5].map(floorWave), [2, 3, 4, 5, 6]);
    for(let floor = 1; floor <= MINE_FLOORS; floor++) assert.ok(floorStage(floor) < OUTLAWS.length, `floor ${floor} maps to a real stage`);
    assert.equal(floorStage(0), 0);
    assert.equal(floorWave(0), 2);
});

test('every floor below the first brings a new enemy, and the difficulty grows with depth', () => {
    for(let floor = 2; floor <= MINE_FLOORS; floor++) {
        assert.ok(featuredFor(floorStage(floor)), `floor ${floor} features an enemy`);
        assert.ok(rosterFor(floorStage(floor)).length > rosterFor(floorStage(floor - 1)).length, `floor ${floor} adds to the roster`);
        assert.ok(outlawDifficulty(floorStage(floor)).budget > outlawDifficulty(floorStage(floor - 1)).budget, `floor ${floor} sends more`);
    }
});

test('a floor is cleared only when nothing is left to send and nobody is standing', () => {
    assert.equal(floorCleared({ budgetRemaining: 0.2, enemyCount: 0, minCost: 0.8 }), true);
    assert.equal(floorCleared({ budgetRemaining: 0.2, enemyCount: 3, minCost: 0.8 }), false, 'enemies left');
    assert.equal(floorCleared({ budgetRemaining: 5, enemyCount: 0, minCost: 0.8 }), false, 'more still to come');
    assert.equal(floorCleared({ budgetRemaining: -1, enemyCount: 0, minCost: 0.8 }), true, 'a spent budget can go below zero');
    assert.equal(floorCleared({ budgetRemaining: 0.8, enemyCount: 0, minCost: 0.8 }), false, 'exactly the cheapest enemy is still a spawn');
});

test('only the last floor ends the run', () => {
    assert.equal(isLastFloor(MINE_FLOORS - 1), false);
    assert.equal(isLastFloor(MINE_FLOORS), true);
});

test('the words on screen name the floor and the way out', () => {
    assert.equal(floorTitle(2), 'FLOOR 2 / 5');
    assert.equal(hatchLabel(), 'THE HOLLOW CLAIM: FLOOR 1');
    assert.match(floorBanner(3), /FLOOR 3 \/ 5/);
    assert.match(clearedBanner(1), /FLOOR 1 CLEARED/);
    assert.match(clearedBanner(MINE_FLOORS), /LAST FLOOR/);
    assert.match(clearedBanner(2), /WALK TO IT/);
    assert.deepEqual(resultText('mine-win', 5)[0], 'LIFT UP');
    assert.deepEqual(resultText('died', 3), ['WASTED', 'You fell on floor 3 of 5.']);
});

test('the mine has its own look and sound, apart from the outlaws\' stages', () => {
    assert.equal(atmosphereFor(MINE_ATMOSPHERE_ID), MINE_ATMOSPHERE);
    assert.ok(!(MINE_ATMOSPHERE_ID in ATMOSPHERES), 'not an outlaw stage');
    assert.ok(SURFACES[soundFor(MINE_ATMOSPHERE_ID).surface] && BEDS[soundFor(MINE_ATMOSPHERE_ID).bed], 'a known footstep surface and bed');
});

test('the HUD points to the open shaft: up the screen is north, into the map', () => {
    assert.equal(shaftArrow(0, -10), '\u2191', 'straight ahead');
    assert.equal(shaftArrow(10, 0), '\u2192', 'to the right');
    assert.equal(shaftArrow(0, 10), '\u2193', 'behind');
    assert.equal(shaftArrow(-10, 0), '\u2190', 'to the left');
    assert.equal(shaftArrow(10, -10), '\u2197');
    assert.equal(shaftArrow(-10, 10), '\u2199');
    assert.equal(shaftHint(30, 40), 'SHAFT 50 m \u2198');
    assert.equal(shaftHint(0, 0).startsWith('SHAFT 0 m'), true);
});
