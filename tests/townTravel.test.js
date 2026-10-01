import test from 'node:test';
import assert from 'node:assert/strict';
import { stops, stopById, arrival, SQUARE } from '../src/townTravel.js';
import { DISTRICTS, TOWN_AREA, walkAreas, getDistrict, lockedHint } from '../src/townDistricts.js';
import { SPOTS } from '../src/townSpots.js';

const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;

test('the train always stops at Main Street, and at a district only once it is open', () => {
    const all = stops([]);
    assert.deepEqual(all.map(s => s.id), ['square', ...DISTRICTS.map(d => d.id)]);
    assert.equal(all[0].open, true);
    assert.ok(all.slice(1).every(s => !s.open), 'nothing beaten, no district stop');
    assert.equal(stopById('foundry', []), null, 'a shut district cannot be travelled to');
    assert.equal(stopById('foundry', ['foundry'])?.id, 'foundry');
    assert.equal(stopById('nope', ['foundry']), null);
    assert.equal(stopById('square', [])?.id, 'square');
});

test('a shut stop names the outlaw to beat, and opening one place changes no other stop', () => {
    const shut = stops([]).find(s => s.id === 'foundry');
    assert.equal(shut.hint, lockedHint(getDistrict('foundry')));
    const before = stops([]);
    const after = stops(['crossing']);
    for(let i = 0; i < before.length; i++) {
        if(before[i].id === 'crossing') continue;
        assert.deepEqual(after[i], before[i], `${before[i].id} is the same whether the Crossing is open or not`);
    }
    assert.equal(after.find(s => s.id === 'crossing').open, true);
});

test('you step off on the right ground: Main Street, inside an open district, or at the farm gate', () => {
    assert.ok(inside(TOWN_AREA, SQUARE[0], SQUARE[1], 0.6), 'Main Street is in the town');
    for(const d of DISTRICTS) {
        const [x, z] = arrival(d);
        if(d.interior) {
            assert.ok(inside(TOWN_AREA, x, z, 0.6), `${d.id}: the farm gate is in the town`);
        } else {
            assert.ok(inside(d.area, x, z, 0.6), `${d.id}: the arrival point is on the district's own ground`);
            assert.ok(walkAreas([d.id]).some(a => inside(a, x, z, 0.6)), `${d.id}: and it can be walked`);
        }
    }
});

test('the town train has a platform beside the depot, clear of the other places', () => {
    const platform = SPOTS.find(s => s.id === 'platform');
    assert.ok(platform && platform.verb === 'RIDE');
    const train = SPOTS.find(s => s.id === 'train');
    assert.ok(Math.hypot(platform.stand[0] - train.stand[0], platform.stand[1] - train.stand[1]) > 6);
});
