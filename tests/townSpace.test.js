import test from 'node:test';
import assert from 'node:assert/strict';
import { SPREAD, TOWN_LAYOUT, spread, near, moved } from '../src/townSpace.js';
import { TOWN_AREA, DISTRICTS } from '../src/townDistricts.js';
import { FOLK } from '../src/townFolk.js';
import { SPOTS } from '../src/townSpots.js';

const OLD_AREA = { minX: -38, maxX: 40, minZ: -21, maxZ: 19 };

test('the town is spread out: more room between buildings, the same buildings', () => {
    assert.ok(SPREAD >= 1.4, 'a clear step up from the packed layout');
    const nearest = layout => Math.min(...layout.flatMap((a, i) => layout.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.z - b.z))));
    const old = TOWN_LAYOUT.map(b => ({ x: b.x / SPREAD, z: b.z / SPREAD }));
    assert.ok(nearest(TOWN_LAYOUT) >= 20, `the nearest two buildings are ${nearest(TOWN_LAYOUT).toFixed(1)} apart`);
    assert.deepEqual(TOWN_LAYOUT.map(b => b.id), ['saloon', 'sheriff', 'bank', 'jail', 'gunsmith', 'tailor', 'depot', 'arena']);
    assert.deepEqual(spread(10, -4), [10 * SPREAD, -4 * SPREAD]);
});

test('the town ground grew with it, and the districts moved out with its edge', () => {
    for(const key of ['minX', 'maxX', 'minZ', 'maxZ']) assert.equal(TOWN_AREA[key], OLD_AREA[key] * SPREAD);
    // Each district still overlaps the town by the same strip, wherever its gate is.
    const overlapX = (a, b) => Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const overlapZ = (a, b) => Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    for(const d of DISTRICTS) assert.ok(overlapX(d.area, TOWN_AREA) >= 3 && overlapZ(d.area, TOWN_AREA) >= 3, `${d.id} still meets the town`);
});

test('a thing that belongs to a building keeps its place beside it', () => {
    const depot = TOWN_LAYOUT.find(b => b.id === 'depot');
    const [x, z] = near('depot', 31, -3.7);
    assert.ok(Math.abs((x - depot.x) - (31 - 33)) < 1e-9 && Math.abs((z - depot.z) - (-3.7 - -15)) < 1e-9, 'the train stays 2 left and 11.3 in front of the depot');
    const [mx, mz] = moved('depot');
    assert.ok(Math.abs(mx - (depot.x - 33)) < 1e-9 && Math.abs(mz - (depot.z - -15)) < 1e-9);
    // The jail's cash box stays in the jail's yard.
    const cash = SPOTS.find(s => s.id === 'cashbox');
    const jail = TOWN_LAYOUT.find(b => b.id === 'jail');
    assert.ok(Math.hypot(cash.stand[0] - jail.x, cash.stand[1] - jail.z) < 12, 'the cash box is in the jail yard');
});

test('the townsfolk walk the spread-out town, inside it', () => {
    for(const person of FOLK) for(const [x, z] of person.route) {
        assert.ok(x > TOWN_AREA.minX && x < TOWN_AREA.maxX && z > TOWN_AREA.minZ && z < TOWN_AREA.maxZ, `${person.id} stays in the town`);
    }
    // Routes grew with the town, so the walk between stops is longer than it was.
    const length = route => route.reduce((sum, p, i) => sum + Math.hypot(p[0] - route[(i + 1) % route.length][0], p[1] - route[(i + 1) % route.length][1]), 0);
    assert.ok(length(FOLK[0].route) > 50);
});
