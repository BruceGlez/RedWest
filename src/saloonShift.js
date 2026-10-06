import { crowd, menu } from './saloon.js';

// One shift behind Dusty Pete's bar (PLACES.md, section 8). The rules of the game, with no rendering, so tests/saloonShift.test.js can play
// whole shifts. src/saloonShiftView.js draws it; src/saloon.js settles the summary (the server never trusts this file: it clamps what a
// shift may report).
//
// - Customers arrive over the first part of the shift and sit at one of SEATS places. Each wants one dish and has a patience bar that runs
//   down. The three stations (the stove, the barrel, the oven) each cook one thing at a time, so what you cook first is the game.
// - COOK a seat's dish at its station; when it is ready SERVE it. Serve while the customer still has half their patience and it is a QUICK
//   serve (a tip). A QUICK serve with nobody having walked out yet is a PERFECT serve (the biggest tip).
// - A customer whose patience runs out walks out: a miss, and the combo starts again.
// - The same night, farm state and seed always give the same shift, so a test can replay it.

export const SHIFT_SECONDS = 120;
export const SEATS = 4;
export const STATIONS = ['stove', 'barrel', 'oven'];
// Seconds a station takes for a dish.
export const COOK_SECONDS = { sarsaparilla: 1.5, beans: 3, cornbread: 4, eggs: 3.5, pie: 5 };
// A customer waiting for a free seat gives up after this long (a miss).
export const SEAT_WAIT = 8;
// Share of a customer's patience that must be left for a serve to be quick.
export const QUICK_SHARE = 0.5;
// Seconds of patience at the start of a night: the later nights are less patient, never under 16.
export const patience = night => Math.max(16, 40 - night * 2);

// A small repeatable random stream (mulberry32), so a night's crowd depends only on the night, the farm and the seed.
function stream(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createShift({ night = 1, farm = false, seed = 1 } = {}) {
    const next = stream(seed * 7919 + night * 104729);
    const dishes = menu(night, farm);
    const total = crowd(night);
    const span = SHIFT_SECONDS * 0.7;
    // Who comes, when, and what they want: spread over the first part of the shift with a little jitter.
    const arrivals = Array.from({ length: total }, (_, i) => ({
        at: Math.max(0, (i * span) / total + (next() - 0.5) * (span / total) * 0.6),
        dish: dishes[Math.floor(next() * dishes.length)].id
    })).sort((a, b) => a.at - b.at);
    const full = patience(night);

    const state = {
        night, time: 0, over: false,
        seats: Array.from({ length: SEATS }, () => null), // { dish, left, cooking: seconds left or null, ready }
        queue: [], // { dish, waited }
        stations: Object.fromEntries(STATIONS.map(s => [s, null])), // { seat, left } while busy
        served: [], missed: 0, combo: 0, bestCombo: 0, pending: arrivals.slice()
    };
    const stationOf = dish => menu(night, true).find(d => d.id === dish).station;

    function seat(customer) {
        const free = state.seats.findIndex(s => s === null);
        if(free < 0) return false;
        state.seats[free] = { dish: customer.dish, left: full, cooking: null, ready: false };
        return true;
    }
    function miss() {
        state.missed++;
        state.combo = 0;
    }
    function finishIfDone() {
        if(!state.pending.length && !state.queue.length && state.seats.every(s => s === null)) state.over = true;
        if(state.time >= SHIFT_SECONDS) state.over = true;
    }

    return {
        state,
        // The seats, as the screen shows them.
        view() {
            return state.seats.map((s, i) => (s ? {
                seat: i, dish: s.dish, station: stationOf(s.dish), share: s.left / full, ready: s.ready, cooking: s.cooking !== null && !s.ready,
                quick: s.left / full >= QUICK_SHARE
            } : null));
        },
        // Start cooking a seat's dish. Returns false when the seat is empty, already cooking or ready, or its station is busy.
        cook(index) {
            const s = state.seats[index];
            if(state.over || !s || s.cooking !== null || s.ready) return false;
            const station = stationOf(s.dish);
            if(state.stations[station]) return false;
            state.stations[station] = { seat: index, left: COOK_SECONDS[s.dish] };
            s.cooking = COOK_SECONDS[s.dish];
            return true;
        },
        // Serve a ready plate. Returns the tip tier (0 plain, 1 quick, 2 perfect), or -1 when there is nothing ready for that seat.
        serve(index) {
            const s = state.seats[index];
            if(state.over || !s || !s.ready) return -1;
            const quick = s.left / full >= QUICK_SHARE;
            const tip = quick ? (state.missed === 0 ? 2 : 1) : 0;
            state.served.push({ dish: s.dish, tip });
            state.combo = quick ? state.combo + 1 : 0;
            state.bestCombo = Math.max(state.bestCombo, state.combo);
            state.seats[index] = null;
            finishIfDone();
            return tip;
        },
        // Move time on by dt seconds (the screen calls this every frame).
        update(dt) {
            if(state.over) return;
            state.time += dt;
            for(const station of STATIONS) {
                const job = state.stations[station];
                if(!job) continue;
                job.left -= dt;
                if(job.left <= 0) {
                    const s = state.seats[job.seat];
                    if(s) { s.ready = true; s.cooking = 0; }
                    state.stations[station] = null;
                }
            }
            state.seats.forEach((s, i) => {
                if(!s) return;
                s.left -= dt;
                if(s.left <= 0) { // walked out: its station frees up
                    for(const station of STATIONS) if(state.stations[station]?.seat === i) state.stations[station] = null;
                    state.seats[i] = null;
                    miss();
                }
            });
            while(state.pending.length && state.pending[0].at <= state.time) state.queue.push({ dish: state.pending.shift().dish, waited: 0 });
            for(const q of state.queue) q.waited += dt;
            state.queue = state.queue.filter(q => {
                if(seat(q)) return false;
                if(q.waited >= SEAT_WAIT) { miss(); return false; }
                return true;
            });
            finishIfDone();
        },
        // What the shift reports to src/saloon.js: { night, served: [{ dish, tip }] }.
        summary() { return { action: 'shift', night, served: state.served.map(s => ({ ...s })) }; },
        get over() { return state.over; }
    };
}
