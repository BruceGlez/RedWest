// The general store, a place you step into (MINE_PLAN.md, slice 5, "buying light": the owner's choice, 2026-10-06: Mr. Grimsby's and the general store
// both sell light, and the store is a place of its own). A small shop room: a long counter at the back with the shopkeeper behind it, shelves along one wall,
// and the door in the south wall. No rendering here, so the walking rules (src/townWalkLogic.js) and tests/storeLayout.test.js can use it as it is.
// The map is flat: x to the right, z toward the viewer. The scene (src/placeStore.js) reads this, never invents it.

export const STORE_AREA = { minX: -14, maxX: 14, minZ: -10, maxZ: 9 };
export const STORE_START = [0, 5.4]; // just inside the door

// What blocks the way: footprint half sizes (hx, hz) around a centre.
export const COUNTER = { x: 0, z: -4.5, hx: 5.5, hz: 1 };
export const SHELVES = { x: -12.3, z: -2, hx: 0.9, hz: 5.5 };
export const BARRELS = { x: 11.4, z: -5.5, hx: 1.7, hz: 1.7 };
export const TABLE = { x: 8, z: 2, hx: 1.8, hz: 1 };
export const KEEPER = { x: 0, z: -7.2, hx: 0.6, hz: 0.5 }; // behind the counter
export const BLOCKS = [COUNTER, SHELVES, BARRELS, TABLE, KEEPER];

const box = ({ x, z, hx, hz }) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// Where the marshal stands to use each thing (in front, on the +z side, where the camera sees it).
export const SPOTS = [
    { id: 'counter', verb: 'BUY', x: COUNTER.x, z: COUNTER.z + COUNTER.hz + 1.7 },
    { id: 'leave', verb: 'LEAVE', x: 0, z: 7.8 }
];

// The shopkeeper's name and what she says (our own: an original character).
export const KEEPER_NAME = 'ADA PRUITT';
export const KEEPER_LINE = 'Lamp oil, torches and matches, same as ever. If you are going down the old claim, go with a light, and tell Mr. Grimsby I sold it cheaper.';

// What the walk map is made of: ground, walls and doors.
export function storeMap() {
    return { areas: [STORE_AREA], boxes: BLOCKS.map(box), doors: SPOTS.map(s => ({ id: s.id, label: s.id.toUpperCase(), verb: s.verb, x: s.x, z: s.z })) };
}

// The words on the prompt for a door.
export function storeLabel(door) {
    switch(door.id) {
        case 'counter': return `THE GENERAL STORE: ${KEEPER_NAME}`;
        case 'leave': return 'BACK TO THE STREET';
        default: return door.label;
    }
}
