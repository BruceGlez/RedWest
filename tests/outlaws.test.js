import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTLAWS, MODIFIERS, applyOutlawToWave, applyOutlawToEnemy, outlawDifficulty, getOutlaw } from '../src/outlaws.js';

const wave = { budget: 20, interval: 1, weights: { bandit: 2, wolf: 1, gunslinger: 1 }, caps: { bandit: 10, wolf: 4, gunslinger: 1 } };
const stats = { speed: 10, hp: 1, shootCooldown: 2, projectileSpeed: 40, aimSpread: 2 };

test('the road has unique outlaws with known threats and rising bounties', () => {
    assert.equal(new Set(OUTLAWS.map(o => o.id)).size, OUTLAWS.length);
    for(const outlaw of OUTLAWS) for(const id of outlaw.modifiers) assert.ok(MODIFIERS[id], id);
    for(let i = 1; i < OUTLAWS.length; i++) assert.ok(OUTLAWS[i].bounty > OUTLAWS[i - 1].bounty);
});

test('the first outlaw is the base game, a step up (playtest: too easy), with no signature threats', () => {
    const pete = applyOutlawToWave(wave, 0);
    assert.deepEqual({ weights: pete.weights, caps: pete.caps }, { weights: wave.weights, caps: wave.caps });
    assert.ok(Math.abs(pete.budget - wave.budget * 1.15) < 1e-9);
    const bandit = applyOutlawToEnemy('bandit', stats, 0);
    assert.ok(Math.abs(bandit.speed - stats.speed * 1.05) < 1e-9);
    assert.equal(bandit.hp, stats.hp);
});

test('later outlaws are harder and apply their signature threats', () => {
    const rosa = applyOutlawToWave(wave, 1);
    assert.ok(rosa.weights.wolf > wave.weights.wolf && rosa.caps.wolf === wave.caps.wolf + 3);
    assert.ok(applyOutlawToEnemy('wolf', stats, 1).speed > applyOutlawToEnemy('wolf', stats, 0).speed * 1.3);
    const deacon = applyOutlawToEnemy('gunslinger', stats, 2);
    assert.ok(deacon.shootCooldown < stats.shootCooldown && deacon.aimSpread < stats.aimSpread);
    assert.ok(applyOutlawToEnemy('boss', stats, 7).hp > applyOutlawToEnemy('boss', stats, 0).hp);
    assert.ok(outlawDifficulty(7).budget > outlawDifficulty(0).budget);
});

test('inputs are not mutated and out-of-range stages clamp', () => {
    const copy = structuredClone(wave);
    applyOutlawToWave(wave, 7);
    assert.deepEqual(wave, copy);
    assert.equal(getOutlaw(99).id, OUTLAWS.at(-1).id);
    assert.equal(getOutlaw(-3).id, OUTLAWS[0].id);
});

test('every outlaw has its own signature attack with a tip and a description', () => {
    const styles = OUTLAWS.map(outlaw => outlaw.signature?.style);
    assert.equal(new Set(styles).size, OUTLAWS.length, 'no two outlaws share an attack');
    for(const outlaw of OUTLAWS) {
        assert.ok(outlaw.signature.move && outlaw.signature.tip && outlaw.signature.detail, outlaw.id);
    }
});

test('difficulty climbs every stage, and the last outlaws are much tougher than the first', () => {
    for(let i = 1; i < OUTLAWS.length; i++) {
        const [a, b] = [outlawDifficulty(i - 1), outlawDifficulty(i)];
        assert.ok(b.budget > a.budget && b.enemySpeed > a.enemySpeed && b.bossHp > a.bossHp, `stage ${i + 1}`);
        assert.ok(b.spawnInterval <= a.spawnInterval && b.bossFire <= a.bossFire && b.gunFire <= a.gunFire, `stage ${i + 1}`);
    }
    const [first, last] = [outlawDifficulty(0), outlawDifficulty(OUTLAWS.length - 1)];
    assert.ok(last.bossHp >= first.bossHp * 2.5, 'the last outlaw takes over twice as many hits');
    assert.ok(last.budget >= first.budget * 1.8, 'and brings nearly twice the gang');
    const stats = { speed: 5, hp: 1, shootCooldown: 2.5, projectileSpeed: 40, aimSpread: 2 };
    assert.ok(applyOutlawToEnemy('boss', stats, OUTLAWS.length - 1).shootCooldown < applyOutlawToEnemy('boss', stats, 0).shootCooldown);
});
