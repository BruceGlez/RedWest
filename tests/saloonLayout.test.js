import test from 'node:test';
import assert from 'node:assert/strict';
import { SALOON_AREA, SALOON_START, SALOON, BLOCKS, SHELF, SPOTS, saloonMap, saloonLabel } from '../src/saloonLayout.js';
import { createSaloonPlace } from '../src/places/saloon.js';
import { settleShift, PAID_SHIFTS_PER_DAY } from '../src/saloon.js';
import { createProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { moveInTown, nearestDoor, PLAYER_RADIUS } from '../src/townWalkLogic.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const map = saloonMap();
const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const standable = (x, z) => { const [px, pz] = moveInTown(map, x, z, 0, 0); return Math.hypot(px - x, pz - z) < 1e-9; };
const withStars = ids => {
    const p = createProfile(T0);
    for(const id of ids) p.stats.stageStars[OUTLAWS.findIndex(o => o.id === id)] = 1;
    return p;
};
const host = profile => ({ profile: () => profile, markVisited: () => {} });

test('Copper Bit is one flat map: ground, walls and a door for the bar, the piano, the upgrade shelf and the way out', () => {
    assert.deepEqual(map.areas, [SALOON_AREA]);
    assert.equal(map.boxes.length, BLOCKS.length);
    assert.deepEqual(map.doors.map(d => d.id).sort(), ['bar', 'leave', 'piano', 'shelf']);
    assert.ok(standable(...SALOON_START) && inside(SALOON_AREA, SALOON_START[0], SALOON_START[1], PLAYER_RADIUS));
});

test('every door can be stood at, is the nearest there, and can be walked to from the gate', () => {
    const step = 0.5;
    const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
    const seen = new Set([key(...SALOON_START)]);
    const queue = [SALOON_START];
    while(queue.length) {
        const [x, z] = queue.pop();
        for(const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = x + dx, nz = z + dz;
            if(seen.has(key(nx, nz)) || !inside(SALOON_AREA, nx, nz, PLAYER_RADIUS) || !standable(nx, nz)) continue;
            seen.add(key(nx, nz));
            queue.push([nx, nz]);
        }
    }
    for(const door of map.doors) {
        assert.ok(inside(SALOON_AREA, door.x, door.z, PLAYER_RADIUS), `${door.id} is in the street`);
        assert.ok(standable(door.x, door.z), `${door.id} is not inside a wall`);
        assert.equal(nearestDoor(map, door.x, door.z)?.id, door.id, `${door.id} is the nearest door at its own spot`);
        assert.ok(seen.has(key(door.x, door.z)), `${door.id} is reachable`);
    }
    assert.equal(SPOTS.length, map.doors.length);
});

test('the bar prompt says how many paid shifts are left today', () => {
    const p = withStars(['dusty-pete']);
    assert.equal(saloonLabel({ id: 'bar' }, p, T0), "DUSTY PETE'S BAR: 3 PAID SHIFTS LEFT");
    for(let i = 0; i < PAID_SHIFTS_PER_DAY - 1; i++) settleShift(p, { night: 1, served: [] }, T0);
    assert.equal(saloonLabel({ id: 'bar' }, p, T0), "DUSTY PETE'S BAR: 1 PAID SHIFT LEFT");
    assert.equal(saloonLabel({ id: 'bar' }), "DUSTY PETE'S BAR");
    assert.equal(saloonLabel({ id: 'leave' }), 'THE ROAD TO TOWN');
    assert.equal(saloonLabel({ id: 'piano' }), 'THE BROKEN PIANO');
    assert.equal(saloonLabel({ id: 'shelf' }), 'THE UPGRADE SHELF');
});

test('the saloon cannot be entered until Dusty Pete has a star, and only its own gate leads in', () => {
    assert.equal(createSaloonPlace(host(withStars(['calloway-gang']))).canEnter(), false);
    assert.equal(createSaloonPlace(host(null)).canEnter(), false);
    const place = createSaloonPlace(host(withStars(['dusty-pete'])));
    assert.equal(place.canEnter(), true);
    assert.equal(place.entrance('enter-copper'), true);
    assert.equal(place.entrance('enter-canal'), false);
    assert.equal(place.click({ dataset: {}, hasAttribute: () => false }), false);
});

test('the bar card shows the night, the menu and the paid shifts; the farm adds dishes', () => {
    const alone = createSaloonPlace(host(withStars(['dusty-pete']))).card('bar');
    assert.match(alone, /night 1 of 10/);
    assert.match(alone, /3 of 3 paid shifts left/);
    assert.match(alone, /BEANS <b>\$3<\/b>/);
    assert.match(alone, /data-shift="1"[^>]*>START NIGHT 1/);
    assert.ok(!/data-shift="2"/.test(alone), 'night 2 is shut until night 1 has a star');
    assert.ok(!/EGG PLATE/.test(alone));
    const p = withStars(['dusty-pete', 'calloway-gang']);
    p.town.saloon.nights = [3, 3, 0, 0, 0, 0, 0, 0, 0, 0];
    const farmed = createSaloonPlace(host(p)).card('bar');
    assert.match(farmed, /night 3 of 10/);
    assert.match(farmed, /EGG PLATE <b>\$5<\/b>/);
    assert.match(farmed, /NIGHT 1 <b>\*\*\*<\/b>/);
    assert.match(farmed, /data-shift="3"[^>]*>START NIGHT 3/);
    assert.match(farmed, /data-shift="1"[^>]*>REPLAY NIGHT 1/);
    for(let i = 0; i < PAID_SHIFTS_PER_DAY; i++) settleShift(p, { night: 1, served: [] }, new Date());
    assert.match(createSaloonPlace(host(p)).card('bar'), /paid shifts are done/);
});

test('a shut saloon shows no menu, and the piano card still reads', () => {
    const shut = createSaloonPlace(host(createProfile(T0)));
    assert.match(shut.card('bar'), /DUSTY PETE is beaten/);
    assert.ok(!shut.card('bar').includes('On the menu'));
    assert.match(shut.card('piano'), /sour notes/);
    assert.equal(shut.card('nowhere'), '');
});

test('only the START NIGHT buttons are the saloon\'s, and a shut saloon starts nothing', () => {
    const place = createSaloonPlace({ ...host(createProfile(T0)), closeCard: () => { throw new Error('a shut saloon must not start a shift'); } });
    assert.equal(place.click({ dataset: { shift: '1' }, hasAttribute: () => false }), true);
    assert.equal(place.click({ dataset: { plant: 'wheat' }, hasAttribute: () => false }), false);
});

test('the shelf stands against the saloon\'s front wall, clear of the door, and its spot is in front of it', () => {
    assert.ok(BLOCKS.includes(SHELF));
    assert.ok(SHELF.z - SHELF.hz >= SALOON.z + SALOON.hz - 1e-9, 'the shelf is outside the building');
    assert.ok(Math.abs(SHELF.x - SALOON.x) - SHELF.hx > 1.5, 'and does not block the bar\'s door');
    const shelf = map.doors.find(d => d.id === 'shelf');
    const bar = map.doors.find(d => d.id === 'bar');
    assert.equal(shelf.verb, 'SHOP');
    assert.ok(shelf.z > SHELF.z + SHELF.hz, 'in front, on the +z side');
    assert.ok(Math.hypot(shelf.x - bar.x, shelf.z - bar.z) > 2.8 * 1.5, 'far enough from the bar that each prompt is its own');
});
