import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createPeteBossState,
    damagePeteBoss,
    updateBossPete,
    PETE_PHASES,
    PETE_BARKS
} from '../src/bossPete.js';

test('createPeteBossState initializes in Phase 1 (DUEL) at full health', () => {
    const boss = createPeteBossState(100);
    assert.equal(boss.hp, 100);
    assert.equal(boss.maxHp, 100);
    assert.equal(boss.phase, PETE_PHASES.DUEL);
    assert.equal(boss.defeated, false);
    assert.equal(boss.currentBark, PETE_BARKS.start);
});

test('damagePeteBoss transitions to Phase 2 (DYNAMITE) at 50% HP', () => {
    const boss = createPeteBossState(100);
    const res = damagePeteBoss(boss, 50);
    assert.equal(res.hp, 50);
    assert.equal(boss.phase, PETE_PHASES.DYNAMITE);
    assert.equal(res.phaseTransition, true);
    assert.equal(boss.currentBark, PETE_BARKS.phase2);
});

test('damagePeteBoss transitions to Phase 3 (GATLING) at 25% HP', () => {
    const boss = createPeteBossState(100);
    damagePeteBoss(boss, 50); // Phase 2
    const res = damagePeteBoss(boss, 25); // 25 HP left
    assert.equal(res.hp, 25);
    assert.equal(boss.phase, PETE_PHASES.GATLING);
    assert.equal(boss.isShielded, true);
    assert.equal(res.phaseTransition, true);
    assert.equal(boss.currentBark, PETE_BARKS.phase3);
});

test('Phase 3 barrel cover shields 30% of incoming damage', () => {
    const boss = createPeteBossState(100);
    boss.phase = PETE_PHASES.GATLING;
    boss.hp = 20;

    // 10 raw damage -> 7 actual damage applied
    const res = damagePeteBoss(boss, 10);
    assert.equal(res.hp, 13);
});

test('damagePeteBoss marks boss as defeated at 0 HP', () => {
    const boss = createPeteBossState(100);
    const res = damagePeteBoss(boss, 100);
    assert.equal(res.hp, 0);
    assert.equal(res.defeated, true);
    assert.equal(boss.defeated, true);
    assert.equal(boss.currentBark, PETE_BARKS.defeated);
});

test('updateBossPete dispatches phase-specific attacks', () => {
    const boss = createPeteBossState(100);
    const bossPos = { x: 0, z: 100 };
    const playerPos = { x: 0, z: 85 };

    // Phase 1 triggers fan-fire
    boss.attackCooldown = 0;
    const duelUpdate = updateBossPete(boss, bossPos, playerPos, 0.1);
    assert.ok(duelUpdate.actions.some(a => a.type === 'fan-fire'));

    // Phase 2 triggers dynamite throw
    boss.phase = PETE_PHASES.DYNAMITE;
    boss.dynamiteCooldown = 0;
    const dynamiteUpdate = updateBossPete(boss, bossPos, playerPos, 0.1);
    assert.ok(dynamiteUpdate.actions.some(a => a.type === 'throw-dynamite'));

    // Phase 3 triggers gatling spray
    boss.phase = PETE_PHASES.GATLING;
    boss.attackCooldown = 0;
    const gatlingUpdate = updateBossPete(boss, bossPos, playerPos, 0.1);
    assert.ok(gatlingUpdate.actions.some(a => a.type === 'gatling-spray'));
});
