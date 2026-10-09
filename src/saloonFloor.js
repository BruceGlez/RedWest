import { crowd, menu, starNeeds, starsFor } from './saloon.js';
import { generateArrivals, cookSeconds, shiftUpgrades, barrelPours, seatCount, patience, EXTRA_PATIENCE, STREAK_FOR_BIG_TIP, QUICK_SHARE, HARD_STOP, SEAT_WAIT } from './saloonShift.js';
import { SPOTS, SEAT_SPOTS, spotDistance, spotPath, directDistance, FLAP_Z } from './saloonKitchenLayout.js';

export const SHIFT_WALK_SPEED = 5.5; // Base speed for the marshal walking the kitchen
export const CUSTOMER_WALK_SPEED = 3.5; // Speed at which customers walk from door to seats
export const REACH = 2.0; // Interaction distance
export const KITCHEN_PATIENCE_BONUS = 6; // Allowance for walking distance in kitchen

const STATION_MAP = {
    sarsaparilla: 'barrel',
    beans: 'stove',
    cornbread: 'oven',
    eggs: 'stove',
    pie: 'oven',
    stew: 'stove'
};

export function createSaloonFloor({ night = 1, farm = false, seed = 1, upgrades = null } = {}) {
    const levels = shiftUpgrades(upgrades);
    const arrivals = generateArrivals({ night, farm, seed }).map((a, i) => ({ ...a, id: `c_${i + 1}` }));
    const total = crowd(night);

    // Upgrades configuration
    const basePatience = patience(night) + (levels.cushions ? EXTRA_PATIENCE : 0);
    const fullPatience = basePatience + KITCHEN_PATIENCE_BONUS;
    const numSeats = seatCount(levels);
    const pours = barrelPours(levels);
    const handsCapacity = 1 + Math.min(2, Math.max(0, levels.tray || 0));
    const walkSpeed = SHIFT_WALK_SPEED + (levels.boots === 1 ? 1.0 : levels.boots >= 2 ? 2.0 : 0);
    const stoveCap = 1 + (levels.burner ? 1 : 0);

    const state = {
        night,
        time: 0,
        over: false,
        // Marshal state
        marshal: {
            x: SPOTS.FLAP.x,
            z: SPOTS.FLAP.z,
            target: null, // { x, z, spotId }
            path: [], // waypoints remaining
            held: [] // [{ customerId, seatIndex, dish, station }]
        },
        // Seats state
        seats: Array.from({ length: numSeats }, () => null),
        // Customer flow state
        pending: arrivals.slice(),
        doorQueue: [], // [{ id, dish, rush, waited }]
        walkingIn: [], // [{ id, dish, rush, seatIndex, walked, duration }]
        // Stations state
        jobs: { stove: [], barrel: [], oven: [] }, // [{ customerId, seatIndex, dish, left, total }]
        readyPlates: { stove: [], barrel: [], oven: [] }, // [{ customerId, seatIndex, dish }]
        // Tickets on order rail
        tickets: [], // [{ id, customerId, seatIndex, dish, station, left, fullPatience }]
        // Performance counters
        served: [],
        missed: 0,
        combo: 0,
        bestCombo: 0
    };

    function stationCapacity(station) {
        if(station === 'stove') return stoveCap;
        if(station === 'barrel') return pours;
        return 1;
    }

    function findFreeSeat() {
        return state.seats.findIndex(s => s === null);
    }

    function startCustomerWalkIn(customer, seatIndex) {
        const seatSpot = SEAT_SPOTS[seatIndex];
        const dist = spotDistance(SPOTS.DOOR, seatSpot);
        const duration = dist / CUSTOMER_WALK_SPEED;
        state.walkingIn.push({
            id: customer.id,
            dish: customer.dish,
            rush: customer.rush,
            seatIndex,
            walked: 0,
            duration
        });
        state.seats[seatIndex] = { id: customer.id, state: 'walking' };
    }

    function actAtStation(station) {
        // 1. Pick up ready plates if marshal has hand space
        const ready = state.readyPlates[station];
        let i = 0;
        while(i < ready.length && state.marshal.held.length < handsCapacity) {
            const plate = ready[i];
            const seat = state.seats[plate.seatIndex];
            if(seat && seat.id === plate.customerId && seat.state === 'ordering') {
                state.marshal.held.push(ready.splice(i, 1)[0]);
            } else {
                ready.splice(i, 1);
            }
        }

        // 2. Start cooking for most impatient customer waiting for this station
        const cap = stationCapacity(station);
        const activeCount = state.jobs[station].length + state.readyPlates[station].length;
        let openSlots = cap - activeCount;

        if(openSlots > 0) {
            const candidates = state.tickets
                .filter(t => t.station === station)
                .sort((a, b) => a.left - b.left);

            for(const ticket of candidates) {
                if(openSlots <= 0) break;
                const hasJob = state.jobs[station].some(j => j.customerId === ticket.customerId);
                const hasReady = state.readyPlates[station].some(r => r.customerId === ticket.customerId);
                const hasHeld = state.marshal.held.some(h => h.customerId === ticket.customerId);

                if(!hasJob && !hasReady && !hasHeld) {
                    const cookTime = cookSeconds(ticket.dish, station, levels);
                    state.jobs[station].push({
                        customerId: ticket.customerId,
                        seatIndex: ticket.seatIndex,
                        dish: ticket.dish,
                        left: cookTime,
                        total: cookTime
                    });
                    openSlots--;
                }
            }
        }
    }

    function actAtSeat(seatIndex) {
        const seat = state.seats[seatIndex];
        if(!seat || seat.state !== 'ordering') return;

        const heldIdx = state.marshal.held.findIndex(h => h.customerId === seat.id);
        if(heldIdx >= 0) {
            const plate = state.marshal.held.splice(heldIdx, 1)[0];
            const quick = (seat.left / seat.fullPatience) >= QUICK_SHARE;
            const tip = quick ? (state.combo + 1 >= STREAK_FOR_BIG_TIP ? 2 : 1) : 0;

            state.served.push({ dish: plate.dish, tip });
            state.combo = quick ? state.combo + 1 : 0;
            state.bestCombo = Math.max(state.bestCombo, state.combo);

            state.tickets = state.tickets.filter(t => t.customerId !== seat.id);
            state.seats[seatIndex] = null;
            finishIfDone();
        }
    }

    function actAtPosition(x, z) {
        const pos = { x, z };
        // Check station interactions
        for(const st of ['stove', 'barrel', 'oven']) {
            const spot = SPOTS[st.toUpperCase()];
            if(directDistance(pos, spot) <= REACH) {
                actAtStation(st);
            }
        }
        // Check seat interactions
        for(let idx = 0; idx < numSeats; idx++) {
            const spot = SEAT_SPOTS[idx];
            if(directDistance(pos, spot) <= REACH) {
                actAtSeat(idx);
            }
        }
    }

    function miss() {
        state.missed++;
        state.combo = 0;
    }

    function finishIfDone() {
        const noPending = state.pending.length === 0;
        const noQueue = state.doorQueue.length === 0;
        const noWalkingIn = state.walkingIn.length === 0;
        const noSeats = state.seats.every(s => s === null);
        const noHeld = state.marshal.held.length === 0;

        if(noPending && noQueue && noWalkingIn && noSeats && noHeld) {
            state.over = true;
        }
        if(state.time >= HARD_STOP) {
            state.over = true;
        }
    }

    return {
        state,
        upgrades: levels,
        get over() { return state.over; },

        moveTo(spotOrPos) {
            if(state.over) return;
            let targetPos = null;
            let spotId = null;

            if(typeof spotOrPos === 'string') {
                const spot = SPOTS[spotOrPos];
                if(spot) {
                    spotId = spot.id;
                    targetPos = { x: spot.x, z: spot.z };
                }
            } else if(spotOrPos && typeof spotOrPos.x === 'number' && typeof spotOrPos.z === 'number') {
                targetPos = { x: spotOrPos.x, z: spotOrPos.z };
                spotId = spotOrPos.spotId || null;
            }

            if(!targetPos) return;

            const waypoints = spotPath({ x: state.marshal.x, z: state.marshal.z }, targetPos);
            // Skip start point if included
            state.marshal.path = waypoints.slice(1);
            state.marshal.target = { x: targetPos.x, z: targetPos.z, spotId };
        },

        update(dt) {
            if(state.over) return;
            state.time += dt;

            // 1. Process customer arrivals
            while(state.pending.length && state.pending[0].at <= state.time) {
                const customer = state.pending.shift();
                const freeSeat = findFreeSeat();
                if(freeSeat >= 0) {
                    startCustomerWalkIn(customer, freeSeat);
                } else {
                    state.doorQueue.push({ ...customer, waited: 0 });
                }
            }

            // 2. Process door queue
            state.doorQueue.forEach(q => { q.waited += dt; });
            state.doorQueue = state.doorQueue.filter(q => {
                const freeSeat = findFreeSeat();
                if(freeSeat >= 0) {
                    startCustomerWalkIn(q, freeSeat);
                    return false;
                }
                if(q.waited >= SEAT_WAIT) {
                    miss();
                    return false;
                }
                return true;
            });

            // 3. Process walking-in customers
            state.walkingIn.forEach(w => { w.walked += dt; });
            state.walkingIn = state.walkingIn.filter(w => {
                if(w.walked >= w.duration) {
                    state.seats[w.seatIndex] = {
                        id: w.id,
                        dish: w.dish,
                        rush: w.rush,
                        fullPatience,
                        left: fullPatience,
                        decideLeft: 1.0,
                        state: 'deciding'
                    };
                    return false;
                }
                return true;
            });

            // 4. Process seated customers
            for(let i = 0; i < numSeats; i++) {
                const s = state.seats[i];
                if(!s) continue;

                if(s.state === 'deciding') {
                    s.decideLeft -= dt;
                    if(s.decideLeft <= 0) {
                        s.state = 'ordering';
                        state.tickets.push({
                            id: `t_${s.id}`,
                            customerId: s.id,
                            seatIndex: i,
                            dish: s.dish,
                            station: STATION_MAP[s.dish],
                            left: s.left,
                            fullPatience: s.fullPatience
                        });
                    }
                } else if(s.state === 'ordering') {
                    s.left -= dt;
                    const ticket = state.tickets.find(t => t.customerId === s.id);
                    if(ticket) ticket.left = s.left;

                    if(s.left <= 0) {
                        // Customer patience expired
                        miss();
                        state.tickets = state.tickets.filter(t => t.customerId !== s.id);
                        state.seats[i] = null;
                        finishIfDone();
                    }
                }
            }

            // 5. Process station cooking jobs
            for(const station of ['stove', 'barrel', 'oven']) {
                const jobs = state.jobs[station];
                for(const job of jobs) {
                    job.left -= dt;
                }
                const done = jobs.filter(j => j.left <= 0);
                for(const job of done) {
                    state.readyPlates[station].push({
                        customerId: job.customerId,
                        seatIndex: job.seatIndex,
                        dish: job.dish
                    });
                }
                state.jobs[station] = jobs.filter(j => j.left > 0);
            }

            // 6. Process marshal movement
            if(state.marshal.path.length > 0) {
                let moveDist = walkSpeed * dt;
                while(moveDist > 0 && state.marshal.path.length > 0) {
                    const nextPt = state.marshal.path[0];
                    const distToNext = directDistance({ x: state.marshal.x, z: state.marshal.z }, nextPt);

                    if(distToNext <= moveDist) {
                        state.marshal.x = nextPt.x;
                        state.marshal.z = nextPt.z;
                        moveDist -= distToNext;
                        state.marshal.path.shift();
                    } else {
                        const ratio = moveDist / distToNext;
                        state.marshal.x += (nextPt.x - state.marshal.x) * ratio;
                        state.marshal.z += (nextPt.z - state.marshal.z) * ratio;
                        moveDist = 0;
                    }
                }
            }

            // 7. Perform actions based on marshal current position
            actAtPosition(state.marshal.x, state.marshal.z);

            finishIfDone();
        },

        progress() {
            return {
                served: state.served.length,
                crowd: total,
                needs: starNeeds(night),
                stars: starsFor(night, state.served.length),
                combo: state.combo,
                bestCombo: state.bestCombo,
                streakLeft: Math.max(0, STREAK_FOR_BIG_TIP - state.combo),
                missed: state.missed
            };
        },

        summary() {
            return {
                action: 'shift',
                night,
                served: state.served.map(s => ({ dish: s.dish, tip: s.tip }))
            };
        }
    };
}
