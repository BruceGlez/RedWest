import test from 'node:test';
import assert from 'node:assert/strict';
import { mine, beginMineRun, endMineRun, nextFloor, MINE_ATMOSPHERE_ID, floorStage, floorWave, floorTitle, floorBanner, descentScore, chestReward,
    resultText, confirmText, shaftArrow, shaftHint, liftHint, PRACTICE_NOTE, SAVE_FAILED_NOTE, oreInChest, runSummary, savedText, statusText } from '../src/mine.js';
import { maxOreOnFloor, applyMineRun, createMineProgress, normalizeMineProgress } from '../src/mineProgress.js';
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
    assert.match(PRACTICE_NOTE, /no stars and no money/);
    assert.match(SAVE_FAILED_NOTE, /could not be saved/);
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

test('a run may begin on a checkpoint he has reached, and only on one', () => {
    const record = normalizeMineProgress({ deepest: 12 });
    beginMineRun(10, record);
    assert.deepEqual([mine.floor, mine.startFloor, mine.ore], [10, 10, 0]);
    beginMineRun(15, record);
    assert.deepEqual([mine.floor, mine.startFloor], [1, 1], 'a checkpoint he has not reached is floor 1');
    beginMineRun(7, record);
    assert.equal(mine.startFloor, 1, 'and so is a floor that is no checkpoint');
    beginMineRun(10);
    assert.equal(mine.startFloor, 1, 'with no record there is only floor 1');
    endMineRun();
    assert.deepEqual([mine.floor, mine.startFloor, mine.ore], [1, 1, 0]);
});

test('every chest holds a share of its floor\'s ore, so opening them all never gives more than the floor can hold', () => {
    for(const floor of [1, 2, 5, 9, 20]) for(const chests of [1, 2, 3, 6, 10]) {
        assert.ok(oreInChest(floor, chests) >= 1);
        assert.ok(oreInChest(floor, chests) * chests <= Math.max(maxOreOnFloor(floor), chests), `floor ${floor}, ${chests} chests`);
    }
    assert.ok(oreInChest(9, 3) > oreInChest(1, 3), 'deeper chests hold more');
    assert.equal(oreInChest(3, 0), maxOreOnFloor(3), 'no chests listed: the whole floor in one');
});

test('the run reports where it began, how deep, the ore carried and how it ended, and the answer reads well', () => {
    beginMineRun(1);
    mine.floor = 4;
    mine.ore = 17;
    assert.deepEqual(runSummary('mine-win', 123.6), { startFloor: 1, depth: 4, ore: 17, outcome: 'up', seconds: 124 });
    assert.equal(runSummary('died', -5).outcome, 'fell');
    assert.equal(runSummary('died', -5).seconds, 0);
    const record = createMineProgress();
    const up = applyMineRun(record, runSummary('mine-win', 300));
    assert.match(savedText(up), /New deepest floor: 4\./);
    assert.match(savedText(up), /17 ore banked\./);
    assert.match(savedText(up), /no stars and no money/);
    mine.floor = 6;
    const fell = applyMineRun(record, runSummary('died', 400));
    assert.match(savedText(fell), /Checkpoint: floor 5\./);
    assert.match(savedText(fell), /17 ore lost in the fall\./);
    assert.match(savedText({ depth: 2, newDeepest: false, newCheckpoint: 0, carried: 0 }), /Deepest floor kept\./);
    assert.deepEqual(resultText('died', 6, 17), ['WASTED', 'You fell on depth 6 and lost 17 ore.']);
    assert.deepEqual(resultText('mine-win', 6, 17), ['LIFT UP', 'You rode the lift back up from depth 6 with 17 ore.']);
    assert.equal(statusText(0, -50, 0), liftHint(0, -50));
    assert.equal(statusText(0, -50, 9), `${liftHint(0, -50)}  ORE 9`);
    endMineRun();
});
