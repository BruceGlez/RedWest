import test from 'node:test';
import assert from 'node:assert/strict';
import { createMineProgress, normalizeMineProgress, checkpointFor, startFloors, maxOreOnFloor, maxOreForRun, oreKept, applyMineRun, CHECKPOINT_EVERY, MAX_FLOOR, MAX_ORE, FALL_KEEPS } from '../src/mineProgress.js';
import { createProfile, normalizeProfile, applyRun, CURRENCIES } from '../src/profile.js';
import { PRODUCTS } from '../src/products.js';
import { SHOP_ITEMS } from '../src/cosmetics.js';

test('a new profile has an empty mine record, and old saves without one get it', () => {
    assert.deepEqual(createProfile().mine, { version: 1, deepest: 0, checkpoint: 0, ore: 0, runs: 0, light: { lantern: false, oil: 0, torches: 0, matches: 0 } });
    const old = createProfile();
    delete old.mine;
    assert.deepEqual(normalizeProfile(old).mine, createMineProgress());
    assert.deepEqual(normalizeProfile(null).mine, createMineProgress());
});

test('normalizing keeps real numbers, cuts tampered ones, and derives the checkpoint from the deepest floor', () => {
    assert.deepEqual(normalizeMineProgress({ deepest: 13.9, checkpoint: 500, ore: '40', runs: 3 }), { version: 1, deepest: 13, checkpoint: 10, ore: 40, runs: 3, light: createMineProgress().light });
    assert.equal(normalizeMineProgress({ deepest: 1e9 }).deepest, MAX_FLOOR);
    assert.equal(normalizeMineProgress({ ore: 1e12 }).ore, MAX_ORE);
    assert.deepEqual(normalizeMineProgress({ deepest: -4, ore: -1, runs: 'x' }), createMineProgress());
    assert.deepEqual(normalizeMineProgress('nope'), createMineProgress());
    assert.deepEqual(normalizeProfile({ mine: { deepest: 7, ore: 12 } }).mine, { version: 1, deepest: 7, checkpoint: 5, ore: 12, runs: 0, light: createMineProgress().light });
    const once = normalizeMineProgress({ deepest: 22, ore: 5, runs: 9 });
    assert.deepEqual(normalizeMineProgress(once), once, 'normalizing twice changes nothing');
});

test('a checkpoint every few floors, and a run may begin on any checkpoint reached', () => {
    assert.deepEqual([0, 1, 4, 5, 6, 9, 10, 24].map(checkpointFor), [0, 0, 0, 5, 5, 5, 10, 20]);
    assert.deepEqual(startFloors(createMineProgress()), [1]);
    assert.deepEqual(startFloors({ checkpoint: 15 }), [1, 5, 10, 15]);
    assert.equal(CHECKPOINT_EVERY, 5);
});

test('riding the lift up keeps the ore, falling loses it, and the deepest floor is kept either way', () => {
    const up = createMineProgress();
    const rode = applyMineRun(up, { startFloor: 1, depth: 4, ore: 20, outcome: 'up', seconds: 200 });
    assert.deepEqual([up.deepest, up.ore, up.runs, up.checkpoint], [4, 20, 1, 0]);
    assert.deepEqual([rode.kept, rode.lost, rode.newDeepest, rode.newCheckpoint], [20, 0, true, 0]);
    const fell = applyMineRun(up, { startFloor: 1, depth: 6, ore: 30, outcome: 'fell', seconds: 300 });
    assert.deepEqual([up.deepest, up.ore, up.checkpoint], [6, 20, 5], 'banked ore stays, the carried ore is lost, the depth still counts');
    assert.deepEqual([fell.kept, fell.lost, fell.newDeepest, fell.newCheckpoint], [30 * FALL_KEEPS, 30 - 30 * FALL_KEEPS, true, 5]);
    assert.equal(oreKept(10, 'up'), 10);
    assert.equal(oreKept(10, 'fell'), Math.floor(10 * FALL_KEEPS));
    const shallow = applyMineRun(up, { startFloor: 1, depth: 2, ore: 3, outcome: 'up', seconds: 100 });
    assert.deepEqual([up.deepest, shallow.newDeepest], [6, false], 'a shallower run never lowers the record');
});

test('a run from a checkpoint is allowed only from one he has reached', () => {
    const mine = normalizeMineProgress({ deepest: 12 });
    assert.equal(applyMineRun(mine, { startFloor: 10, depth: 11, ore: 0, outcome: 'up', seconds: 60 }).startFloor, 10);
    assert.equal(applyMineRun(mine, { startFloor: 15, depth: 16, ore: 0, outcome: 'up', seconds: 600 }).startFloor, 1, 'an unreached checkpoint is floor 1');
    assert.equal(applyMineRun(mine, { startFloor: 7, depth: 8, ore: 0, outcome: 'up', seconds: 600 }).startFloor, 1, 'and so is a floor that is no checkpoint');
});

test('the server cuts a summary that cannot be true', () => {
    const mine = createMineProgress();
    // 12 s is two floors of walking: floor 3 at the deepest, whatever the client says.
    const fast = applyMineRun(mine, { startFloor: 1, depth: 40, ore: 5, outcome: 'up', seconds: 12 });
    assert.equal(fast.depth, 3);
    assert.equal(mine.deepest, 3);
    // More ore than three floors can hold is cut to what they can.
    const rich = applyMineRun(createMineProgress(), { startFloor: 1, depth: 3, ore: 1e9, outcome: 'up', seconds: 100 });
    assert.equal(rich.carried, maxOreForRun(1, 3));
    // Nonsense: a fall, floor 1, nothing.
    const none = createMineProgress();
    assert.deepEqual(applyMineRun(none, null), { startFloor: 1, depth: 1, outcome: 'fell', carried: 0, kept: 0, lost: 0, newDeepest: true, newCheckpoint: 0 });
    assert.equal(none.runs, 1);
    assert.ok(maxOreOnFloor(9) > maxOreOnFloor(1), 'deeper floors hold more');
    const capped = normalizeMineProgress({ ore: MAX_ORE });
    applyMineRun(capped, { startFloor: 1, depth: 2, ore: 10, outcome: 'up', seconds: 100 });
    assert.equal(capped.ore, MAX_ORE, 'the bank has a ceiling');
});

test('the mine gives no stars, no dollars, no score records, and ore is not a currency or anything for sale', () => {
    const profile = createProfile();
    const before = JSON.stringify({ ...profile, mine: null });
    applyMineRun(profile.mine, { startFloor: 1, depth: 5, ore: 30, outcome: 'up', seconds: 300 });
    assert.equal(JSON.stringify({ ...profile, mine: null }), before, 'nothing but profile.mine changed');
    assert.ok(!('ore' in CURRENCIES) && !('ore' in profile.balances));
    assert.ok(!JSON.stringify(PRODUCTS).toLowerCase().includes('ore"'), 'no product grants ore');
    assert.ok(!/\bore\b/i.test(JSON.stringify(SHOP_ITEMS)), 'no shop item sells ore');
    // A normal run does not touch the mine record either.
    applyRun(profile, { score: 400, bounty: 'none', outlawIndex: 0, seconds: 120, kills: {} });
    assert.equal(profile.mine.ore, 30);
});
