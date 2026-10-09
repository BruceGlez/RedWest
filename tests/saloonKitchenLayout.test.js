import test from 'node:test';
import assert from 'node:assert/strict';
import { SPOTS, SEAT_SPOTS, spotDistance, spotPath, travelTime, FLAP_Z } from '../src/saloonKitchenLayout.js';

test('saloon kitchen spots are defined with coordinates matching the design spec', () => {
    assert.deepEqual(SPOTS.STOVE, { id: 'STOVE', x: -7, z: -7, name: 'Stove', area: 'kitchen' });
    assert.deepEqual(SPOTS.BARREL, { id: 'BARREL', x: -2.5, z: -6.5, name: 'Barrel', area: 'kitchen' });
    assert.deepEqual(SPOTS.OVEN, { id: 'OVEN', x: 6.5, z: -7, name: 'Oven', area: 'kitchen' });
    assert.deepEqual(SPOTS.CRATES, { id: 'CRATES', x: 10, z: -5, name: 'Crates', area: 'kitchen' });
    assert.deepEqual(SPOTS.FLAP, { id: 'FLAP', x: 0, z: -1.5, name: 'Flap', area: 'flap' });
    assert.deepEqual(SPOTS.SEAT_1, { id: 'SEAT_1', x: -6, z: 3, name: 'Seat 1', area: 'dining' });
    assert.deepEqual(SPOTS.SEAT_2, { id: 'SEAT_2', x: -2, z: 3, name: 'Seat 2', area: 'dining' });
    assert.deepEqual(SPOTS.SEAT_3, { id: 'SEAT_3', x: 2, z: 3, name: 'Seat 3', area: 'dining' });
    assert.deepEqual(SPOTS.SEAT_4, { id: 'SEAT_4', x: 6, z: 3, name: 'Seat 4', area: 'dining' });
    assert.deepEqual(SPOTS.SEAT_5, { id: 'SEAT_5', x: 10, z: 3, name: 'Seat 5', area: 'dining' });
    assert.deepEqual(SPOTS.DOOR, { id: 'DOOR', x: 0, z: 9, name: 'Door', area: 'dining' });
    assert.deepEqual(SPOTS.SHELF, { id: 'SHELF', x: -9, z: 7, name: 'Shelf', area: 'dining' });
    assert.equal(SEAT_SPOTS.length, 5);
});

test('every spot is reachable from every other spot', () => {
    const keys = Object.keys(SPOTS);
    for(const a of keys) {
        for(const b of keys) {
            const dist = spotDistance(a, b);
            assert.ok(Number.isFinite(dist), `${a} to ${b} is not finite`);
            assert.ok(dist >= 0, `${a} to ${b} distance is negative`);
        }
    }
});

test('spot distances match the layout design table within tolerance', () => {
    assert.ok(Math.abs(spotDistance('STOVE', 'FLAP') - 8.902) < 0.1);
    assert.ok(Math.abs(spotDistance('BARREL', 'FLAP') - 5.590) < 0.1);
    assert.ok(Math.abs(spotDistance('OVEN', 'FLAP') - 8.514) < 0.1);
    assert.ok(Math.abs(spotDistance('FLAP', 'SEAT_1') - 7.500) < 0.1);

    // Cross-bar trips (kitchen -> dining via FLAP)
    assert.ok(Math.abs(spotDistance('STOVE', 'SEAT_1') - 16.4) < 0.2);
    assert.ok(Math.abs(spotDistance('BARREL', 'SEAT_2') - 10.5) < 0.2);
    assert.ok(Math.abs(spotDistance('OVEN', 'SEAT_3') - 13.4) < 0.2);

    // Same-side trips (direct)
    assert.ok(Math.abs(spotDistance('STOVE', 'BARREL') - 4.5) < 0.2);
    assert.ok(Math.abs(spotDistance('BARREL', 'OVEN') - 9.0) < 0.2);
    assert.ok(Math.abs(spotDistance('STOVE', 'OVEN') - 13.5) < 0.2);
});

test('cross-bar paths route through FLAP waypoint', () => {
    const crossPath = spotPath('STOVE', 'SEAT_1');
    assert.equal(crossPath.length, 3);
    assert.deepEqual(crossPath[1], { x: 0, z: FLAP_Z });

    const samePath = spotPath('STOVE', 'OVEN');
    assert.equal(samePath.length, 2);
});

test('travel time calculation matches distance divided by speed', () => {
    const dist = spotDistance('STOVE', 'SEAT_1');
    assert.equal(travelTime('STOVE', 'SEAT_1', 5.5), dist / 5.5);
});
