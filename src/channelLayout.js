import { farmWatered } from './farm.js';

// Where everything stands at Morgan's Channel, the third place you step into (PLACES.md, section 3). No rendering here, so the walking
// rules (src/townWalkLogic.js) and tests/channelLayout.test.js can use it as it is. The map is flat, like the farm's: x to the right,
// z toward the viewer, the road back to town at the south edge. The channel runs across the middle with a footbridge at x = 0; the
// warehouse is on the far bank, so the walk to it crosses the bridge. The scene (src/placeChannel.js) reads this, never invents it.

export const CHANNEL_AREA = { minX: -28, maxX: 28, minZ: -22, maxZ: 24 };
export const CHANNEL_START = [0, 17.5]; // just inside the gate

// The water: two blocks of channel with the footbridge between them (z -3 to 1.5, the bridge is 5 wide).
export const WATER = [
    { x: -15.25, z: -0.75, hx: 12.75, hz: 2.25 },
    { x: 15.25, z: -0.75, hx: 12.75, hz: 2.25 }
];
// Buildings and props that block the way: footprint half sizes (hx, hz) around a centre.
export const WAREHOUSE = { x: -12, z: -15, hx: 5, hz: 3 };
export const SLUICE = { x: 14, z: 5, hx: 1.4, hz: 0.8 };
export const BUCKETS = { x: 12, z: -12, hx: 1.6, hz: 0.6 };
export const BLOCKS = [...WATER, WAREHOUSE, SLUICE, BUCKETS];

const box = ({ x, z, hx, hz }) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// Where the marshal stands to use each thing (in front, on the +z side, where the camera sees it).
export const SPOTS = [
    { id: 'sluice', verb: 'LOOK', x: SLUICE.x, z: SLUICE.z + SLUICE.hz + 1.4 },
    { id: 'log', verb: 'READ', x: WAREHOUSE.x, z: WAREHOUSE.z + WAREHOUSE.hz + 1.4 },
    { id: 'leave', verb: 'LEAVE', x: 0, z: 22.4 }
];

// What the walk map is made of: ground, walls (the water too) and doors.
export function channelMap() {
    return { areas: [CHANNEL_AREA], boxes: BLOCKS.map(box), doors: SPOTS.map(s => ({ id: s.id, label: s.id.toUpperCase(), verb: s.verb, x: s.x, z: s.z })) };
}

// The words on the prompt for a door. The sluice says whether the farm is being watered.
export function channelLabel(door, profile = null) {
    switch(door.id) {
        case 'sluice': return profile && farmWatered(profile) ? 'THE SLUICE: THE FARM IS WATERED' : 'THE SLUICE';
        case 'log': return 'THE WAREHOUSE LOG';
        case 'leave': return 'THE ROAD TO TOWN';
        default: return door.label;
    }
}
