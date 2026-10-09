import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaloonFloor, SHIFT_WALK_SPEED } from '../src/saloonFloor.js';
import { SPOTS, SEAT_SPOTS, spotDistance } from '../src/saloonKitchenLayout.js';
import { starsFor, shiftPay, NIGHTS, PAID_SHIFTS_PER_DAY, SHIFT_PAY_CEILING } from '../src/saloon.js';

// The balance gate for the Copper Bit walking kitchen floor (docs/design/copper-bit-kitchen.md, Section 8, K12).
// A graph-based bot plays whole shifts on the navigation graph with fixed decision pauses (0.5 s fast, 1.5 s slow)
// and a 1.15 human-inefficiency factor on walk distances.
const DT = 0.1;
const INEFFICIENCY = 1.15;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function runFloorBot(night, farm, seed, delay, upgrades = null) {
    const floor = createSaloonFloor({ night, farm, seed, upgrades });
    let wait = 0;
    let peakSeats = 0;

    while(!floor.over && floor.state.time <= 160) {
        wait -= DT;

        if(wait <= 0) {
            const marshalPos = { x: floor.state.marshal.x, z: floor.state.marshal.z };
            const walkSpeed = SHIFT_WALK_SPEED + (floor.upgrades.boots === 1 ? 1.0 : floor.upgrades.boots >= 2 ? 2.0 : 0);
            let bestTarget = null;
            let lowestCost = Infinity;

            // 1. Evaluate delivery targets (seats) where marshal holds matching plate
            for(const held of floor.state.marshal.held) {
                const seatIndex = held.seatIndex;
                const seat = floor.state.seats[seatIndex];
                if(seat && seat.id === held.customerId && seat.state === 'ordering') {
                    const spot = SEAT_SPOTS[seatIndex];
                    const walkDist = spotDistance(marshalPos, spot) * INEFFICIENCY;
                    const cost = seat.left + 0.7 * (walkDist / walkSpeed);
                    if(cost < lowestCost) {
                        lowestCost = cost;
                        bestTarget = spot.id;
                    }
                }
            }

            // 2. Evaluate station targets (picking up plates or starting cooking)
            for(const station of ['stove', 'barrel', 'oven']) {
                const spotKey = station.toUpperCase();
                const spot = SPOTS[spotKey];
                const readyPlates = floor.state.readyPlates[station];
                const jobs = floor.state.jobs[station];

                // If ready plates exist that marshal can pick up
                if(readyPlates.length > 0 && floor.state.marshal.held.length < (1 + (floor.upgrades.tray || 0))) {
                    const plate = readyPlates[0];
                    const seat = floor.state.seats[plate.seatIndex];
                    const left = seat ? seat.left : 10;
                    const walkDist = spotDistance(marshalPos, spot) * INEFFICIENCY;
                    const cost = left + 0.7 * (walkDist / walkSpeed);
                    if(cost < lowestCost) {
                        lowestCost = cost;
                        bestTarget = spotKey;
                    }
                }

                // If station has room to cook waiting tickets
                const cap = station === 'stove' ? (1 + (floor.upgrades.burner ? 1 : 0)) : station === 'barrel' ? (floor.upgrades.taps ? 2 : 1) : 1;
                const active = jobs.length + readyPlates.length;
                if(active < cap) {
                    const tickets = floor.state.tickets.filter(t => t.station === station);
                    for(const ticket of tickets) {
                        const hasJob = jobs.some(j => j.customerId === ticket.customerId);
                        const hasReady = readyPlates.some(r => r.customerId === ticket.customerId);
                        const hasHeld = floor.state.marshal.held.some(h => h.customerId === ticket.customerId);
                        if(!hasJob && !hasReady && !hasHeld) {
                            const walkDist = spotDistance(marshalPos, spot) * INEFFICIENCY;
                            const cost = ticket.left + 0.7 * (walkDist / walkSpeed);
                            if(cost < lowestCost) {
                                lowestCost = cost;
                                bestTarget = spotKey;
                            }
                        }
                    }
                }
            }

            if(bestTarget) {
                floor.moveTo(bestTarget);
                wait = delay;
            }
        }

        floor.update(DT);
        const occupiedSeats = floor.state.seats.filter(s => s && (s.state === 'ordering' || s.state === 'deciding')).length;
        peakSeats = Math.max(peakSeats, occupiedSeats);
    }

    const served = floor.summary().served;
    return {
        stars: starsFor(night, served.length),
        peakSeats,
        seconds: floor.state.time,
        pay: shiftPay(night, served, farm).dollars
    };
}

const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
const results = {};
function runs(delay, farm, night, upgrades = null) {
    const key = `${delay}/${farm}/${night}/${JSON.stringify(upgrades)}`;
    return (results[key] ??= SEEDS.map(seed => runFloorBot(night, farm, seed, delay, upgrades)));
}

test('a fast floor bot (0.5 s delay) three-stars nights 1 to 3 in >= 90% of seeds', () => {
    for(const farm of [false, true]) {
        for(const night of [1, 2, 3]) {
            const threes = runs(0.5, farm, night).filter(r => r.stars === 3).length;
            assert.ok(threes / SEEDS.length >= 0.9, `night ${night} farm ${farm}: ${threes} of ${SEEDS.length} three-star shifts`);
        }
    }
});

test('a slow floor bot (1.5 s delay) averages no better than 2 stars on late nights (nights 8 to 10)', () => {
    for(const farm of [false, true]) {
        for(let night = 8; night <= NIGHTS; night++) {
            const average = mean(runs(1.5, farm, night).map(r => r.stars));
            assert.ok(average <= 2.0, `night ${night} farm ${farm}: ${average} stars on average`);
        }
        const lateMean = mean([7, 8, 9, 10].flatMap(night => runs(1.5, farm, night).map(r => r.stars)));
        assert.ok(lateMean <= 2.0, `farm ${farm}: overall late mean ${lateMean} <= 2.0`);
    }
});

test('seats are juggled on the floor: peak seats occupied >= 3 from night 5', () => {
    for(const farm of [false, true]) {
        for(let night = 5; night <= NIGHTS; night++) {
            for(const delay of [0.5, 1.5]) {
                const maxPeak = Math.max(...runs(delay, farm, night).map(r => r.peakSeats));
                assert.ok(maxPeak >= 3, `night ${night} farm ${farm} delay ${delay}: peak ${maxPeak}`);
            }
        }
    }
});

test('a played floor shift lasts nearly two minutes', () => {
    for(const delay of [0.5, 1.5]) {
        const allSeconds = [];
        for(let night = 1; night <= NIGHTS; night++) {
            const seconds = runs(delay, true, night).map(r => r.seconds);
            allSeconds.push(...seconds);
        }
        assert.ok(mean(allSeconds) >= 90, `delay ${delay}: mean shift time ${mean(allSeconds).toFixed(1)} s`);
    }
});

test('floor income stays inside the pay ceiling', () => {
    let maxPay = 0;
    for(let night = 1; night <= NIGHTS; night++) {
        for(const farm of [false, true]) {
            maxPay = Math.max(maxPay, ...runs(0.5, farm, night).map(r => r.pay));
        }
    }
    assert.ok(maxPay <= SHIFT_PAY_CEILING, `max pay ${maxPay} exceeds ceiling ${SHIFT_PAY_CEILING}`);
    assert.ok(maxPay * PAID_SHIFTS_PER_DAY < 400);
});

test('all layout spots are reachable from door through flap', () => {
    for(const key of Object.keys(SPOTS)) {
        const dist = spotDistance('DOOR', key);
        assert.ok(Number.isFinite(dist) && dist >= 0);
    }
});
