import test from 'node:test';
import assert from 'node:assert/strict';
import { IMPACTS, impactForObstacle, deathPose, deathLength, weaponKick, muzzleFlash, TUMBLE_SECONDS, POP_SECONDS, MAX_CLIP_SECONDS } from '../src/combatMath.js';
import { WEAPONS } from '../src/weapons.js';
import { stepAround, checkCollision, markObstacleGridDirty } from '../src/physics.js';
import { obstacles } from '../src/state.js';

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

// Walk like the enemy update does: straight on, else round the thing in the way on the side it went round last time.
function walkTo(from, to, speed = 0.35, steps = 600) {
    let [x, z] = from, side = 1, detours = 0;
    for(let i = 0; i < steps; i++) {
        const dx = to[0] - x, dz = to[1] - z, d = Math.hypot(dx, dz);
        if(d < 1) return { arrived: true, steps: i, detours };
        const mx = dx / d * speed, mz = dz / d * speed;
        if(!checkCollision(x + mx, z + mz, 0.5)) { x += mx; z += mz; continue; }
        const around = stepAround(x, z, mx, mz, 0.5, side);
        if(!around) return { arrived: false, steps: i, detours };
        ({ x, z, side } = around);
        detours++;
    }
    return { arrived: false, steps, detours };
}

test('an enemy walks round a crate, a column and a fence instead of standing against them', () => {
    const saved = obstacles.splice(0);
    try {
        obstacles.push({ x: 0, z: 10, radius: 3 }); // straight between them
        markObstacleGridDirty();
        const crate = walkTo([0, 0], [0, 24]);
        assert.ok(crate.arrived && crate.detours > 0, 'round a crate that is dead ahead');
        obstacles.length = 0;
        for(let x = -14; x <= 14; x += 2) obstacles.push({ x, z: 10, radius: 1.6 }); // a fence 30 units long
        markObstacleGridDirty();
        const fence = walkTo([0, 0], [0, 24]);
        assert.ok(fence.arrived, 'along a fence and round its end');
        obstacles.length = 0;
        for(let x = -14; x <= 14; x += 2) obstacles.push({ x, z: 10, radius: 1.6 });
        obstacles.push({ x: -14, z: 4, radius: 1.6 }, { x: 14, z: 4, radius: 1.6 }); // with the ends turned in, a pocket
        markObstacleGridDirty();
        assert.ok(walkTo([0, 0], [0, 24], 0.35, 1500).arrived, 'out of a pocket too');
        obstacles.length = 0;
        markObstacleGridDirty();
        assert.equal(stepAround(0, 0, 0.3, 0, 0.5, 1)?.side, 1, 'nothing in the way: the first angle is free');
    } finally {
        obstacles.length = 0;
        obstacles.push(...saved);
        markObstacleGridDirty();
    }
});

test('a mover boxed in on every side finds no way round, and does not throw', () => {
    const saved = obstacles.splice(0);
    try {
        for(let a = 0; a < 16; a++) obstacles.push({ x: Math.cos(a / 16 * Math.PI * 2) * 2, z: Math.sin(a / 16 * Math.PI * 2) * 2, radius: 1.6 });
        markObstacleGridDirty();
        assert.equal(stepAround(0, 0, 0.3, 0.1, 0.5, 1), null);
    } finally {
        obstacles.length = 0;
        obstacles.push(...saved);
        markObstacleGridDirty();
    }
});
