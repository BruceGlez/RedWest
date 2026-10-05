import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOOR_LAYOUTS, floorLayout, distance, isOpen, bounds, wallCircles, propCircles, spawnPoint, shaftReached, setActiveFloor, activeFloor,
    CELL, MIN_SPAWN_DISTANCE, SHAFT_REACH } from '../src/mineMap.js';
import { MINE_FLOORS } from '../src/mine.js';

const MARSHAL = 1.5; // the radius the player's movement checks (src/playerSystem.js)
const STEP = 2;

// Everything solid, as the game sees it: the wall ring and the props.
const solids = layout => [...wallCircles(layout), ...propCircles(layout)];
const blocked = (layout, circles, x, z, radius = MARSHAL) => !isOpen(layout, x, z) || circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + radius);

// Flood fill over the walkable ground, the way the marshal can really walk it.
function reachable(layout, circles, from) {
    const b = bounds(layout);
    const key = (i, j) => `${i},${j}`;
    const seen = new Set([key(0, 0)]);
    const queue = [[0, 0]];
    const cells = [];
    while(queue.length) {
        const [i, j] = queue.pop();
        const x = from[0] + i * STEP, z = from[1] + j * STEP;
        cells.push([x, z]);
        for(const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj;
            const nx = from[0] + ni * STEP, nz = from[1] + nj * STEP;
            if(seen.has(key(ni, nj)) || nx < b.minX || nx > b.maxX || nz < b.minZ || nz > b.maxZ) continue;
            if(blocked(layout, circles, nx, nz)) continue;
            seen.add(key(ni, nj));
            queue.push([ni, nj]);
        }
    }
    return cells;
}
const near = (cells, [x, z], within = STEP * 1.5) => cells.some(([cx, cz]) => Math.hypot(cx - x, cz - z) <= within);

test('there is one cave for every floor of the mine', () => {
    assert.equal(FLOOR_LAYOUTS.length, MINE_FLOORS);
    assert.equal(new Set(FLOOR_LAYOUTS.map(l => l.id)).size, MINE_FLOORS, 'each floor has its own layout');
    assert.equal(floorLayout(1), FLOOR_LAYOUTS[0]);
    assert.equal(floorLayout(MINE_FLOORS), FLOOR_LAYOUTS.at(-1));
    assert.equal(floorLayout(99), FLOOR_LAYOUTS.at(-1), 'past the last floor stays on the last cave');
    assert.equal(floorLayout(0), FLOOR_LAYOUTS[0]);
});

test('the lift and the shaft stand in open ground with room to move', () => {
    for(const layout of FLOOR_LAYOUTS) {
        assert.ok(isOpen(layout, 0, 0, 10), `${layout.id}: the marshal starts on the lift, well clear of the walls`);
        assert.ok(isOpen(layout, layout.shaft[0], layout.shaft[1], 8), `${layout.id}: the shaft has room around it`);
        assert.ok(Math.hypot(layout.shaft[0], layout.shaft[1]) >= 50, `${layout.id}: the shaft is a real walk from the lift`);
    }
});

test('everything is placed on open ground and clear of everything else', () => {
    for(const layout of FLOOR_LAYOUTS) {
        const props = propCircles(layout);
        for(const p of props) {
            assert.ok(isOpen(layout, p.x, p.z, p.r + 1.5), `${layout.id}: ${p.kind} at ${p.x}, ${p.z} stands clear of the wall`);
            assert.ok(Math.hypot(p.x, p.z) >= p.r + 8, `${layout.id}: ${p.kind} at ${p.x}, ${p.z} is off the lift`);
            assert.ok(Math.hypot(p.x - layout.shaft[0], p.z - layout.shaft[1]) >= p.r + 7, `${layout.id}: ${p.kind} at ${p.x}, ${p.z} is off the shaft`);
        }
        for(let i = 0; i < props.length; i++) for(let j = i + 1; j < props.length; j++) {
            const a = props[i], b = props[j];
            if(a.kind === 'post' && b.kind === 'post') continue; // the two posts of one arch
            assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.r + b.r + 3.2, `${layout.id}: ${a.kind} and ${b.kind} leave room to pass between them`);
        }
        for(const [x1, z1, x2, z2] of layout.rails.slice(1).map((p, i) => [...layout.rails[i], ...p])) {
            for(let t = 0; t <= 1; t += 0.05) assert.ok(isOpen(layout, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 3), `${layout.id}: the rails stay inside the cave`);
        }
        assert.deepEqual(layout.rails[0], [0, 0], `${layout.id}: the rails start at the lift`);
        assert.ok(Math.hypot(layout.rails.at(-1)[0] - layout.shaft[0], layout.rails.at(-1)[1] - layout.shaft[1]) <= 4, `${layout.id}: the rails end at the shaft`);
    }
});

test('the cave is sealed, and the shaft and every tunnel mouth can be walked to from the lift', () => {
    for(const layout of FLOOR_LAYOUTS) {
        const circles = solids(layout);
        const cells = reachable(layout, circles, [0, 0]);
        assert.ok(cells.length > 400, `${layout.id}: a real amount of ground (${cells.length} cells)`);
        assert.ok(near(cells, layout.shaft, SHAFT_REACH), `${layout.id}: the shaft can be reached`);
        for(const spawn of layout.spawns) assert.ok(near(cells, spawn), `${layout.id}: the tunnel mouth at ${spawn} can be reached`);
        const b = bounds(layout);
        for(const [x, z] of cells) assert.ok(x > b.minX + 4 && x < b.maxX - 4 && z > b.minZ + 4 && z < b.maxZ - 4, `${layout.id}: the walls leak at ${x}, ${z}`);
        // The marshal can never stand in the rock, even at the very edge of the wall ring.
        for(const [x, z] of cells) assert.ok(isOpen(layout, x, z), `${layout.id}: walked into rock at ${x}, ${z}`);
    }
});

test('tunnel mouths are open ground, far apart, and some are always far enough from the marshal', () => {
    for(const layout of FLOOR_LAYOUTS) {
        const circles = solids(layout);
        assert.ok(layout.spawns.length >= 4, `${layout.id}: enough mouths that the pursuit comes from several sides`);
        for(const [x, z] of layout.spawns) {
            assert.ok(isOpen(layout, x, z, 4), `${layout.id}: the mouth at ${x}, ${z} is in open ground`);
            assert.ok(!blocked(layout, circles, x, z, 2), `${layout.id}: nothing stands on the mouth at ${x}, ${z}`);
        }
        // From the lift and from the shaft there is always a mouth to come out of.
        for(const at of [{ x: 0, z: 0 }, { x: layout.shaft[0], z: layout.shaft[1] }]) {
            assert.ok(layout.spawns.some(([x, z]) => Math.hypot(x - at.x, z - at.z) >= MIN_SPAWN_DISTANCE), `${layout.id}: a mouth far from ${at.x}, ${at.z}`);
        }
    }
});

test('spawnPoint picks a mouth far from the marshal and never puts anyone in the rock', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for(const layout of FLOOR_LAYOUTS) {
        for(const player of [{ x: 0, z: 0 }, { x: layout.shaft[0], z: layout.shaft[1] }, { x: layout.spawns[0][0], z: layout.spawns[0][1] }]) {
            for(let i = 0; i < 40; i++) {
                const p = spawnPoint(layout, player, rand);
                assert.ok(isOpen(layout, p.x, p.z, 3), `${layout.id}: spawned in open ground`);
                assert.ok(Math.hypot(p.x - player.x, p.z - player.z) >= MIN_SPAWN_DISTANCE - 6, `${layout.id}: spawned away from the marshal`);
            }
        }
    }
});

test('the wall ring has no gaps a bullet could slip through', () => {
    for(const layout of FLOOR_LAYOUTS) {
        const walls = wallCircles(layout);
        assert.ok(walls.length > 100 && walls.length < 900, `${layout.id}: ${walls.length} wall circles keeps the physics grid cheap`);
        // Every point just inside the rock has a wall circle within a bullet's width, so a shot stops at the wall.
        const b = bounds(layout);
        for(let x = b.minX; x <= b.maxX; x += 1) for(let z = b.minZ; z <= b.maxZ; z += 1) {
            const d = distance(layout, x, z);
            if(d > 0.1 && d < 0.6) assert.ok(walls.some(w => Math.hypot(x - w.x, z - w.z) < w.r + 0.5), `${layout.id}: a bullet gets through at ${x}, ${z}`);
        }
        assert.ok(CELL > 0);
    }
});

test('the active floor is what the physics and the spawns look at, and it can be cleared', () => {
    assert.equal(activeFloor(), null);
    setActiveFloor(FLOOR_LAYOUTS[0]);
    assert.equal(activeFloor(), FLOOR_LAYOUTS[0]);
    assert.equal(shaftReached(FLOOR_LAYOUTS[0], 78, -8), true);
    assert.equal(shaftReached(FLOOR_LAYOUTS[0], 78 + SHAFT_REACH + 0.5, -8), false);
    setActiveFloor(null);
    assert.equal(activeFloor(), null);
});
