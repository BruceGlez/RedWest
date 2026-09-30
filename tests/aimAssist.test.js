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

test('a shot leads a moving target by the time the bullet takes', async () => {
    const { leadPoint } = await import('../src/aimAssist.js');
    // 30 units away, walking sideways at 10 units/s, bullet at 60 units/s: about half a second, so 5 units ahead.
    const lead = leadPoint({ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 0, z: 10 }, 60);
    assert.equal(lead.x, 30);
    assert.ok(Math.abs(lead.z - 5.07) < 0.2, `leads by about 5 units (got ${lead.z})`);
    // A target standing still is aimed at directly, and the lead is capped for a wild velocity.
    assert.deepEqual(leadPoint({ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 0, z: 0 }, 60), { x: 30, z: 0 });
    assert.ok(leadPoint({ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 0, z: 500 }, 60).z <= 500 * 0.6 + 1e-6);
});

test('shots go from the gun to the aim point, not along the body line', async () => {
    const { directionTo } = await import('../src/aimAssist.js');
    // The muzzle is 1 unit to the right of the body; the target is straight ahead of the body at 20.
    const dir = directionTo({ x: 1, z: 1.8 }, { x: 0, z: 20 });
    assert.ok(dir.x < 0 && Math.abs(dir.x * 18.2 - -1) < 0.1, 'angled back toward the body line');
    assert.equal(directionTo({ x: 0, z: 0 }, { x: 0.5, z: 0.5 }), null, 'too close for a direction');
});
