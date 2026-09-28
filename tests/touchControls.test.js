import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector, FIRE_THRESHOLD } from '../src/touchControls.js';

test('a small wobble inside the dead zone reads as no input', () => {
    assert.deepEqual(stickVector(100, 100, 105, 103), { x: 0, y: 0, magnitude: 0 });
});

test('dragging maps screen x/y onto a normalized direction', () => {
    const right = stickVector(100, 100, 128, 100, 56);
    assert.equal(right.magnitude, 0.5);
    assert.equal(right.x, 0.5);
    assert.equal(right.y, 0);
    const down = stickVector(100, 100, 100, 156, 56);
    assert.deepEqual(down, { x: 0, y: 1, magnitude: 1 });
});

test('dragging past the rim is clamped to full tilt', () => {
    const v = stickVector(0, 0, 300, 400, 56);
    assert.equal(v.magnitude, 1);
    assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
    assert.ok(Math.abs(v.x - 0.6) < 1e-9 && Math.abs(v.y - 0.8) < 1e-9);
});

test('the aim stick only fires once pushed past the fire threshold', () => {
    assert.ok(stickVector(0, 0, 56 * (FIRE_THRESHOLD - 0.05), 0, 56).magnitude < FIRE_THRESHOLD);
    assert.ok(stickVector(0, 0, 56 * (FIRE_THRESHOLD + 0.05), 0, 56).magnitude >= FIRE_THRESHOLD);
});
