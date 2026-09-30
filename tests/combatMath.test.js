import test from 'node:test';
import assert from 'node:assert/strict';
import { IMPACTS, impactForObstacle, deathPose, deathLength, weaponKick, muzzleFlash, TUMBLE_SECONDS, POP_SECONDS, MAX_CLIP_SECONDS } from '../src/combatMath.js';
import { WEAPONS } from '../src/weapons.js';

test('every impact is complete and cheap', () => {
    for(const [name, spec] of Object.entries(IMPACTS)) {
        assert.ok(spec.count >= 1 && spec.count <= 12, `${name}: a small burst`);
        assert.ok(spec.size[0] > 0 && spec.size[1] >= spec.size[0], `${name}: sizes`);
        assert.ok(spec.life > 0 && spec.life <= 1, `${name}: short lived`);
        assert.ok(spec.colors.length >= 1, `${name}: colours`);
    }
});

test('obstacles throw what they are made of, and anything unknown throws dust', () => {
    assert.equal(impactForObstacle('rock'), 'stone');
    assert.equal(impactForObstacle('crate'), 'splinters');
    assert.equal(impactForObstacle('cactus'), 'leaves');
    assert.equal(impactForObstacle('haystack'), 'straw');
    assert.equal(impactForObstacle('a-new-prop'), 'dust');
    for(const type of ['rock', 'spire', 'wall', 'tombstone', 'crate', 'fence', 'tree', 'barrel', 'cactus', 'haystack']) {
        assert.ok(IMPACTS[impactForObstacle(type)], `${type} has an impact`);
    }
});

test('a fall lasts under two seconds, and an imported clip is capped', () => {
    assert.equal(deathLength(), TUMBLE_SECONDS + POP_SECONDS);
    assert.equal(deathLength(0.6), 0.6 + POP_SECONDS);
    assert.equal(deathLength(5), MAX_CLIP_SECONDS + POP_SECONDS);
    assert.ok(deathLength(5) < 2);
});

test('a box-built enemy tips over, hops once, and pops away only at the end', () => {
    const total = deathLength();
    const start = deathPose(0, total);
    assert.deepEqual([start.tip, start.hop, start.scale], [0, 0, 1]);
    const mid = deathPose(total * 0.3, total);
    assert.ok(mid.tip > 0 && mid.tip < Math.PI / 2 && mid.hop > 0 && mid.scale === 1);
    const lying = deathPose(total - POP_SECONDS - 0.001, total);
    assert.ok(Math.abs(lying.tip - Math.PI / 2) < 0.01 && lying.scale === 1, 'lying flat just before the pop');
    const gone = deathPose(total, total);
    assert.equal(gone.scale, 0);
    let last = 0;
    for(let t = 0; t <= total; t += 0.01) { const { tip } = deathPose(t, total); assert.ok(tip >= last - 1e-9, 'never tips back'); last = tip; }
});

test('a shotgun kicks harder than a pistol, and every gun stays in range', () => {
    const kicks = WEAPONS.map(w => [w.id, weaponKick(w.stats)]);
    for(const [id, kick] of kicks) assert.ok(kick >= 0.05 && kick <= 0.5, `${id}: ${kick}`);
    const kick = id => weaponKick(WEAPONS.find(w => w.id === id).stats);
    assert.ok(kick('gun-shotgun') > kick('gun-revolver'));
    for(const w of WEAPONS) { const flash = muzzleFlash(w.stats); assert.ok(flash.size >= 0.9 && flash.size <= 2.4 && flash.life <= 0.1); }
});
