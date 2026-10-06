import test from 'node:test';
import assert from 'node:assert/strict';
import { PARLOUR_AREA, PARLOUR_START, BLOCKS, SPOTS, STAIRS, COUNTER, parlourMap, parlourLabel, grimsbyLine, GRIMSBY_LINES } from '../src/undertakerLayout.js';
import { moveInTown, nearestDoor, DOOR_REACH, PLAYER_RADIUS } from '../src/townWalkLogic.js';

const map = parlourMap();
const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const overlaps = (a, b) => Math.min(a.maxX, b.maxX) > Math.max(a.minX, b.minX) && Math.min(a.maxZ, b.maxZ) > Math.max(a.minZ, b.minZ);
const standable = (x, z) => { const [px, pz] = moveInTown(map, x, z, 0, 0); return Math.hypot(px - x, pz - z) < 1e-9; };

test('the parlour is one flat room: ground, walls and three doors', () => {
    assert.deepEqual(map.areas, [PARLOUR_AREA]);
    assert.equal(map.boxes.length, BLOCKS.length);
    assert.deepEqual(map.doors.map(d => d.id), ['grimsby', 'cellar', 'leave']);
    assert.deepEqual(map.doors.map(d => d.verb), ['TALK', 'DESCEND', 'LEAVE']);
    assert.ok(standable(...PARLOUR_START), 'the marshal starts on open ground');
    assert.ok(inside(PARLOUR_AREA, PARLOUR_START[0], PARLOUR_START[1], PLAYER_RADIUS));
});

test('the marshal starts inside the door, without a prompt already up', () => {
    assert.equal(nearestDoor(map, PARLOUR_START[0], PARLOUR_START[1]), null);
    const leave = SPOTS.find(s => s.id === 'leave');
    assert.ok(Math.hypot(leave.x - PARLOUR_START[0], leave.z - PARLOUR_START[1]) > DOOR_REACH, 'the door is a step away');
});

test('every door can be stood at, and from there it is the door that is offered', () => {
    for(const door of map.doors) {
        assert.ok(inside(PARLOUR_AREA, door.x, door.z, PLAYER_RADIUS), `${door.id} is in the room`);
        assert.ok(standable(door.x, door.z), `${door.id} is not inside a wall`);
        assert.equal(nearestDoor(map, door.x, door.z)?.id, door.id, `${door.id} is the nearest door at its own spot`);
    }
});

test('every door can be walked to from the street door (the parlour has no dead ends)', () => {
    const step = 0.5;
    const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
    const seen = new Set([key(...PARLOUR_START)]);
    const queue = [PARLOUR_START];
    while(queue.length) {
        const [x, z] = queue.pop();
        for(const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = x + dx, nz = z + dz;
            if(seen.has(key(nx, nz)) || !inside(PARLOUR_AREA, nx, nz, PLAYER_RADIUS) || !standable(nx, nz)) continue;
            seen.add(key(nx, nz));
            queue.push([nx, nz]);
        }
    }
    for(const door of map.doors) assert.ok(seen.has(key(door.x, door.z)), `${door.id} is reachable`);
});

test('the furniture is in the room, apart from each other, and leaves room to walk between', () => {
    const solid = BLOCKS.map(b => ({ minX: b.x - b.hx, maxX: b.x + b.hx, minZ: b.z - b.hz, maxZ: b.z + b.hz }));
    solid.forEach((a, i) => {
        assert.ok(inside(PARLOUR_AREA, a.minX, a.minZ) && inside(PARLOUR_AREA, a.maxX, a.maxZ), `block ${i} is in the room`);
        solid.forEach((b, j) => { if(i < j && j !== BLOCKS.length - 1 && i !== BLOCKS.length - 1) assert.ok(!overlaps(a, b), `blocks ${i} and ${j} do not overlap`); });
    });
    // The coffins stand clear of each other by more than the marshal is wide.
    const coffins = BLOCKS.filter(b => b.hz === 2.5);
    for(let i = 0; i + 1 < coffins.length; i++) assert.ok(coffins[i + 1].x - coffins[i + 1].hx - (coffins[i].x + coffins[i].hx) > PLAYER_RADIUS * 2, 'room to walk between the coffins');
    // The stairs and the counter keep the way to the back of the room open.
    assert.ok(STAIRS.x - STAIRS.hx - (coffins.at(-1).x + coffins.at(-1).hx) > PLAYER_RADIUS * 2, 'a way between the coffins and the stairs');
    assert.ok(COUNTER.x + COUNTER.hx < coffins[0].x - coffins[0].hx, 'the counter is clear of the coffins');
});

test('the prompts say where each door goes', () => {
    assert.equal(parlourLabel({ id: 'grimsby' }), 'MR. GRIMSBY, UNDERTAKER');
    assert.match(parlourLabel({ id: 'cellar' }), /CELLAR STAIRS/);
    assert.equal(parlourLabel({ id: 'leave' }), 'BACK TO THE STREET');
    assert.equal(parlourLabel({ id: 'other', label: 'OTHER' }), 'OTHER');
});

test('Mr. Grimsby has one line for how far the marshal has got, and it only moves on', () => {
    assert.equal(GRIMSBY_LINES[0].from, 0, 'there is a line for a marshal who has beaten nobody');
    for(let i = 1; i < GRIMSBY_LINES.length; i++) assert.ok(GRIMSBY_LINES[i].from > GRIMSBY_LINES[i - 1].from, 'in order');
    assert.equal(grimsbyLine(0), GRIMSBY_LINES[0].line);
    assert.equal(grimsbyLine(2), GRIMSBY_LINES[1].line);
    assert.equal(grimsbyLine(10), GRIMSBY_LINES.at(-1).line);
    assert.equal(grimsbyLine(99), GRIMSBY_LINES.at(-1).line);
    assert.equal(grimsbyLine(-3), GRIMSBY_LINES[0].line);
    assert.equal(grimsbyLine(undefined), GRIMSBY_LINES[0].line);
    assert.equal(grimsbyLine('4'), GRIMSBY_LINES[2].line);
});
