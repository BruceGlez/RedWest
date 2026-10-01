import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCompanion, saveCompanion, followStep, FOLLOW } from '../src/townCompanion.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('no dog until it is adopted; adopting keeps it across visits, and it can be sent home', () => {
    const storage = memory();
    assert.deepEqual(loadCompanion(storage), { adopted: false, following: false });
    saveCompanion({ adopted: true, following: true }, storage);
    assert.deepEqual(loadCompanion(storage), { adopted: true, following: true });
    saveCompanion({ adopted: true, following: false }, storage);
    assert.deepEqual(loadCompanion(storage), { adopted: true, following: false });
});

test('damaged or missing storage is no dog, not an error', () => {
    const broken = { getItem: () => '{nope', setItem: () => { throw new Error('private mode'); } };
    assert.deepEqual(loadCompanion(broken), { adopted: false, following: false });
    assert.doesNotThrow(() => saveCompanion({ adopted: true }, broken));
    assert.deepEqual(loadCompanion(null), { adopted: false, following: false });
});

test('the dog trots after the marshal and stops beside him', () => {
    let dog = { x: 0, z: 0, heading: 0 };
    const target = { x: 10, z: 0 };
    for(let i = 0; i < 200; i++) dog = { ...dog, ...followStep(dog, target, 0.016) };
    assert.ok(Math.abs((target.x - dog.x) - FOLLOW.stop) < 0.05, `stopped ${target.x - dog.x} short`);
    const still = followStep(dog, target, 0.016);
    assert.equal(still.moving, false);
    assert.equal(still.x, dog.x);
});

test('it never overshoots in one big step, runs faster when far behind, and is put beside a teleported marshal', () => {
    const near = followStep({ x: 0, z: 0 }, { x: 3, z: 0 }, 10);
    assert.ok(near.x <= 3 - FOLLOW.stop + 1e-9, 'no overshoot');
    const close = followStep({ x: 0, z: 0 }, { x: 6, z: 0 }, 0.1).x;
    const far = followStep({ x: 0, z: 0 }, { x: 20, z: 0 }, 0.1).x;
    assert.ok(far > close, 'faster when far');
    const snapped = followStep({ x: 0, z: 0 }, { x: 100, z: 50 }, 0.016);
    assert.ok(Math.hypot(snapped.x - 100, snapped.z - 50) < 2);
});
