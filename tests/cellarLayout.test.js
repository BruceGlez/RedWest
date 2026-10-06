import test from 'node:test';
import assert from 'node:assert/strict';
import { CELLAR_AREA, CELLAR_START, BLOCKS, SPOTS, HIDDEN_REACH, cellarMap, cellarLabel, hiddenDoorOpen } from '../src/cellarLayout.js';
import { createCellarPlace } from '../src/places/cellar.js';
import { createProfile, normalizeProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { moveInTown, nearestDoor, DOOR_REACH, PLAYER_RADIUS } from '../src/townWalkLogic.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const map = cellarMap();
const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const standable = (x, z) => { const [px, pz] = moveInTown(map, x, z, 0, 0); return Math.hypot(px - x, pz - z) < 1e-9; };
const withStars = ids => {
    const p = createProfile(T0);
    for(const id of ids) p.stats.stageStars[OUTLAWS.findIndex(o => o.id === id)] = 1;
    return p;
};

test('the cellar is one flat room: ground, walls and two doors, the hidden one and the stairs up', () => {
    assert.deepEqual(map.areas, [CELLAR_AREA]);
    assert.equal(map.boxes.length, BLOCKS.length);
    assert.deepEqual(map.doors.map(d => d.id).sort(), ['up', 'wall']);
    assert.ok(standable(...CELLAR_START) && inside(CELLAR_AREA, CELLAR_START[0], CELLAR_START[1], PLAYER_RADIUS));
});

test('every door can be stood at, is the nearest there, and can be walked to from the stairs', () => {
    const step = 0.5;
    const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
    const seen = new Set([key(...CELLAR_START)]);
    const queue = [CELLAR_START];
    while(queue.length) {
        const [x, z] = queue.pop();
        for(const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = x + dx, nz = z + dz;
            if(seen.has(key(nx, nz)) || !inside(CELLAR_AREA, nx, nz, PLAYER_RADIUS) || !standable(nx, nz)) continue;
            seen.add(key(nx, nz));
            queue.push([nx, nz]);
        }
    }
    for(const door of map.doors) {
        assert.ok(inside(CELLAR_AREA, door.x, door.z, PLAYER_RADIUS), `${door.id} is in the room`);
        assert.ok(standable(door.x, door.z), `${door.id} is not inside a wall`);
        assert.equal(nearestDoor(map, door.x, door.z)?.id, door.id, `${door.id} is the nearest door at its own spot`);
        assert.ok(seen.has(key(door.x, door.z)), `${door.id} is reachable`);
    }
    assert.equal(SPOTS.length, map.doors.length);
});

test('the hidden door only shows its prompt when the marshal is right beside it', () => {
    const wall = map.doors.find(d => d.id === 'wall');
    assert.ok(HIDDEN_REACH < DOOR_REACH, 'closer than any ordinary door');
    assert.equal(nearestDoor(map, wall.x, wall.z)?.id, 'wall');
    assert.equal(nearestDoor(map, wall.x - (HIDDEN_REACH - 0.2), wall.z)?.id, 'wall', 'beside the wall');
    assert.equal(nearestDoor(map, wall.x - (HIDDEN_REACH + 0.3), wall.z), null, 'a step or two away, no prompt at all');
    assert.equal(nearestDoor(map, CELLAR_START[0], CELLAR_START[1])?.id === 'wall', false, 'nor from the foot of the stairs');
    const up = map.doors.find(d => d.id === 'up');
    assert.equal(nearestDoor(map, up.x + 2, up.z)?.id, 'up', 'the stairs keep the usual reach');
    // A door without its own reach behaves as before.
    assert.equal(nearestDoor({ doors: [{ id: 'a', x: 0, z: 0 }] }, 2.5, 0)?.id, 'a');
});

test('Deacon Graves alone opens the hidden door', () => {
    assert.equal(hiddenDoorOpen(createProfile(T0)), false);
    assert.equal(hiddenDoorOpen(null), false);
    assert.equal(hiddenDoorOpen(withStars(['dusty-pete', 'rattlesnake-rosa', 'calloway-gang', 'iron-jack', 'lucky-lou'])), false, 'no other outlaw opens it');
    const p = createProfile(T0);
    p.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'deacon-graves')] = 6; // stars without the "beaten" bit do not open it
    assert.equal(hiddenDoorOpen(p), false);
    assert.equal(hiddenDoorOpen(withStars(['deacon-graves'])), true);
});

test('the prompts: a hollow seam until the Deacon is beaten, then the door to the mine', () => {
    assert.equal(cellarLabel({ id: 'wall' }, createProfile(T0)), 'A HOLLOW SEAM IN THE WALL');
    assert.equal(cellarLabel({ id: 'wall' }, withStars(['deacon-graves'])), 'THE HIDDEN DOOR: THE HOLLOW CLAIM');
    assert.equal(cellarLabel({ id: 'up' }), 'THE STAIRS UP TO THE PARLOUR');
});

function host(profile, calls = []) {
    return { profile: () => profile, closeCard: () => calls.push(['close']), onDescend: floor => calls.push(['descend', floor]), goTo: id => calls.push(['goTo', id]), openBuilding: id => calls.push(['open', id]) };
}

test('the wall is shut until the Deacon is beaten: it says so, offers no floor, and a stale button cannot open it', () => {
    const calls = [];
    const place = createCellarPlace(host(createProfile(T0), calls));
    const card = place.card('wall');
    assert.match(card, /DEACON GRAVES/);
    assert.ok(!card.includes('data-descend'));
    assert.equal(place.click({ dataset: { descend: '1' } }), true);
    assert.deepEqual(calls, [], 'nothing started');
});

test('once the Deacon is beaten the wall offers floor 1 and every checkpoint, and a floor starts a run', () => {
    const calls = [];
    const p = withStars(['deacon-graves']);
    p.mine = { version: 1, deepest: 12, checkpoint: 10, ore: 3, runs: 4 };
    const place = createCellarPlace(host(p, calls));
    const card = place.card('wall');
    assert.deepEqual([...card.matchAll(/data-descend="(\d+)"/g)].map(m => m[1]), ['1', '5', '10']);
    assert.match(card, /deepest floor is 12/);
    assert.equal(place.click({ dataset: { descend: '5' } }), true);
    assert.deepEqual(calls, [['close'], ['descend', 5]]);
    assert.equal(place.click({ dataset: {} }), false);
});

test('a save from before the cellar keeps its deepest floor, checkpoints and ore', () => {
    const old = createProfile(T0);
    old.mine = { version: 1, deepest: 7, checkpoint: 5, ore: 9, runs: 2 };
    old.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'deacon-graves')] = 7;
    const back = normalizeProfile(JSON.parse(JSON.stringify(old)));
    assert.equal(back.mine.deepest, 7);
    assert.equal(back.mine.checkpoint, 5);
    assert.equal(back.mine.ore, 9);
    assert.match(createCellarPlace(host(back)).card('wall'), /data-descend="5"/);
});

test('the stairs up lead back to the parlour, and the cellar is not reached from the town', () => {
    const calls = [];
    const place = createCellarPlace(host(createProfile(T0), calls));
    assert.equal(place.entrance('undertaker'), false);
    assert.equal(place.entrance('enter-copper'), false);
    assert.equal(place.canEnter(), true);
    assert.equal(createCellarPlace(host(null)).canEnter(), false);
    assert.equal(place.card('nowhere'), '');
});
