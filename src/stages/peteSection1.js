// Dusty Pete, Area 1, Section 1: "The Claims Road", from the Trailhead to the Flume Bridge, as a big area of its own.
// The art is the Blender build exported at game scale (public/models/pete-area1/, tools/blender/make_pete_section1.py): the export multiplies
// everything by SECTION1_SCALE so the 6-unit marshal fits the world (docs/design/pete-section1-gameplay.md, section 1).
// This file is data and pure functions only, so it runs in node tests: createSection1Area({ collision, markers }) takes the two JSON files
// the export writes (pete_section1_collision.json, pete_section1_markers.json) and returns an area in the shape src/stages/pete.js documents.
// The old road data (peteArea1.js) is the layout the art was built from; it is read here and multiplied by the scale.

import { createCampfire } from '../checkpoints.js';
import { createLootCrate } from '../ammoEconomy.js';
import {
    AREA1_ROAD, AREA1_STORY, AREA1_CAMPFIRES, AREA1_CRATES, AREA1_SECRET_CRATES, AREA1_POTS, AREA1_BANDITS, AREA1_ENCOUNTERS, AREA1_BRANCHES, AREA1_START
} from './peteArea1.js';

export const SECTION1_SCALE = 3;
export const SECTION1_ID = 'claims-road-1';
const S = SECTION1_SCALE;
const SECTION_END = 432;                 // road distance (art metres) where the rock plug closes the valley, just past the bridge

// ---- the road, as the art stands on it (the old road samples up to the bridge, times the scale)
const samples = AREA1_ROAD.samples.filter(s => s.d <= SECTION_END).map(s => ({ x: s.x * S, z: s.z * S, tx: s.tx, tz: s.tz, d: s.d * S }));
export const SECTION1_ROAD = { samples, length: samples[samples.length - 1].d };

function nearestSample(x, z) {
    let best = samples[0], bestD = Infinity;
    for(const s of samples) {
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if(d < bestD) { bestD = d; best = s; }
    }
    return best;
}

// The point at `d` art metres along the road, `off` art metres to the right of the heading.
export function section1PointAt(d, off = 0) {
    const target = d * S;
    let lo = 0, hi = samples.length - 1;
    while(lo < hi) {
        const mid = (lo + hi) >> 1;
        if(samples[mid].d < target) lo = mid + 1; else hi = mid;
    }
    const s = samples[lo];
    return { x: s.x - s.tz * off * S, z: s.z + s.tx * off * S, tx: s.tx, tz: s.tz };
}

// ---- the walkable ground: the export's 1 m grid (blocked cells are rock, berms and the gully) plus the obstacle footprints
export function createCollisionWalk(collision, pad = 1.2) {
    const raw = typeof atob === 'function' ? atob(collision.bits) : Buffer.from(collision.bits, 'base64').toString('binary');
    const bits = new Uint8Array(raw.length);
    for(let i = 0; i < raw.length; i++) bits[i] = raw.charCodeAt(i);
    const { x0, y0, nx, ny, cell } = collision;
    const blockedCell = (x, z) => {
        const ix = Math.floor((x - x0) / cell), iy = Math.floor((-z - y0) / cell);   // the grid is in Blender XY: y = -z
        if(ix < 0 || iy < 0 || ix >= nx || iy >= ny) return true;
        const k = iy * nx + ix;
        return ((bits[k >> 3] >> (k & 7)) & 1) === 1;
    };
    // Boxes in 30-unit buckets so a lookup touches only its neighbours.
    const BUCKET = 30;
    const buckets = new Map();
    const boxes = collision.boxes.map(([cx, cy, hx, hy, yaw]) => ({ cx, cy, hx, hy, c: Math.cos(-yaw), s: Math.sin(-yaw) }));
    for(const b of boxes) {
        const r = Math.hypot(b.hx, b.hy) + pad;
        for(let gx = Math.floor((b.cx - r) / BUCKET); gx <= Math.floor((b.cx + r) / BUCKET); gx++) {
            for(let gy = Math.floor((b.cy - r) / BUCKET); gy <= Math.floor((b.cy + r) / BUCKET); gy++) {
                const key = gx * 100003 + gy;
                if(!buckets.has(key)) buckets.set(key, []);
                buckets.get(key).push(b);
            }
        }
    }
    const inBox = (x, z) => {
        const by = -z;
        const list = buckets.get(Math.floor(x / BUCKET) * 100003 + Math.floor(by / BUCKET));
        if(!list) return false;
        for(const b of list) {
            const dx = x - b.cx, dy = by - b.cy;
            const lx = dx * b.c - dy * b.s, ly = dx * b.s + dy * b.c;
            if(Math.abs(lx) <= b.hx + pad && Math.abs(ly) <= b.hy + pad) return true;
        }
        return false;
    };
    const walk = (x, z) => !blockedCell(x, z) && !inBox(x, z);
    walk.mask = null;                    // this area draws its own rock; there is no road grid to build cliffs from
    return walk;
}

// ---- places (art distances in metres along the road; the radius is the clearing in art metres)
const placeAt = (id, name, d, r, line, extra = {}) => {
    const p = section1PointAt(d);
    return { id, name, x: p.x, z: p.z, r: r * S, line, ...extra };
};

export const SECTION1_PLACES = [
    placeAt('trailhead', 'The Trailhead', 6, 24, AREA1_STORY.trailhead.line, { camera: 'reveal' }),
    placeAt('shack-row', 'Shack Row', 100, 40, "Miners' homes, left as they were. Some doors are not as shut as they look.", { camera: 'pullback' }),
    placeAt('claims', 'The Abandoned Claims', 183, 30, AREA1_STORY.claims.line, { camera: 'pullback' }),
    placeAt('headframe', 'The Headframe', 250, 32, "The Company's winch house stands over the shaft. Its yard is full of powder and whiskey.", { camera: 'pullback' }),
    placeAt('wash', 'Tailings Wash', 315, 30, "The creek bed runs dry and cold. Riflemen watch the road from the rim."),
    placeAt('flume', 'The Flume Bridge', 395, 22, AREA1_STORY.flume.line, { camera: 'narrow' })
];
// The Smuggler's Stash is a clearing off the road (the old layout's first side path), a place of its own.
const stashBranch = AREA1_BRANCHES[0];
SECTION1_PLACES.push({ id: 'stash', name: "The Smuggler's Stash", x: stashBranch.clearing.x * S, z: stashBranch.clearing.z * S, r: stashBranch.clearing.r * S, line: 'Someone hid more than crates here.' });
export const SECTION1_STORY = Object.fromEntries(SECTION1_PLACES.map(p => [p.id, { title: p.name.toUpperCase(), line: p.line }]));

// ---- things that stand in the area: the old layout's items that lie in Section 1, times the scale
const scaledCrate = c => createLootCrate(c.id, c.x * S, c.z * S, c.loot);
const scaledPot = p => ({ id: p.id, x: p.x * S, z: p.z * S });
const CRATE_IDS = ['a1-crate-1', 'a1-crate-2', 'a1-crate-3', 'a1-crate-4', 'a1-secret-1a', 'a1-secret-1b'];
const POT_IDS = ['a1-pot-1', 'a1-pot-2', 'a1-pot-3', 'a1-pot-4', 'a1-pot-5', 'a1-pot-s1'];
const GUARD_IDS = ['a1-sleeper-1'];
const ENCOUNTER_IDS = ['a1-claims-guards', 'a1-flume-ambush'];

function scaledEncounter(g) {
    const x = g.x * S, z = g.z * S;
    return {
        ...g, x, z, radius: g.radius * S,
        progress: nearestSample(x, z).d / SECTION1_ROAD.length,
        enemies: g.enemies.map(e => ({ ...e, dx: e.dx * S, dz: e.dz * S }))
    };
}

// ---- the area itself
// `sceneFactory` (optional) returns { buildEnvironment, buildLandmarks } for one mount of the scene (src/placePeteSection1.js).
export function createSection1Area({ collision, markers = [], sceneFactory = null } = {}) {
    if(!collision) throw new Error('createSection1Area needs the collision JSON');
    const byId = Object.fromEntries(markers.map(m => [m.id, m]));
    const trail = AREA1_CAMPFIRES.find(c => c.id === 'a1-trail');
    const campfires = [createCampfire('a1-trail', 'Trailhead Campfire', 'trailhead', trail.x * S, trail.z * S)];
    if(byId.I26) campfires.push(createCampfire('a1-headframe', 'Headframe Campfire', 'headframe', byId.I26.x, byId.I26.z));
    const crates = [...AREA1_CRATES, ...AREA1_SECRET_CRATES].filter(c => CRATE_IDS.includes(c.id)).map(scaledCrate);
    const pots = AREA1_POTS.filter(p => POT_IDS.includes(p.id)).map(scaledPot);
    const bandits = AREA1_BANDITS.filter(g => GUARD_IDS.includes(g.id)).map(g => ({ ...g, x: g.x * S, z: g.z * S }));
    const encounters = AREA1_ENCOUNTERS.filter(g => ENCOUNTER_IDS.includes(g.id)).map(scaledEncounter);
    const start = { x: AREA1_START.x * S, z: AREA1_START.z * S };
    const end = section1PointAt(424);
    const walk = createCollisionWalk(collision);

    return {
        index: 0,
        id: SECTION1_ID,
        name: 'The Claims Road',
        isSection: true,
        camera: 'chase',               // the chase camera: Z and X or a right-drag swing it, W walks where it looks (src/stages/chaseCamera.js)
        mapSize: 1000,                 // |x| and |z| stay under this (the export spans about 720 to 840 by 190 to 990)
        groundSize: 8,                 // the art has its own ground
        start,
        createWalk: () => walk,
        campfires, crates, pots, bandits,
        clues: [],
        encounters,
        places: SECTION1_PLACES,
        story: SECTION1_STORY,
        markers,
        zoneAt(x, z) {
            let best = null, bestScore = Infinity;
            for(const place of SECTION1_PLACES) {
                const score = Math.hypot(place.x - x, place.z - z) / place.r;
                if(score <= 1.25 && score < bestScore) { best = place; bestScore = score; }
            }
            return best ? { id: best.id, name: best.name } : null;
        },
        progressAt: (x, z) => nearestSample(x, z).d / SECTION1_ROAD.length,
        progressMargin: 0.01,
        headingAt: (x, z) => { const s = nearestSample(x, z); return { tx: s.tx, tz: s.tz }; },
        // The way on: the end of the bridge. The next area is the old road from its flume progress.
        exit: {
            x: end.x, z: end.z, tx: end.tx, tz: end.tz, r: 18,
            requires: [],
            clears: ['a1-flume-ambush'],           // the way on opens once this guard group has been woken and beaten
            locked: 'The bridge is held. Clear the Company men first.',
            opened: 'The Flume Bridge is yours. The road goes on.',
            next: 1
        },
        objective: () => 'FOLLOW THE CLAIMS ROAD',
        isGateOpen: run => !!run.exitOpen,
        enterBanner: 'THE CLAIMS ROAD: THE TRAILHEAD',
        sceneParts() {
            if(!sceneFactory) return null;
            const parts = sceneFactory({ markers });
            return {
                campfires, crates, pots, bandits, clues: [],
                itemScale: S,                 // crates, pots and campfires are drawn in the art's scale
                buildEnvironment: parts.buildEnvironment,
                buildLandmarks: parts.buildLandmarks,
                isGateOpen: run => !!run.exitOpen
            };
        }
    };
}
