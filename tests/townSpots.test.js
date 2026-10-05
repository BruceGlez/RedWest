import test from 'node:test';
import assert from 'node:assert/strict';
import { SPOTS, COIN_SLOTS, BOARD_NOTES, getSpot, spotLabel, coinCount, cashBoxFull, boardNotes, jobsLeft } from '../src/townSpots.js';
import { TOWN_LAYOUT } from '../src/townScene.js';
import { TOWN_AREA } from '../src/townDistricts.js';
import { UNDERTAKER_AT } from '../src/townSpace.js';

test('the five places exist, with a verb each', () => {
    assert.deepEqual(SPOTS.map(s => s.id), ['train', 'platform', 'cashbox', 'board', 'hatch']);
    for(const spot of SPOTS) assert.ok(spot.verb && getSpot(spot.id) === spot);
    assert.equal(getSpot('nope'), null);
});

test('places are inside the town and clear of every building and of each other', () => {
    for(const spot of SPOTS) {
        const [x, z] = spot.stand;
        assert.ok(x > TOWN_AREA.minX + 2 && x < TOWN_AREA.maxX - 1 && z > TOWN_AREA.minZ + 1 && z < TOWN_AREA.maxZ - 1, `${spot.id} is inside the town`);
        for(const b of TOWN_LAYOUT) assert.ok(Math.hypot(x - b.x, z - b.z) >= 3.5, `${spot.id} is not inside ${b.id}`);
    }
    for(const a of SPOTS) for(const b of SPOTS) {
        if(a !== b) assert.ok(Math.hypot(a.stand[0] - b.stand[0], a.stand[1] - b.stand[1]) > 6, `${a.id} and ${b.id} are far apart`);
    }
});

test('a prop never blocks the place you stand to use it', () => {
    for(const spot of SPOTS.filter(s => s.object)) {
        const { x, z, hx, hz } = spot.object;
        const [sx, sz] = spot.stand;
        const clear = sx < x - hx - 0.6 || sx > x + hx + 0.6 || sz < z - hz - 0.6 || sz > z + hz + 0.6;
        assert.ok(clear, `${spot.id}: the marshal (radius 0.6) fits at the stand point`);
    }
});

test('the prompts name what you will get', () => {
    assert.equal(spotLabel('train', { outlawName: 'Dusty Pete' }), 'RIDE OUT: DUSTY PETE');
    assert.equal(spotLabel('train'), 'RIDE OUT');
    assert.equal(spotLabel('platform'), 'THE TOWN TRAIN');
    assert.equal(spotLabel('cashbox', { stored: 0 }), 'JAIL CASH BOX');
    assert.equal(spotLabel('cashbox', { stored: 1234.4 }), 'COLLECT $1,234');
    assert.equal(spotLabel('board', { jobsLeft: 2 }), 'BOUNTY BOARD: 2 LEFT');
    assert.equal(spotLabel('board', { jobsLeft: 0 }), 'BOUNTY BOARD');
    assert.equal(spotLabel('hatch'), 'THE HOLLOW CLAIM: FLOOR 1');
});

test('coins show what is stored: none when empty, one at the first dollar, all when full', () => {
    assert.equal(coinCount(0, 100), 0);
    assert.equal(coinCount(0.5, 100), 1);
    assert.equal(coinCount(50, 100), COIN_SLOTS / 2);
    assert.equal(coinCount(100, 100), COIN_SLOTS);
    assert.equal(coinCount(500, 100), COIN_SLOTS);
    assert.equal(coinCount(10, 0), 0);
    assert.equal(cashBoxFull(100, 100), true);
    assert.equal(cashBoxFull(99, 100), false);
    assert.equal(cashBoxFull(0, 0), false);
});

test('the board pins a note for each job left today, at most three', () => {
    assert.equal(BOARD_NOTES, 3);
    assert.equal(boardNotes(0), 0);
    assert.equal(boardNotes(2), 2);
    assert.equal(boardNotes(9), 3);
    assert.equal(boardNotes(-1), 0);
    assert.equal(jobsLeft({ jobs: { list: [{ done: true }, { done: false }, { done: false }] } }), 2);
    assert.equal(jobsLeft(null), 0);
});

test('the cellar hatch stands beside the undertaker and says DESCEND', () => {
    const hatch = getSpot('hatch');
    assert.equal(hatch.verb, 'DESCEND');
    assert.ok(Math.hypot(hatch.object.x - UNDERTAKER_AT[0], hatch.object.z - UNDERTAKER_AT[1]) < 8, 'beside the undertaker');
    assert.ok(Math.abs(hatch.object.x - UNDERTAKER_AT[0]) > 2.8 + hatch.object.hx, 'clear of the undertaker\'s walk box (2.8 each way)');
});
