// Mr. Grimsby's parlour: the inside of the undertaker's, a place of its own like Calloway Farm (src/farmLayout.js, PLACES.md). It is
// the way down to the Hollow Claim (src/mine.js): the cellar stairs are at the back, behind the coffins on show. No rendering here,
// so the walking rules (src/townWalkLogic.js) and tests/undertakerLayout.test.js can use it as it is. The map is flat, like the
// town's: x to the right, z toward the viewer, the door in the south wall where the camera stands.

export const PARLOUR_AREA = { minX: -18, maxX: 18, minZ: -14, maxZ: 12 };
export const PARLOUR_START = [0, 7.2]; // just inside the door

// What blocks the way: footprint half sizes (hx, hz) around a centre.
export const COUNTER = { x: -9, z: -5, hx: 5, hz: 1 };
export const COFFINS = [{ x: -1.5, z: -9, hx: 1.1, hz: 2.5 }, { x: 2.3, z: -9, hx: 1.1, hz: 2.5 }, { x: 6.1, z: -9, hx: 1.1, hz: 2.5 }]; // on show, on trestles
export const STAIRS = { x: 13.5, z: -10.5, hx: 3.4, hz: 2.6 }; // the cellar stairs: the opening in the floor, with its rail around it
export const BENCH = { x: -15.6, z: 3.5, hx: 1.0, hz: 4 };
export const STOVE = { x: 15.6, z: 3, hx: 1.1, hz: 1.1 };
export const GRIMSBY = { x: -9, z: -7.4, hx: 0.6, hz: 0.5 }; // behind the counter
export const BLOCKS = [COUNTER, ...COFFINS, STAIRS, BENCH, STOVE, GRIMSBY];

const box = ({ x, z, hx, hz }) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// Where the marshal stands to use each thing (in front, on the +z side, where the camera sees it).
export const SPOTS = [
    { id: 'grimsby', verb: 'TALK', x: COUNTER.x, z: COUNTER.z + COUNTER.hz + 1.7 },
    { id: 'cellar', verb: 'DESCEND', x: STAIRS.x, z: STAIRS.z + STAIRS.hz + 1.7 },
    { id: 'leave', verb: 'LEAVE', x: 0, z: 10.8 }
];

// What the walk map is made of: ground, walls and doors (the same parts the town and the farm hand to src/townWalk.js).
export function parlourMap() {
    return {
        areas: [PARLOUR_AREA],
        boxes: BLOCKS.map(box),
        doors: SPOTS.map(spot => ({ id: spot.id, label: spot.id.toUpperCase(), verb: spot.verb, x: spot.x, z: spot.z }))
    };
}

// The words on the prompt for a door.
export function parlourLabel(door) {
    switch(door.id) {
        case 'grimsby': return 'MR. GRIMSBY, UNDERTAKER';
        case 'cellar': return 'THE CELLAR STAIRS';
        case 'leave': return 'BACK TO THE STREET';
        default: return door.label;
    }
}

// What Mr. Grimsby says: dry, courteous and a little too interested in who is not coming back (STORY_BIBLE.md, section 8).
// `beaten` is how many outlaws the marshal has beaten on the Wanted Road. One line each, so the talk reads the same every visit.
export const GRIMSBY_LINES = [
    { from: 0, line: 'A quiet week, Marshal. I like a quiet week. It is bad for business, but I like it.' },
    { from: 1, line: 'Word is the Company is counting its friends. I only count the others.' },
    { from: 3, line: 'Somebody left a ledger in the cellar. Nobody has come back for it, which tells you something.' },
    { from: 6, line: 'The old claim under my floor keeps its own counsel. If you go down, take a light, and take the stairs, not the shortcut.' },
    { from: 9, line: 'Nearly all of them down. I measured every one, just in case. Professional habit.' },
    { from: 10, line: 'Ten down, and not one of them mine. I do not know what to do with myself, Marshal.' }
];

export function grimsbyLine(beaten = 0) {
    const count = Math.max(0, Math.floor(Number(beaten) || 0));
    let chosen = GRIMSBY_LINES[0];
    for(const entry of GRIMSBY_LINES) if(count >= entry.from) chosen = entry;
    return chosen.line;
}
