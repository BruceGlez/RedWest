import { OUTLAWS } from './outlaws.js';

// The cellar under Mr. Grimsby's parlour (MINE_PLAN.md, slice 5): a small room of its own, like the parlour, where the way down to the
// Hollow Claim is a HIDDEN DOOR in the wall. You find it by walking along the wall: its prompt only shows when you are right beside it.
// It opens once Deacon Graves has a star (the owner's choice); until then the wall only rings hollow. No rendering here, so the walking rules
// (src/townWalkLogic.js) and tests/cellarLayout.test.js can use it as it is. The map is flat: x to the right, z toward the viewer, the stairs
// back up to the parlour at the south edge.

export const CELLAR_AREA = { minX: -12, maxX: 12, minZ: -10, maxZ: 9 };
export const CELLAR_START = [0, 5.2]; // at the foot of the stairs

// What blocks the way: footprint half sizes (hx, hz) around a centre.
export const BARRELS = { x: -8, z: -6, hx: 1.6, hz: 1.6 };
export const SHELF = { x: 4, z: -8.8, hx: 4, hz: 0.6 };
export const CRATES = { x: -8, z: 2.5, hx: 1.4, hz: 1.2 };
export const TABLE = { x: 2, z: -1.5, hx: 2, hz: 1 };
export const BLOCKS = [BARRELS, SHELF, CRATES, TABLE];

const box = ({ x, z, hx, hz }) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// The hidden door is a seam in the east wall. Its prompt shows only within HIDDEN_REACH, closer than any other door's (2.8).
export const HIDDEN_DOOR = { x: 11, z: -4 };
export const HIDDEN_REACH = 1.6;
export const SPOTS = [
    { id: 'wall', verb: 'SEARCH', x: HIDDEN_DOOR.x, z: HIDDEN_DOOR.z, reach: HIDDEN_REACH },
    { id: 'up', verb: 'LEAVE', x: 0, z: 7.6 }
];

// The wall's door opens once Deacon Graves has a star (Wanted Road stage 3). It reads nothing else.
const DEACON_INDEX = OUTLAWS.findIndex(o => o.id === 'deacon-graves');
export const hiddenDoorOpen = profile => ((profile?.stats?.stageStars?.[DEACON_INDEX]) & 1) !== 0;

// What the walk map is made of: ground, walls and doors.
export function cellarMap() {
    return { areas: [CELLAR_AREA], boxes: BLOCKS.map(box), doors: SPOTS.map(s => ({ id: s.id, label: s.id.toUpperCase(), verb: s.verb, x: s.x, z: s.z, ...(s.reach ? { reach: s.reach } : {}) })) };
}

// The words on the prompt for a door.
export function cellarLabel(door, profile = null) {
    switch(door.id) {
        case 'wall': return hiddenDoorOpen(profile) ? 'THE HIDDEN DOOR: THE HOLLOW CLAIM' : 'A HOLLOW SEAM IN THE WALL';
        case 'up': return 'THE STAIRS UP TO THE PARLOUR';
        default: return door.label;
    }
}
