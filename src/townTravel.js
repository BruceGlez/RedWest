import { DISTRICTS, lockedHint } from './townDistricts.js';
import { spread } from './townSpace.js';

// The town train (TOWN_PLAN.md, the spread-out town): the districts stand a real walk apart, so the depot's platform has a
// train that stops at Main Street and at every district that is open. A shut district shows as a greyed stop that names the
// outlaw to beat, and never changes where the train goes. The stops are here with no rendering so they can be unit tested;
// src/townPanel.js shows the card and moves the marshal.

// Where you step off in a district: just inside its gate, on its own ground. The farm is a place of its own, so the train
// drops you at its gate in the town, and the way in is a few steps on.
export function arrival(district) {
    const [x1, z1] = district.fence.from, [x2, z2] = district.fence.to;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    if(district.interior) return [...district.fence.read];
    if(z1 === z2) return [cx, cz + (cz < 0 ? -4 : 4)]; // a gate on the north or south edge: step further out
    return [cx + (cx < 0 ? -4 : 4), cz]; // a gate on the west or east edge
}

export const SQUARE = spread(0, -3.2); // Main Street, where the marshal starts

// unlocked: the ids of the open districts (unlockedDistricts). Each stop: { id, name, open, at, hint }.
export function stops(unlocked = []) {
    return [
        { id: 'square', name: 'MAIN STREET', open: true, at: [...SQUARE], hint: 'The middle of town.' },
        ...DISTRICTS.map(d => ({ id: d.id, name: d.name, open: unlocked.includes(d.id), at: arrival(d), hint: unlocked.includes(d.id) ? '' : lockedHint(d) }))
    ];
}

export const stopById = (id, unlocked) => stops(unlocked).find(stop => stop.id === id && stop.open) ?? null;

export const TRAVEL_FADE_MS = 380;
