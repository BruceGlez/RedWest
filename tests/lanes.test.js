import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { config, laneOf, unowned } from '../tools/lanes.mjs';

const tracked = () => execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);

test('every tracked file has an owner lane or is shared', () => {
    assert.deepEqual(unowned(tracked()), []);
});

test('there are eleven lanes, each with a doc that exists and checks to run', () => {
    assert.equal(config.lanes.length, 11);
    for(const lane of config.lanes) {
        assert.ok(lane.checks.length > 0, `${lane.id} has no checks`);
        assert.ok(existsSync(lane.doc), `${lane.id}: missing ${lane.doc}`);
    }
});

test('lane ids are unique and shared wins over a lane', () => {
    const ids = config.lanes.map(lane => lane.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(laneOf('src/gameLoop.js'), 'shared');
    assert.equal(laneOf('src/mineMap.js'), 'mine');
    assert.equal(laneOf('server/app.js'), 'scale');
});

test('every npm script a lane lists exists in package.json', async () => {
    const { default: pkg } = await import('../package.json', { with: { type: 'json' } });
    for(const lane of config.lanes) {
        for(const check of lane.checks) {
            const match = /^npm run ([\w:-]+)$/.exec(check);
            if(match) assert.ok(pkg.scripts[match[1]], `${lane.id}: no npm script "${match[1]}"`);
        }
    }
});
