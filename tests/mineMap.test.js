import test from 'node:test';
import assert from 'node:assert/strict';
import { floorLayout, floorName, chamberCount, roadLength, distance, isOpen, bounds, gridPoints, wallCircles, propCircles, spawnPoint, steerTarget, lineOpen, nearestNode,
    shaftReached, liftReached, chestWithin, setActiveFloor, activeFloor, MAX_CHAMBERS, MIN_SPAWN_DISTANCE, MAX_SPAWN_DISTANCE, SHAFT_REACH, LIFT_REACH, CHEST_REACH } from '../src/mineMap.js';

const MARSHAL = 1.5; // the radius the player's movement checks (src/playerSystem.js)
const STEP = 3;
const FLOORS = [1, 2, 3, 4, 5, 8, 13];

// Everything solid, as the game sees it, in a grid so a big cave can be searched.
function solidsOf(layout) {
    const hash = new Map();
    for(const c of [...wallCircles(layout), ...propCircles(layout)]) {
        const key = `${Math.floor(c.x / 12)},${Math.floor(c.z / 12)}`;
        (hash.get(key) ?? hash.set(key, []).get(key)).push(c);
    }
    return (x, z, radius) => {
        for(let gx = Math.floor((x - 8) / 12); gx <= Math.floor((x + 8) / 12); gx++) for(let gz = Math.floor((z - 8) / 12); gz <= Math.floor((z + 8) / 12); gz++) {
            for(const c of hash.get(`${gx},${gz}`) ?? []) if(Math.hypot(x - c.x, z - c.z) < c.r + radius) return true;
        }
        return false;
    };
}

// Flood fill over the walkable ground, the way the marshal can really walk it.
function reachable(layout, hits, from) {
    const b = bounds(layout);
    const key = (i, j) => `${i},${j}`;
    const seen = new Set([key(0, 0)]);
    const queue = [[0, 0]];
    const cells = [];
    while(queue.length) {
        const [i, j] = queue.pop();
        cells.push([from[0] + i * STEP, from[1] + j * STEP]);
        for(const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj;
            const nx = from[0] + ni * STEP, nz = from[1] + nj * STEP;
            if(seen.has(key(ni, nj)) || nx < b.minX || nx > b.maxX || nz < b.minZ || nz > b.maxZ) continue;
            if(!isOpen(layout, nx, nz) || hits(nx, nz, MARSHAL)) continue;
            seen.add(key(ni, nj));
            queue.push([ni, nj]);
        }
    }
    return cells;
}
const near = (cells, [x, z], within = STEP * 1.5) => cells.some(([cx, cz]) => Math.hypot(cx - x, cz - z) <= within);
const extent = layout => { const b = bounds(layout, 0); return (b.maxX - b.minX) * (b.maxZ - b.minZ); };

test('a depth always makes the same cave, and every floor is bigger than the one above', () => {
    assert.equal(floorLayout(3), floorLayout(3), 'the same floor is the same cave');
    const again = floorLayout(4);
    assert.equal(again.shaft.join(), floorLayout(4).shaft.join());
    assert.equal(floorLayout(0), floorLayout(1), 'a floor below the first is the first');
    let lastChambers = 0;
    for(let floor = 1; floor <= 10; floor++) {
        const layout = floorLayout(floor);
        assert.equal(layout.main, 3 + floor, `floor ${floor}: 3 + the floor chambers for the first ten floors`);
        assert.ok(layout.main > lastChambers, `floor ${floor} has more chambers than floor ${floor - 1}`);
        lastChambers = layout.main;
    }
    assert.ok(Math.hypot(...floorLayout(1).shaft) >= 180, 'even the first floor is a real walk, far larger than the old hand-made caves');
    assert.equal(chamberCount(1), 4);
    assert.deepEqual([10, 11, 15, 20, 30].map(chamberCount), [13, 13, 14, 15, 17], 'after the tenth floor, a chamber every five floors');
    assert.equal(chamberCount(100), MAX_CHAMBERS, 'the caves stop growing once they are as big as the game can draw');
    assert.ok(extent(floorLayout(5)) > extent(floorLayout(1)) * 2, 'floor 5 covers a lot more ground than floor 1');
    assert.equal(floorName(1), 'THE UPPER GALLERY');
    assert.equal(floorName(12), 'THE LOST LEVEL 12');
});

test('there is no bottom: any depth makes a cave', () => {
    for(const floor of [20, 50, 200]) {
        const layout = floorLayout(floor);
        assert.equal(layout.depth, floor);
        assert.ok(layout.main >= 10 && layout.shapes.length > layout.main, `floor ${floor} is a full cave`);
    }
});

test('the lift and the shaft stand in open ground with room to move, and the shaft is far from the lift', () => {
    for(const floor of FLOORS) {
        const layout = floorLayout(floor);
        assert.ok(isOpen(layout, 0, 0, 12), `floor ${floor}: the marshal starts on the lift, well clear of the walls`);
        assert.ok(isOpen(layout, layout.shaft[0], layout.shaft[1], 8), `floor ${floor}: the shaft has room around it`);
        assert.ok(Math.hypot(layout.shaft[0], layout.shaft[1]) >= 180, `floor ${floor}: the shaft is a real walk from the lift`);
        assert.deepEqual(layout.rails[0], [0, 0], `floor ${floor}: the rails start at the lift`);
        assert.deepEqual(layout.rails.at(-1), layout.shaft, `floor ${floor}: and end at the shaft`);
    }
});

test('everything is placed on open ground and clear of everything else', () => {
    for(const floor of FLOORS) {
        const layout = floorLayout(floor);
        const props = propCircles(layout);
        for(const p of props) {
            assert.ok(isOpen(layout, p.x, p.z, p.r + 1.5), `floor ${floor}: ${p.kind} at ${p.x.toFixed(0)}, ${p.z.toFixed(0)} stands clear of the wall`);
            assert.ok(Math.hypot(p.x, p.z) >= p.r + 8, `floor ${floor}: ${p.kind} is off the lift`);
            assert.ok(Math.hypot(p.x - layout.shaft[0], p.z - layout.shaft[1]) >= p.r + 7, `floor ${floor}: ${p.kind} is off the shaft`);
        }
        for(let i = 0; i < props.length; i++) for(let j = i + 1; j < props.length; j++) {
            const a = props[i], b = props[j];
            if(a.kind === 'post' || b.kind === 'post' || a.kind === 'cart' || b.kind === 'cart') continue; // posts are in pairs; carts sit under arches
            assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.r + b.r + 3, `floor ${floor}: ${a.kind} and ${b.kind} leave room to pass between them`);
        }
        for(let i = 0; i + 1 < layout.rails.length; i++) {
            const [x1, z1] = layout.rails[i], [x2, z2] = layout.rails[i + 1];
            for(let t = 0; t <= 1; t += 0.02) assert.ok(isOpen(layout, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 3), `floor ${floor}: the rails stay inside the cave`);
        }
        assert.ok(layout.pillars.length >= layout.main, `floor ${floor}: columns for cover`);
        assert.ok(layout.arches.length >= 2, `floor ${floor}: timber arches in the tunnels`);
        assert.ok(layout.chests.length >= 1, `floor ${floor}: something to find off the main road`);
    }
});

test('the cave is sealed, and the shaft, every tunnel mouth and every chest can be walked to from the lift', () => {
    for(const floor of FLOORS) {
        const layout = floorLayout(floor);
        const hits = solidsOf(layout);
        const cells = reachable(layout, hits, [0, 0]);
        assert.ok(cells.length > 800, `floor ${floor}: a real amount of ground (${cells.length} cells)`);
        assert.ok(near(cells, layout.shaft, SHAFT_REACH + 1), `floor ${floor}: the shaft can be reached`);
        for(const [x, z] of layout.spawns) assert.ok(near(cells, [x, z]), `floor ${floor}: the tunnel mouth at ${x}, ${z} can be reached`);
        for(const [x, z] of layout.chests) assert.ok(near(cells, [x, z], STEP * 2.5), `floor ${floor}: the chest at ${x.toFixed(0)}, ${z.toFixed(0)} can be reached`);
        const b = bounds(layout);
        for(const [x, z] of cells) {
            assert.ok(x > b.minX + 4 && x < b.maxX - 4 && z > b.minZ + 4 && z < b.maxZ - 4, `floor ${floor}: the walls leak at ${x}, ${z}`);
            assert.ok(isOpen(layout, x, z), `floor ${floor}: walked into rock at ${x}, ${z}`);
        }
    }
});

test('tunnel mouths are open ground with room around them, in plenty, and far from the lift and shaft', () => {
    for(const floor of FLOORS) {
        const layout = floorLayout(floor);
        const hits = solidsOf(layout);
        assert.ok(layout.spawns.length >= 30, `floor ${floor}: enough mouths (${layout.spawns.length}) that the pursuit comes from several sides`);
        for(const [x, z, node] of layout.spawns) {
            assert.ok(isOpen(layout, x, z, 7), `floor ${floor}: the mouth at ${x}, ${z} is in open ground`);
            assert.ok(!hits(x, z, 4), `floor ${floor}: nothing stands on the mouth at ${x}, ${z}`);
            assert.ok(Math.hypot(x, z) >= 16 && Math.hypot(x - layout.shaft[0], z - layout.shaft[1]) >= 12, `floor ${floor}: not on the lift or the shaft`);
            assert.equal(node, nearestNode(layout, x, z), 'each mouth knows its chamber');
        }
    }
});

test('spawnPoint comes out of the dark around the marshal, never in the rock, and never far across the cave', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for(const floor of FLOORS) {
        const layout = floorLayout(floor);
        const where = [{ x: 0, z: 0 }, { x: layout.shaft[0], z: layout.shaft[1] }, { x: layout.nodes[Math.floor(layout.main / 2)].x, z: layout.nodes[Math.floor(layout.main / 2)].z }];
        for(const player of where) {
            let inRing = 0;
            for(let i = 0; i < 60; i++) {
                const p = spawnPoint(layout, player, rand);
                assert.ok(isOpen(layout, p.x, p.z, 3), `floor ${floor}: spawned in open ground`);
                const d = Math.hypot(p.x - player.x, p.z - player.z);
                assert.ok(d <= MAX_SPAWN_DISTANCE + 50, `floor ${floor}: spawned near the marshal (${d.toFixed(0)} away)`);
                if(d >= MIN_SPAWN_DISTANCE - 4 && d <= MAX_SPAWN_DISTANCE + 4) inRing++;
            }
            assert.ok(inRing >= 40, `floor ${floor}: most pursuers come out in the ring around the marshal (${inRing} of 60)`);
        }
    }
});

test('a pursuer that cannot see the marshal follows the road of chambers, and one that can goes straight at him', () => {
    for(const floor of [2, 5, 8]) {
        const layout = floorLayout(floor);
        // Two chambers apart: the rock is between them.
        const a = layout.nodes[0], c = layout.nodes[2];
        const from = { x: a.x, z: a.z }, to = { x: c.x, z: c.z };
        const aim = steerTarget(layout, from, to);
        if(!lineOpen(layout, from.x, from.z, to.x, to.z)) {
            const hop = layout.nodes[layout.next[nearestNode(layout, from.x, from.z)][nearestNode(layout, to.x, to.z)]];
            assert.deepEqual(aim, { x: hop.x, z: hop.z }, `floor ${floor}: heads for the next chamber along the road`);
            assert.ok(lineOpen(layout, from.x, from.z, aim.x, aim.z) || Math.hypot(aim.x - from.x, aim.z - from.z) < 120, 'and the next chamber is a short walk away');
        }
        // Following the road step by step always gets there.
        let at = { ...from };
        for(let step = 0; step < 40 && Math.hypot(at.x - to.x, at.z - to.z) > 12; step++) {
            const t = steerTarget(layout, at, to);
            at = { x: t.x, z: t.z };
        }
        assert.ok(Math.hypot(at.x - to.x, at.z - to.z) <= 12 || lineOpen(layout, at.x, at.z, to.x, to.z), `floor ${floor}: the road leads all the way`);
        // In plain sight: straight at him.
        const here = { x: a.x + 3, z: a.z + 3 }, there = { x: a.x - 6, z: a.z + 5 };
        assert.deepEqual(steerTarget(layout, here, there), there, 'in plain sight, straight at him');
    }
    const layout = floorLayout(1);
    assert.equal(lineOpen(layout, 0, 0, 500, 500), false, 'nobody sees across the whole cave');
});

test('the lift, the shaft and the chests are reached by walking up to them', () => {
    const layout = floorLayout(1);
    assert.equal(shaftReached(layout, layout.shaft[0], layout.shaft[1]), true);
    assert.equal(shaftReached(layout, layout.shaft[0] + SHAFT_REACH + 0.5, layout.shaft[1]), false);
    assert.equal(liftReached(0, 0), true);
    assert.equal(liftReached(LIFT_REACH + 0.5, 0), false);
    const [cx, cz] = layout.chests[0];
    assert.equal(chestWithin(layout, cx, cz), 0);
    assert.equal(chestWithin(layout, cx + CHEST_REACH + 0.5, cz), -1);
    assert.equal(chestWithin(layout, cx, cz, [0]), -1, 'an opened chest is done with');
});

test('the wall ring has no gaps a bullet could slip through', () => {
    for(const floor of [1, 4]) {
        const layout = floorLayout(floor);
        const hits = solidsOf(layout);
        const walls = wallCircles(layout);
        assert.ok(walls.length > 300 && walls.length < 20000, `floor ${floor}: ${walls.length} wall circles keeps the physics grid cheap`);
        // Every point just inside the rock has a wall circle within a bullet's width, so a shot stops at the wall.
        for(const [x, z] of gridPoints(layout, 1, 1)) {
            const d = distance(layout, x, z);
            if(d > 0.1 && d < 0.6) assert.ok(hits(x, z, 0.5), `floor ${floor}: a bullet gets through at ${x}, ${z}`);
        }
    }
});

test('the active floor is what the physics and the spawns look at, and it can be cleared', () => {
    assert.equal(activeFloor(), null);
    setActiveFloor(floorLayout(1));
    assert.equal(activeFloor(), floorLayout(1));
    setActiveFloor(null);
    assert.equal(activeFloor(), null);
    assert.ok(MAX_CHAMBERS >= 12);
});

test('floors get twin caverns, long galleries and rockfalls with depth, and the first floor stays plain', () => {
    const count = (layout, kind) => layout.extras.filter(e => e.kind === kind).length;
    assert.equal(floorLayout(1).extras.length, 0, 'floor 1 has no extra shapes');
    let lobes = 0, galleries = 0, falls = 0;
    for(let floor = 2; floor <= 15; floor++) {
        const layout = floorLayout(floor);
        lobes += count(layout, 'lobe');
        galleries += count(layout, 'gallery');
        falls += layout.rockfalls.length;
        assert.equal(layout.shapes.length, layout.nodes.length + layout.tunnels.length + layout.extras.length, `floor ${floor}: every extra is a shape the scene already draws`);
        for(const e of layout.extras) assert.ok(e.owner > 0 && e.owner < layout.main - 1, `floor ${floor}: never on the lift's chamber or the shaft's`);
        for(const e of layout.extras.filter(e => e.kind === 'gallery')) assert.ok(floor >= 3, 'galleries start on floor 3');
        for(const [x, z, r] of layout.rockfalls) {
            assert.ok(r >= 3.6 && isOpen(layout, x, z, r + 5), `floor ${floor}: a rockfall has a wide way round it`);
            assert.ok(layout.pillars.some(p => p[0] === x && p[1] === z && p[2] === r), 'and is solid like a column');
        }
    }
    assert.ok(lobes >= 3 && galleries >= 2 && falls >= 4, `a spread of shapes over fifteen floors (${lobes} lobes, ${galleries} galleries, ${falls} rockfalls)`);
});

test('every floor from 1 to 30 can be walked from the lift to the shaft and to every chest, with the new shapes in', () => {
    for(let floor = 1; floor <= 30; floor++) {
        const layout = floorLayout(floor);
        const cells = reachable(layout, solidsOf(layout), [0, 0]);
        assert.ok(near(cells, layout.shaft, SHAFT_REACH + 1), `floor ${floor}: the shaft can be reached`);
        for(const [x, z] of layout.chests) assert.ok(near(cells, [x, z], STEP * 2.5), `floor ${floor}: the chest at ${x.toFixed(0)}, ${z.toFixed(0)} can be reached`);
        for(const [x, z] of layout.spawns) assert.ok(near(cells, [x, z]), `floor ${floor}: the tunnel mouth at ${x}, ${z} can be reached`);
        for(const e of layout.extras) {
            const node = layout.nodes[e.owner];
            assert.ok(near(cells, [node.x, node.z], STEP * 4), `floor ${floor}: ${e.kind} chamber can be reached`);
        }
        assert.ok(isOpen(layout, 0, 0, 12), `floor ${floor}: the lift still has room`);
        assert.ok(layout.main > 2, `floor ${floor}: still a descent`);
    }
});

// The mine is dark and the way back is marked with torches (MINE_PLAN.md, "Level size and torches"), so a floor is only so long: the road from the
// lift to the shaft is about 250 on the first floor, 500 on the fifth, 800 on the tenth and 1,500 by the thirtieth, a torch every 40 units.
test('the road from the lift to the shaft is short on the first floors and grows slowly', () => {
    for(const [floor, target] of [[1, 250], [5, 500], [10, 800], [30, 1500]]) {
        const length = roadLength(floorLayout(floor));
        assert.ok(Math.abs(length - target) <= target * 0.15, `floor ${floor}: a road of about ${target} (${Math.round(length)})`);
    }
    let last = roadLength(floorLayout(1));
    for(let floor = 2; floor <= 30; floor++) {
        const length = roadLength(floorLayout(floor));
        assert.ok(length >= last * 0.9 && length <= last * 1.4, `floor ${floor}: no jump from ${Math.round(last)} to ${Math.round(length)}`);
        last = length;
    }
    assert.ok(roadLength(floorLayout(10)) < 900 && roadLength(floorLayout(5)) < 600, 'the first ten floors stay small');
    // About one torch every 40 units: floor 1 needs only a handful, and the deep floors never more than about forty.
    assert.ok(Math.ceil(roadLength(floorLayout(1)) / 40) <= 8);
    assert.ok(Math.ceil(roadLength(floorLayout(30)) / 40) <= 40);
});

test('every way a floor needs is open: the shaft, every chamber, alcove, treasure room, chest and extra cavern can be walked to', () => {
    for(const floor of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 17, 20, 25, 30]) {
        const layout = floorLayout(floor);
        const cells = reachable(layout, solidsOf(layout), [0, 0]);
        for(const [i, n] of layout.nodes.entries()) assert.ok(near(cells, [n.x, n.z], 9), `floor ${floor}: ${n.kind} ${i} can be reached`);
        for(const [x, z, node] of layout.spawns) assert.ok(near(cells, [x, z]), `floor ${floor}: the tunnel mouth in chamber ${node} can be reached`);
    }
});
