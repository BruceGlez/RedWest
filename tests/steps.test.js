import test from 'node:test';
import assert from 'node:assert/strict';
import { createStepper, advanceStepper, STRIDE } from '../src/steps.js';

test('a foot lands every stride, left then right', () => {
    const s = createStepper();
    assert.deepEqual(advanceStepper(s, STRIDE * 0.5), []);
    assert.deepEqual(advanceStepper(s, STRIDE * 0.5), [{ left: true }]);
    assert.deepEqual(advanceStepper(s, STRIDE), [{ left: false }]);
    assert.deepEqual(advanceStepper(s, STRIDE), [{ left: true }]);
});

test('a dash covers several strides in one frame, and standing still makes none', () => {
    const s = createStepper();
    const steps = advanceStepper(s, STRIDE * 3.2);
    assert.deepEqual(steps.map(x => x.left), [true, false, true]);
    assert.deepEqual(advanceStepper(s, 0), []);
    assert.ok(s.travelled < STRIDE);
});
