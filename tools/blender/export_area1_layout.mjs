// Writes tools/blender/pete_area1_layout.json: Pete's Area 1 as plain data, so a Blender level can be built to match the game exactly.
// Run: node tools/blender/export_area1_layout.mjs
// Coordinates are game units (1 unit = 1 metre). Game x is east, game z is south; Blender import maps (x, z) -> (x, -z) with +Z up.
import { writeFileSync } from 'node:fs';
import {
    AREA1_ROAD, AREA1_PLACES, AREA1_BRANCHES, AREA1_CAMPFIRES, AREA1_CRATES, AREA1_SECRET_CRATES, AREA1_POTS, AREA1_BANDITS,
    AREA1_ENCOUNTERS, AREA1_EXIT, AREA1_START, AREA1_CLUE_AT, AREA1_GROUND_SIZE, AREA1_MAP_SIZE
} from '../../src/stages/peteArea1.js';

const r = n => Math.round(n * 100) / 100;
const pt = p => ({ x: r(p.x), z: r(p.z) });
const every = (list, n) => list.filter((_, i) => i % n === 0 || i === list.length - 1);

const layout = {
    note: 'Pete Area 1, The Claims Road. Units = metres. Game +x east, game +z south. Roads/branches are centre lines; walkable width in metres is given.',
    mapSize: AREA1_MAP_SIZE,
    groundSize: AREA1_GROUND_SIZE,
    roadWidth: 26,
    roadLength: r(AREA1_ROAD.length),
    road: every(AREA1_ROAD.samples, 5).map(s => ({ ...pt(s), tx: r(s.tx), tz: r(s.tz), d: r(s.d) })),
    branches: AREA1_BRANCHES.map(b => ({ id: b.id, width: b.width, line: b.line.map(pt), clearing: { ...pt(b.clearing), r: b.clearing.r } })),
    places: AREA1_PLACES.map(p => ({ id: p.id, name: p.name, ...pt(p), radius: p.r, camera: p.camera, story: p.line })),
    start: pt(AREA1_START),
    gate: { ...pt(AREA1_EXIT), tx: r(AREA1_EXIT.tx), tz: r(AREA1_EXIT.tz), width: 15 },
    manifestClue: pt(AREA1_CLUE_AT),
    campfires: AREA1_CAMPFIRES.map(c => ({ id: c.id, name: c.name, place: c.zone, ...pt(c) })),
    crates: [...AREA1_CRATES, ...AREA1_SECRET_CRATES].map(c => ({ id: c.id, ...pt(c), loot: c.loot?.type ?? c.type })),
    pots: AREA1_POTS.map(p => ({ id: p.id, ...pt(p) })),
    guardAnchors: AREA1_BANDITS.map(b => ({ id: b.id, role: b.role, campfire: b.campId, ...pt(b), rotY: b.rotY })),
    encounters: AREA1_ENCOUNTERS.map(g => ({ id: g.id, place: g.zone, ...pt(g), wakeRadius: g.radius, spawnPoints: g.enemies.map(e => ({ type: e.type, ...pt({ x: g.x + e.dx, z: g.z + e.dz }) })) }))
};
writeFileSync(new URL('./pete_area1_layout.json', import.meta.url), JSON.stringify(layout, null, 1) + '\n');
console.log(`wrote layout: ${layout.road.length} road points, ${layout.places.length} places, ${layout.branches.length} branches`);
