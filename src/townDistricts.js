import { OUTLAWS } from './outlaws.js';

// Lantern Rock grows outward as outlaws fall (TOWN_PLAN.md, step B). Each district is ground beyond the town's edge,
// fenced off and named until the outlaw that opens it has been beaten (the first star, the same rule the jail uses).
// Districts open by stars, never by money. The data and rules are here, with no rendering, so they can be unit tested;
// src/townScene.js draws them and src/townPanel.js shows their cards.
//
// area: the ground you may walk once it is open. Each one reaches 3 units into the town (more than a marshal's width),
//       so walking across the edge never lands in a gap between two areas.
// fence: the line across the way in while it is shut, from (x1, z1) to (x2, z2), and where to stand to read the sign.
// place: the thing to use inside (a plaque), with where it stands and where you stand.
// interior: a district that is a place of its own (PLACES.md). Its gate opens a whole new map you walk around (the farm's is
//           src/farmLayout.js) and not ground in the town, so it has no walk area and no place here.

export const TOWN_AREA = { minX: -38, maxX: 40, minZ: -21, maxZ: 19 };

export const DISTRICTS = [
    {
        id: 'ranch', name: 'CALLOWAY FARM', outlaw: 'calloway-gang', interior: 'farm',
        area: { minX: -72, maxX: -35, minZ: -10, maxZ: 6 },
        fence: { from: [-38, -10], to: [-38, 6], read: [-36.4, -2] },
        ground: 0x55613a,
        place: null,
        card: {
            title: 'CALLOWAY FARM',
            text: 'The Calloway brothers rebuilt these fences themselves. The paper they lost the farm to hangs in the barn, with a nail through the small print. They keep one dog more than they can feed.'
        }
    },
    {
        id: 'foundry', name: 'FOUNDRY YARD', outlaw: 'iron-jack',
        area: { minX: 12, maxX: 37, minZ: -46, maxZ: -18 },
        fence: { from: [12, -21], to: [37, -21], read: [24.5, -19.4] },
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
    },
    {
        id: 'crossing', name: "VANE'S CROSSING", outlaw: 'silas-vane',
        area: { minX: 37, maxX: 82, minZ: -12, maxZ: 10 },
        fence: { from: [40, -12], to: [40, 10], read: [38.4, -1] },
        ground: 0x8c7653,
        place: { id: 'clock', verb: 'READ', object: { x: 75, z: -1, hx: 1.5, hz: 1.5 }, stand: [71.2, -1] },
        card: {
            title: "VANE'S CROSSING",
            text: 'The Crossing is open again, and wagons use it. Silas Vane left the clock on the tower stopped at the hour the Company paid him to close the road. He says it should stay stopped, so that nobody forgets what the road cost.'
        }
    },
    {
        id: 'tresrios', name: 'TRES RIOS', outlaw: 'el-espectro',
        area: { minX: -34, maxX: -5, minZ: -46, maxZ: -18 },
        fence: { from: [-34, -21], to: [-5, -21], read: [-19.5, -19.4] },
        ground: 0xa8895c,
        place: { id: 'grave', verb: 'READ', object: { x: -27, z: -26, hx: 0.6, hz: 0.4 }, stand: [-27, -24.4] },
        card: {
            title: 'TRES RIOS',
            text: 'Don Rafael Ibarra has his name back in the town records, and the land grant is framed in the hacienda. The stone with his old name still stands by the wall, with the date struck out. He asked that it be left.'
        }
    },
    {
        id: 'belle', name: 'THE SILVER BELLE', outlaw: 'lucky-lou',
        area: { minX: 26, maxX: 64, minZ: 16, maxZ: 44 },
        fence: { from: [26, 19], to: [40, 19], read: [33, 17.4] },
        ground: 0x7e6a4a,
        place: { id: 'landing', verb: 'READ', object: { x: 49, z: 30.6, hx: 0.3, hz: 0.3 }, stand: [46.6, 30.6] },
        card: {
            title: 'THE SILVER BELLE',
            text: 'The riverboat is tied up here for good. The ledger Lou kept went to the court, and the deck hands keep the paddle wheel painted. The sign on the gangway says every game aboard is played straight.'
        }
    },
    {
        id: 'fort', name: 'FORT PELL', outlaw: 'colonel-crane',
        area: { minX: 37, maxX: 80, minZ: -46, maxZ: -14 },
        fence: { from: [40, -21], to: [40, -14], read: [38.6, -17.5] },
        ground: 0x5d5a4a,
        place: { id: 'gatling', verb: 'READ', object: { x: 60, z: -26, hx: 1.2, hz: 1.0 }, stand: [60, -23.6] },
        card: {
            title: 'FORT PELL',
            text: "The Colonel's old regiment stands down here. The gatling is oiled and unloaded, pointed at the sky. On the staff list nailed by the gate, one page is missing, and the Colonel will not say where it went."
        }
    },
    {
        id: 'copper', name: 'COPPER BIT', outlaw: 'dusty-pete',
        area: { minX: -62, maxX: -22, minZ: 16, maxZ: 44 },
        fence: { from: [-38, 19], to: [-22, 19], read: [-30, 17.4] },
        ground: 0x8a6e4c,
        place: { id: 'piano', verb: 'READ', object: { x: -46, z: 30, hx: 1.4, hz: 0.8 }, stand: [-46, 32.4] },
        card: {
            title: 'COPPER BIT',
            text: "Copper Bit's saloon street is open again. Dusty Pete runs the bar, and the broken piano stays broken: he says the sour notes keep the tune honest. The first drink of the day is on the house."
        }
    },
    {
        id: 'wash', name: 'WHISPER WASH', outlaw: 'rattlesnake-rosa',
        area: { minX: -72, maxX: -35, minZ: -34, maxZ: -12 },
        fence: { from: [-38, -21], to: [-38, -12], read: [-36.4, -16.5] },
        ground: 0x7c6a52,
        place: { id: 'den', verb: 'READ', object: { x: -58, z: -24, hx: 1.8, hz: 1.2 }, stand: [-58, -21.2] },
        card: {
            title: 'WHISPER WASH',
            text: "Water runs down the old riverbed again, a thin line you can step across. Rosa's wolf pups sleep in the den under the bank, and the pack answers to her whistle alone. Nobody has asked them to leave."
        }
    },
    {
        id: 'chapel', name: 'HOLLOW HILL', outlaw: 'deacon-graves',
        area: { minX: -3, maxX: 10, minZ: -46, maxZ: -18 },
        fence: { from: [-3, -21], to: [10, -21], read: [3.5, -19.4] },
        ground: 0x4f5a40,
        place: { id: 'bell', verb: 'READ', object: { x: 3.5, z: -34, hx: 1.0, hz: 1.0 }, stand: [3.5, -31.4] },
        card: {
            title: 'HOLLOW HILL',
            text: 'The Deacon rebuilt the chapel from the burnt beams, one pew at a time. The bell rings once at dusk for everyone the road took. He keeps a lamp lit in the window and asks nothing for it.'
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
    return [TOWN_AREA, ...DISTRICTS.filter(d => !d.interior && unlocked.includes(d.id)).map(d => d.area)];
}

// Interaction places of the open districts (src/townSpots.js has the town's own).
export function districtPlaces(unlocked = []) {
    return DISTRICTS.filter(d => d.place && unlocked.includes(d.id)).map(d => ({ ...d.place, district: d.id }));
}

// What the walk prompt says at a district's places and at a shut gate ('' for anything else).
const PLACE_LABELS = {
    furnace: 'THE FURNACE', channel: 'THE CHANNEL LOG', clock: 'THE STOPPED CLOCK', grave: 'THE OLD STONE',
    landing: 'THE GANGWAY', gatling: 'THE GATLING', piano: 'THE BROKEN PIANO', den: 'THE DEN', bell: 'THE CHAPEL BELL'
};
export function doorLabel(id) {
    if(id.startsWith('enter-')) return getDistrict(id.slice(6))?.name ?? '';
    if(id.startsWith('gate-')) {
        const d = getDistrict(id.slice(5));
        return d ? `${d.name}: SHUT` : '';
    }
    return PLACE_LABELS[id] ?? '';
}

// The district a place (furnace, channel, ...), a shut gate (gate-ranch) or an open way in (enter-ranch) (gate-ranch, ...) belongs to, or null.
export function districtOf(id) {
    if(id.startsWith('gate-')) return getDistrict(id.slice(5));
    if(id.startsWith('enter-')) return getDistrict(id.slice(6));
    return DISTRICTS.find(d => d.place?.id === id) ?? null;
}

// A district's name as it reads in a sentence ("FOUNDRY YARD" -> "Foundry Yard", "MORGAN'S CHANNEL" -> "Morgan's Channel").
export function placeName(district) {
    return district.name.toLowerCase().replace(/(^|\s)([a-z])/g, (m, space, letter) => space + letter.toUpperCase());
}

const insideArea = (a, x, z) => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ;

// The district a point lies in (its own ground, not the strip shared with the town), or null.
export function districtAt(x, z) {
    if(insideArea(TOWN_AREA, x, z)) return null;
    return DISTRICTS.find(d => insideArea(d.area, x, z)) ?? null;
}

// Which edge of the town a district's gate is on: 'north', 'south', 'east' or 'west'.
export function edgeOf(district) {
    const [x1, z1] = district.fence.from, [x2, z2] = district.fence.to;
    if(z1 === z2) return z1 < 0 ? 'north' : 'south';
    return (x1 + x2) / 2 < 0 ? 'west' : 'east';
}
