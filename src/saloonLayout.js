import { paidShiftsLeft } from './saloon.js';

// Where everything stands at Copper Bit, the fourth place you step into (PLACES.md, section 8). No rendering here, so the walking rules
// (src/townWalkLogic.js) and tests/saloonLayout.test.js can use it as it is. The map is flat, like the farm's: x to the right, z toward the
// viewer, the road back to town at the south edge. The saloon stands at the back with the bar inside its doors; the broken piano is out
// front. The scene (src/placeSaloon.js) reads this, never invents it.

export const SALOON_AREA = { minX: -28, maxX: 28, minZ: -22, maxZ: 24 };
export const SALOON_START = [0, 17.5]; // just inside the gate

// Buildings and props that block the way: footprint half sizes (hx, hz) around a centre.
export const SALOON = { x: 0, z: -12, hx: 9, hz: 4 };
export const PIANO = { x: -16, z: -3, hx: 1.4, hz: 0.8 };
export const KEGS = { x: 18, z: -6, hx: 1.6, hz: 1.2 };
export const RAIL = { x: 14, z: 7, hx: 3.2, hz: 0.3 };
// The upgrade shelf stands against the saloon's front wall, to the right of the door (docs/design/copper-bit-shift.md, P7). The art lane builds it
// in src/placeSaloon.js from this footprint; the rules and the list are src/saloonShelf.js.
export const SHELF = { x: 5.5, z: SALOON.z + SALOON.hz + 0.4, hx: 1.6, hz: 0.4 };
export const BLOCKS = [SALOON, PIANO, KEGS, RAIL, SHELF];

const box = ({ x, z, hx, hz }) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// Where the marshal stands to use each thing (in front, on the +z side, where the camera sees it).
export const SPOTS = [
    { id: 'bar', verb: 'ENTER', x: SALOON.x, z: SALOON.z + SALOON.hz + 1.4 },
    { id: 'piano', verb: 'READ', x: PIANO.x, z: PIANO.z + PIANO.hz + 1.4 },
    { id: 'shelf', verb: 'SHOP', x: SHELF.x, z: SHELF.z + SHELF.hz + 1.4 },
    { id: 'leave', verb: 'LEAVE', x: 0, z: 22.4 }
];

// What the walk map is made of: ground, walls and doors.
export function saloonMap() {
    return { areas: [SALOON_AREA], boxes: BLOCKS.map(box), doors: SPOTS.map(s => ({ id: s.id, label: s.id.toUpperCase(), verb: s.verb, x: s.x, z: s.z })) };
}

// The words on the prompt for a door. The bar says how many paid shifts are left today.
export function saloonLabel(door, profile = null, now = new Date()) {
    switch(door.id) {
        case 'bar': {
            if(!profile) return "DUSTY PETE'S BAR";
            const left = paidShiftsLeft(profile, now);
            return `DUSTY PETE'S BAR: ${left} PAID ${left === 1 ? 'SHIFT' : 'SHIFTS'} LEFT`;
        }
        case 'piano': return 'THE BROKEN PIANO';
        case 'shelf': return 'THE UPGRADE SHELF';
        case 'leave': return 'THE ROAD TO TOWN';
        default: return door.label;
    }
}
