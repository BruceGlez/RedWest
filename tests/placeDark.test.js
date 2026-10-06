import test from 'node:test';
import assert from 'node:assert/strict';
import { darkAlpha, MIN_RADIUS, LANTERN_RADIUS } from '../src/placeDark.js';

test('the marshal always sees his own feet, even with no light at all', () => {
    assert.ok(darkAlpha(0, 0) < 0.01);
    assert.ok(darkAlpha(1.5, 0) < 0.2);
    assert.equal(darkAlpha(MIN_RADIUS, 0), 1); // the faint ring still ends: past it is black
});

test('outside the light it is truly black, inside it clears smoothly', () => {
    assert.equal(darkAlpha(LANTERN_RADIUS + 0.01, LANTERN_RADIUS), 1);
    assert.equal(darkAlpha(500, LANTERN_RADIUS), 1);
    let last = -1;
    for(let d = 0; d <= LANTERN_RADIUS; d += 0.5) {
        const a = darkAlpha(d, LANTERN_RADIUS);
        assert.ok(a >= last, 'never brighter further out');
        last = a;
    }
});

test('a bigger light clears more of the dark', () => {
    assert.ok(darkAlpha(10, 20) < darkAlpha(10, 12));
});
