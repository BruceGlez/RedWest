import { PLOT_COUNT, minutesText, plotStates, eggsReady, minutesToNextEgg } from './farm.js';

// Where everything stands on Calloway Farm, the first place you step into (PLACES.md). No rendering here, so the walking
// rules (src/townWalkLogic.js) and tests/farmLayout.test.js can use it as it is. The map is flat, like the town's:
// x to the right, z toward the viewer, the road back to town at the south edge.

export const FARM_AREA = { minX: -30, maxX: 30, minZ: -26, maxZ: 24 };
export const FARM_START = [0, 17.5]; // just inside the gate

// Plots: two rows of three beds, each 6 wide and 5 deep.
export const PLOT_SIZE = { w: 6, d: 5 };
export const PLOTS = Array.from({ length: PLOT_COUNT }, (_, i) => ({ index: i, x: [-8, 0, 8][i % 3], z: i < 3 ? -4 : 5 }));

// Buildings and props that block the way: footprint half sizes (hx, hz) around a centre.
export const BARN = { x: -18, z: -17, hx: 6, hz: 3.8 };
export const COOP = { x: 18, z: -16, hx: 2.4, hz: 1.8 };
export const STAND = { x: -17, z: 10, hx: 2.6, hz: 1.4 };
export const KENNEL = { x: 23, z: 8, hx: 1.1, hz: 0.9 };
export const WINDMILL = { x: 27, z: -5, hx: 1.7, hz: 1.7 };
export const WELL = { x: -26, z: 1, hx: 1.1, hz: 1.1 };
export const SCARECROW = { x: 0, z: 0.5, hx: 0.4, hz: 0.4 };
export const HAY = { x: -26, z: 15, hx: 1.6, hz: 1.2 };
export const BLOCKS = [BARN, COOP, STAND, KENNEL, WINDMILL, WELL, SCARECROW, HAY];

const box = ({ x, z, hx, hz }) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// Where the marshal stands to use each thing (in front, on the +z side, where the camera sees it).
export const SPOTS = [
    { id: 'barn', x: BARN.x, z: BARN.z + BARN.hz + 1.4 },
    { id: 'coop', x: COOP.x, z: COOP.z + COOP.hz + 1.4 },
    { id: 'stand', x: STAND.x, z: STAND.z + STAND.hz + 1.4 },
    { id: 'kennel', x: KENNEL.x, z: KENNEL.z + KENNEL.hz + 1.4 },
    { id: 'leave', x: 0, z: 22.4 }
];

export const plotId = index => `plot-${index}`;
export const plotIndex = id => (/^plot-(\d)$/.test(id) ? Number(id.slice(5)) : -1);

// What the walk map is made of: ground, walls and doors. `farm` and `now` make the verbs match what a plot or the coop
// can do right now (a ready crop says HARVEST), so the prompt never offers something that would be refused.
export function farmMap(farm = null, now = new Date(), level = 1) {
    const states = farm ? plotStates(farm, now) : PLOTS.map(() => ({ state: 'empty' }));
    const eggs = farm ? eggsReady(farm, now, level) : 0;
    const doors = [
        ...PLOTS.map(p => ({ id: plotId(p.index), label: 'PLOT', verb: { empty: 'PLANT', growing: 'LOOK', ready: 'HARVEST' }[states[p.index].state], x: p.x, z: p.z })),
        ...SPOTS.map(spot => ({
            id: spot.id, label: spot.id.toUpperCase(), x: spot.x, z: spot.z,
            verb: { barn: 'LOOK', coop: eggs ? 'COLLECT' : 'LOOK', stand: 'SELL', kennel: 'MEET', leave: 'LEAVE' }[spot.id]
        }))
    ];
    return { areas: [FARM_AREA], boxes: BLOCKS.map(box), doors };
}

// The words on the prompt for a door, from the farm's state ("WHEAT: 12m", "CORN READY", "COOP: 3 EGGS").
export function farmLabel(door, farm = null, now = new Date(), level = 1) {
    const index = plotIndex(door.id);
    if(index >= 0) {
        const plot = farm ? plotStates(farm, now)[index] : { state: 'empty' };
        if(plot.state === 'empty') return 'EMPTY PLOT';
        if(plot.state === 'ready') return `${plot.crop.name} READY`;
        return `${plot.crop.name}: ${minutesText(plot.minutesLeft)}`;
    }
    switch(door.id) {
        case 'coop': {
            if(!farm) return 'THE COOP';
            const eggs = eggsReady(farm, now, level);
            if(eggs) return `COOP: ${eggs} ${eggs === 1 ? 'EGG' : 'EGGS'}`;
            return `COOP: NEXT EGG IN ${minutesText(minutesToNextEgg(farm, now, level))}`;
        }
        case 'stand': return 'THE FARM STAND';
        case 'barn': return 'THE BARN';
        case 'kennel': return 'THE KENNEL';
        case 'leave': return 'THE ROAD TO TOWN';
        default: return door.label;
    }
}
