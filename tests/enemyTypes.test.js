import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_TYPES, ENEMY_ORDER, rosterFor, featuredFor, rosterWave } from '../src/enemyTypes.js';
import { OUTLAWS } from '../src/outlaws.js';

test('every Wanted Road stage after the first introduces exactly one new enemy', () => {
    for(let stage = 1; stage < OUTLAWS.length; stage++) {
        const introduced = ENEMY_ORDER.filter(id => ENEMY_TYPES[id].stage === stage);
        assert.equal(introduced.length, 1, `stage ${stage}`);
        assert.equal(featuredFor(stage), introduced[0]);
    }
    assert.equal(featuredFor(0), null);
});

test('rosters grow along the road and keep the basics', () => {
    assert.deepEqual(rosterFor(0), ['bandit', 'wolf', 'gunslinger']);
    for(let stage = 1; stage < OUTLAWS.length; stage++) {
        assert.equal(rosterFor(stage).length, rosterFor(stage - 1).length + 1);
        assert.ok(rosterFor(stage).includes('bandit'));
    }
});

test('the featured enemy is weighted up; older specials appear less', () => {
    const { weights, caps } = rosterWave(3, 1);
    assert.ok(weights.dynamiter > weights.rattler);
    assert.ok(weights.dynamiter > weights.rifleman);
    for(const id of rosterFor(3)) assert.ok(caps[id] >= 1, id);
    assert.equal(weights.brute, undefined, 'later enemies are not in earlier stages');
});

test('every enemy has Bounty Book text and sane stats', () => {
    for(const [id, def] of Object.entries(ENEMY_TYPES)) {
        assert.ok(def.name && def.blurb && def.tip, id);
        assert.ok(def.hp >= 1 && def.speed > 0 && def.cost > 0, id);
    }
});
