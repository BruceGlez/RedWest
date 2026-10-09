import { crowd, menu, starNeeds, UPGRADES } from './saloon.js';

// One shift behind Dusty Pete's bar (PLACES.md, section 8). The rules of the game, with no rendering, so tests/saloonShift.test.js can play
// whole shifts. src/saloonShiftView.js draws it; src/saloon.js settles the summary (the server never trusts this file: it clamps what a
// shift may report).
//
// - Customers arrive over the first part of the shift and sit at one of SEATS places. Each wants one dish and has a patience bar that runs
//   down. The three stations (the stove, the barrel, the oven) each cook one thing at a time, so what you cook first is the game.
// - COOK a seat's dish at its station; when it is ready SERVE it. Serve while the customer still has half their patience and it is a QUICK
//   serve (a tip). The third quick serve in a row, and every one after it until the streak breaks, is a PERFECT serve (the biggest tip).
// - A customer whose patience runs out walks out: a miss, and the streak starts again. A slow serve breaks it too.
// - From night 3 customers come in RUSHES: bunches of three within two seconds, wanting different things (docs/design/copper-bit-shift.md, P1, P2).
// - The same night, farm state and seed always give the same shift, so a test can replay it.

export const SHIFT_SECONDS = 120;
// Customers keep arriving over this share of the shift; the last ones are served in the time that is left. A shift ends when the last customer
// has been served or has walked out (the clock only shows SHIFT_SECONDS; nothing is cut off at it). HARD_STOP is only a guard for a stuck shift.
export const ARRIVAL_SHARE = 0.8; // 96 s: tuned with tests/saloonBalance.test.js so a good player is busy to about 100 s
// The first customer of the even stream comes in about now.
const FIRST_AT = 2;
export const HARD_STOP = SHIFT_SECONDS + 40;
// A quick serve is perfect when it makes this many quick serves in a row.
export const STREAK_FOR_BIG_TIP = 3;
// Rushes: how many customers in one, how many seconds a rush spreads over, and where in the arrival span each one lands, by night.
export const RUSH_SIZE = 3;
export const RUSH_SPREAD = 2;
export const RUSH_NIGHT_ONE = 3;
export const RUSHES = night => (night >= 7 ? [0.25, 0.55, 0.85] : night >= RUSH_NIGHT_ONE ? [0.4, 0.85] : []);
export const SEATS = 4;
export const STATIONS = ['stove', 'barrel', 'oven'];
// Seconds a station takes for a dish.
export const COOK_SECONDS = { sarsaparilla: 1.5, beans: 3, cornbread: 4, eggs: 3.5, pie: 5, stew: 4 };
// What the shelf's upgrades do in a shift (docs/design/copper-bit-shift.md, P6), by level bought: how long the stove and the oven take (times
// the dish's COOK_SECONDS), the seats, how many the barrel pours at once, and the extra patience. Level 0 is the plain bar. Nothing here
// touches a dish's price, a tip or the pay ceiling.
export const COOK_FACTOR = { stove: [1, 0.75, 0.55], oven: [1, 0.75, 0.55] };
export const EXTRA_PATIENCE = 3;
const STATION_UPGRADE = { stove: 'stove', oven: 'oven' };
// The levels a shift will believe (own keys, whole numbers, no more than the shelf sells), so a rubbish save cannot make a free kitchen.
export function shiftUpgrades(raw) {
    const out = {};
    for(const u of UPGRADES) out[u.id] = Math.min(u.levels.length, Math.max(0, Math.floor(Number(Object.hasOwn(raw ?? {}, u.id) ? raw[u.id] : 0)) || 0));
    return out;
}
export const seatCount = upgrades => SEATS + (shiftUpgrades(upgrades).stool ? 1 : 0);
export const barrelPours = upgrades => (shiftUpgrades(upgrades).taps ? 2 : 1);
// Seconds a dish takes at its station with these upgrades (the card shows it: "beans 3.0 s to 2.3 s").
export function cookSeconds(dish, station, upgrades) {
    const up = STATION_UPGRADE[station];
    const level = up ? shiftUpgrades(upgrades)[up] : 0;
    return COOK_SECONDS[dish] * (up ? COOK_FACTOR[up][level] : 1);
}
// A customer waiting for a free seat gives up after this long (a miss).
export const SEAT_WAIT = 8;
// Share of a customer's patience that must be left for a serve to be quick.
export const QUICK_SHARE = 0.5;
// Seconds of patience at the start of a night: 28 on night 1, 14 on night 10, never under 14.
export const patience = night => Math.max(14, Math.round(30 - 1.8 * night));

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

// Generates the customer arrival stream for a night. Shared by the flat shift view and the walking kitchen floor.
export function generateArrivals({ night = 1, farm = false, seed = 1 } = {}) {
    const next = stream(seed * 7919 + night * 104729);
    const dishes = menu(night, farm);
    const total = crowd(night);
    const span = SHIFT_SECONDS * ARRIVAL_SHARE;
    const dishAt = () => dishes[Math.floor(next() * dishes.length)];
    // Who comes, when, and what they want. The rushes first: bunches that want at most two things from the same station, so what to cook first is a choice.
    const rushes = RUSHES(night).slice(0, Math.floor(total / RUSH_SIZE));
    const arrivals = [];
    rushes.forEach((share, rush) => {
        let group = [];
        for(let tries = 0; tries < 12; tries++) {
            group = Array.from({ length: RUSH_SIZE }, dishAt);
            if(new Set(group.map(d => d.station)).size > 1 || new Set(dishes.map(d => d.station)).size < 2) break;
        }
        group.forEach((d, i) => arrivals.push({ at: share * span + (i * RUSH_SPREAD) / (RUSH_SIZE - 1) + next() * 0.2, dish: d.id, rush }));
    });
    // The rest arrive evenly over the span with a little jitter.
    const rest = total - arrivals.length;
    const gap = span / Math.max(1, rest - 1);
    for(let i = 0; i < rest; i++) arrivals.push({ at: Math.min(span, Math.max(0, FIRST_AT + (i * (span - FIRST_AT)) / Math.max(1, rest - 1) + (next() - 0.5) * gap * 0.5)), dish: dishAt().id });
    arrivals.sort((a, b) => a.at - b.at);
    return arrivals;
}

export function createShift({ night = 1, farm = false, seed = 1, upgrades = null } = {}) {
    const levels = shiftUpgrades(upgrades);
    const arrivals = generateArrivals({ night, farm, seed });
    const total = crowd(night);
    const full = patience(night) + (levels.cushions ? EXTRA_PATIENCE : 0);
    const pours = barrelPours(levels);

    const state = {
        night, time: 0, over: false,
        seats: Array.from({ length: seatCount(levels) }, () => null), // { dish, left, cooking: seconds left or null, ready }
        queue: [], // { dish, waited }
        stations: Object.fromEntries(STATIONS.map(s => [s, null])), // { seat, left } while the station can take no more (the screen's "busy")
        jobs: Object.fromEntries(STATIONS.map(s => [s, []])), // every job in progress at a station: { seat, left } (the barrel can hold two with the taps)
        served: [], missed: 0, combo: 0, bestCombo: 0, pending: arrivals.slice()
    };
    const stationOf = dish => menu(night, true).find(d => d.id === dish).station;

    function seat(customer) {
        const free = state.seats.findIndex(s => s === null);
        if(free < 0) return false;
        state.seats[free] = { dish: customer.dish, left: full, cooking: null, ready: false };
        return true;
    }
    const capacity = station => (station === 'barrel' ? pours : 1);
    // `state.stations[station]` is the first job once the station is full and null while it has room, as the screen has always read it.
    const settleStation = station => { state.stations[station] = state.jobs[station].length >= capacity(station) ? state.jobs[station][0] : null; };
    function miss() {
        state.missed++;
        state.combo = 0;
    }
    function finishIfDone() {
        if(!state.pending.length && !state.queue.length && state.seats.every(s => s === null)) state.over = true;
        if(state.time >= HARD_STOP) state.over = true;
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
            const seconds = cookSeconds(s.dish, station, levels);
            state.jobs[station].push({ seat: index, left: seconds });
            settleStation(station);
            s.cooking = seconds;
            return true;
        },
        // Serve a ready plate. Returns the tip tier (0 plain, 1 quick, 2 perfect), or -1 when there is nothing ready for that seat.
        serve(index) {
            const s = state.seats[index];
            if(state.over || !s || !s.ready) return -1;
            const quick = s.left / full >= QUICK_SHARE;
            const tip = quick ? (state.combo + 1 >= STREAK_FOR_BIG_TIP ? 2 : 1) : 0;
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
                for(const job of state.jobs[station]) job.left -= dt;
                for(const job of state.jobs[station].filter(j => j.left <= 0)) {
                    const s = state.seats[job.seat];
                    if(s) { s.ready = true; s.cooking = 0; }
                }
                state.jobs[station] = state.jobs[station].filter(j => j.left > 0);
                settleStation(station);
            }
            state.seats.forEach((s, i) => {
                if(!s) return;
                s.left -= dt;
                if(s.left <= 0) { // walked out: its station frees up
                    for(const station of STATIONS) {
                        state.jobs[station] = state.jobs[station].filter(j => j.seat !== i);
                        settleStation(station);
                    }
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
        // What the screen needs to show how the shift is going: served so far against the crowd and the star notches (starNeeds), the streak and how
        // many more quick serves make the next big tip.
        progress() {
            return {
                served: state.served.length, crowd: total, needs: starNeeds(night), stars: state.served.length >= total ? 3 : starNeeds(night).filter(n => state.served.length >= n).length,
                combo: state.combo, bestCombo: state.bestCombo, streakLeft: Math.max(0, STREAK_FOR_BIG_TIP - state.combo), missed: state.missed
            };
        },
        // The upgrades this shift runs with (what the shelf sold, clamped), for the screen to show the extra seat and the like.
        upgrades: levels,
        get seatCount() { return state.seats.length; },
        // What the shift reports to src/saloon.js: { night, served: [{ dish, tip }] }.
        summary() { return { action: 'shift', night, served: state.served.map(s => ({ ...s })) }; },
        get over() { return state.over; }
    };
}
