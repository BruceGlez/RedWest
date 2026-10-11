// Dusty Pete's chapter: a list of big areas, played in order. Each area is described by data the Pete run mode (src/modes/peteWorld.js)
// and the scene (src/placePeteWorld.js, src/placePeteArea.js) read. docs/design/stage-world-framework.md, sections 2 and 9.
//
//   index, id, name       which area, and what the banner calls it
//   mapSize, groundSize   how far the marshal may walk, and how much sand lies under it
//   start                 where the marshal arrives (the forced checkpoint)
//   createWalk()          (x, z) -> true where anyone may stand; also sets what is rock
//   campfires, crates, pots, bandits, clues, encounters   what stands in the area
//   places / story        named spots, the words on first arrival, the camera each wants
//   zoneAt(x, z)          the place the marshal is in, for the HUD and banners (null = keep the last one)
//   progressAt(x, z)      how far along the area a spot is, to skip guards already left behind when resuming (margin: progressMargin)
//   headingAt(x, z)       which way the road runs there, for the camera to look ahead
//   exit                  { x, z, r, requires, locked, opened, next }: the gate to the next area, or null for the last one
//   objective(clues, boss) the one thing to do next, for the HUD
//   sceneParts(walk)      what the scene builder needs beyond the lists above (null = the original canyon)

import { ZONE_STORY, ENCOUNTERS, WORLD_CAMPFIRES, WORLD_CRATES, INVESTIGATION_CLUES, PETE_WORLD_ZONES, zoneAt, objectiveFor } from '../peteWorldMap.js';
import {
    AREA1_ID, AREA1_MAP_SIZE, AREA1_GROUND_SIZE, AREA1_ROAD, AREA1_START, AREA1_PLACES, AREA1_STORY, AREA1_CAMPFIRES, AREA1_CRATES,
    AREA1_SECRET_CRATES, AREA1_POTS, AREA1_BANDITS, AREA1_ENCOUNTERS, AREA1_EXIT, createAreaWalk
} from './peteArea1.js';
import { createAreaEnvironment, createAreaGate } from '../placePeteArea.js';

function nearestSample(road, x, z) {
    let best = null, bestD = Infinity;
    for(const s of road.samples) {
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if(d < bestD) { bestD = d; best = s; }
    }
    return best;
}

const area1 = {
    index: 0,
    id: AREA1_ID,
    name: 'The Claims Road',
    mapSize: AREA1_MAP_SIZE,
    groundSize: AREA1_GROUND_SIZE,
    start: AREA1_START,
    createWalk: createAreaWalk,
    campfires: AREA1_CAMPFIRES,
    crates: [...AREA1_CRATES, ...AREA1_SECRET_CRATES],
    pots: AREA1_POTS,
    bandits: AREA1_BANDITS,
    clues: INVESTIGATION_CLUES.filter(clue => clue.area === 0),
    encounters: AREA1_ENCOUNTERS.map(group => ({ ...group, progress: group.progress ?? 0 })),
    places: AREA1_PLACES,
    story: AREA1_STORY,
    zoneAt(x, z) {
        let best = null, bestScore = Infinity;
        for(const place of AREA1_PLACES) {
            const score = Math.hypot(place.x - x, place.z - z) / place.r;
            if(score <= 1.25 && score < bestScore) { best = place; bestScore = score; }
        }
        return best ? { id: best.id, name: best.name } : null;
    },
    progressAt: (x, z) => nearestSample(AREA1_ROAD, x, z).d / AREA1_ROAD.length,
    progressMargin: 0.01,
    headingAt: (x, z) => { const s = nearestSample(AREA1_ROAD, x, z); return { tx: s.tx, tz: s.tz }; },
    exit: { ...AREA1_EXIT, next: 1 },
    objective: collected => collected.includes('clue-manifest') ? 'REACH THE COMPANY GATE' : "FIND: MINERS' PAYROLL MANIFEST",
    isGateOpen: run => !!run.exitOpen,
    sceneParts(walk) {
        return {
            campfires: this.campfires, crates: this.crates, pots: this.pots, bandits: this.bandits, clues: this.clues,
            buildEnvironment: () => createAreaEnvironment(walk),
            buildLandmarks: () => createAreaGate(),
            isGateOpen: this.isGateOpen
        };
    }
};

// The canyon that was the whole MVP, now the second area: rail spur, sunken saloon and Pete's stronghold.
const area2 = {
    index: 1,
    id: 'canyon-stronghold',
    name: "Pete's Canyon",
    mapSize: 140,
    groundSize: 300,
    start: { x: 0, z: -40 },
    createWalk: () => (x, z) => Math.abs(x) <= 40 && z >= -46 && z <= 128,
    campfires: WORLD_CAMPFIRES,
    crates: WORLD_CRATES,
    pots: null,
    bandits: null,
    clues: INVESTIGATION_CLUES.filter(clue => clue.area === 1),
    encounters: ENCOUNTERS.map(group => ({ ...group, progress: group.z })),
    places: [],
    story: ZONE_STORY,
    zoneAt: (x, z) => zoneAt(z),
    progressAt: (x, z) => z,
    progressMargin: 10,
    headingAt: () => ({ tx: 0, tz: 1 }),
    exit: null,
    boss: true,
    objective: objectiveFor,
    isGateOpen: run => !!run.gateBreached,
    sceneParts: () => null
};

export const PETE_AREAS = [area1, area2];
export { PETE_WORLD_ZONES };
