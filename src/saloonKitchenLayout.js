// Data contract for the Copper Bit kitchen floor interior (docs/design/copper-bit-kitchen.md).
//
// Kitchen layout: a long bar counter crosses at z = -1.5 with a FLAP at (0, -1.5).
// Kitchen area is behind the bar (z < -1.5), dining area in front (z >= -1.5).
// Movement between kitchen and dining must pass through the FLAP.

export const FLAP_Z = -1.5;

export const SPOTS = {
    STOVE: { id: 'STOVE', x: -7, z: -7, name: 'Stove', area: 'kitchen' },
    BARREL: { id: 'BARREL', x: -2.5, z: -6.5, name: 'Barrel', area: 'kitchen' },
    OVEN: { id: 'OVEN', x: 6.5, z: -7, name: 'Oven', area: 'kitchen' },
    CRATES: { id: 'CRATES', x: 10, z: -5, name: 'Crates', area: 'kitchen' },
    FLAP: { id: 'FLAP', x: 0, z: -1.5, name: 'Flap', area: 'flap' },
    SEAT_1: { id: 'SEAT_1', x: -6, z: 3, name: 'Seat 1', area: 'dining' },
    SEAT_2: { id: 'SEAT_2', x: -2, z: 3, name: 'Seat 2', area: 'dining' },
    SEAT_3: { id: 'SEAT_3', x: 2, z: 3, name: 'Seat 3', area: 'dining' },
    SEAT_4: { id: 'SEAT_4', x: 6, z: 3, name: 'Seat 4', area: 'dining' },
    SEAT_5: { id: 'SEAT_5', x: 10, z: 3, name: 'Seat 5', area: 'dining' },
    DOOR: { id: 'DOOR', x: 0, z: 9, name: 'Door', area: 'dining' },
    SHELF: { id: 'SHELF', x: -9, z: 7, name: 'Shelf', area: 'dining' }
};

export const SEAT_SPOTS = [
    SPOTS.SEAT_1,
    SPOTS.SEAT_2,
    SPOTS.SEAT_3,
    SPOTS.SEAT_4,
    SPOTS.SEAT_5
];

export function directDistance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

// Distance along the walking path between any two points or spots.
// If one point is in the kitchen (z < -1.5) and the other in dining (z > -1.5),
// the route goes through the FLAP at (0, -1.5).
export function spotDistance(a, b) {
    const pA = typeof a === 'string' ? SPOTS[a] : a;
    const pB = typeof b === 'string' ? SPOTS[b] : b;
    if(!pA || !pB) return Infinity;

    const crossBar = (pA.z < FLAP_Z && pB.z > FLAP_Z) || (pA.z > FLAP_Z && pB.z < FLAP_Z);
    if(crossBar) {
        return directDistance(pA, SPOTS.FLAP) + directDistance(SPOTS.FLAP, pB);
    }
    return directDistance(pA, pB);
}

// Navigation path (waypoints) between two points.
export function spotPath(a, b) {
    const pA = typeof a === 'string' ? SPOTS[a] : a;
    const pB = typeof b === 'string' ? SPOTS[b] : b;
    if(!pA || !pB) return [];

    const crossBar = (pA.z < FLAP_Z && pB.z > FLAP_Z) || (pA.z > FLAP_Z && pB.z < FLAP_Z);
    if(crossBar) {
        return [{ x: pA.x, z: pA.z }, { x: SPOTS.FLAP.x, z: SPOTS.FLAP.z }, { x: pB.x, z: pB.z }];
    }
    return [{ x: pA.x, z: pA.z }, { x: pB.x, z: pB.z }];
}

export function travelTime(a, b, speed = 5.5) {
    return spotDistance(a, b) / speed;
}
