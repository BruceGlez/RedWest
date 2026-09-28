import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTarget, edgeIndicator } from '../src/aimAssist.js';

const at = (x, z, id) => ({ id, position: { x, z } });
const origin = { x: 0, z: 0 };

test('tap-to-fire picks the nearest enemy in range', () => {
    const enemies = [at(30, 0, 'far'), at(0, -12, 'near'), at(100, 0, 'out')];
    assert.equal(pickTarget(origin, enemies).id, 'near');
    assert.equal(pickTarget(origin, [at(100, 0)]), null, 'nothing in range');
});

test('drag aim only snaps to enemies inside the assist cone', () => {
    const enemies = [at(20, 2, 'ahead'), at(0, 5, 'beside')];
    assert.equal(pickTarget(origin, enemies, { dirX: 1, dirZ: 0 }).id, 'ahead');
    assert.equal(pickTarget(origin, [at(0, 5)], { dirX: 1, dirZ: 0 }), null, 'a closer enemy off to the side is ignored');
    assert.equal(pickTarget(origin, [at(-20, -1, 'behind-wrap')], { dirX: -1, dirZ: 0.01 }).id, 'behind-wrap', 'angles wrap around ±π');
});

test('edge arrows sit inside the screen margin and point at the target', () => {
    assert.equal(edgeIndicator(0.5, 0.5, 800, 400), null, 'on-screen targets get no arrow');
    const right = edgeIndicator(3, 0, 800, 400, 20);
    assert.deepEqual([right.x, right.y, right.angle], [780, 200, 0]);
    const top = edgeIndicator(0, 2, 800, 400, 20);
    assert.equal(top.y, 20);
    assert.ok(Math.abs(top.angle + Math.PI / 2) < 1e-9, 'points up');
});
