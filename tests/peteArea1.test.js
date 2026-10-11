import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AREA1_ROAD, AREA1_PLACES, AREA1_BRANCHES, AREA1_CAMPFIRES, AREA1_CRATES, AREA1_SECRET_CRATES, AREA1_POTS, AREA1_BANDITS,
    AREA1_ENCOUNTERS, AREA1_EXIT, AREA1_START, AREA1_CLUE_AT, createAreaWalk
} from '../src/stages/peteArea1.js';
import { smoothPolyline, resample, pointAlong, createWalkMask } from '../src/stages/roadMask.js';
import { INVESTIGATION_CLUES } from '../src/peteWorldMap.js';
import { PETE_AREAS } from '../src/stages/pete.js';

test('the road maths: a smooth line keeps its ends, and points along it sit on it', () => {
    const line = smoothPolyline([[0, 0], [10, 0], [20, 10]], 8);
    assert.deepEqual([line[0].x, line[0].z], [0, 0]);
    assert.deepEqual([line.at(-1).x, line.at(-1).z], [20, 10]);
    const road = resample(line, 1);
    assert.ok(road.length > 20 && road.length < 35);
    const mid = pointAlong(road, 0.5, 0);
    assert.ok(road.samples.some(s => Math.hypot(s.x - mid.x, s.z - mid.z) < 1.1));
    const right = pointAlong(road, 0.1, 5);
    const centre = pointAlong(road, 0.1, 0);
    assert.ok(Math.abs(Math.hypot(right.x - centre.x, right.z - centre.z) - 5) < 1e-6);
});

test('a walk mask is open on the road and closed everywhere else', () => {
    const mask = createWalkMask({ corridors: [{ line: resample([{ x: 0, z: 0 }, { x: 60, z: 0 }], 2).samples, width: 10 }] });
    assert.equal(mask.isWalkable(30, 0), true);
    assert.equal(mask.isWalkable(30, 4), true);
    assert.equal(mask.isWalkable(30, 9), false);
    assert.equal(mask.isWalkable(500, 500), false);
    let walls = 0;
    mask.forEachWallCell(() => { walls++; });
    assert.ok(walls > 20, 'rock stands along both sides');
});

test('Area 1 is big: over a kilometre of road, seven places, two secrets and a nook', () => {
    assert.ok(AREA1_ROAD.length > 1200, `road is ${AREA1_ROAD.length.toFixed(0)} long`);
    assert.equal(AREA1_PLACES.length, 7);
    assert.equal(AREA1_BRANCHES.length, 3);
    assert.equal(AREA1_SECRET_CRATES.length, 4);
    assert.ok(AREA1_ENCOUNTERS.length >= 5);
    for(let i = 1; i < AREA1_PLACES.length; i++) {
        const a = AREA1_PLACES[i - 1], b = AREA1_PLACES[i];
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 30, `${a.id} and ${b.id} are different places`);
    }
});

test('everything in Area 1 stands on walkable ground', () => {
    const walk = createAreaWalk();
    const stand = (name, o) => assert.ok(walk(o.x, o.z), `${name} at ${o.x.toFixed(1)}, ${o.z.toFixed(1)} is on the road`);
    for(const o of [...AREA1_CAMPFIRES, ...AREA1_CRATES, ...AREA1_SECRET_CRATES, ...AREA1_POTS, ...AREA1_BANDITS]) stand(o.id, o);
    for(const g of AREA1_ENCOUNTERS) {
        stand(g.id, g);
        g.enemies.forEach((e, i) => stand(`${g.id}#${i}`, { x: g.x + e.dx, z: g.z + e.dz }));
    }
    for(const p of AREA1_PLACES) stand(p.id, p);
    stand('start', AREA1_START);
    stand('manifest', AREA1_CLUE_AT);
    for(const b of AREA1_BRANCHES) stand(`${b.id} clearing`, b.clearing);
});

test('you can walk from the start to the gate, and to every secret, without leaving the mask', () => {
    const walk = createAreaWalk();
    const mask = walk.mask;
    const cell = mask.cell;
    const key = (x, z) => `${Math.floor((x - mask.minX) / cell)},${Math.floor((z - mask.minZ) / cell)}`;
    const seen = new Set([key(AREA1_START.x, AREA1_START.z)]);
    const queue = [[AREA1_START.x, AREA1_START.z]];
    while(queue.length) {
        const [x, z] = queue.pop();
        for(const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
            const nx = x + dx, nz = z + dz, k = key(nx, nz);
            if(!seen.has(k) && walk(nx, nz)) { seen.add(k); queue.push([nx, nz]); }
        }
    }
    const reach = o => seen.has(key(o.x, o.z));
    const beforeGate = { x: AREA1_EXIT.x - AREA1_EXIT.tx * AREA1_EXIT.r, z: AREA1_EXIT.z - AREA1_EXIT.tz * AREA1_EXIT.r };
    assert.ok(reach(beforeGate), 'the gate can be reached');
    assert.ok(reach(AREA1_CLUE_AT), 'the manifest can be reached');
    for(const b of AREA1_BRANCHES) assert.ok(reach(b.clearing), `${b.id} can be reached`);
    for(const o of [...AREA1_CAMPFIRES, ...AREA1_CRATES, ...AREA1_SECRET_CRATES]) assert.ok(reach(o), `${o.id} can be reached`);
});

test('the gate is a wall until it is opened: nobody walks past it', () => {
    const walk = createAreaWalk();
    const past = { x: AREA1_EXIT.x + AREA1_EXIT.tx * 3, z: AREA1_EXIT.z + AREA1_EXIT.tz * 3 };
    assert.equal(walk(past.x, past.z), false);
    assert.equal(walk(AREA1_EXIT.x - AREA1_EXIT.tx * AREA1_EXIT.r, AREA1_EXIT.z - AREA1_EXIT.tz * AREA1_EXIT.r), true);
});

test('Area 1 asks for the payroll manifest, which lies at the foreman\'s nook, and the areas chain together', () => {
    const manifest = INVESTIGATION_CLUES.find(clue => clue.id === 'clue-manifest');
    assert.equal(manifest.area, 0);
    assert.deepEqual({ x: manifest.x, z: manifest.z }, AREA1_CLUE_AT);
    assert.deepEqual(AREA1_EXIT.requires, ['clue-manifest']);
    assert.deepEqual(PETE_AREAS.map(a => a.index), [0, 1]);
    assert.equal(PETE_AREAS[0].exit.next, 1);
    assert.equal(PETE_AREAS[1].exit, null);
    assert.equal(PETE_AREAS[1].boss, true);
    const ids = INVESTIGATION_CLUES.map(c => c.id);
    assert.deepEqual(PETE_AREAS.flatMap(a => a.clues.map(c => c.id)).sort(), [...ids].sort(), 'every clue lives in exactly one area');
});

test('every area has a walk, a start on it, and a heading for the camera', () => {
    for(const area of PETE_AREAS) {
        const walk = area.createWalk();
        assert.ok(walk(area.start.x, area.start.z), `${area.id} starts on walkable ground`);
        const heading = area.headingAt(area.start.x, area.start.z);
        assert.ok(Math.abs(Math.hypot(heading.tx, heading.tz) - 1) < 1e-6);
        assert.ok(area.mapSize >= Math.max(...[area.start].map(p => Math.abs(p.x))));
    }
});
