import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeatState, recordKill, recordDamage, advanceHeat, heatMultiplier, heatSpawnMultiplier } from '../src/heat.js';

test('kill chains raise reward and danger but are capped', () => {
    const heat = createHeatState();
    assert.equal(recordKill(heat), 1);
    assert.equal(recordKill(heat), 1.5);
    for(let i = 0; i < 12; i++) recordKill(heat);
    assert.equal(heat.level, 4);
    assert.equal(heat.peak, 4);
    assert.equal(heatMultiplier(heat.level), 3);
    assert.equal(heatSpawnMultiplier(heat.level), 1.72);
});

test('a broken chain decays and damage clears current Heat', () => {
    const heat = createHeatState();
    for(let i = 0; i < 6; i++) recordKill(heat);
    advanceHeat(heat, 4);
    assert.equal(heat.streak, 0);
    advanceHeat(heat, 5);
    assert.equal(heat.level, 2);
    recordDamage(heat);
    assert.equal(heat.level, 0);
    assert.equal(heat.peak, 3);
});
