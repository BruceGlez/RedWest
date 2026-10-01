import test from 'node:test';
import assert from 'node:assert/strict';
import { FARM_AREA, FARM_START, PLOTS, PLOT_SIZE, BLOCKS, SPOTS, farmMap, farmLabel, plotId, plotIndex } from '../src/farmLayout.js';
import { createFarm, plant, harvest } from '../src/farm.js';
import { createProfile } from '../src/profile.js';
import { moveInTown, nearestDoor, PLAYER_RADIUS } from '../src/townWalkLogic.js';
import { OUTLAWS } from '../src/outlaws.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const later = minutes => new Date(T0.getTime() + minutes * 60000);
const map = farmMap();
const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const overlaps = (a, b) => Math.min(a.maxX, b.maxX) > Math.max(a.minX, b.minX) && Math.min(a.maxZ, b.maxZ) > Math.max(a.minZ, b.minZ);
const standable = (x, z) => { const [px, pz] = moveInTown(map, x, z, 0, 0); return Math.hypot(px - x, pz - z) < 1e-9; };

test('the farm is one flat map: ground, walls and every door of a plot or building', () => {
    assert.deepEqual(map.areas, [FARM_AREA]);
    assert.equal(map.boxes.length, BLOCKS.length);
    assert.equal(map.doors.length, PLOTS.length + SPOTS.length);
    assert.equal(new Set(map.doors.map(d => d.id)).size, map.doors.length, 'every door has its own id');
    assert.ok(standable(...FARM_START), 'the marshal starts on open ground');
    assert.ok(inside(FARM_AREA, FARM_START[0], FARM_START[1], PLAYER_RADIUS));
});

test('every door can be stood at, and from there it is the door that is offered', () => {
    for(const door of map.doors) {
        assert.ok(inside(FARM_AREA, door.x, door.z, PLAYER_RADIUS), `${door.id} is on the farm`);
        assert.ok(standable(door.x, door.z), `${door.id} is not inside a wall`);
        assert.equal(nearestDoor(map, door.x, door.z)?.id, door.id, `${door.id} is the nearest door at its own spot`);
    }
});

test('every door can be walked to from the gate (the farm has no dead ends)', () => {
    const step = 0.5;
    const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
    const seen = new Set([key(...FARM_START)]);
    const queue = [FARM_START];
    while(queue.length) {
        const [x, z] = queue.pop();
        for(const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = x + dx, nz = z + dz;
            if(seen.has(key(nx, nz)) || !inside(FARM_AREA, nx, nz, PLAYER_RADIUS) || !standable(nx, nz)) continue;
            seen.add(key(nx, nz));
            queue.push([nx, nz]);
        }
    }
    for(const door of map.doors) assert.ok(seen.has(key(door.x, door.z)), `${door.id} is reachable`);
});

test('plots are apart from each other and from every building, and sit on the farm', () => {
    const half = { x: PLOT_SIZE.w / 2, z: PLOT_SIZE.d / 2 };
    const beds = PLOTS.map(p => ({ minX: p.x - half.x, maxX: p.x + half.x, minZ: p.z - half.z, maxZ: p.z + half.z }));
    beds.forEach((bed, i) => {
        assert.ok(inside(FARM_AREA, bed.minX, bed.minZ) && inside(FARM_AREA, bed.maxX, bed.maxZ), `plot ${i} is on the farm`);
        beds.forEach((other, j) => { if(i < j) assert.ok(!overlaps(bed, other), `plots ${i} and ${j} do not overlap`); });
        for(const wall of map.boxes) assert.ok(!overlaps(bed, wall), `plot ${i} is clear of the buildings`);
    });
    PLOTS.forEach((p, i) => assert.equal(plotIndex(plotId(i)), p.index));
    assert.equal(plotIndex('barn'), -1);
});

test('a door offers only what it can do: plant, look, or harvest', () => {
    const profile = createProfile(T0);
    profile.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'calloway-gang')] = 1;
    const farm = profile.town.farm;
    const verb = (id, now) => farmMap(farm, now).doors.find(d => d.id === id).verb;
    assert.equal(verb('plot-0', T0), 'PLANT');
    plant(profile, 0, 'wheat', T0);
    assert.equal(verb('plot-0', later(5)), 'LOOK');
    assert.equal(verb('plot-0', later(20)), 'HARVEST');
    harvest(profile, 0, later(20));
    assert.equal(verb('plot-0', later(20)), 'PLANT');
    farm.coopAt = T0.toISOString();
    assert.equal(verb('coop', later(10)), 'LOOK');
    assert.equal(verb('coop', later(35)), 'COLLECT');
    assert.equal(verb('stand', T0), 'SELL');
    assert.equal(verb('leave', T0), 'LEAVE');
});

test('the prompt says what is in the plot and how long it has left', () => {
    const profile = createProfile(T0);
    profile.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'calloway-gang')] = 1;
    const farm = profile.town.farm;
    const label = (id, now) => farmLabel({ id }, farm, now);
    assert.equal(label('plot-3', T0), 'EMPTY PLOT');
    plant(profile, 3, 'corn', T0);
    assert.equal(label('plot-3', later(30)), 'CORN: 1h');
    assert.equal(label('plot-3', later(90)), 'CORN READY');
    farm.coopAt = T0.toISOString();
    assert.equal(label('coop', later(10)), 'COOP: NEXT EGG IN 20m');
    assert.equal(label('coop', later(65)), 'COOP: 2 EGGS');
    assert.equal(label('coop', later(35)), 'COOP: 1 EGG');
    assert.equal(label('leave', T0), 'THE ROAD TO TOWN');
    assert.equal(farmLabel({ id: 'plot-0' }), 'EMPTY PLOT', 'with no farm yet');
    assert.deepEqual(createFarm(T0).plots.length, PLOTS.length);
});
