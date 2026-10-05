import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANNEL_AREA, CHANNEL_START, BLOCKS, SPOTS, WATER, channelMap, channelLabel } from '../src/channelLayout.js';
import { createChannelPlace } from '../src/places/channel.js';
import { createProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { moveInTown, nearestDoor, PLAYER_RADIUS } from '../src/townWalkLogic.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const map = channelMap();
const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const standable = (x, z) => { const [px, pz] = moveInTown(map, x, z, 0, 0); return Math.hypot(px - x, pz - z) < 1e-9; };
const withStars = ids => {
    const p = createProfile(T0);
    for(const id of ids) p.stats.stageStars[OUTLAWS.findIndex(o => o.id === id)] = 1;
    return p;
};
const host = profile => ({ profile: () => profile, markVisited: () => {} });

test('the Channel is one flat map: ground, water, walls and a door for the sluice, the log and the way out', () => {
    assert.deepEqual(map.areas, [CHANNEL_AREA]);
    assert.equal(map.boxes.length, BLOCKS.length);
    assert.deepEqual(map.doors.map(d => d.id).sort(), ['leave', 'log', 'sluice']);
    assert.ok(standable(...CHANNEL_START) && inside(CHANNEL_AREA, CHANNEL_START[0], CHANNEL_START[1], PLAYER_RADIUS));
});

test('the water blocks the way, except over the footbridge', () => {
    assert.ok(!standable(-10, -0.75) && !standable(10, -0.75), 'no walking on the water');
    assert.ok(standable(0, -0.75), 'the bridge is open');
    assert.equal(WATER.length, 2);
});

test('every door can be stood at, is the nearest there, and can be walked to from the gate (the log is over the bridge)', () => {
    const step = 0.5;
    const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
    const seen = new Set([key(...CHANNEL_START)]);
    const queue = [CHANNEL_START];
    while(queue.length) {
        const [x, z] = queue.pop();
        for(const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = x + dx, nz = z + dz;
            if(seen.has(key(nx, nz)) || !inside(CHANNEL_AREA, nx, nz, PLAYER_RADIUS) || !standable(nx, nz)) continue;
            seen.add(key(nx, nz));
            queue.push([nx, nz]);
        }
    }
    for(const door of map.doors) {
        assert.ok(inside(CHANNEL_AREA, door.x, door.z, PLAYER_RADIUS), `${door.id} is in the area`);
        assert.ok(standable(door.x, door.z), `${door.id} is not inside a wall`);
        assert.equal(nearestDoor(map, door.x, door.z)?.id, door.id, `${door.id} is the nearest door at its own spot`);
        assert.ok(seen.has(key(door.x, door.z)), `${door.id} is reachable`);
    }
    assert.equal(SPOTS.length, map.doors.length);
});

test('the sluice prompt says when the farm is being watered', () => {
    assert.equal(channelLabel({ id: 'sluice' }, withStars(['calloway-gang', 'mesa-morgan'])), 'THE SLUICE: THE FARM IS WATERED');
    assert.equal(channelLabel({ id: 'sluice' }, withStars(['mesa-morgan'])), 'THE SLUICE');
    assert.equal(channelLabel({ id: 'sluice' }), 'THE SLUICE');
    assert.equal(channelLabel({ id: 'leave' }), 'THE ROAD TO TOWN');
});

test('the Channel cannot be entered until Mad Mesa Morgan has a star, and only its own gate leads in', () => {
    assert.equal(createChannelPlace(host(withStars(['calloway-gang']))).canEnter(), false);
    assert.equal(createChannelPlace(host(null)).canEnter(), false);
    const place = createChannelPlace(host(withStars(['mesa-morgan'])));
    assert.equal(place.canEnter(), true);
    assert.equal(place.entrance('enter-canal'), true);
    assert.equal(place.entrance('enter-crossing'), false);
    assert.equal(place.click({ dataset: {}, hasAttribute: () => false }), false);
});

test('the sluice card says what the water does, and says so when there is no farm yet', () => {
    const watered = createChannelPlace(host(withStars(['calloway-gang', 'mesa-morgan']))).card('sluice');
    assert.match(watered, /10% sooner/);
    assert.match(watered, /WHEAT <b>18m<\/b>/);
    const noFarm = createChannelPlace(host(withStars(['mesa-morgan']))).card('sluice');
    assert.match(noFarm, /still shut/);
    assert.ok(!/10% sooner/.test(noFarm));
    assert.match(createChannelPlace(host(withStars(['mesa-morgan']))).card('log'), /no blasting after dark/);
    assert.equal(createChannelPlace(host(withStars(['mesa-morgan']))).card('nowhere'), '');
});
