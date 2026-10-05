import test from 'node:test';
import assert from 'node:assert/strict';
import { VANE_AREA, VANE_START, BLOCKS, SPOTS, vaneMap, vaneLabel } from '../src/vaneLayout.js';
import { createVanePlace } from '../src/places/vane.js';
import { openOrders } from '../src/farmOrders.js';
import { createProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { moveInTown, nearestDoor, PLAYER_RADIUS } from '../src/townWalkLogic.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const map = vaneMap();
const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const standable = (x, z) => { const [px, pz] = moveInTown(map, x, z, 0, 0); return Math.hypot(px - x, pz - z) < 1e-9; };
const open = () => {
    const profile = createProfile(T0);
    profile.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'silas-vane')] = 1;
    profile.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'calloway-gang')] = 1;
    return profile;
};

test('the Crossing is one flat map: ground, walls, and a door for the wagon, the clock, the board and the way out', () => {
    assert.deepEqual(map.areas, [VANE_AREA]);
    assert.equal(map.boxes.length, BLOCKS.length);
    assert.deepEqual(map.doors.map(d => d.id).sort(), ['board', 'clock', 'leave', 'wagon']);
    assert.ok(standable(...VANE_START) && inside(VANE_AREA, VANE_START[0], VANE_START[1], PLAYER_RADIUS));
});

test('every door can be stood at, is the nearest there, and can be walked to from the gate', () => {
    const step = 0.5;
    const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
    const seen = new Set([key(...VANE_START)]);
    const queue = [VANE_START];
    while(queue.length) {
        const [x, z] = queue.pop();
        for(const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = x + dx, nz = z + dz;
            if(seen.has(key(nx, nz)) || !inside(VANE_AREA, nx, nz, PLAYER_RADIUS) || !standable(nx, nz)) continue;
            seen.add(key(nx, nz));
            queue.push([nx, nz]);
        }
    }
    for(const door of map.doors) {
        assert.ok(inside(VANE_AREA, door.x, door.z, PLAYER_RADIUS), `${door.id} is in the yard`);
        assert.ok(standable(door.x, door.z), `${door.id} is not inside a wall`);
        assert.equal(nearestDoor(map, door.x, door.z)?.id, door.id, `${door.id} is the nearest door at its own spot`);
        assert.ok(seen.has(key(door.x, door.z)), `${door.id} is reachable`);
    }
    assert.equal(SPOTS.length, map.doors.length);
});

test('the board prompt says how many orders wait', () => {
    const profile = open();
    assert.equal(vaneLabel({ id: 'board' }, profile, T0), 'THE ORDER BOARD: 3 ORDERS');
    assert.equal(vaneLabel({ id: 'board' }, null), 'THE ORDER BOARD');
    assert.equal(vaneLabel({ id: 'leave' }), 'THE ROAD TO TOWN');
    assert.equal(vaneLabel({ id: 'clock' }), 'THE STOPPED CLOCK');
});

function host(profile, calls = []) {
    return {
        profile: () => profile, closeCard: () => calls.push(['close']), track: e => calls.push(['track', e]), onProfile: p => calls.push(['profile', p]),
        toast: (t, err) => calls.push(['toast', t, !!err]), act: async (work, onError) => { try { await work(); } catch(error) { onError(error.message); } },
        wallet: { orders: async body => { calls.push(['wallet', body]); return { profile: { marker: 'new' }, result: { dollars: 31 } }; } }
    };
}

test('the Crossing cannot be entered until Silas Vane has a star, and only the gate in the town leads in', () => {
    assert.equal(createVanePlace(host(createProfile(T0))).canEnter(), false);
    assert.equal(createVanePlace(host(null)).canEnter(), false);
    const place = createVanePlace(host(open()));
    assert.equal(place.canEnter(), true);
    assert.equal(place.entrance('enter-crossing'), true);
    assert.equal(place.entrance('enter-ranch'), false);
});

test('the board card lists today\'s orders with a FILL button only for those the barn can cover', () => {
    const profile = open();
    const orders = openOrders(profile, new Date());
    const place = createVanePlace(host(profile));
    let html = place.card('board');
    assert.equal((html.match(/data-order=/g) ?? []).length, orders.length);
    assert.equal((html.match(/ disabled/g) ?? []).length, orders.length, 'an empty barn fills nothing');
    for(const w of orders[0].wants) profile.town.farm.store[w.good] = w.count;
    html = place.card('board');
    assert.ok(!new RegExp(`data-order="${orders[0].id}" disabled`).test(html), 'the first order can be filled now');
    assert.match(html, new RegExp(`\\$${orders[0].pays}`));
    assert.equal(place.card('nowhere'), '');
});

test('a shut Crossing shows no orders on its board', () => {
    const place = createVanePlace(host(createProfile(T0)));
    assert.match(place.card('board'), /SILAS VANE is beaten/);
    assert.ok(!place.card('board').includes('data-order'));
});

test('FILL runs the wallet, hands the new profile back and says what was paid; other buttons are ignored', async () => {
    const calls = [];
    const place = createVanePlace(host(open(), calls));
    assert.equal(place.click({ dataset: {}, hasAttribute: () => false }), false);
    assert.equal(place.click({ dataset: { order: '20000:1' }, hasAttribute: () => false }), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, [
        ['close'], ['wallet', { action: 'fill', order: '20000:1' }], ['profile', { marker: 'new' }], ['track', 'orders_fill'], ['toast', 'Order filled for $31.', false]
    ]);
});

test('a refused order is told to the player as an error toast', async () => {
    const calls = [];
    const h = host(open(), calls);
    h.wallet.orders = async () => { throw new Error('The barn does not have enough for that order.'); };
    createVanePlace(h).click({ dataset: { order: '1:1' }, hasAttribute: () => false });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.at(-1), ['toast', 'The barn does not have enough for that order.', true]);
});

test('the first visit starts the player\'s days, and a visit after that does nothing', async () => {
    const calls = [];
    const profile = open();
    profile.town.orders.since = null;
    const place = createVanePlace({ ...host(profile, calls), markVisited: id => calls.push(['visited', id]) });
    place.entered();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.filter(c => c[0] === 'wallet'), [['wallet', { action: 'visit' }]]);
    calls.length = 0;
    profile.town.orders.since = 20000;
    place.entered();
    assert.deepEqual(calls, [['visited', 'crossing']]);
});
