import test from 'node:test';
import assert from 'node:assert/strict';
import { mine, beginMineRun, endMineRun, nextFloor, MINE_ATMOSPHERE_ID, floorStage, floorWave, floorTitle, floorBanner, descentScore, chestReward,
    resultText, confirmText, shaftArrow, shaftHint, liftHint, PRACTICE_NOTE, SAVE_FAILED_NOTE, oreInChest, runSummary, savedText, statusText } from '../src/mine.js';
import { maxOreOnFloor, applyMineRun, createMineProgress, normalizeMineProgress } from '../src/mineProgress.js';
import { LIGHT_NEEDS_SHOP, lightSource, DIM_RING, OIL_CAPACITY, CARRY_LIMIT, MATCH_LIMIT } from '../src/mineLight.js';
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
    assert.match(up.text, /come back down to this floor/);
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
    assert.deepEqual(runSummary('mine-win', 123.6), { startFloor: 1, depth: 4, ore: 17, outcome: 'up', seconds: 124, used: { oil: 0, torches: 0, matches: 0 } });
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

test('the run starts with a light kit and reports what it used; the HUD shows the torches and the oil', () => {
    beginMineRun(1, { checkpoint: 0, light: { lantern: true, oil: 300, torches: 10, matches: 0 } });
    assert.ok(mine.light, 'a run has a light');
    assert.deepEqual([mine.light.lantern, mine.light.oil, mine.light.torches], [true, 300, 10], 'it starts with what he owns');
    mine.light.oil -= 125.2;
    mine.light.torches -= 2;
    assert.deepEqual(runSummary('mine-win', 60).used, { oil: 126, torches: 2, matches: 0 });
    assert.equal(statusText(0, -30, 0, mine.light), `${liftHint(0, -30)}  TORCHES ${mine.light.torches}  OIL ${Math.ceil(mine.light.oil / 60)}m`);
    mine.light.oil = 0;
    assert.match(statusText(0, -30, 5, mine.light), /ORE 5  TORCHES \d+  LANTERN OUT$/);
    mine.light.lantern = false;
    assert.doesNotMatch(statusText(0, -30, 0, mine.light), /OIL|LANTERN/, 'no lantern, nothing to say about it');
    endMineRun();
    assert.equal(mine.light, null);
    assert.deepEqual(runSummary('died', 5).used, { oil: 0, torches: 0, matches: 0 }, 'no run, nothing used');
});

test('the light shops are open: a run starts with what he owns and nothing else, so with nothing he has the dim ring and can still walk back', () => {
    assert.equal(LIGHT_NEEDS_SHOP, true);
    beginMineRun(1);
    assert.deepEqual([mine.light.lantern, mine.light.oil, mine.light.torches, mine.light.matches], [false, 0, 0, 0], 'no record: an empty kit');
    assert.equal(lightSource(mine.light, 1).radius, DIM_RING, 'the dim ring, never nothing');
    assert.deepEqual(runSummary('died', 10).used, { oil: 0, torches: 0, matches: 0 });
    endMineRun();
    beginMineRun(1, { checkpoint: 0, light: { lantern: true, oil: 9999, torches: 99, matches: 99 } });
    assert.deepEqual([mine.light.oil, mine.light.torches, mine.light.matches], [OIL_CAPACITY, CARRY_LIMIT, MATCH_LIMIT], 'a kit is kept inside its limits');
    endMineRun();
    beginMineRun(1, { checkpoint: 0, light: { lantern: false, oil: 500, torches: 3, matches: 1 } });
    assert.equal(mine.light.oil, 0, 'oil without a lantern is nothing');
    assert.equal(mine.light.torches, 3);
    endMineRun();
});

test('slice 7: riding the lift up remembers the floor, and the next descent can go back to it with its torches', async () => {
    const { beginMineRun, endMineRun, rideUp, runSummary, mine } = await import('../src/mine.js');
    const { placeTorch } = await import('../src/mineLight.js');
    const { forgetResume, withResume } = await import('../src/mineResume.js');
    const { startFloors } = await import('../src/mineProgress.js');
    const record = { deepest: 7, checkpoint: 5, light: { lantern: true, oil: 300, torches: 5, matches: 2 } };
    forgetResume();
    beginMineRun(1, record);
    mine.floor = 4;
    placeTorch(mine.light, 3, 4, 4);
    rideUp(100);
    endMineRun();
    assert.deepEqual(startFloors(withResume(record)), [1, 5, 4]);
    beginMineRun(4, record);
    assert.equal(mine.floor, 4);
    assert.equal(mine.light.placed.length, 1, 'the torch he left is standing');
    assert.equal(mine.light.torches, 5, 'it is not paid for twice');
    assert.equal(runSummary('mine-win', 20).seconds, 120, 'the run clock goes on');
    endMineRun();
    beginMineRun(5, record); // starting anywhere else gives the resume point up
    endMineRun();
    assert.deepEqual(startFloors(withResume(record)), [1, 5]);
    forgetResume();
});

test('slice 7: the lift reports a resume save with the torches left standing', async () => {
    const { beginMineRun, endMineRun, resumeSummary, mine } = await import('../src/mine.js');
    const { placeTorch } = await import('../src/mineLight.js');
    const { forgetResume } = await import('../src/mineResume.js');
    forgetResume();
    beginMineRun(1, { deepest: 3, checkpoint: 0, light: { lantern: true, oil: 300, torches: 5, matches: 2 } });
    placeTorch(mine.light, 1, 2, 1);
    mine.ore = 7;
    const summary = resumeSummary(42);
    assert.equal(summary.action, 'save');
    assert.equal(summary.outcome, 'up');
    assert.equal(summary.ore, 7);
    assert.deepEqual(summary.torches, [[1, 1, 2, 1]]);
    endMineRun();
});
