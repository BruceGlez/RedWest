// Dusty Pete, Area 1: "The Claims Road". A long, bending road from the trailhead through the abandoned claims, over the flume
// bridge, round the hairpin to the miners' camp, through Boulder Pass and up to the Company gate. About 1,300 units of road,
// seven places, two side paths with secrets, five guard groups and one clue that the gate needs (the payroll manifest).
// Data only (docs/design/stage-world-framework.md, section 2.1); src/placePeteArea.js draws it, src/modes/peteWorld.js plays it.
// Everything is placed along the road with pointAlong(), so a bend in the road never means hand-moving scenery.

import { createCampfire } from '../checkpoints.js';
import { createLootCrate } from '../ammoEconomy.js';
import { smoothPolyline, resample, pointAlong, createWalkMask } from './roadMask.js';

export const AREA1_ID = 'claims-road';
export const AREA1_MAP_SIZE = 235;   // how far the marshal may walk (the mask is the real limit)
export const AREA1_GROUND_SIZE = 560; // the sand under the area

const ROAD_WIDTH = 26;

const CONTROL_POINTS = [
    [-190, -195], [-130, -202], [-60, -192], [10, -178], [80, -172], [140, -182], [178, -160],
    [188, -115], [165, -72],
    [105, -60], [35, -66], [-35, -74], [-105, -62], [-165, -45],
    [-190, 0], [-170, 48],
    [-110, 62], [-40, 52], [30, 60], [100, 75], [160, 95], [190, 130]
];

export const AREA1_ROAD = resample(smoothPolyline(CONTROL_POINTS, 10), 2);
const at = (fraction, off = 0) => pointAlong(AREA1_ROAD, fraction, off);

// A side path leaves the road at `from` (a fraction) and runs `length` units out to the `side`, ending in a clearing.
function branch(id, from, side, length, bend = 0) {
    const start = at(from);
    const nx = -start.tz * side, nz = start.tx * side; // the way out of the road
    const line = [], steps = 6;
    for(let i = 0; i <= steps; i++) {
        const t = i / steps;
        const sway = Math.sin(t * Math.PI) * bend;
        line.push({
            x: start.x + nx * length * t + start.tx * sway,
            z: start.z + nz * length * t + start.tz * sway
        });
    }
    const end = line[line.length - 1];
    return { id, line, width: 11, clearing: { x: end.x, z: end.z, r: 13 } };
}

export const AREA1_BRANCHES = [
    branch('smugglers-stash', 0.285, -1, 42, 6),
    branch('foremans-nook', 0.505, -1, 20, 0),
    branch('lookout-hill', 0.835, 1, 52, -8)
];

// Where people gather. Each is a clearing off the road (r) with a name for the HUD, the words on first arrival and the camera it wants.
const place = (id, name, fraction, r, line, extra = {}) => {
    const p = at(fraction);
    return { id, name, x: p.x, z: p.z, r, line, ...extra };
};

export const AREA1_PLACES = [
    place('trailhead', 'The Trailhead', 0.006, 24, 'Copper Bit used to be a boomtown. Follow the road and find out who ended it.', { camera: 'reveal' }),
    place('claims', 'The Abandoned Claims', 0.14, 30, 'Smashed sluice boxes and eviction notices. The Company did not send lawyers.', { camera: 'pullback' }),
    place('flume', 'The Flume Bridge', 0.29, 18, 'The old flume carried water to forty claims. Now it carries Company riflemen.', { camera: 'narrow' }),
    place('hairpin', 'The Hairpin', 0.40, 22, 'The road doubles back on itself. Somebody has been watching it from the rim.', { camera: 'pullback' }),
    place('miners', "The Miners' Camp", 0.505, 32, 'The foreman kept the payroll book. The Company wants it burned.', { camera: 'pullback' }),
    place('pass', 'Boulder Pass', 0.65, 24, 'A choke point the Company holds with its biggest man.', { camera: 'reveal' }),
    place('gate', 'The Company Gate', 0.955, 24, 'Meridian Land & Rail owns the road beyond this gate. The payroll book is the key.', { camera: 'reveal' })
];

export const AREA1_STORY = Object.fromEntries(AREA1_PLACES.map(p => [p.id, { title: p.name.toUpperCase(), line: p.line }]));

const campfire = (id, name, placeId, fraction, off) => {
    const p = at(fraction, off);
    return createCampfire(id, name, placeId, p.x, p.z);
};

export const AREA1_CAMPFIRES = [
    campfire('a1-trail', 'Trailhead Campfire', 'trailhead', 0.012, 6),
    campfire('a1-hairpin', 'Hairpin Campfire', 'hairpin', 0.43, 5),
    campfire('a1-miners', "Miners' Campfire", 'miners', 0.47, 7),
    campfire('a1-pass', 'Boulder Pass Campfire', 'pass', 0.615, 6),
    campfire('a1-gate', 'Company Gate Campfire', 'gate', 0.93, 6)
];

const crate = (id, fraction, off, type, amount) => {
    const p = at(fraction, off);
    return createLootCrate(id, p.x, p.z, { type, amount });
};

export const AREA1_CRATES = [
    crate('a1-crate-1', 0.05, -8, 'ammo', 15),
    crate('a1-crate-2', 0.12, 9, 'ammo', 20),
    crate('a1-crate-3', 0.19, -9, 'health', 1),
    crate('a1-crate-4', 0.25, 7, 'ammo', 15),
    crate('a1-crate-5', 0.37, -8, 'ammo', 20),
    crate('a1-crate-6', 0.46, 10, 'health', 1),
    crate('a1-crate-7', 0.56, -9, 'ammo', 25),
    crate('a1-crate-8', 0.60, 8, 'ammo', 15),
    crate('a1-crate-9', 0.72, -8, 'health', 1),
    crate('a1-crate-10', 0.80, 9, 'ammo', 20),
    crate('a1-crate-11', 0.90, -8, 'ammo', 25)
];

// Secrets at the end of each side path: more of the same, but richer, and the Lookout's hill gives a view of the whole road.
const clearingCrate = (id, b, type, amount, dx = 0, dz = 0) => createLootCrate(id, b.clearing.x + dx, b.clearing.z + dz, { type, amount });
export const AREA1_SECRET_CRATES = [
    clearingCrate('a1-secret-1a', AREA1_BRANCHES[0], 'ammo', 40, -3, 0),
    clearingCrate('a1-secret-1b', AREA1_BRANCHES[0], 'health', 2, 3, 2),
    clearingCrate('a1-secret-3a', AREA1_BRANCHES[2], 'ammo', 40, -3, 0),
    clearingCrate('a1-secret-3b', AREA1_BRANCHES[2], 'health', 2, 3, 2)
];

const pot = (id, fraction, off) => { const p = at(fraction, off); return { id, x: p.x, z: p.z }; };
export const AREA1_POTS = [
    pot('a1-pot-1', 0.03, 7), pot('a1-pot-2', 0.045, -6), pot('a1-pot-3', 0.14, -10), pot('a1-pot-4', 0.155, 8),
    pot('a1-pot-5', 0.21, 6), pot('a1-pot-6', 0.35, 8), pot('a1-pot-7', 0.49, -9), pot('a1-pot-8', 0.52, 9),
    pot('a1-pot-9', 0.68, -7), pot('a1-pot-10', 0.77, 8), pot('a1-pot-11', 0.93, -8),
    { id: 'a1-pot-s1', x: AREA1_BRANCHES[0].clearing.x + 4, z: AREA1_BRANCHES[0].clearing.z - 5 },
    { id: 'a1-pot-s2', x: AREA1_BRANCHES[2].clearing.x - 5, z: AREA1_BRANCHES[2].clearing.z + 4 }
];

const guard = (id, campId, role, fraction, off, rotY) => { const p = at(fraction, off); return { id, campId, x: p.x, z: p.z, role, rotY }; };
export const AREA1_BANDITS = [
    guard('a1-sleeper-1', 'a1-trail', 'sleeper', 0.014, -6, 0.4),
    guard('a1-sentry-1', 'a1-hairpin', 'sentry', 0.435, -7, -2.0),
    guard('a1-sleeper-2', 'a1-miners', 'sleeper', 0.475, -8, 1.1),
    guard('a1-sentry-2', 'a1-pass', 'sentry', 0.62, 7, -1.6),
    guard('a1-sentry-3', 'a1-gate', 'sentry', 0.935, -7, 2.4)
];

// Guard groups: they wake once as the marshal walks up (src/modes/peteWorld.js). Offsets are across the road (off) and along it (d).
function group(id, placeId, fraction, radius, line, members) {
    const centre = at(fraction);
    return {
        id, zone: placeId, x: centre.x, z: centre.z, radius, line, progress: fraction,
        enemies: members.map(([type, off, along = 0]) => {
            const p = at(fraction + along / AREA1_ROAD.length, off);
            return { type, dx: p.x - centre.x, dz: p.z - centre.z };
        })
    };
}

export const AREA1_ENCOUNTERS = [
    group('a1-claims-guards', 'claims', 0.165, 34, 'Company guards among the old claims!', [['bandit', -6], ['bandit', 7, 6], ['wolf', 0, -8]]),
    group('a1-flume-ambush', 'flume', 0.31, 30, 'An ambush on the flume bridge!', [['bandit', -5, 4], ['bandit', 5, -4], ['gunslinger', 0, 14]]),
    group('a1-hairpin-patrol', 'hairpin', 0.40, 32, 'A patrol cuts across the hairpin.', [['bandit', -7], ['knifer', 7, 5], ['knifer', -4, 9], ['wolf', 0, -9]]),
    group('a1-camp-guards', 'miners', 0.525, 36, "Enforcers hold the miners' camp.", [['bandit', -8], ['bandit', 8], ['gunslinger', 0, 8], ['rifleman', 0, 20]]),
    group('a1-pass-brute', 'pass', 0.655, 34, 'The Company\'s big man blocks Boulder Pass.', [['brute', 0], ['bandit', -7, -8], ['bandit', 7, -8]]),
    group('a1-lookout-guards', 'pass', 0.84, 30, 'Riflemen on the lookout rim.', [['rifleman', -6], ['gunslinger', 6, 6], ['bandit', 0, -6]]),
    group('a1-gate-guards', 'gate', 0.95, 34, 'The gate crew has seen you.', [['bandit', -9], ['bandit', 9], ['knifer', -4, 6], ['knifer', 4, 6], ['brute', 0, 12]])
];

// The way on: the area's gate stands at the end of the road and opens for the payroll manifest.
export const AREA1_EXIT = (() => {
    const p = at(1, 0);
    return {
        x: p.x, z: p.z, tx: p.tx, tz: p.tz, r: 6,
        requires: ['clue-manifest'],
        locked: 'The gate is chained. The foreman\'s payroll book opens it.',
        opened: 'The payroll book is the key. The gate swings open.'
    };
})();

// Where the manifest lies: the foreman's nook, off the road at the miners' camp.
const nook = AREA1_BRANCHES[1].clearing;
export const AREA1_CLUE_AT = { x: nook.x, z: nook.z };

export const AREA1_START = (() => { const p = at(0.012, 0); return { x: p.x, z: p.z }; })();

export function createAreaWalkMask() {
    const discs = [
        ...AREA1_PLACES.map(p => ({ x: p.x, z: p.z, r: p.r })),
        ...AREA1_BRANCHES.map(b => b.clearing)
    ];
    return createWalkMask({
        corridors: [{ line: AREA1_ROAD.samples, width: ROAD_WIDTH }, ...AREA1_BRANCHES.map(b => ({ line: b.line, width: b.width }))],
        discs
    });
}

// What anyone may stand on: the mask, and nothing past the gate (the gate is a wall until the manifest opens it and the marshal steps through).
export function createAreaWalk() {
    const mask = createAreaWalkMask();
    const walk = (x, z) => mask.isWalkable(x, z) && ((x - AREA1_EXIT.x) * AREA1_EXIT.tx + (z - AREA1_EXIT.z) * AREA1_EXIT.tz) < -1;
    walk.mask = mask;
    return walk;
}
