import test from 'node:test';
import assert from 'node:assert/strict';
import { COOK_FACTOR, EXTRA_PATIENCE, shiftUpgrades, seatCount, barrelPours, cookSeconds, SHIFT_SECONDS, ARRIVAL_SHARE, HARD_STOP, STREAK_FOR_BIG_TIP, RUSH_SIZE, RUSH_SPREAD, RUSHES, SEATS, STATIONS, COOK_SECONDS, QUICK_SHARE, patience, createShift } from '../src/saloonShift.js';
import { crowd, menu, getDish, starNeeds, settleShift, shiftPay, starsFor, NIGHTS } from '../src/saloon.js';
import { createProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const DT = 0.1;
// A player who always cooks the customer with the least patience and serves what is ready at once.
function play(shift, { skill = 1 } = {}) {
    let ticks = 0;
    while(!shift.over && ticks++ < SHIFT_SECONDS * 20) {
        const seats = shift.view().filter(Boolean).sort((a, b) => a.share - b.share);
        for(const s of seats) if(s.ready) shift.serve(s.seat);
        if(skill) for(const s of seats) if(!s.ready && !s.cooking) shift.cook(s.seat);
        shift.update(DT);
    }
    return shift;
}
const idle = shift => { while(!shift.over) shift.update(1); return shift; };

test('a shift is repeatable: the same night, farm and seed give the same crowd', () => {
    const a = play(createShift({ night: 3, farm: true, seed: 5 }));
    const b = play(createShift({ night: 3, farm: true, seed: 5 }));
    assert.deepEqual(a.summary(), b.summary());
    const other = play(createShift({ night: 3, farm: true, seed: 6 }));
    assert.notDeepEqual(other.summary().served.map(s => s.dish), a.summary().served.map(s => s.dish));
});

test('nobody comes for a dish that is not on the menu, and no more than the crowd arrive', () => {
    for(const [night, farm] of [[1, false], [2, false], [3, true], [5, true], [10, false], [10, true]]) {
        const shift = play(createShift({ night, farm, seed: 3 }));
        const ids = new Set(menu(night, farm).map(d => d.id));
        const { served } = shift.summary();
        assert.ok(served.length <= crowd(night), `night ${night}: no more than the crowd`);
        assert.ok(served.every(s => ids.has(s.dish)), `night ${night}: only dishes on the menu`);
        assert.equal(served.length + shift.state.missed, crowd(night), `night ${night}: every customer was served or walked out`);
    }
});

test('an idle player serves nobody, and every customer walks out', () => {
    const shift = idle(createShift({ night: 1, seed: 1 }));
    assert.equal(shift.summary().served.length, 0);
    assert.equal(shift.state.missed, crowd(1));
    assert.ok(shift.state.time <= SHIFT_SECONDS + 1);
});

test('a steady player does well on the first night and earns tips', () => {
    const shift = play(createShift({ night: 1, seed: 1 }));
    const { served } = shift.summary();
    assert.equal(served.length, crowd(1));
    assert.deepEqual(served.map(s => s.tip), [1, 1, 2, 2, 2], 'the first two quick serves are quick, the third on is perfect');
    assert.equal(starsFor(1, served.length), 3);
    assert.equal(shift.state.bestCombo, crowd(1));
});

test('the stations cook one thing at a time: a second dish for the same station has to wait', () => {
    const shift = createShift({ night: 2, seed: 1 });
    while(shift.view().filter(Boolean).length < 2 && !shift.over) shift.update(0.5);
    const seats = shift.view().filter(Boolean);
    const first = seats[0];
    assert.equal(shift.cook(first.seat), true);
    assert.equal(shift.cook(first.seat), false, 'cooking twice does nothing');
    const same = seats.slice(1).find(s => s.station === first.station);
    if(same) assert.equal(shift.cook(same.seat), false, 'the station is busy');
    shift.update(COOK_SECONDS[first.dish] + 0.1);
    assert.equal(shift.view()[first.seat].ready, true);
    if(same) assert.equal(shift.cook(same.seat), true, 'and it is free again once the plate is ready');
});

test('serving needs a ready plate, and a slow serve earns no tip', () => {
    const shift = createShift({ night: 1, seed: 1 });
    while(!shift.view().some(Boolean)) shift.update(0.5);
    const s = shift.view().find(Boolean);
    assert.equal(shift.serve(s.seat), -1, 'nothing is ready yet');
    assert.equal(shift.serve(3), -1, 'nor in an empty seat');
    assert.equal(shift.cook(s.seat), true);
    shift.update(patience(1) * (1 - QUICK_SHARE) + 1); // most of the patience gone, though the plate is ready
    const view = shift.view()[s.seat];
    assert.ok(view && view.ready && !view.quick);
    assert.equal(shift.serve(s.seat), 0);
});

test('a customer who walks out is a miss: the streak starts again, so the next quick serves are only quick', () => {
    const shift = createShift({ night: 1, seed: 2 });
    while(shift.state.missed === 0 && !shift.over) shift.update(1); // nobody is served: the first one walks out
    assert.equal(shift.state.missed, 1);
    assert.equal(shift.state.combo, 0);
    while(!shift.view().some(Boolean) && !shift.over) shift.update(0.5);
    const s = shift.view().find(Boolean);
    if(s) {
        shift.cook(s.seat);
        shift.update(COOK_SECONDS[s.dish] + 0.1);
        assert.equal(shift.serve(s.seat), 1, 'quick, but the first of a new streak');
    }
});

test('the shift ends by the clock and nothing happens after it', () => {
    const shift = idle(createShift({ night: 10, seed: 4 }));
    assert.equal(shift.over, true);
    const before = JSON.stringify(shift.summary());
    shift.update(10);
    assert.equal(shift.cook(0), false);
    assert.equal(shift.serve(0), -1);
    assert.equal(JSON.stringify(shift.summary()), before);
});

test('later nights are harder: shorter patience and bigger crowds', () => {
    assert.ok(patience(1) > patience(5) && patience(5) > patience(10) && patience(NIGHTS) >= 14);
    assert.deepEqual([1, 2, 5, 10].map(patience), [28, 26, 21, 14], 'the design doc\'s table, tuned by the balance bot (tests/saloonBalance.test.js)');
    assert.ok(patience(40) === 14, 'never under 14');
    assert.ok(SEATS >= 3 && STATIONS.length === 3);
});

test('what a shift reports is settled by the rules: the same dishes pay what the shift says, and the server can take every shift', () => {
    for(const [night, farm] of [[1, false], [4, true], [10, true]]) {
        const p = createProfile(T0);
        p.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'dusty-pete')] = 1;
        if(farm) p.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'calloway-gang')] = 1;
        p.town.saloon.nights = Array(NIGHTS).fill(1);
        const summary = play(createShift({ night, farm, seed: 9 })).summary();
        const expected = shiftPay(night, summary.served, farm);
        assert.equal(expected.served, summary.served.length, 'nothing the shift reports is cut');
        const before = p.balances.dollars;
        const result = settleShift(p, summary, T0);
        assert.equal(result.dollars, expected.dollars);
        assert.equal(p.balances.dollars, before + expected.dollars);
    }
});

test('the big tip is the third quick serve in a row, and a slow serve or a walk-out starts the count again', () => {
    assert.equal(STREAK_FOR_BIG_TIP, 3);
    const shift = createShift({ night: 1, seed: 1 });
    const serveOne = wait => { // cook the next customer at once and serve after `wait` seconds of the plate sitting ready
        while(!shift.view().some(Boolean)) shift.update(0.25);
        const s = shift.view().find(Boolean);
        shift.cook(s.seat);
        shift.update(COOK_SECONDS[s.dish] + 0.01 + wait);
        return shift.serve(s.seat);
    };
    assert.deepEqual([serveOne(0), serveOne(0), serveOne(0), serveOne(0)], [1, 1, 2, 2]);
    assert.equal(shift.progress().streakLeft, 0);
    assert.equal(shift.serve(0), -1);
});

test('a miss early in the shift no longer takes the big tip from the rest of it', () => {
    const shift = createShift({ night: 1, seed: 2 });
    while(shift.state.missed === 0) shift.update(1); // the first customer walks out
    const tips = [];
    for(let i = 0; i < 4 && !shift.over; i++) {
        while(!shift.view().some(Boolean) && !shift.over) shift.update(0.25);
        const s = shift.view().find(Boolean);
        if(!s) break;
        shift.cook(s.seat);
        shift.update(COOK_SECONDS[s.dish] + 0.01);
        tips.push(shift.serve(s.seat));
    }
    assert.ok(tips.includes(2), `a streak builds again after a miss: ${tips}`);
});

test('from night 3 customers come in rushes of three that want at most two things from the same station', () => {
    assert.deepEqual([1, 2, 3, 6, 7, 10].map(n => RUSHES(n).length), [0, 0, 2, 2, 3, 3]);
    for(const night of [3, 5, 7, 10]) {
        for(const farm of [false, true]) {
            for(let seed = 1; seed <= 12; seed++) {
                const arrivals = createShift({ night, farm, seed }).state.pending;
                const span = SHIFT_SECONDS * ARRIVAL_SHARE;
                assert.equal(arrivals.length, crowd(night));
                assert.ok(arrivals.every(a => a.at >= 0 && a.at <= span + RUSH_SPREAD + 1), `night ${night}: everyone arrives by the end of the span`);
                for(const share of RUSHES(night)) {
                    const group = arrivals.filter(a => a.rush === RUSHES(night).indexOf(share));
                    assert.equal(group.length, RUSH_SIZE, `night ${night} seed ${seed}: a rush of ${RUSH_SIZE} at ${share}`);
                    assert.ok(group.every(a => a.at >= share * span && a.at <= share * span + RUSH_SPREAD + 0.25), 'within two seconds');
                    const stations = group.map(a => getDish(a.dish).station);
                    assert.ok(new Set(stations).size >= 2, `night ${night} seed ${seed}: the rush does not all want the ${stations[0]}`);
                }
            }
        }
    }
    assert.equal(createShift({ night: 2, seed: 1 }).state.pending.every((a, i, all) => i === 0 || a.at - all[i - 1].at > 0.2), true, 'no rush before night 3');
});

test('the stew is cooked on the stove for four seconds on night 5, with or without the farm', () => {
    assert.equal(COOK_SECONDS.stew, 4);
    const dishes = new Set();
    for(let seed = 1; seed <= 20; seed++) for(const a of createShift({ night: 5, farm: false, seed }).state.pending) dishes.add(a.dish);
    assert.ok(dishes.has('stew') && !dishes.has('pie') && !dishes.has('eggs'));
    const none = new Set();
    for(let seed = 1; seed <= 20; seed++) for(const a of createShift({ night: 4, farm: false, seed }).state.pending) none.add(a.dish);
    assert.ok(!none.has('stew'));
});

test('a shift ends when the last customer is served or gone, and fills the better part of two minutes when played well', () => {
    assert.ok(HARD_STOP > SHIFT_SECONDS);
    for(const night of [1, 5, 10]) {
        const last = Math.max(...createShift({ night, farm: true, seed: 3 }).state.pending.map(a => a.at));
        assert.ok(last <= SHIFT_SECONDS * ARRIVAL_SHARE + 1, 'the last customer arrives by the end of the span');
        const shift = play(createShift({ night, farm: true, seed: 3 }));
        assert.ok(shift.over && shift.state.time <= HARD_STOP);
        assert.ok(shift.state.time >= last, `night ${night}: lasts at least until the last customer arrives (${shift.state.time})`);
    }
});

test('progress tells the screen how the shift is going', () => {
    const shift = createShift({ night: 7, seed: 1 });
    assert.deepEqual(shift.progress(), { served: 0, crowd: 11, needs: starNeeds(7), stars: 0, combo: 0, bestCombo: 0, streakLeft: 3, missed: 0 });
    assert.deepEqual(starNeeds(7), [6, 9, 11]);
    const done = play(createShift({ night: 1, seed: 1 }));
    assert.equal(done.progress().stars, 3);
    assert.equal(done.progress().served, crowd(1));
});

const ALL = { stove: 2, stool: 1, oven: 2, taps: 1, cushions: 1 };

test('what the shift believes about upgrades: own keys, whole levels, no more than the shelf sells', () => {
    assert.deepEqual(shiftUpgrades(null), { stove: 0, stool: 0, oven: 0, taps: 0, cushions: 0 });
    assert.deepEqual(shiftUpgrades({ stove: 9, oven: -1, taps: 'x', stool: 1.9, cushions: null, free: 5 }), { stove: 2, stool: 1, oven: 0, taps: 0, cushions: 0 });
    assert.equal(shiftUpgrades(Object.create({ stove: 2 })).stove, 0, 'only own keys');
    assert.equal(shiftUpgrades('stove').stove, 0);
});

test('the stove and the oven cook faster by the level bought, and only their own dishes', () => {
    assert.equal(cookSeconds('beans', 'stove', null), COOK_SECONDS.beans);
    assert.equal(cookSeconds('beans', 'stove', { stove: 1 }), COOK_SECONDS.beans * COOK_FACTOR.stove[1]);
    assert.ok(Math.abs(cookSeconds('beans', 'stove', { stove: 1 }) - 2.25) < 1e-9 && Math.abs(cookSeconds('beans', 'stove', { stove: 2 }) - 1.65) < 1e-9);
    assert.ok(Math.abs(cookSeconds('pie', 'oven', { oven: 2 }) - 2.75) < 1e-9 && Math.abs(cookSeconds('cornbread', 'oven', { oven: 1 }) - 3) < 1e-9);
    assert.equal(cookSeconds('beans', 'stove', { oven: 2, taps: 1 }), COOK_SECONDS.beans, 'the oven does not help the stove');
    assert.equal(cookSeconds('sarsaparilla', 'barrel', ALL), COOK_SECONDS.sarsaparilla, 'the barrel\'s time does not change');
    assert.equal(cookSeconds('stew', 'stove', { stove: 2 }), COOK_SECONDS.stew * 0.55);
    const shift = createShift({ night: 1, seed: 1, upgrades: { stove: 2 } });
    while(!shift.view().some(s => s?.station === 'stove')) shift.update(0.25);
    const s = shift.view().find(c => c?.station === 'stove');
    shift.cook(s.seat);
    shift.update(COOK_SECONDS[s.dish] * 0.55 + 0.01);
    assert.equal(shift.view()[s.seat].ready, true, 'ready after the shorter time');
});

test('the extra stool, the taps and the cushions change the seats, the barrel and the patience', () => {
    assert.equal(seatCount(null), SEATS);
    assert.equal(seatCount({ stool: 1 }), SEATS + 1);
    assert.equal(createShift({ night: 1, upgrades: { stool: 1 } }).state.seats.length, SEATS + 1);
    assert.equal(createShift({ night: 1, upgrades: { stool: 1 } }).seatCount, SEATS + 1);
    assert.equal(createShift({ night: 1 }).state.seats.length, SEATS);
    assert.equal(barrelPours(null), 1);
    assert.equal(barrelPours({ taps: 1 }), 2);
    const first = up => {
        const shift = createShift({ night: 1, seed: 1, upgrades: up });
        while(!shift.view().some(Boolean)) shift.update(0.25);
        return shift.view().find(Boolean).share;
    };
    assert.equal(first(null) <= 1, true);
    const plain = createShift({ night: 1, seed: 1 });
    const soft = createShift({ night: 1, seed: 1, upgrades: { cushions: 1 } });
    for(const sh of [plain, soft]) while(!sh.view().some(Boolean)) sh.update(0.25);
    const left = sh => sh.state.seats.find(Boolean).left;
    assert.ok(Math.abs(left(soft) - left(plain) - EXTRA_PATIENCE) < 1e-9, 'three more seconds of patience');
});

test('with the taps the barrel pours two at once, and the stove still takes one', () => {
    const drinks = (up, want) => {
        const shift = createShift({ night: 1, seed: 1, upgrades: up });
        shift.state.seats[0] = { dish: 'sarsaparilla', left: 28, cooking: null, ready: false };
        shift.state.seats[1] = { dish: 'sarsaparilla', left: 28, cooking: null, ready: false };
        shift.state.seats[2] = { dish: 'sarsaparilla', left: 28, cooking: null, ready: false };
        return [shift.cook(0), shift.cook(1), shift.cook(2), shift];
    };
    assert.deepEqual(drinks(null).slice(0, 3), [true, false, false]);
    const [a, b, c, shift] = drinks({ taps: 1 });
    assert.deepEqual([a, b, c], [true, true, false], 'two at once, the third waits');
    assert.ok(shift.state.stations.barrel, 'the screen reads the barrel as busy once it is full');
    shift.update(COOK_SECONDS.sarsaparilla + 0.01);
    assert.equal(shift.view()[0].ready && shift.view()[1].ready, true);
    assert.equal(shift.state.stations.barrel, null);
    assert.equal(shift.cook(2), true, 'free again');
});

test('a customer who walks out frees only their own job at the barrel', () => {
    const shift = createShift({ night: 1, seed: 1, upgrades: { taps: 1 } });
    shift.state.seats[0] = { dish: 'sarsaparilla', left: 0.05, cooking: null, ready: false };
    shift.state.seats[1] = { dish: 'sarsaparilla', left: 28, cooking: null, ready: false };
    shift.cook(0);
    shift.cook(1);
    shift.update(0.1);
    assert.equal(shift.state.seats[0], null);
    assert.deepEqual(shift.state.jobs.barrel.map(j => j.seat), [1]);
    assert.equal(shift.state.stations.barrel, null, 'room for one more');
});

test('upgrades never change what a dish pays or what a shift may report', () => {
    const plain = play(createShift({ night: 10, farm: true, seed: 2 })).summary();
    const upgraded = play(createShift({ night: 10, farm: true, seed: 2, upgrades: ALL })).summary();
    assert.equal(upgraded.action, 'shift');
    assert.deepEqual(Object.keys(upgraded), Object.keys(plain));
    assert.ok(shiftPay(10, upgraded.served, true).dollars <= 130);
    assert.equal(createShift({ night: 4, seed: 3, upgrades: ALL }).state.pending.length, crowd(4));
    assert.deepEqual(createShift({ night: 4, seed: 3, upgrades: ALL }).state.pending, createShift({ night: 4, seed: 3 }).state.pending, 'the same crowd comes');
});
