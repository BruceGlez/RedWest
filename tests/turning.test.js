import test from 'node:test';
import assert from 'node:assert/strict';
import { TURN, angleDelta, createTurner, snapTurn, resetTurner } from '../src/turning.js';

const run = (current, wanted, seconds, dt = 1 / 60, turner = createTurner()) => {
    for(let t = 0; t < seconds; t += dt) current = snapTurn(turner, current, wanted, dt);
    return current;
};

test('angles are compared the short way round', () => {
    assert.ok(Math.abs(angleDelta(3, -3) - (2 * Math.PI - 6)) < 1e-9, 'across the +-pi seam');
    assert.ok(Math.abs(angleDelta(0, Math.PI / 2) - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(angleDelta(0.1, 0.1)) < 1e-9);
});

test('he snaps round: a right angle in about a tenth of a second, a half turn in under a quarter', () => {
    assert.ok(Math.abs(angleDelta(run(0, Math.PI / 2, 0.1), Math.PI / 2)) < 0.05, 'a quarter turn after 0.1 s');
    assert.ok(Math.abs(angleDelta(run(0, Math.PI, 0.25), Math.PI)) < 0.02, 'a half turn after 0.25 s');
});

test('he is much quicker than the old slow easing (rate 14), in the tail of the turn as well', () => {
    const slow = (current, wanted, seconds, dt = 1 / 60) => {
        for(let t = 0; t < seconds; t += dt) current += angleDelta(current, wanted) * (1 - Math.exp(-14 * dt));
        return current;
    };
    const old = Math.abs(angleDelta(slow(0, 2, 0.15), 2));
    const now = Math.abs(angleDelta(run(0, 2, 0.15), 2));
    assert.ok(now < old * 0.2, `left ${now.toFixed(3)} rad against ${old.toFixed(3)} rad`);
    assert.ok(Math.abs(angleDelta(run(0, 0.5, 0.1), 0.5)) < 0.01, 'a small turn still finishes, it does not crawl');
});

test('he turns the short way and never overshoots, even on a very long frame', () => {
    const across = run(3, -3, 0.2);
    assert.ok(across > 3, 'went on past +pi (the short way), not back through zero');
    assert.ok(Math.abs(angleDelta(across, -3)) < 0.02, 'and arrived');
    for(const dt of [1 / 120, 1 / 30, 0.25, 5]) {
        const next = snapTurn(createTurner(), 0, 1, dt);
        assert.ok(next >= 0 && next <= 1 + 1e-9, `dt ${dt}: ${next}`);
    }
    const next = snapTurn(createTurner(), 0, -1, 5);
    assert.ok(Math.abs(next + 1) < 1e-9, 'a long frame lands exactly on the heading');
});

test('a thumb wobbling a few degrees does not make the body twitch', () => {
    const turner = createTurner();
    let facing = run(0, 1, 0.5, 1 / 60, turner); // turned to 1 radian
    const settled = facing;
    for(let i = 0; i < 120; i++) {
        const wobble = 1 + Math.sin(i * 2.1) * 0.08; // within the 0.12 rad band
        facing = snapTurn(turner, facing, wobble, 1 / 60);
        assert.ok(Math.abs(facing - settled) < 1e-6, `moved on frame ${i}`);
    }
});

test('a real change of direction is followed at once, and the new heading is then reached exactly', () => {
    const turner = createTurner();
    let facing = run(0, 1, 0.5, 1 / 60, turner);
    facing = run(facing, 1 + TURN.wobble * 3, 0.3, 1 / 60, turner);
    assert.ok(Math.abs(angleDelta(facing, 1 + TURN.wobble * 3)) < 1e-6, 'lands on the new heading, not 7 degrees short');
});

test('forgetting the heading starts a fresh turn', () => {
    const turner = createTurner();
    snapTurn(turner, 0, 1, 1 / 60);
    assert.equal(turner.target, 1);
    resetTurner(turner);
    assert.equal(turner.target, null);
    assert.ok(snapTurn(turner, 0, 0.05, 1 / 60) > 0, 'a small first turn is followed, not ignored as wobble');
});
