// What the marshal can use in Section 1 (docs/design/pete-section1-gameplay.md, section 4): the art's markers (pete_section1_markers.json) become
// interactables with a kind, a place, a reach and a prompt. Pure data and rules; src/stages/section1/runtime.js runs them each frame.

export const KIND_BY_TYPE = { npc: 'npc', hide: 'hide', door: 'door', lever: 'lever', lore: 'lore', climb: 'climb', vantage: 'vantage' };
// When several are in reach, the first kind in this list wins (a door beside a hiding place opens the door).
const PRIORITY = ['npc', 'door', 'lever', 'stack', 'climb', 'lore', 'vantage', 'hide'];
export const MIN_REACH = 6;           // units: even a small marker can be used from a step away

export function buildInteractables(markers = []) {
    return markers.filter(m => KIND_BY_TYPE[m.type] || m.id === 'DYNAMITE').map(m => ({
        id: m.id, kind: m.id === 'DYNAMITE' ? 'stack' : KIND_BY_TYPE[m.type], x: m.x, z: m.z, r: Math.max(m.radius || 0, MIN_REACH), note: m.note ?? ''
    }));
}

// The best interactable in reach of (x, z), optionally limited to some kinds.
export function nearestInteractable(list, x, z, kinds = null) {
    let best = null, bestScore = Infinity;
    for(const item of list) {
        if(kinds && !kinds.includes(item.kind)) continue;
        const d = Math.hypot(item.x - x, item.z - z);
        if(d > item.r) continue;
        const score = PRIORITY.indexOf(item.kind) * 1000 + d;
        if(score < bestScore) { bestScore = score; best = item; }
    }
    return best;
}

// The words on the HUD and the touch button for what is in reach.
export function promptFor(item, state) {
    if(!item) return null;
    switch(item.kind) {
    case 'door': return state?.doors?.[item.id]?.open ? 'E: CLOSE DOOR' : 'E: OPEN DOOR';
    case 'lever': return state?.leverPulled ? 'LEVER PULLED' : 'E: PULL LEVER';
    case 'hide': return state?.hiding?.hidden && state.hiding.hideId === item.id ? 'HIDDEN (E: STEP OUT)' : 'E: HIDE';
    case 'stack': return state?.stackTaken ? null : 'E: TAKE DYNAMITE';
    case 'npc': return state?.beats?.witness ? 'E: TALK TO ODELL' : 'E: TALK';
    case 'lore': return 'E: LOOK';
    case 'climb': return 'E: CLIMB';
    case 'vantage': return 'E: LOOK OUT';
    default: return null;
    }
}

// Cards for the lore markers: a title and up to 200 characters. Placeholder copy for the story lane to polish (src/stages/section1/story.js).
export const LORE = {
    TH_GATE: { speaker: 'The trailhead gate', lines: ["The Claims Road. Copper Bit's miners walked this way every morning. The signboard shows a pick and a rail."] },
    I02: { speaker: 'Notice', lines: ['By order of Meridian Land and Rail, these claims are forfeit. Leave the ground by Friday. A red stamp: a rail and a rising sun.'] },
    I24: { speaker: 'A pull-toy', lines: ["A child's wooden pull-toy, left in the road. Somebody left in a hurry."] },
    I25: { speaker: 'The bridge sign', lines: ['A hand-painted sign: a bucket and a pick. The old flume carried water to forty claims.'] },
    I22_map: { speaker: 'A pinned map', lines: ['The Company gate, a path past the flume, and a note in a hurried hand: bring the book.'] },
    B17: { speaker: 'The smugglers\' cave', lines: ['Crates under tarps, a lantern still lit, a bedroll gone cold. Somebody hid more than supplies here.'] }
};
