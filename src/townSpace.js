// How far apart things stand in Lantern Rock. The town used to be packed; it is now laid out like a small rural town, with
// room between the buildings and a real walk (or a train ride) between the town and the districts around it.
//
// One number sets it: every position in the town's core is moved outward from the centre by SPREAD, while buildings and props
// keep their own size, so the gaps grow and nothing gets bigger. Things that belong to a building (the piano in the saloon's
// street, the pups on the jail's porch, the train in front of the depot) are moved with that building instead, so they keep
// their place beside it. Districts move out by the same amount as the town's edge (src/townDistricts.js).
// No rendering here, so the rules and tests can use it as it is.

export const SPREAD = 1.5;

// The original layout, as designed. Do not use these directly: TOWN_LAYOUT below is what stands in the world.
const BASE_LAYOUT = [
    { id: 'saloon', x: -15, z: -14, label: 'SALOON' },
    { id: 'sheriff', x: 0, z: -13, label: "SHERIFF'S OFFICE" },
    { id: 'bank', x: 14, z: -13, label: 'BANK' },
    { id: 'jail', x: -16, z: 5, label: 'JAIL' },
    { id: 'gunsmith', x: 1, z: 5, label: 'GUNSMITH' },
    { id: 'tailor', x: 16, z: 5, label: 'TAILOR' }, // 4 further from the gunsmith than before, so no two buildings stand close
    { id: 'depot', x: 33, z: -15, label: 'MOST WANTED' },
    { id: 'arena', x: 33, z: 6, label: 'ARENA' }
];

// A point moved outward from the centre of the town.
export const spread = (x, z) => [x * SPREAD, z * SPREAD];

export const TOWN_LAYOUT = BASE_LAYOUT.map(spot => {
    const [x, z] = spread(spot.x, spot.z);
    return { ...spot, x, z };
});

const baseOf = id => BASE_LAYOUT.find(spot => spot.id === id);
const spreadOf = id => TOWN_LAYOUT.find(spot => spot.id === id);

// A point that belongs to a building: where it was relative to the building, kept relative to the building's new place.
export function near(id, x, z) {
    const before = baseOf(id);
    const after = spreadOf(id);
    return [after.x + (x - before.x), after.z + (z - before.z)];
}

// The same for the building's own displacement, for things that are built around a building (the depot's rails).
export function moved(id) {
    return [spreadOf(id).x - baseOf(id).x, spreadOf(id).z - baseOf(id).z];
}

// The town station on the south road (the town train, src/townTravel.js): the line of its rails. The platform is in front of it
// (toward the road), the green train stands on it, and the marshal boards from the platform.
export const STATION = { x: 0, z: 25.4 };
