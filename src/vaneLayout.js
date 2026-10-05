import { ordersWaiting } from './farmOrders.js';

// Where everything stands at Vane's Crossing, the second place you step into (PLACES.md, section 4). No rendering here, so the
// walking rules (src/townWalkLogic.js) and tests/vaneLayout.test.js can use it as it is. The map is flat, like the farm's:
// x to the right, z toward the viewer, the road back to town at the south edge. The scene (src/placeVane.js) reads this, never invents it.

export const VANE_AREA = { minX: -28, maxX: 28, minZ: -22, maxZ: 24 };
export const VANE_START = [0, 17.5]; // just inside the gate

// Buildings and props that block the way: footprint half sizes (hx, hz) around a centre.
export const WAGON = { x: -12, z: -6, hx: 4.2, hz: 1.6 };
export const CLOCK = { x: 0, z: -9, hx: 1.5, hz: 1.5 };
export const BOARD = { x: 12, z: -6, hx: 2.6, hz: 0.5 };
export const FRONTS = [-18, 0, 18].map(x => ({ x, z: -17.5, hx: 3.7, hz: 1.7 }));
export const BLOCKS = [WAGON, CLOCK, BOARD, ...FRONTS];

const box = ({ x, z, hx, hz }) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// Where the marshal stands to use each thing (in front, on the +z side, where the camera sees it).
export const SPOTS = [
    { id: 'wagon', verb: 'LOOK', x: WAGON.x, z: WAGON.z + WAGON.hz + 1.4 },
    { id: 'clock', verb: 'READ', x: CLOCK.x, z: CLOCK.z + CLOCK.hz + 1.4 },
    { id: 'board', verb: 'ORDERS', x: BOARD.x, z: BOARD.z + BOARD.hz + 1.4 },
    { id: 'leave', verb: 'LEAVE', x: 0, z: 22.4 }
];

// What the walk map is made of: ground, walls and doors.
export function vaneMap() {
    return { areas: [VANE_AREA], boxes: BLOCKS.map(box), doors: SPOTS.map(s => ({ id: s.id, label: s.id.toUpperCase(), verb: s.verb, x: s.x, z: s.z })) };
}

// The words on the prompt for a door. The board says how many orders are waiting for the player's barn.
export function vaneLabel(door, profile = null, now = new Date()) {
    switch(door.id) {
        case 'board': {
            const waiting = profile ? ordersWaiting(profile, now) : 0;
            return waiting ? `THE ORDER BOARD: ${waiting} ${waiting === 1 ? 'ORDER' : 'ORDERS'}` : 'THE ORDER BOARD';
        }
        case 'wagon': return 'THE WAGON TRAIN';
        case 'clock': return 'THE STOPPED CLOCK';
        case 'leave': return 'THE ROAD TO TOWN';
        default: return door.label;
    }
}
