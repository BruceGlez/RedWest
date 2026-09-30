import test from 'node:test';
import assert from 'node:assert/strict';
import { moveInTown, clampToAreas, pushOutOfBox, stepFromInput, nearestDoor, turnToward, PLAYER_RADIUS, WALK_SPEED, DOOR_REACH } from '../src/townWalkLogic.js';

const map = {
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    boxes: [{ minX: -2, maxX: 2, minZ: -2, maxZ: 2 }],
    doors: [{ id: 'bank', label: 'BANK', x: 0, z: 3.3 }, { id: 'jail', label: 'JAIL', x: 10, z: 3.3 }]
};

test('walking in the open moves by the step', () => {
    const [x, z] = moveInTown(map, 10, 10, 1, -1);
    assert.ok(Math.abs(x - 11) < 1e-6 && Math.abs(z - 9) < 1e-6);
});

test('a building stops the marshal and lets him slide along the wall', () => {
    // Push diagonally at the box from the south (still under its span, x from -1 to 0.5): z is stopped, x slides.
    let x = -1, z = 3;
    for(let i = 0; i < 15; i++) [x, z] = moveInTown(map, x, z, 0.1, -0.3);
    assert.ok(z >= 2 + PLAYER_RADIUS - 1e-6, `stopped at the wall, z = ${z}`);
    assert.ok(x > 0, `slid along it, x = ${x}`);
    // Keep going and he rounds the corner instead of sticking.
    for(let i = 0; i < 40; i++) [x, z] = moveInTown(map, x, z, 0.1, -0.3);
    assert.ok(z < 2, `rounded the corner, z = ${z}`);
});

test('no step, however long, goes through a wall', () => {
    const [, z] = moveInTown(map, 0, 6, 0, -30); // a frame hitch: one huge step straight through the building
    assert.ok(z >= 2 + PLAYER_RADIUS - 1e-6, `z = ${z}`);
});

test('the town edge holds the marshal in', () => {
    const [x, z] = moveInTown(map, 19, -19, 50, -50);
    assert.ok(x <= 20 - PLAYER_RADIUS + 1e-6 && z >= -20 + PLAYER_RADIUS - 1e-6);
});

test('standing inside a box is pushed out by the nearest side', () => {
    const [x, z] = pushOutOfBox(1.5, 0, PLAYER_RADIUS, map.boxes[0]);
    assert.ok(x >= 2 + PLAYER_RADIUS - 1e-6 && z === 0);
});

test('input maps to ground movement relative to the camera, and diagonals are not faster', () => {
    const none = stepFromInput(0, 0, 0.52, 0.016);
    assert.equal(none.moving, false);
    const up = stepFromInput(0, 1, 0, 1);
    assert.ok(Math.abs(up.dx) < 1e-9 && Math.abs(up.dz + WALK_SPEED) < 1e-9, 'up the screen is -z with no camera turn');
    const diagonal = stepFromInput(1, 1, 0.52, 1);
    assert.ok(Math.abs(Math.hypot(diagonal.dx, diagonal.dz) - WALK_SPEED) < 1e-6);
    const light = stepFromInput(0.3, 0, 0, 1);
    assert.ok(Math.abs(Math.hypot(light.dx, light.dz) - WALK_SPEED * 0.3) < 1e-6, 'a light push on the stick walks slowly');
});

test('the nearest door within reach is offered, and none when far', () => {
    assert.equal(nearestDoor(map, 0, 4)?.id, 'bank');
    assert.equal(nearestDoor(map, 9, 4)?.id, 'jail');
    assert.equal(nearestDoor(map, 5, 10), null);
    assert.equal(nearestDoor(map, 0, 3.3 + DOOR_REACH + 0.1), null);
});

test('turning takes the short way round', () => {
    const next = turnToward(Math.PI - 0.1, -Math.PI + 0.1, 1);
    assert.ok(Math.abs(next - (Math.PI + 0.1)) < 1e-9, 'across the +-pi seam, not the long way');
    assert.equal(turnToward(0, 1, 0), 0);
});

test('the ground can be several areas: a marshal crosses where they overlap and is held in at the far edge', () => {
    const town = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    const yard = { minX: 17, maxX: 50, minZ: -5, maxZ: 5 }; // reaches 3 units into the town
    const two = { areas: [town, yard], boxes: [], doors: [] };
    let x = 10, z = 0;
    for(let i = 0; i < 60; i++) [x, z] = moveInTown(two, x, z, 1, 0);
    assert.ok(x > 45, `walked on into the yard, x = ${x}`);
    assert.ok(x <= 50 - PLAYER_RADIUS + 1e-6, 'held in at the yard end');
    // The yard is narrower than the town: stepping sideways out of it is stopped, but the town is still open.
    [x, z] = moveInTown(two, 40, 0, 0, 30);
    assert.ok(z <= 5 - PLAYER_RADIUS + 1e-6, `held in by the yard's side, z = ${z}`);
    [x, z] = moveInTown(two, 0, 0, 0, 30);
    assert.ok(z > 10, 'the town itself is wider');
});

test('a shut district is simply not an area: the fence line holds', () => {
    const town = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    const shut = { areas: [town], boxes: [], doors: [] };
    const [x] = moveInTown(shut, 18, 0, 10, 0);
    assert.ok(x <= 20 - PLAYER_RADIUS + 1e-6);
});

test('clampToAreas leaves a point that is already on the ground, and finds the nearest ground otherwise', () => {
    const areas = [{ minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, { minX: 20, maxX: 30, minZ: 0, maxZ: 10 }];
    assert.deepEqual(clampToAreas(areas, 5, 5, 0.6), [5, 5]);
    assert.deepEqual(clampToAreas(areas, 25, -4, 0.6), [25, 0.6]);
    const [x] = clampToAreas(areas, 17, 5, 0.6); // nearer the second area
    assert.ok(x > 19);
});
