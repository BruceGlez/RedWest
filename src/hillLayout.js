import { HILL_START, OIL_STAND, POSTS, PIECES, getPost, runState } from './vigil.js';

// Hollow Hill as a place you walk into (PLACES.md, section 10): the hill where the dusk vigil is played (src/vigil.js has the rules, src/places/hill.js the
// cards, src/placeHill.js the scene). No rendering here, so the walking rules (src/townWalkLogic.js) and tests/hillLayout.test.js can use it as it is.
// The map is flat: x to the right, z toward the viewer, the road back to town at the south edge. The posts, the oil stand and the gate are the rules'
// (src/vigil.js): the server replays a route from the same positions, so the scene never moves them.

export const HILL_WALK_AREA = { minX: -30, maxX: 30, minZ: -32, maxZ: 20 }; // a little more than the posts' hill, for the chapel at the back
export const HILL_ENTRY = HILL_START;
export const CHAPEL = { x: 0, z: -27.5, hx: 5, hz: 3.5 }; // the chapel at the back; the bell hangs at its door
export const OIL_BLOCK = { x: OIL_STAND.x, z: OIL_STAND.z - 1.2, hx: 0.9, hz: 0.5 }; // the stand's barrels, behind the spot he fills the can at
export const BLOCKS = [CHAPEL, OIL_BLOCK];

const box = ({ x, z, hx, hz }) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

export const BELL_SPOT = { id: 'bell', verb: 'LOOK', x: CHAPEL.x, z: CHAPEL.z + CHAPEL.hz + 1.7 };
export const LEAVE_SPOT = { id: 'leave', verb: 'LEAVE', x: 0, z: 19.2 };

// What the walk map is made of: ground, walls and doors. With a night, every lantern of tonight is a door (LIGHT while it is dark, LOOK once lit) and the
// oil stand is one when any lantern needs oil; with none (before the vigil is set up) only the bell and the way out.
export function hillMap(night = null, lit = []) {
    const doors = [
        { id: BELL_SPOT.id, label: 'BELL', verb: BELL_SPOT.verb, x: BELL_SPOT.x, z: BELL_SPOT.z },
        { id: LEAVE_SPOT.id, label: 'LEAVE', verb: LEAVE_SPOT.verb, x: LEAVE_SPOT.x, z: LEAVE_SPOT.z }
    ];
    if(night) {
        if(night.oil) doors.push({ id: 'oil', label: 'OIL', verb: 'FILL', x: OIL_STAND.x, z: OIL_STAND.z });
        for(const l of night.lanterns) {
            const post = getPost(l.id);
            doors.push({ id: l.id, label: 'LANTERN', verb: lit.includes(l.id) ? 'LOOK' : 'LIGHT', x: post.x, z: post.z });
        }
    }
    return { areas: [HILL_WALK_AREA], boxes: BLOCKS.map(box), doors };
}

// The words on the prompt for a door. `night` and `order` are the vigil being played ({ lanterns, limit, ... } and the steps so far), or null.
export function hillLabel(door, night = null, order = []) {
    if(door.id === 'bell') return 'THE CHAPEL BELL';
    if(door.id === 'leave') return 'THE ROAD TO TOWN';
    if(!night) return door.label;
    const state = runState(night, order);
    if(door.id === 'oil') return state.oil >= 3 ? 'THE OIL STAND: THE CAN IS FULL' : `THE OIL STAND: THE CAN LIGHTS ${state.oil}`;
    const lantern = night.lanterns.find(l => l.id === door.id);
    if(!lantern) return door.label;
    if(state.lit.includes(lantern.id)) return 'THE LANTERN: LIT';
    const waiting = lantern.needs && !state.lit.includes(lantern.needs);
    if(waiting) return 'A LANTERN OUT OF REACH';
    return lantern.dry ? 'A DRY LANTERN: NEEDS OIL' : 'AN UNLIT LANTERN';
}

// The chapel's pieces as a line for the card ("THE WINDOW, 5 MORE LIGHT").
export function chapelLines(light) {
    return PIECES.map(p => (light >= p.at ? { name: p.name, built: true, text: `${p.name}: BUILT` } : { name: p.name, built: false, text: `${p.name}: ${p.at - light} MORE LIGHT` }));
}
export { POSTS };
