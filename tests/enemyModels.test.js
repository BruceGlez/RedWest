import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { ENEMY_MODELS, ENEMY_TYPES } from '../src/enemyTypes.js';
import { MINE_MONSTERS } from '../src/mineMonsters.js';

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
