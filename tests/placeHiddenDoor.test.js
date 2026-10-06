import test from 'node:test';
import assert from 'node:assert/strict';
import { reveal, createHiddenDoor, NOTICE_FAR, NOTICE_NEAR } from '../src/placeHiddenDoor.js';

test('far away the door is a plain wall; close up it gives itself away, smoothly', () => {
    assert.equal(reveal(NOTICE_FAR + 5), 0);
    assert.equal(reveal(NOTICE_NEAR - 1), 1);
    let last = 2;
    for(let d = 0; d <= 20; d += 0.5) { const r = reveal(d); assert.ok(r <= last); last = r; }
});

test('the tell fades once the door is open, and the door swings', () => {
    const door = createHiddenDoor();
    door.update(1, 3);
    assert.ok(door.shown > 0.9, 'close and shut: the seam shows');
    assert.ok(door.hinge.rotation.y === 0);
    door.setOpen(true);
    for(let i = 0; i < 400; i++) door.update(i / 60, 3);
    assert.equal(door.openAmount, 1);
    assert.ok(door.hinge.rotation.y < -1.5, 'swung open');
    assert.equal(door.shown, 0, 'an open door needs no hint');
});
