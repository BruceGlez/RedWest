import { OUTLAWS } from './outlaws.js';

// Lantern Rock grows outward as outlaws fall (TOWN_PLAN.md, step B). Each district is ground beyond the town's edge,
// fenced off and named until the outlaw that opens it has been beaten (the first star, the same rule the jail uses).
// Districts open by stars, never by money. The data and rules are here, with no rendering, so they can be unit tested;
// src/townScene.js draws them and src/townPanel.js shows their cards.
//
// area: the ground you may walk once it is open. Each one reaches 3 units into the town (more than a marshal's width),
//       so walking across the edge never lands in a gap between two areas.
// fence: the line across the way in while it is shut, from (x1, z1) to (x2, z2), and where to stand to read the sign.
// place: the thing to use inside (a plaque, or the kennel), with where it stands and where you stand.

export const TOWN_AREA = { minX: -38, maxX: 40, minZ: -21, maxZ: 19 };

export const DISTRICTS = [
    {
        id: 'ranch', name: 'CALLOWAY FARM', outlaw: 'calloway-gang',
        area: { minX: -72, maxX: -35, minZ: -10, maxZ: 6 },
        fence: { from: [-38, -10], to: [-38, 6], read: [-36.4, -2] },
        ground: 0x55613a,
        place: { id: 'kennel', verb: 'MEET', object: { x: -46, z: 2.4, hx: 1.0, hz: 0.8 }, stand: [-46, 4.6] },
        card: {
            title: 'CALLOWAY FARM',
            text: 'The Calloway brothers rebuilt these fences themselves. The paper they lost the farm to hangs in the barn, with a nail through the small print. They keep one dog more than they can feed.'
        }
    },
    {
        id: 'foundry', name: 'FOUNDRY YARD', outlaw: 'iron-jack',
        area: { minX: 12, maxX: 40, minZ: -46, maxZ: -18 },
        fence: { from: [12, -21], to: [40, -21], read: [26, -19.4] },
        ground: 0x3a3634,
        place: { id: 'furnace', verb: 'READ', object: { x: 16, z: -30, hx: 1.6, hz: 1.4 }, stand: [16, -27.4] },
        card: {
            title: 'FOUNDRY YARD',
            text: 'Ezra Stone opened the armour with the bolt he found on its back. Jack asked if the smithy had work for a man his size. The furnace has not gone cold since; it makes rails now, and pumps for the wells.'
        }
    },
    {
        id: 'canal', name: "MORGAN'S CHANNEL", outlaw: 'mesa-morgan',
        area: { minX: -20, maxX: 24, minZ: 16, maxZ: 44 },
        fence: { from: [-20, 19], to: [24, 19], read: [2, 17.4] },
        ground: 0x7a6346,
        place: { id: 'channel', verb: 'READ', object: { x: 3.8, z: 34.6, hx: 0.3, hz: 0.3 }, stand: [2, 34.6] },
        card: {
            title: "MORGAN'S CHANNEL",
            text: 'The dry channel from Redstone Mesa runs here now, with water in it, and a fire crew keeps its buckets by the bridge. The log at the warehouse door has one rule, in Morgan\'s hand: no blasting after dark.'
        }
    }
];

const BY_ID = new Map(DISTRICTS.map(d => [d.id, d]));
export const getDistrict = id => BY_ID.get(id) ?? null;

// The outlaw's place in OUTLAWS (and so in a profile's stageStars).
export function opensWith(district) {
    return OUTLAWS.findIndex(o => o.id === district.outlaw);
}

// Which districts are open, given the account's stars per outlaw (bit 1 is "beaten").
export function unlockedDistricts(stageStars = []) {
    return DISTRICTS.filter(d => ((stageStars[opensWith(d)] | 0) & 1) !== 0).map(d => d.id);
}

// What a shut gate says.
export function lockedHint(district) {
    const outlaw = OUTLAWS[opensWith(district)];
    return `${district.name} is shut. Beat ${outlaw.name} to open it.`;
}

// The ground you can walk on: the town plus every open district.
export function walkAreas(unlocked = []) {
    return [TOWN_AREA, ...DISTRICTS.filter(d => unlocked.includes(d.id)).map(d => d.area)];
}

// Interaction places of the open districts (src/townSpots.js has the town's own).
export function districtPlaces(unlocked = []) {
    return DISTRICTS.filter(d => unlocked.includes(d.id)).map(d => ({ ...d.place, district: d.id }));
}

// What the walk prompt says at a district's places and at a shut gate ('' for anything else).
const PLACE_LABELS = { kennel: 'THE KENNEL', furnace: 'THE FURNACE', channel: 'THE CHANNEL LOG' };
export function doorLabel(id) {
    if(id.startsWith('gate-')) {
        const d = getDistrict(id.slice(5));
        return d ? `${d.name}: SHUT` : '';
    }
    return PLACE_LABELS[id] ?? '';
}

// The district a place (kennel, furnace, channel) or a shut gate (gate-ranch, ...) belongs to, or null.
export function districtOf(id) {
    if(id.startsWith('gate-')) return getDistrict(id.slice(5));
    return DISTRICTS.find(d => d.place.id === id) ?? null;
}
