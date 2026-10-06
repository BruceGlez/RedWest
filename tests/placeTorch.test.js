import test from 'node:test';
import assert from 'node:assert/strict';
import { torchHoles, MAX_TORCHES, TORCH_LIGHT_RADIUS } from '../src/placeTorch.js';

test('only lit torches clear the dark, nearest first, and never more than the limit', () => {
    const list = [{ x: 30, z: 0, lit: true }, { x: 5, z: 0, lit: false }, { x: 10, z: 0, lit: true }, { x: 20, z: 0, lit: true }];
    const holes = torchHoles(list, { x: 0, z: 0 }, 2);
    assert.deepEqual(holes.map(h => h.x), [10, 20]);
    assert.ok(holes.every(h => h.r === TORCH_LIGHT_RADIUS && h.k > 0 && h.k <= 1));
});

test('a put-out torch gives no light, so a light eater\'s work shows', () => {
    assert.deepEqual(torchHoles([{ x: 1, z: 1, lit: false }], { x: 0, z: 0 }), []);
});

test('the layer is capped so the instanced meshes never overflow', () => {
    assert.ok(MAX_TORCHES >= 32);
});
