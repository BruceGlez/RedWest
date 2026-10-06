import test from 'node:test';
import assert from 'node:assert/strict';
import { STORE_AREA, STORE_START, BLOCKS, SPOTS, KEEPER_NAME, storeMap, storeLabel } from '../src/storeLayout.js';
import { createStorePlace } from '../src/places/store.js';
import { SPOTS as TOWN_SPOTS, getSpot, spotLabel } from '../src/townSpots.js';
import { STORE_AT, UNDERTAKER_AT, TOWN_LAYOUT } from '../src/townSpace.js';
import { createProfile } from '../src/profile.js';
import { LIGHT_ITEMS, priceOf } from '../src/mineLight.js';
import { moveInTown, nearestDoor, PLAYER_RADIUS } from '../src/townWalkLogic.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const map = storeMap();
const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const standable = (x, z) => { const [px, pz] = moveInTown(map, x, z, 0, 0); return Math.hypot(px - x, pz - z) < 1e-9; };
const host = (profile, wallet = {}, calls = []) => ({
    profile: () => profile, openBuilding: id => calls.push(['open', id]), onProfile: p => calls.push(['profile', p]), track: e => calls.push(['track', e]),
    toast: (t, err) => calls.push(['toast', t, !!err]), act: async (work, onError) => { try { await work(); } catch(error) { onError(error.message); } }, wallet
});

test('the store is one flat room: ground, walls, a counter and the way out', () => {
    assert.deepEqual(map.areas, [STORE_AREA]);
    assert.equal(map.boxes.length, BLOCKS.length);
    assert.deepEqual(map.doors.map(d => d.id).sort(), ['counter', 'leave']);
    assert.ok(standable(...STORE_START) && inside(STORE_AREA, STORE_START[0], STORE_START[1], PLAYER_RADIUS));
});

test('every door can be stood at, is the nearest there, and can be walked to from the door', () => {
    const step = 0.5;
    const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
    const seen = new Set([key(...STORE_START)]);
    const queue = [STORE_START];
    while(queue.length) {
        const [x, z] = queue.pop();
        for(const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = x + dx, nz = z + dz;
            if(seen.has(key(nx, nz)) || !inside(STORE_AREA, nx, nz, PLAYER_RADIUS) || !standable(nx, nz)) continue;
            seen.add(key(nx, nz));
            queue.push([nx, nz]);
        }
    }
    for(const door of map.doors) {
        assert.ok(inside(STORE_AREA, door.x, door.z, PLAYER_RADIUS), `${door.id} is in the room`);
        assert.ok(standable(door.x, door.z), `${door.id} is not inside a wall`);
        assert.equal(nearestDoor(map, door.x, door.z)?.id, door.id, `${door.id} is the nearest door at its own spot`);
        assert.ok(seen.has(key(door.x, door.z)), `${door.id} is reachable`);
    }
    assert.equal(SPOTS.length, map.doors.length);
});

test('the store has a door on the town street, clear of the other buildings, and its own prompt', () => {
    const door = getSpot('store');
    assert.ok(door && door.verb === 'ENTER');
    assert.equal(spotLabel('store'), 'THE GENERAL STORE');
    assert.ok(Math.hypot(STORE_AT[0] - UNDERTAKER_AT[0], STORE_AT[1] - UNDERTAKER_AT[1]) > 10, 'apart from the undertaker');
    for(const b of TOWN_LAYOUT) assert.ok(Math.hypot(STORE_AT[0] - b.x, STORE_AT[1] - b.z) > 14, `apart from the ${b.id}`);
    for(const other of TOWN_SPOTS.filter(s => s.id !== 'store')) {
        assert.ok(Math.hypot(door.stand[0] - other.stand[0], door.stand[1] - other.stand[1]) >= 3.5, `its door is not on top of the ${other.id}`);
    }
});

test('anybody can walk in, and only the store\'s own door leads in', () => {
    const place = createStorePlace(host(createProfile(T0)));
    assert.equal(place.canEnter(), true);
    assert.equal(createStorePlace(host(null)).canEnter(), false, 'before the profile has loaded');
    assert.equal(place.entrance('store'), true);
    assert.equal(place.entrance('undertaker'), false);
    assert.equal(place.entrance('enter-copper'), false);
    assert.equal(place.click({ dataset: {} }), false);
});

test('the counter card names the shopkeeper and sells light at the store\'s prices, a little over Mr. Grimsby\'s, in dollars only', () => {
    const html = createStorePlace(host(createProfile(T0))).card('counter');
    assert.match(html, new RegExp(KEEPER_NAME));
    assert.equal((html.match(/data-buy-light=/g) ?? []).length, 4);
    for(const id of Object.keys(LIGHT_ITEMS)) {
        assert.ok(html.includes(`$${priceOf(id, 'store')}`), `${id} at the store's price`);
        assert.ok(html.includes(`data-buy-light="${id}" data-shop="store"`));
        assert.ok(priceOf(id, 'store') >= priceOf(id, 'grimsby'));
    }
    assert.ok(!/nugget|gold|real money/i.test(html));
    assert.equal(createStorePlace(host(createProfile(T0))).card('nowhere'), '');
    assert.equal(createStorePlace(host(null)).card('counter'), '');
    assert.equal(storeLabel({ id: 'leave' }), 'BACK TO THE STREET');
});

test('a BUY at the counter goes to the wallet as the store\'s sale', async () => {
    const calls = [];
    const wallet = { buyLight: async body => { calls.push(['wallet', body]); return { result: { id: body.item, price: priceOf(body.item, 'store') }, profile: { marker: 'new' } }; } };
    const place = createStorePlace(host(createProfile(T0), wallet, calls));
    assert.equal(place.click({ dataset: { buyLight: 'torches', shop: 'store' } }), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.slice(0, 2), [['wallet', { item: 'torches', shop: 'store' }], ['profile', { marker: 'new' }]]);
    assert.deepEqual(calls.at(-1), ['toast', `Bought torches x5 for $${priceOf('torches', 'store')}.`, false]);
});
