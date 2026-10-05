// The maps of the Hollow Claim (MINE_PLAN.md): one cave per floor, described as a handful of shapes (circles, boxes, capsules)
// whose union is the open ground. Everything else is solid rock. No rendering here, so the rules and the tests use it as it is;
// src/mineScene.js draws a floor and builds its walls.
//
// A cave must work with the game's plain chasers (enemies walk straight at the marshal), so every cavern is wide and roughly
// convex and every passage is wide enough to fight in; pillars give cover instead of mazes. The marshal always starts on the
// lift at (0, 0). The shaft down is a place to walk to: it stays sealed until the floor is cleared (src/gameLoop.js).
// Positions are world units; the arena the other stages use is 240 wide, the longest cave is about 120 across.

export const CELL = 2.5;          // the grid the wall circles stand on
export const WALL_DEPTH = 4.5;    // how deep into the rock the wall circles go (the marshal and bullets stop at the first ring)
export const WALL_RADIUS = 2.5;
export const SHAFT_REACH = 3.4;   // how close to the shaft counts as stepping into it
export const MIN_SPAWN_DISTANCE = 28; // enemies come out of tunnel mouths at least this far from the marshal

const circle = (x, z, r) => ({ kind: 'circle', x, z, r });
const box = (x, z, hw, hh, round = 3) => ({ kind: 'box', x, z, hw, hh, round });
const capsule = (x1, z1, x2, z2, r) => ({ kind: 'capsule', x1, z1, x2, z2, r });

// How each floor looks and plays. shapes: the open ground. rails: polylines from the lift to the shaft. pillars: [x, z, radius]
// of rock columns (cover). arches: a timber frame across a passage, [x, z, angle of the line the posts stand on, half span].
// clusters: stacked crates and barrels. carts: ore carts on the rails, [x, z, angle]. spawns: where pursuers come out of the dark.
export const FLOOR_LAYOUTS = [
    { // 1. A round gallery by the lift, a passage east, and the shaft in a small chamber.
        id: 'upper-gallery', name: 'THE UPPER GALLERY',
        shapes: [circle(0, 0, 32), capsule(18, 0, 62, -8, 10), circle(76, -8, 18)],
        shaft: [78, -8],
        rails: [[0, 0], [18, 0], [62, -8], [76, -8]],
        pillars: [[-10, -12, 2.6], [14, 14, 3], [-18, 16, 2.2], [22, -11, 2.4]],
        arches: [[36, -3.6, 0.17, 7], [54, -7, 0.17, 7]],
        clusters: [[-22, -4], [-6, 24]],
        carts: [[22, -0.7, -0.17]],
        spawns: [[-24, 8], [-12, -23], [6, 25], [46, -5]]
    },
    { // 2. A long rail cut with side alcoves: the corridor floor.
        id: 'rail-cut', name: 'THE RAIL CUT',
        shapes: [box(48, 0, 62, 15), circle(28, -24, 13), circle(78, 24, 13), circle(104, 0, 16)],
        shaft: [102, 0],
        rails: [[0, 0], [102, 0]],
        pillars: [[21, 7, 2.4], [48, -9, 2.8], [76, 8, 2.4], [90, -9, 2.2]],
        arches: [[14, 0, Math.PI / 2, 10], [40, 0, Math.PI / 2, 10], [62, 0, Math.PI / 2, 10]],
        clusters: [[30, -29], [80, 29], [30, 10]],
        carts: [[26, 0, 0], [58, 0, 0], [84, 0, 0]],
        spawns: [[-6, -9], [24, -22], [74, 22], [54, -7], [108, 8]]
    },
    { // 3. Two caverns joined by a wide pass.
        id: 'twin-caverns', name: 'THE TWIN CAVERNS',
        shapes: [circle(0, 0, 28), capsule(14, 10, 48, 38, 11), circle(62, 50, 26)],
        shaft: [66, 54],
        rails: [[0, 0], [14, 10], [48, 38], [66, 54]],
        pillars: [[-12, -10, 3], [12, -14, 2.6], [-6, 14, 2.2], [52, 40, 3], [72, 40, 2.6], [58, 64, 2.4]],
        arches: [[31, 24, 0.69 + Math.PI / 2, 6]],
        clusters: [[-20, 10], [70, 66]],
        carts: [[24, 17.5, 0.69], [40, 31, 0.69]],
        spawns: [[-22, -14], [2, -22], [-2, 21], [44, 60], [78, 40], [31, 24]]
    },
    { // 4. A crossing of two galleries under a round chamber.
        id: 'crossing', name: 'THE CROSSING',
        shapes: [box(46, 0, 60, 12), box(46, -28, 12, 54), circle(46, 0, 20)],
        shaft: [46, -68],
        rails: [[0, 0], [46, 0], [46, -68]],
        pillars: [[36, -10, 2.6], [56, 10, 2.6], [30, 4, 2.2], [56, -6, 2.4], [41, -44, 2.6], [52, -30, 2.4], [50, -56, 2.2]],
        arches: [[14, 0, Math.PI / 2, 8], [46, -38, 0, 8]],
        clusters: [[100, -6], [40, 16]],
        carts: [[22, 0, 0], [46, -20, Math.PI / 2]],
        spawns: [[100, 0], [46, 18], [-6, -4], [46, -50], [76, 6]]
    },
    { // 5. The deep hollow: a ring of connected caverns, the shaft in the farthest.
        id: 'deep-hollow', name: 'THE DEEP HOLLOW',
        shapes: [circle(0, 0, 24), circle(34, -20, 26), circle(70, -6, 22), circle(48, 22, 22), circle(96, -30, 24), circle(78, -52, 20),
            capsule(0, 0, 34, -20, 10), capsule(34, -20, 70, -6, 10), capsule(70, -6, 96, -30, 10)], // the capsules keep every neck wide
        shaft: [100, -34],
        rails: [[0, 0], [34, -20], [70, -6], [100, -34]],
        pillars: [[30, -14, 3], [42, -26, 2.6], [33, -33, 2.2], [50, -14, 2.4], [68, -2, 3], [62, -17, 2.4], [48, 26, 3], [56, 18, 2.4], [90, -26, 2.6], [76, -48, 2.4], [8, 10, 2.2]],
        arches: [[17, -10, -0.53 + Math.PI / 2, 8], [52, -13, 0.37 + Math.PI / 2, 8], [83, -18, -0.7 + Math.PI / 2, 8]],
        clusters: [[-14, -10], [60, 28], [86, -60]],
        carts: [[20, -12, -0.53], [60, -9, 0.37]],
        spawns: [[-8, -16], [28, 0], [48, 36], [66, 8], [88, -52], [30, -40]]
    }
];

export function floorLayout(floor) {
    return FLOOR_LAYOUTS[Math.max(0, Math.min(FLOOR_LAYOUTS.length - 1, Math.floor(floor) - 1))];
}

// ---------- the shape of the ground ----------

function sdShape(s, x, z) {
    if(s.kind === 'circle') return Math.hypot(x - s.x, z - s.z) - s.r;
    if(s.kind === 'box') {
        const dx = Math.abs(x - s.x) - (s.hw - s.round);
        const dz = Math.abs(z - s.z) - (s.hh - s.round);
        return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - s.round;
    }
    // capsule: the distance to a segment, less its radius
    const vx = s.x2 - s.x1, vz = s.z2 - s.z1;
    const t = Math.max(0, Math.min(1, ((x - s.x1) * vx + (z - s.z1) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - (s.x1 + vx * t), z - (s.z1 + vz * t)) - s.r;
}

// A slow, fixed wobble so the walls are not made of perfect circles and straight lines.
const wobble = (x, z) => 1.8 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.4) + 1.1 * Math.sin((x + z) * 0.21);

// Negative inside the cave, positive in the rock; roughly the distance to the wall.
export function distance(layout, x, z) {
    let d = Infinity;
    for(const shape of layout.shapes) d = Math.min(d, sdShape(shape, x, z));
    return d + wobble(x, z);
}

// Is (x, z) open ground, at least `margin` units from the wall?
export function isOpen(layout, x, z, margin = 0) {
    return distance(layout, x, z) < -margin;
}

export function bounds(layout, pad = 10) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for(const s of layout.shapes) {
        const r = s.kind === 'box' ? [s.x - s.hw, s.x + s.hw, s.z - s.hh, s.z + s.hh]
            : s.kind === 'circle' ? [s.x - s.r, s.x + s.r, s.z - s.r, s.z + s.r]
                : [Math.min(s.x1, s.x2) - s.r, Math.max(s.x1, s.x2) + s.r, Math.min(s.z1, s.z2) - s.r, Math.max(s.z1, s.z2) + s.r];
        minX = Math.min(minX, r[0]); maxX = Math.max(maxX, r[1]); minZ = Math.min(minZ, r[2]); maxZ = Math.max(maxZ, r[3]);
    }
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

// ---------- what stands in the cave ----------

// The solid ring the marshal, the enemies and bullets stop at: circles on a grid, in the first WALL_DEPTH units of rock.
export function wallCircles(layout) {
    const b = bounds(layout);
    const circles = [];
    for(let x = Math.floor(b.minX / CELL) * CELL; x <= b.maxX; x += CELL) {
        for(let z = Math.floor(b.minZ / CELL) * CELL; z <= b.maxZ; z += CELL) {
            const d = distance(layout, x, z);
            if(d >= 0 && d < WALL_DEPTH) circles.push({ x, z, r: WALL_RADIUS, kind: 'wall' });
        }
    }
    return circles;
}

// Pillars, the posts of each arch, crates and carts: the things you can take cover behind.
export function propCircles(layout) {
    const circles = layout.pillars.map(([x, z, r]) => ({ x, z, r, kind: 'pillar' }));
    for(const [x, z, angle, half] of layout.arches) {
        for(const side of [-1, 1]) circles.push({ x: x + Math.cos(angle) * half * side, z: z + Math.sin(angle) * half * side, r: 0.9, kind: 'post' });
    }
    for(const [x, z] of layout.clusters) circles.push({ x, z, r: 2.6, kind: 'cluster' });
    for(const [x, z] of layout.carts) circles.push({ x, z, r: 1.9, kind: 'cart' });
    return circles;
}

// Where a pursuer comes out of the dark: a tunnel mouth far enough from the marshal, with a little scatter.
export function spawnPoint(layout, playerPos, rand = Math.random) {
    const far = layout.spawns.filter(([x, z]) => Math.hypot(x - playerPos.x, z - playerPos.z) >= MIN_SPAWN_DISTANCE);
    const pool = far.length ? far : [layout.spawns.reduce((best, s) => Math.hypot(s[0] - playerPos.x, s[1] - playerPos.z) > Math.hypot(best[0] - playerPos.x, best[1] - playerPos.z) ? s : best)];
    const [sx, sz] = pool[Math.floor(rand() * pool.length)];
    for(let attempt = 0; attempt < 6; attempt++) {
        const x = sx + (rand() - 0.5) * 8, z = sz + (rand() - 0.5) * 8;
        if(isOpen(layout, x, z, 4)) return { x, z };
    }
    return { x: sx, z: sz };
}

export function shaftReached(layout, x, z) {
    return Math.hypot(x - layout.shaft[0], z - layout.shaft[1]) <= SHAFT_REACH;
}

// ---------- the floor being played ----------
// src/mineScene.js sets this when it builds a floor and clears it when the floor goes. The physics (src/physics.js) treats rock as
// blocked and the enemies (src/enemySystem.js) come out of its mouths, so nothing can stand, spawn or reappear inside the rock.
let active = null;
export const setActiveFloor = layout => { active = layout; };
export const activeFloor = () => active;
