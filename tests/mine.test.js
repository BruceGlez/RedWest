import test from 'node:test';
import assert from 'node:assert/strict';
import { mine, beginMineRun, endMineRun, nextFloor, MINE_ATMOSPHERE_ID, floorStage, floorWave, floorTitle, floorBanner, descentScore, chestReward,
    resultText, confirmText, shaftArrow, shaftHint, liftHint, PRACTICE_NOTE } from '../src/mine.js';
import { OUTLAWS } from '../src/outlaws.js';
import { atmosphereFor, soundFor, MINE_ATMOSPHERE, ATMOSPHERES } from '../src/atmosphere.js';
import { SURFACES, BEDS } from '../src/soundscape.js';

test('a mine run starts on the first floor and ends back on the Wanted Road rules', () => {
    assert.equal(mine.enabled, false);
    beginMineRun();
    assert.equal(mine.enabled, true);
    assert.equal(mine.floor, 1);
    mine.opened.push(0);
    mine.liftArmed = true;
    assert.equal(nextFloor(), 2, 'going down is one floor');
    assert.equal(mine.liftArmed, false, 'the new floor has a new lift');
    assert.deepEqual(mine.opened, [], 'and new chests');
    assert.equal(nextFloor(), 3);
    assert.equal(endMineRun(), true);
    assert.equal(mine.enabled, false);
    assert.equal(mine.floor, 1);
    assert.equal(endMineRun(), false, 'nothing to end the second time');
});

test('there is no bottom: depth only grows, and the stage numbers stop at the last outlaw\'s', () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(floorStage), [0, 1, 2, 3, 4]);
    assert.equal(floorStage(OUTLAWS.length), OUTLAWS.length - 1);
    assert.equal(floorStage(500), OUTLAWS.length - 1, 'a very deep floor still has a real stage to look up');
    assert.equal(floorStage(0), 0);
    assert.deepEqual([1, 2, 3].map(floorWave), [2, 3, 4]);
    assert.equal(floorWave(0), 2);
});

test('the words on screen name the depth and the way out', () => {
    assert.equal(floorTitle(3), 'DEPTH 3');
    assert.match(floorBanner(1), /DEPTH 1/);
    assert.match(floorBanner(1), /THE UPPER GALLERY/);
    assert.match(floorBanner(20), /THE LOST LEVEL 20/);
    assert.deepEqual(resultText('mine-win', 7), ['LIFT UP', 'You rode the lift back up from depth 7.']);
    assert.deepEqual(resultText('died', 3), ['WASTED', 'You fell on depth 3.']);
    assert.match(PRACTICE_NOTE, /practice only/);
});

test('going down and opening chests pay by depth', () => {
    assert.equal(descentScore(1), 50);
    assert.ok(descentScore(10) > descentScore(2));
    assert.deepEqual(chestReward(2, 3, 5), { score: 200, heal: true, tripleShot: false }, 'a hurt marshal is healed');
    assert.deepEqual(chestReward(4, 5, 5), { score: 400, heal: false, tripleShot: true }, 'a healthy one gets triple shot');
});

test('the HUD points to the shaft and the lift: up the screen is north, into the map', () => {
    assert.equal(shaftArrow(0, -10), '↑', 'straight ahead');
    assert.equal(shaftArrow(10, 0), '→', 'to the right');
    assert.equal(shaftArrow(0, 10), '↓', 'behind');
    assert.equal(shaftArrow(-10, 0), '←', 'to the left');
    assert.equal(shaftArrow(10, -10), '↗');
    assert.equal(shaftArrow(-10, 10), '↙');
    assert.equal(shaftHint(30, 40), 'SHAFT 50 m ↘');
    assert.equal(liftHint(-30, -40), 'LIFT UP 50 m ↖');
    assert.equal(shaftHint(0, 0).startsWith('SHAFT 0 m'), true);
});

test('the mine has its own look and sound, apart from the outlaws\' stages', () => {
    assert.equal(atmosphereFor(MINE_ATMOSPHERE_ID), MINE_ATMOSPHERE);
    assert.ok(!(MINE_ATMOSPHERE_ID in ATMOSPHERES), 'not an outlaw stage');
    assert.ok(SURFACES[soundFor(MINE_ATMOSPHERE_ID).surface] && BEDS[soundFor(MINE_ATMOSPHERE_ID).bed], 'a known footstep surface and bed');
});

test('the shaft and the lift ask first, and say what they will do', () => {
    assert.deepEqual(confirmText('down', 3), { title: 'GO DOWN?', text: 'Take the shaft down to depth 4. Everything on this floor stays behind.', yes: 'DESCEND', no: 'STAY' });
    const up = confirmText('up', 6);
    assert.equal(up.title, 'RIDE THE LIFT UP?');
    assert.match(up.text, /depth 6/);
    assert.match(up.text, /ends the run/);
    assert.equal(up.yes, 'RIDE UP');
    assert.equal(up.no, 'STAY');
    beginMineRun();
    mine.confirm = 'down';
    mine.blocked = 'up';
    nextFloor();
    assert.equal(mine.confirm, null, 'a new floor asks nothing yet');
    assert.equal(mine.blocked, null);
    mine.confirm = 'up';
    endMineRun();
    assert.equal(mine.confirm, null);
});
