// The maps of the Hollow Claim (MINE_PLAN.md): one cave per depth, made for that depth, each larger than the last. A cave is a handful of
// shapes (circles, capsules) whose union is the open ground; everything else is solid rock. Chambers are joined by tunnels, with side
// alcoves and treasure rooms, rock columns for cover, timber arches, carts on rails, and a chest or two. No rendering here, so the rules
// and the tests use it as it is; src/mineScene.js draws a floor and builds its walls.
//
// A depth always generates the same cave (it is seeded by the depth), so a floor looks the same each time you reach it. The marshal
// always starts on the lift at (0, 0). The shaft down is a place to walk to and is always open: you can go down whenever you find it,
// fighting or not. Plain chasers walk straight at the marshal, so chambers are wide and roughly round and tunnels are wide enough to fight
// in; for anything that cannot see the marshal there is a road of waypoints (steerTarget) so a winding cave does not trap it.

export const CELL = 2.5;           // the grid the wall circles stand on
export const WALL_DEPTH = 4.5;     // how deep into the rock the wall circles go (the marshal and bullets stop at the first ring)
export const WALL_RADIUS = 2.5;
export const SHAFT_REACH = 3.4;    // how close to the shaft counts as stepping into it
export const LIFT_REACH = 4.4;     // the lift: it brings the marshal back up, once he has walked away from it
export const LIFT_ARM_DISTANCE = 20; // ... which only works after he has been this far from it
export const CHEST_REACH = 3.2;    // how close opens a chest
export const MIN_SPAWN_DISTANCE = 34; // pursuers come out of the dark at least this far from the marshal ...
export const MAX_SPAWN_DISTANCE = 66; // ... and no farther, so the cave is alive around him, not all over it
export const AGGRO_DISTANCE = 64;  // anything farther than this from the marshal is asleep
export const MAX_CHAMBERS = 15;

const shapeBox = s => s.kind === 'circle' ? [s.x - s.r, s.x + s.r, s.z - s.r, s.z + s.r]
    : [Math.min(s.x1, s.x2) - s.r, Math.max(s.x1, s.x2) + s.r, Math.min(s.z1, s.z2) - s.r, Math.max(s.z1, s.z2) + s.r];
const circle = (x, z, r) => ({ kind: 'circle', x, z, r });
const capsule = (x1, z1, x2, z2, r) => ({ kind: 'capsule', x1, z1, x2, z2, r });

const FLOOR_NAMES = ['THE UPPER GALLERY', 'THE RAIL CUT', 'THE TWIN CAVERNS', 'THE CROSSING', 'THE DEEP HOLLOW', 'THE WEEPING STOPES',
    'THE COLLAPSED WORKINGS', 'THE SILVER SEAM', 'THE DROWNED LEVEL', 'THE ECHO VAULTS'];
export function floorName(floor) {
    const n = Math.max(1, Math.floor(floor));
    return n <= FLOOR_NAMES.length ? FLOOR_NAMES[n - 1] : `THE LOST LEVEL ${n}`;
}

// ---------- the shape of the ground ----------

function sdShape(s, x, z) {
    if(s.kind === 'circle') return Math.hypot(x - s.x, z - s.z) - s.r;
    const vx = s.x2 - s.x1, vz = s.z2 - s.z1; // a capsule: the distance to a segment, less its radius
    const t = Math.max(0, Math.min(1, ((x - s.x1) * vx + (z - s.z1) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - (s.x1 + vx * t), z - (s.z1 + vz * t)) - s.r;
}

// A slow, fixed wobble so the walls are not made of perfect circles and straight lines.
const wobble = (x, z) => 1.8 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.4) + 1.1 * Math.sin((x + z) * 0.21);

// Negative inside the cave, positive in the rock; roughly the distance to the wall. A shape whose box the point is far outside of
// cannot be the nearest one, so a cave of fifty shapes costs a few evaluations, not fifty.
export function distance(layout, x, z) {
    const { shapes, boxes } = layout;
    let d = Infinity;
    for(let i = 0; i < shapes.length; i++) {
        const b = boxes[i];
        const dx = Math.max(b[0] - x, 0, x - b[1]), dz = Math.max(b[2] - z, 0, z - b[3]);
        if((dx > 0 || dz > 0) && Math.hypot(dx, dz) >= d) continue;
        const sd = sdShape(shapes[i], x, z);
        if(sd < d) d = sd;
    }
    return d + wobble(x, z);
}

// Is (x, z) open ground, at least `margin` units from the wall?
export function isOpen(layout, x, z, margin = 0) {
    return distance(layout, x, z) < -margin;
}

export function bounds(layout, pad = 10) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for(const b of layout.boxes) { minX = Math.min(minX, b[0]); maxX = Math.max(maxX, b[1]); minZ = Math.min(minZ, b[2]); maxZ = Math.max(maxZ, b[3]); }
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

// Every point on a grid of `step` (multiples of it) within `pad` of the cave's shapes: the places worth looking at, found without
// scanning the empty rock between far-apart chambers. Each is [x, z], once.
export function gridPoints(layout, step, pad) {
    const seen = new Set();
    const points = [];
    layout.shapes.forEach((shape, i) => {
        const b = layout.boxes[i];
        for(let x = Math.floor((b[0] - pad) / step) * step; x <= b[1] + pad; x += step) {
            for(let z = Math.floor((b[2] - pad) / step) * step; z <= b[3] + pad; z += step) {
                if(sdShape(shape, x, z) - 2.9 > pad) continue; // (the wobble moves the wall by at most 2.9)
                const key = `${x},${z}`;
                if(seen.has(key)) continue;
                seen.add(key);
                points.push([x, z]);
            }
        }
    });
    return points;
}

// ---------- the generator ----------

const hashOf = text => { let h = 2166136261; for(const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const seededRandom = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// How far (x, z) is from the segment a-b.
function segmentDistance(x, z, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1)));
    return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}

// How many chambers a depth has: the maps grow a lot with every floor.
export function chamberCount(floor) {
    return Math.min(MAX_CHAMBERS, 2 + 2 * Math.max(1, Math.floor(floor)));
}

function generate(floor) {
    const depth = Math.max(1, Math.floor(floor));
    const rand = seededRandom(hashOf(`hollow-claim-${depth}`));
    const nodes = [{ x: 0, z: 0, r: 30, kind: 'chamber', parent: -1 }];
    const tunnels = []; // { a, b, r, angle, rim0, rim1 }: a tunnel between two nodes (rim0 and rim1: where it leaves the first and enters the second)
    const target = chamberCount(depth);
    const grow = Math.min(depth, 10) * 1.2;
    let heading = (rand() - 0.5) * 0.8;

    // The main road: chambers one after another, each turning a little from the last, never close to an earlier one.
    for(let i = 1; i < target; i++) {
        const prev = nodes[i - 1];
        let placed = false;
        for(let attempt = 0; attempt < 60 && !placed; attempt++) {
            const h = heading + (rand() - 0.5) * (attempt < 24 ? 1.3 : 2.8);
            const r = 24 + rand() * 8 + grow;
            const dist = prev.r + r + 12 + rand() * 10 + attempt * 0.7;
            const x = prev.x + Math.cos(h) * dist, z = prev.z + Math.sin(h) * dist;
            let ok = true;
            for(let j = 0; j < i - 1 && ok; j++) {
                const c = nodes[j];
                if(Math.hypot(x - c.x, z - c.z) < r + c.r + 24) ok = false;
                if(segmentDistance(c.x, c.z, prev.x, prev.z, x, z) < c.r + 16) ok = false;
            }
            for(let k = 0; k < tunnels.length - 1 && ok; k++) {
                const t = tunnels[k];
                if(segmentDistance(x, z, nodes[t.a].x, nodes[t.a].z, nodes[t.b].x, nodes[t.b].z) < r + t.r + 14) ok = false;
            }
            if(!ok) continue;
            nodes.push({ x, z, r, kind: 'chamber', parent: -1 });
            tunnels.push({ a: i - 1, b: i, r: 11 + rand() * 3, angle: h, length: dist });
            heading = h;
            placed = true;
        }
        if(!placed) break; // boxed in: this is the last chamber
    }
    const main = nodes.length;

    const extras = []; // { kind: 'lobe' | 'gallery', owner, shape }: a second cave shape attached to a chamber (below)
    const clearOfOthers = (x, z, r, ownerA, ownerB, gap) => {
        for(const e of extras) if(e.owner !== ownerA && sdShape(e.shape, x, z) < r + gap) return false;
        for(let j = 0; j < nodes.length; j++) {
            if(j === ownerA) continue;
            if(Math.hypot(x - nodes[j].x, z - nodes[j].z) < r + nodes[j].r + gap) return false;
        }
        for(const t of tunnels) {
            if(t.a === ownerA || t.b === ownerA) continue;
            if(segmentDistance(x, z, nodes[t.a].x, nodes[t.a].z, nodes[t.b].x, nodes[t.b].z) < r + t.r + gap) return false;
        }
        return true;
    };
    // Variety of shape: from the second depth a chamber may grow a second round cavern into a twin (a lobe), and from the third a long
    // gallery may cross it. Both are only more ground joined to the chamber, so they keep to the rules of the map (a chamber is a node, the
    // shape is more cave), each is checked clear of every other chamber, tunnel and extra, and they come from their own seeded roll.
    const variety = seededRandom(hashOf(`hollow-claim-variety-${depth}`));
    for(let i = 1; i < main - 1; i++) {
        const node = nodes[i];
        const roll = variety(), around = variety() * Math.PI * 2, size = variety();
        const awayFromLift = (x, z, r) => Math.hypot(x, z) > r + 16;
        if(depth >= 2 && roll < Math.min(0.5, 0.15 + 0.05 * depth)) {
            const r = node.r * (0.55 + 0.2 * size), dist = node.r * 0.7 + r * 0.6;
            const x = node.x + Math.cos(around) * dist, z = node.z + Math.sin(around) * dist;
            if(awayFromLift(x, z, r) && clearOfOthers(x, z, r, i, i, 12)) extras.push({ kind: 'lobe', owner: i, shape: circle(x, z, r) });
        } else if(depth >= 3 && roll > 1 - Math.min(0.4, 0.05 * depth)) {
            const half = node.r * 1.5, r = 9 + size * 3;
            const dx = Math.cos(around) * half, dz = Math.sin(around) * half;
            let ok = true;
            for(let k = -4; k <= 4 && ok; k++) {
                const x = node.x + dx * k / 4, z = node.z + dz * k / 4;
                ok = awayFromLift(x, z, r) && clearOfOthers(x, z, r, i, i, 10);
            }
            if(ok) extras.push({ kind: 'gallery', owner: i, shape: capsule(node.x - dx, node.z - dz, node.x + dx, node.z + dz, r) });
        }
    }

    // Side alcoves (a round pocket off a chamber) and, from the second depth, treasure rooms down a side tunnel of their own.
    const chests = [];
    const sideChance = Math.min(0.85, 0.5 + 0.04 * depth);
    for(let i = 0; i < main; i++) {
        if(rand() > sideChance) continue;
        const parent = nodes[i];
        const room = depth >= 2 && rand() < 0.4;
        for(let attempt = 0; attempt < 14; attempt++) {
            const around = rand() * Math.PI * 2;
            const r = room ? 18 + rand() * 6 : 14 + rand() * 5;
            const dist = room ? parent.r + 34 + r : parent.r + r - 9;
            const x = parent.x + Math.cos(around) * dist, z = parent.z + Math.sin(around) * dist;
            if(!clearOfOthers(x, z, r, i, i, room ? 14 : 10)) continue;
            // The tunnel to a room must not cross another chamber either.
            if(room && nodes.some((c, j) => j !== i && segmentDistance(c.x, c.z, parent.x, parent.z, x, z) < c.r + 14)) continue;
            if(room && extras.some(e => e.owner !== i && [0.25, 0.5, 0.75, 1].some(f => sdShape(e.shape, parent.x + (x - parent.x) * f, parent.z + (z - parent.z) * f) < 24))) continue;
            const index = nodes.length;
            nodes.push({ x, z, r, kind: room ? 'room' : 'alcove', parent: i });
            if(room) tunnels.push({ a: i, b: index, r: 11 + rand() * 2, angle: around, length: dist });
            chests.push([x + Math.cos(around) * r * 0.35, z + Math.sin(around) * r * 0.35]);
            break;
        }
    }

    const shapes = [...nodes.map(n => circle(n.x, n.z, n.r)), ...tunnels.map(t => capsule(nodes[t.a].x, nodes[t.a].z, nodes[t.b].x, nodes[t.b].z, t.r)), ...extras.map(e => e.shape)];
    const last = nodes[main - 1];
    const shaft = [last.x + Math.cos(heading) * last.r * 0.42, last.z + Math.sin(heading) * last.r * 0.42];
    const rails = [[0, 0], ...nodes.slice(1, main).map(n => [n.x, n.z]), shaft];
    const layout = { id: `depth-${depth}`, depth, name: floorName(depth), shapes, boxes: shapes.map(shapeBox), nodes, tunnels, main, shaft, rails,
        pillars: [], arches: [], clusters: [], carts: [], chests, spawns: [], extras: extras.map(e => ({ kind: e.kind, owner: e.owner })), rockfalls: [] };

    // ----- props: each placed on open ground, off the rails, clear of each other, off the lift and the shaft -----
    const props = []; // { x, z, r }
    const clear = (x, z, r, railGap = 5.5, gap = 3.6) => { // railGap null: the prop belongs on the rails (a cart)
        if(!isOpen(layout, x, z, r + 1.8)) return false;
        if(Math.hypot(x, z) < r + 10 || Math.hypot(x - shaft[0], z - shaft[1]) < r + 9) return false;
        for(const p of props) if(Math.hypot(x - p.x, z - p.z) < r + p.r + gap) return false;
        if(railGap !== null) for(let i = 0; i < rails.length - 1; i++) if(segmentDistance(x, z, rails[i][0], rails[i][1], rails[i + 1][0], rails[i + 1][1]) < r + railGap) return false;
        return true;
    };
    const place = (list, node, frac0, frac1, r, count, tries = 14) => {
        for(let n = 0; n < count; n++) for(let attempt = 0; attempt < tries; attempt++) {
            const a = rand() * Math.PI * 2, f = frac0 + rand() * (frac1 - frac0);
            const x = node.x + Math.cos(a) * node.r * f, z = node.z + Math.sin(a) * node.r * f;
            if(!clear(x, z, r)) continue;
            props.push({ x, z, r });
            list.push([x, z, r]);
            break;
        }
    };
    for(const c of chests) props.push({ x: c[0], z: c[1], r: 1.7 });
    // Tunnel arches go in before anything else: they are posts across a passage, and the cave should look held up.
    for(const t of tunnels) {
        if(t.a >= main || t.b >= main) continue;
        const a = nodes[t.a], b = nodes[t.b];
        const ux = (b.x - a.x) / t.length, uz = (b.z - a.z) / t.length;
        const rimIn = a.r, rimOut = t.length - b.r;
        const exposed = rimOut - rimIn;
        const half = t.r - 6;
        const spots = exposed > 30 ? [0.3, 0.7] : exposed > 12 ? [0.5] : [];
        for(const f of spots) {
            const along = rimIn + exposed * f;
            const x = a.x + ux * along, z = a.z + uz * along;
            const posts = [-1, 1].map(s => [x - uz * half * s, z + ux * half * s]);
            if(!posts.every(([px, pz]) => isOpen(layout, px, pz, 2.4))) continue;
            layout.arches.push([x, z, t.angle + Math.PI / 2, half]);
            for(const [px, pz] of posts) props.push({ x: px, z: pz, r: 0.9 });
            props.push({ x, z, r: 0.9 });
        }
    }
    // Ore carts stand in the chambers, parked beside the track (a cart in the middle of a tunnel would block it).
    for(let i = 1; i < main; i++) {
        if(rand() > 0.6) continue;
        for(let attempt = 0; attempt < 16; attempt++) {
            const a = rand() * Math.PI * 2, f = 0.25 + rand() * 0.5;
            const x = nodes[i].x + Math.cos(a) * nodes[i].r * f, z = nodes[i].z + Math.sin(a) * nodes[i].r * f;
            let best = Infinity, bestAngle = 0;
            for(let k = 0; k < rails.length - 1; k++) {
                const d = segmentDistance(x, z, rails[k][0], rails[k][1], rails[k + 1][0], rails[k + 1][1]);
                if(d < best) { best = d; bestAngle = Math.atan2(rails[k + 1][1] - rails[k][1], rails[k + 1][0] - rails[k][0]); }
            }
            if(best > 9 || !clear(x, z, 1.9, 2.5, 3.0)) continue;
            props.push({ x, z, r: 1.9 });
            layout.carts.push([x, z, bestAngle]);
            break;
        }
    }
    nodes.forEach((node, index) => {
        if(node.kind === 'chamber') {
            place(layout.pillars, node, 0.35, 0.72, 2.2 + rand() * 1.0, 2 + Math.floor(rand() * 3) + (node.r > 34 ? 1 : 0));
            if(index > 0 && index < main - 1) place(layout.clusters, node, 0.3, 0.7, 2.6, 1 + (rand() < 0.4 ? 1 : 0));
            if(index === 0 || index === main - 1) place(layout.clusters, node, 0.45, 0.75, 2.6, 1);
        } else {
            place(layout.pillars, node, 0.2, 0.5, 2.3, 1);
        }
    });
    // A rockfall: a heap that fills the middle of a chamber, so the way through goes round it (it is a fat column to the scene and the
    // rules; art may dress it as it likes). Kept well off the rails and the walls, so there is always a wide way past on both sides.
    const fallChance = Math.min(0.5, 0.12 + 0.04 * depth);
    for(let i = 1; i < main; i++) {
        if(nodes[i].r < 24 || variety() > fallChance) continue;
        for(let attempt = 0; attempt < 14; attempt++) {
            const r = 4.6 + variety() * 2, a = variety() * Math.PI * 2, f = 0.2 + variety() * 0.4;
            const x = nodes[i].x + Math.cos(a) * nodes[i].r * f, z = nodes[i].z + Math.sin(a) * nodes[i].r * f;
            if(!clear(x, z, r) || !isOpen(layout, x, z, r + 7)) continue;
            props.push({ x, z, r });
            layout.pillars.push([x, z, r]);
            layout.rockfalls.push([x, z, r]);
            break;
        }
    }
    layout.clusters = layout.clusters.map(([x, z]) => [x, z]); // (a cluster has no radius of its own to the rules)

    // ----- the road: how a pursuer finds the marshal through a winding cave, as the next chamber to head for -----
    const count = nodes.length;
    const links = nodes.map(() => []);
    for(const t of tunnels) { links[t.a].push(t.b); links[t.b].push(t.a); }
    nodes.forEach((n, i) => { if(n.kind === 'alcove') { links[i].push(n.parent); links[n.parent].push(i); } });
    layout.next = Array.from({ length: count }, () => new Array(count).fill(-1));
    layout.hops = Array.from({ length: count }, () => new Array(count).fill(Infinity));
    for(let goal = 0; goal < count; goal++) { // breadth first from each goal: the neighbour closer to it is the next step
        layout.hops[goal][goal] = 0;
        layout.next[goal][goal] = goal;
        const queue = [goal];
        for(let q = 0; q < queue.length; q++) {
            const at = queue[q];
            for(const to of links[at]) {
                if(layout.hops[to][goal] !== Infinity) continue;
                layout.hops[to][goal] = layout.hops[at][goal] + 1;
                layout.next[to][goal] = at;
                queue.push(to);
            }
        }
    }

    // ----- tunnel mouths: open places to come out of the dark, on a grid over the cave -----
    const solids = [...wallCirclesOf(layout), ...propCirclesOf(layout)];
    const grid = new Map();
    for(const c of solids) { const key = `${Math.floor(c.x / 12)},${Math.floor(c.z / 12)}`; (grid.get(key) ?? grid.set(key, []).get(key)).push(c); }
    const free = (x, z, gap) => {
        for(let gx = Math.floor((x - 8) / 12); gx <= Math.floor((x + 8) / 12); gx++) for(let gz = Math.floor((z - 8) / 12); gz <= Math.floor((z + 8) / 12); gz++) {
            for(const c of grid.get(`${gx},${gz}`) ?? []) if(Math.hypot(x - c.x, z - c.z) < c.r + gap) return false;
        }
        return true;
    };
    for(const [x, z] of gridPoints(layout, 10, 0)) {
        if(!isOpen(layout, x, z, 7) || !free(x, z, 4.5)) continue;
        if(Math.hypot(x, z) < 16 || Math.hypot(x - shaft[0], z - shaft[1]) < 12) continue;
        layout.spawns.push([x, z, nearestNode(layout, x, z)]);
    }
    return layout;
}

// ---------- looking things up ----------

const caches = new WeakMap();
const cached = (layout, key, build) => {
    let entry = caches.get(layout);
    if(!entry) caches.set(layout, entry = {});
    return entry[key] ?? (entry[key] = build());
};

const layouts = new Map();
export function floorLayout(floor) {
    const depth = Math.max(1, Math.floor(floor) || 1);
    if(!layouts.has(depth)) {
        if(layouts.size > 6) layouts.delete(layouts.keys().next().value); // only the floors being played stay in memory
        layouts.set(depth, generate(depth));
    }
    return layouts.get(depth);
}

// The solid ring the marshal, the enemies and bullets stop at: circles on a grid, in the first WALL_DEPTH units of rock.
function wallCirclesOf(layout) {
    const circles = [];
    for(const [x, z] of gridPoints(layout, CELL, WALL_DEPTH + 1)) {
        const d = distance(layout, x, z);
        if(d >= 0 && d < WALL_DEPTH) circles.push({ x, z, r: WALL_RADIUS, kind: 'wall' });
    }
    return circles;
}
export const wallCircles = layout => cached(layout, 'walls', () => wallCirclesOf(layout));

// Pillars, the posts of each arch, crates, carts and chests: the things you can take cover behind.
function propCirclesOf(layout) {
    const circles = layout.pillars.map(([x, z, r]) => ({ x, z, r, kind: 'pillar' }));
    for(const [x, z, angle, half] of layout.arches) {
        for(const side of [-1, 1]) circles.push({ x: x + Math.cos(angle) * half * side, z: z + Math.sin(angle) * half * side, r: 0.9, kind: 'post' });
    }
    for(const [x, z] of layout.clusters) circles.push({ x, z, r: 2.6, kind: 'cluster' });
    for(const [x, z] of layout.carts) circles.push({ x, z, r: 1.9, kind: 'cart' });
    for(const [x, z] of layout.chests) circles.push({ x, z, r: 1.7, kind: 'chest' });
    return circles;
}
export const propCircles = layout => cached(layout, 'props', () => propCirclesOf(layout));

// The chamber (or alcove, or treasure room) a point is in, or nearest to.
export function nearestNode(layout, x, z) {
    let best = 0, bestScore = Infinity;
    layout.nodes.forEach((n, i) => {
        const score = Math.hypot(x - n.x, z - n.z) - n.r;
        if(score < bestScore) { bestScore = score; best = i; }
    });
    return best;
}

// Can you see from a to b, without the rock in the way?
export function lineOpen(layout, ax, az, bx, bz, margin = 1.5) {
    const length = Math.hypot(bx - ax, bz - az);
    if(length > 80) return false;
    const steps = Math.ceil(length / 2.5);
    for(let i = 1; i < steps; i++) {
        const t = i / steps;
        if(!isOpen(layout, ax + (bx - ax) * t, az + (bz - az) * t, margin)) return false;
    }
    return true;
}

// Where a pursuer should head to reach the marshal: straight at him when it can see him, else along the road of chambers.
export function steerTarget(layout, from, to) {
    if(lineOpen(layout, from.x, from.z, to.x, to.z)) return { x: to.x, z: to.z };
    const here = nearestNode(layout, from.x, from.z), goal = nearestNode(layout, to.x, to.z);
    if(here === goal) return { x: to.x, z: to.z };
    let hop = layout.next[here][goal];
    if(hop < 0) return { x: to.x, z: to.z };
    let node = layout.nodes[hop];
    if(hop !== goal && Math.hypot(from.x - node.x, from.z - node.z) < 10) node = layout.nodes[layout.next[hop][goal]]; // close enough: on to the next
    return { x: node.x, z: node.z };
}

// Where a pursuer comes out of the dark: a tunnel mouth in a ring around the marshal, no more than two chambers away along the road.
export function spawnPoint(layout, playerPos, rand = Math.random) {
    const here = nearestNode(layout, playerPos.x, playerPos.z);
    const dist = s => Math.hypot(s[0] - playerPos.x, s[1] - playerPos.z);
    let pool = layout.spawns.filter(s => dist(s) >= MIN_SPAWN_DISTANCE && dist(s) <= MAX_SPAWN_DISTANCE && layout.hops[here][s[2]] <= 2);
    if(!pool.length) pool = layout.spawns.filter(s => dist(s) >= 20 && dist(s) <= 110);
    if(!pool.length) pool = [layout.spawns.reduce((best, s) => dist(s) > dist(best) ? s : best)];
    const [sx, sz] = pool[Math.floor(rand() * pool.length)];
    for(let attempt = 0; attempt < 6; attempt++) {
        const x = sx + (rand() - 0.5) * 6, z = sz + (rand() - 0.5) * 6;
        if(isOpen(layout, x, z, 4)) return { x, z };
    }
    return { x: sx, z: sz };
}

export function shaftReached(layout, x, z) {
    return Math.hypot(x - layout.shaft[0], z - layout.shaft[1]) <= SHAFT_REACH;
}

export function liftReached(x, z) {
    return Math.hypot(x, z) <= LIFT_REACH;
}

// The index of the chest within reach, or -1.
export function chestWithin(layout, x, z, opened = []) {
    return layout.chests.findIndex(([cx, cz], i) => !opened.includes(i) && Math.hypot(x - cx, z - cz) <= CHEST_REACH);
}

// ---------- the floor being played ----------
// src/mineScene.js sets this when it builds a floor and clears it when the floor goes. The physics (src/physics.js) treats rock as
// blocked and the enemies (src/enemySystem.js) come out of its mouths, so nothing can stand, spawn or reappear inside the rock.
let active = null;
export const setActiveFloor = layout => { active = layout; };
export const activeFloor = () => active;
