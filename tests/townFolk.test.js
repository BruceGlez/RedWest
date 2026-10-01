import test from 'node:test';
import assert from 'node:assert/strict';
import { FOLK, FOLK_BARK_MAX, getFolk, folkTier, folkLine, createWalker, stepWalker, folkNear } from '../src/townFolk.js';
import { TOWN_AREA } from '../src/townDistricts.js';

test('everyone has a route of two to four stops inside the town and three lines within the limit', () => {
    assert.ok(FOLK.length >= 6);
    assert.equal(new Set(FOLK.map(p => p.id)).size, FOLK.length);
    for(const person of FOLK) {
        assert.ok(person.route.length >= 2 && person.route.length <= 4, `${person.id}: ${person.route.length} points`);
        for(const [x, z, wait = 0] of person.route) {
            assert.ok(x > TOWN_AREA.minX && x < TOWN_AREA.maxX && z > TOWN_AREA.minZ && z < TOWN_AREA.maxZ, `${person.id}: inside the town`);
            assert.ok(wait >= 0 && wait <= 12);
        }
        assert.equal(person.lines.length, 3);
        for(const line of person.lines) assert.ok(line.length > 20 && line.length <= FOLK_BARK_MAX, `${person.id}: "${line}" (${line.length})`);
        assert.ok(person.route.some(point => (point[2] || 0) >= 4), `${person.id} stops somewhere for a while`);
    }
    assert.equal(getFolk('gil').name, 'Old Gil');
    assert.equal(getFolk('nobody'), null);
});

test('what they say follows how many outlaws are beaten', () => {
    assert.equal(folkTier(0), 0);
    assert.equal(folkTier(1), 1);
    assert.equal(folkTier(4), 1);
    assert.equal(folkTier(5), 2);
    assert.equal(folkTier(10), 2);
    const gil = getFolk('gil');
    assert.equal(folkLine(gil, 0), gil.lines[0]);
    assert.equal(folkLine(gil, 7), gil.lines[2]);
    assert.notEqual(folkLine(gil, 0), folkLine(gil, 7));
});

test('a walker walks to each stop, waits there, and goes on round the route', () => {
    const route = [[0, 0, 2], [3, 0, 0], [3, 4, 1]];
    const w = createWalker(route);
    const visits = [];
    let waited = 0;
    for(let t = 0; t < 60; t += 0.05) {
        const before = w.wait;
        stepWalker(w, 0.05, 1.5);
        if(w.wait > 0 && before === 0) visits.push([w.x, w.z]);
        if(w.wait > 0) waited += 0.05;
    }
    // The stops with a wait, in order, round and round: (3, 4) then (0, 0) then (3, 4) again.
    assert.deepEqual(visits.slice(0, 3).map(v => v.map(n => Math.round(n))), [[3, 4], [0, 0], [3, 4]]);
    assert.ok(visits.length >= 4, 'came round to the stops more than once');
    assert.ok(waited > 4, 'it waited at the stops');
});

test('a walker never leaves the line between its stops', () => {
    const route = [[0, 0, 0], [10, 0, 0]];
    const w = createWalker(route);
    for(let t = 0; t < 40; t += 0.1) {
        stepWalker(w, 0.1);
        assert.ok(Math.abs(w.z) < 1e-9 && w.x >= -1e-9 && w.x <= 10 + 1e-9);
    }
});

test('a talking walker stands still, and starts again afterwards; a huge step does not skip a stop', () => {
    const w = createWalker([[0, 0, 0], [10, 0, 0]]);
    w.talking = true;
    const x = w.x;
    stepWalker(w, 5);
    assert.equal(w.x, x);
    assert.equal(w.moving, false);
    w.talking = false;
    stepWalker(w, 1);
    assert.ok(w.x > x && w.moving);
    stepWalker(w, 100);
    assert.equal(w.x, 10);
});

test('starting part-way through the day puts people in different places', () => {
    const route = FOLK[0].route;
    const a = createWalker(route, 0);
    const b = createWalker(route, 11);
    assert.ok(a.x !== b.x || a.z !== b.z);
});

test('the marshal talks to the nearest person in range, and to nobody far off', () => {
    const walkers = [{ id: 'a', x: 10, z: 0 }, { id: 'b', x: 12, z: 0 }];
    assert.equal(folkNear(walkers, 11.5, 0)?.id, 'b');
    assert.equal(folkNear(walkers, 10.2, 0)?.id, 'a');
    assert.equal(folkNear(walkers, 30, 0), null);
});
