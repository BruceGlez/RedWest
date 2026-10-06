import test from 'node:test';
import assert from 'node:assert/strict';
import { OXYGEN_ENABLED, THIN_AIR_FROM_FLOOR, AIR_CAPACITY, AIR_ARRIVAL_FILL, LIFT_AIR_RATE, TORCH_AIR_RATE, LOW_AIR, SLOW_AT_EMPTY, LIGHT_AT_EMPTY,
    drainPerSecond, createAir, arriveAir, tickAir, airLow, airEmpty, airEffects, secondsOfAir } from '../src/mineAir.js';
import { DIM_RING, LANTERN_RADIUS } from '../src/mineLight.js';

test('the bar exists only from floor 15 and is behind a named setting until the owner has chosen what it does', () => {
    assert.equal(THIN_AIR_FROM_FLOOR, 15);
    assert.equal(OXYGEN_ENABLED, false, 'off by default: nothing in the game reads the bar yet');
    for(let floor = 1; floor <= 14; floor++) assert.equal(drainPerSecond(floor), 0, `floor ${floor}: no drain`);
    assert.ok(drainPerSecond(15) > 0);
    const air = createAir();
    air.level = 10;
    tickAir(air, 5, { floor: 14, nearLift: false, nearLitTorch: false });
    assert.equal(air.level, AIR_CAPACITY, 'on a safe floor the bar is simply full');
    assert.equal(tickAir(createAir(), 5, null).level, AIR_CAPACITY);
});

test('it drains gently on the first thin floor, worse deeper, but capped so no floor is impossible', () => {
    assert.ok(drainPerSecond(30) > drainPerSecond(15) && drainPerSecond(20) > drainPerSecond(16));
    assert.equal(drainPerSecond(500), 2.0, 'a cap');
    assert.ok(secondsOfAir(15) >= 150, `a full bar lasts ${Math.round(secondsOfAir(15))} s on floor 15`);
    assert.ok(secondsOfAir(500) >= 40, `and never less than ${Math.round(secondsOfAir(500))} s deep down`);
    assert.equal(secondsOfAir(3), Infinity);
    const air = createAir();
    tickAir(air, 10, { floor: 15, nearLift: false, nearLitTorch: false });
    assert.ok(Math.abs(air.level - (AIR_CAPACITY - 10 * drainPerSecond(15))) < 1e-9);
    tickAir(air, 1e6, { floor: 15, nearLift: false, nearLitTorch: false });
    assert.equal(air.level, 0, 'never below nothing');
    assert.ok(airEmpty(air) && airLow(air));
});

test('it refills at the lift (fast) and beside a lit torch of his (slowly), and never above full', () => {
    const air = createAir();
    air.level = 20;
    tickAir(air, 2, { floor: 20, nearLift: true, nearLitTorch: false });
    assert.equal(air.level, 20 + 2 * LIFT_AIR_RATE);
    air.level = 20;
    tickAir(air, 2, { floor: 20, nearLift: false, nearLitTorch: true });
    assert.equal(air.level, 20 + 2 * TORCH_AIR_RATE);
    air.level = 20;
    tickAir(air, 2, { floor: 20, nearLift: true, nearLitTorch: true });
    assert.equal(air.level, 20 + 2 * LIFT_AIR_RATE, 'the lift wins');
    tickAir(air, 1e6, { floor: 20, nearLift: true, nearLitTorch: false });
    assert.equal(air.level, AIR_CAPACITY);
    assert.ok(LIFT_AIR_RATE > TORCH_AIR_RATE && TORCH_AIR_RATE > drainPerSecond(20), 'a torch is a place to catch his breath, not a cure, and still a gain');
    const frozen = createAir();
    frozen.level = 50;
    tickAir(frozen, -5, { floor: 20, nearLift: false, nearLitTorch: false });
    assert.equal(frozen.level, 50, 'time does not run backwards');
});

test('arriving: a new thin floor is never started nearly empty, and a safe floor fills the bar', () => {
    const air = createAir();
    air.level = 1;
    arriveAir(air, 16);
    assert.equal(air.level, 1 + AIR_ARRIVAL_FILL);
    air.level = 95;
    arriveAir(air, 17);
    assert.equal(air.level, AIR_CAPACITY);
    air.level = 3;
    arriveAir(air, 9);
    assert.equal(air.level, AIR_CAPACITY);
});

test('empty is not lethal: the marshal is a little slower and the lantern a little dimmer, never stuck, never hurt', () => {
    const full = createAir();
    assert.deepEqual(airEffects(full), { speed: 1, light: 1, warning: false, empty: false });
    const low = { level: LOW_AIR / 2 };
    const half = airEffects(low);
    assert.ok(half.speed < 1 && half.speed > SLOW_AT_EMPTY && half.light < 1 && half.light > LIGHT_AT_EMPTY && half.warning && !half.empty, 'it grows worse as it empties');
    const empty = airEffects({ level: 0 });
    assert.deepEqual([empty.speed, empty.light, empty.empty], [SLOW_AT_EMPTY, LIGHT_AT_EMPTY, true]);
    assert.ok(SLOW_AT_EMPTY >= 0.8 && LIGHT_AT_EMPTY >= 0.5, 'a mild penalty');
    assert.ok(Math.round(LANTERN_RADIUS * LIGHT_AT_EMPTY) > DIM_RING, 'a dim lantern still beats the dim ring: nobody is blinded by it');
    for(const key of Object.keys(empty)) assert.ok(!/hp|heart|damage|health/i.test(key), 'no effect touches hearts or damage');
});
