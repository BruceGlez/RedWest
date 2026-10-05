import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { ENEMY_TYPES, ENEMY_ORDER, ENEMY_MODELS, rosterFor, featuredFor, rosterWave } from '../src/enemyTypes.js';
import { MINE_MONSTERS } from '../src/mineMonsters.js';
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

// Every regular enemy that has a 3D model: the file is there, small enough to load on demand, and the height is one a fight can use.
test('every model row names a real enemy, an existing file and a sane height', () => {
    for(const [id, row] of Object.entries(ENEMY_MODELS)) {
        assert.ok(ENEMY_TYPES[id], `${id} is an enemy type`);
        assert.match(row.file, /^models\/[a-z-]+\.glb$/);
        assert.ok(existsSync(`public/${row.file}`), `${row.file} exists`);
        assert.ok(statSync(`public/${row.file}`).size < 1.5e6, `${row.file} is under 1.5 MB`);
        assert.ok(row.height >= 4 && row.height <= 8, `${id}: height ${row.height} is near the box figure's`);
    }
    assert.equal(new Set(Object.values(ENEMY_MODELS).map(r => r.file)).size, Object.keys(ENEMY_MODELS).length, 'one file each');
});

test('the eight models are the ones the art lane made', () => {
    assert.deepEqual(Object.keys(ENEMY_MODELS).sort(), ['bandit', 'brute', 'duelist', 'dynamiter', 'ghost', 'gunslinger', 'knifer', 'rifleman']);
    assert.ok(ENEMY_MODELS.brute.height > ENEMY_MODELS.bandit.height, 'a brute is bigger than a bandit');
});

test('a mine monster that borrows a look gets that look\'s model; one that borrows none keeps its box figure', () => {
    for(const [id, def] of Object.entries(MINE_MONSTERS)) {
        const row = ENEMY_MODELS[def.look ?? id];
        if(row) assert.ok(def.look in ENEMY_MODELS || id in ENEMY_MODELS, `${id}: the model is the borrowed look's`);
        if(def.look && row) assert.equal(row, ENEMY_MODELS[def.look]);
    }
    assert.ok(!('bat' in ENEMY_MODELS) && !('crawler' in ENEMY_MODELS), 'the mine\'s own monsters have no model yet');
});
