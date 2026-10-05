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

test('sharedChanges counts added plus removed lines in shared files only', async () => {
    const { sharedChanges } = await import('../tools/lanes.mjs');
    const numstat = ['12\t3\tsrc/gameLoop.js', '40\t0\tsrc/modes/mine.js', '5\t5\tindex.html', '-\t-\tpublic/models/x.glb', '1\t1\tsrc/townPanel.js'].join('\n');
    assert.deepEqual(sharedChanges(numstat), [
        { file: 'src/gameLoop.js', lines: 15 },
        { file: 'index.html', lines: 10 },
        { file: 'src/townPanel.js', lines: 2 }
    ]);
    assert.deepEqual(sharedChanges(''), []);
});

test('art owns the scene builders and the function lanes own the layouts', () => {
    for(const file of ['src/placeFarm.js', 'src/placeUndertaker.js', 'src/mineScene.js', 'src/townScene.js']) assert.equal(laneOf(file), 'art', file);
    assert.equal(laneOf('src/farmLayout.js'), 'town');
    assert.equal(laneOf('src/townSpace.js'), 'town');
    assert.equal(laneOf('src/undertakerLayout.js'), 'mine');
    assert.equal(laneOf('src/mineMap.js'), 'mine');
    assert.equal(laneOf('src/places/farm.js'), 'town', 'the place registry entry is the function agent\'s, not a scene builder');
    assert.equal(laneOf('src/modes/mine.js'), 'mine');
});

test('the lane briefs belong to qa and the policy answers to money', () => {
    assert.equal(laneOf('docs/lanes/art.md'), 'qa');
    assert.equal(laneOf('docs/POLICY_GENERATOR_ANSWERS.md'), 'money');
});
