import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIFT_SECONDS, SEATS, STATIONS, COOK_SECONDS, QUICK_SHARE, patience, createShift } from '../src/saloonShift.js';
import { crowd, menu, settleShift, shiftPay, starsFor, NIGHTS } from '../src/saloon.js';
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
    assert.ok(served.every(s => s.tip === 2), 'quick serves with nobody walking out are perfect tips');
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

test('a customer who walks out is a miss: the combo starts again and no later tip is perfect', () => {
    const shift = createShift({ night: 1, seed: 2 });
    while(shift.state.missed === 0 && !shift.over) shift.update(1); // nobody is served: the first one walks out
    assert.equal(shift.state.missed, 1);
    assert.equal(shift.state.combo, 0);
    while(!shift.view().some(Boolean) && !shift.over) shift.update(0.5);
    const s = shift.view().find(Boolean);
    if(s) {
        shift.cook(s.seat);
        shift.update(COOK_SECONDS[s.dish] + 0.1);
        assert.equal(shift.serve(s.seat), 1, 'quick, but not perfect after a miss');
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
    assert.ok(patience(1) > patience(5) && patience(5) > patience(10) && patience(NIGHTS) >= 16);
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
