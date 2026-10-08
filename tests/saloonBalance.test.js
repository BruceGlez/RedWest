import test from 'node:test';
import assert from 'node:assert/strict';
import { createShift, SEATS } from '../src/saloonShift.js';
import { starsFor, shiftPay, NIGHTS, PAID_SHIFTS_PER_DAY, SHIFT_PAY_CEILING } from '../src/saloon.js';

// The balance gate for the Copper Bit shift (docs/design/copper-bit-shift.md, P17). A bot plays whole shifts with a fixed pause after every action
// (a tap): it serves what is ready (the customer with the least patience first), otherwise cooks the least patient customer whose station is free.
// A fast human taps about every 1.5 s, a slow one about every 4 s. Every later change to the crowds, patience, rushes, types, regulars or upgrades
// runs against these numbers; if one fails, tune the rules (src/saloonShift.js), not the bot.
const DT = 0.1;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function runBot(night, farm, seed, delay, upgrades = null) {
    const shift = createShift({ night, farm, seed, upgrades });
    let wait = 0, peak = 0;
    while(!shift.over) {
        wait -= DT;
        if(wait <= 0) {
            const seats = shift.view().filter(Boolean);
            const ready = seats.filter(s => s.ready).sort((a, b) => a.share - b.share)[0];
            const next = seats.filter(s => !s.ready && !s.cooking && !shift.state.stations[s.station]).sort((a, b) => a.share - b.share)[0];
            if(ready) { shift.serve(ready.seat); wait = delay; } else if(next) { shift.cook(next.seat); wait = delay; }
        }
        shift.update(DT);
        peak = Math.max(peak, shift.view().filter(Boolean).length);
    }
    const served = shift.summary().served;
    return { stars: starsFor(night, served.length), peak, seconds: shift.state.time, pay: shiftPay(night, served, farm).dollars };
}
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
const results = {}; // computed once: [delay][farm][night] -> list of runs
function runs(delay, farm, night, upgrades = null) {
    const key = `${delay}/${farm}/${night}/${JSON.stringify(upgrades)}`;
    return (results[key] ??= SEEDS.map(seed => runBot(night, farm, seed, delay, upgrades)));
}
const ALL_UPGRADES = { stove: 2, stool: 1, oven: 2, taps: 1, cushions: 1 };

test('a fast player (1.5 s a tap) three-stars the first nights, with or without the farm', () => {
    for(const farm of [false, true]) {
        for(const night of [1, 2, 3]) {
            const threes = runs(1.5, farm, night).filter(r => r.stars === 3).length;
            assert.ok(threes / SEEDS.length >= 0.9, `night ${night} farm ${farm}: ${threes} of ${SEEDS.length} three-star shifts`);
        }
    }
});

test('a slow player (4 s a tap) is kept busy by the crowds: three stars get rare from night 5, are gone from night 7, and from night 7 two stars is the average at best', () => {
    for(const farm of [false, true]) {
        for(let night = 5; night <= NIGHTS; night++) {
            const threes = runs(4, farm, night).filter(r => r.stars === 3).length;
            assert.ok(threes / SEEDS.length <= (night >= 7 ? 0 : 0.4), `night ${night} farm ${farm}: ${threes} of ${SEEDS.length} three-star shifts at 4 s a tap`);
        }
        for(let night = 7; night <= NIGHTS; night++) {
            const average = mean(runs(4, farm, night).map(r => r.stars));
            assert.ok(average <= 2, `night ${night} farm ${farm}: ${average} stars on average`);
        }
        assert.ok(mean(runs(4, farm, 1).map(r => r.stars)) === 3, 'but the first night is always friendly');
    }
});

test('the seats and stations are juggled: at least three customers wait at once from night 5', () => {
    assert.ok(SEATS >= 4);
    for(const farm of [false, true]) {
        for(let night = 5; night <= NIGHTS; night++) {
            for(const delay of [1.5, 4]) assert.ok(Math.max(...runs(delay, farm, night).map(r => r.peak)) >= 3, `night ${night} farm ${farm} delay ${delay}`);
        }
    }
});

test('a played shift fills nearly two minutes', () => {
    for(const delay of [1.5, 4]) {
        const all = [];
        for(let night = 1; night <= NIGHTS; night++) {
            const seconds = runs(delay, true, night).map(r => r.seconds);
            assert.ok(mean(seconds) >= 90, `night ${night} delay ${delay}: ${mean(seconds)} s`);
            all.push(...seconds);
        }
        assert.ok(mean(all) >= 95, `delay ${delay}: a shift lasts ${mean(all).toFixed(1)} s on average`);
        assert.ok(Math.max(...all) <= 125, 'and never drags on');
    }
});

test('the income rule: the best bot shift stays inside the ceiling, so three paid shifts stay under the farm\'s 400', () => {
    let best = 0;
    for(let night = 1; night <= NIGHTS; night++) for(const farm of [false, true]) best = Math.max(best, ...runs(1.5, farm, night).map(r => r.pay));
    assert.ok(best <= SHIFT_PAY_CEILING, `${best}`);
    assert.ok(best * PAID_SHIFTS_PER_DAY < 400);
});

test('upgrades are felt: a fully upgraded slow player does clearly better on the hard nights, and none of them hurts', () => {
    for(const farm of [false, true]) {
        const stars = (up, delay = 4) => [5, 6, 7, 8, 9, 10].reduce((sum, night) => sum + mean(runs(delay, farm, night, up).map(r => r.stars)), 0);
        const plain = stars(null), full = stars(ALL_UPGRADES);
        assert.ok(full >= plain + 3, `farm ${farm}: ${full.toFixed(2)} stars over six nights against ${plain.toFixed(2)} without upgrades`);
        for(const [id, level] of [['stove', 2], ['stool', 1], ['oven', 2], ['taps', 1], ['cushions', 1]]) {
            for(const delay of [1.5, 2.5, 4]) assert.ok(stars({ [id]: level }, delay) >= stars(null, delay) - 0.05, `farm ${farm}: ${id} does not hurt at ${delay} s a tap`);
        }
        // The bot taps one thing at a time, so the stool and the taps (more at once) show only in the rules tests (tests/saloonShift.test.js); the
        // ones that shorten waits or forgive slowness show here.
        for(const [id, level] of [['stove', 2], ['oven', 2], ['cushions', 1]]) {
            const helps = [1.5, 2.5, 4].some(delay => stars({ [id]: level }, delay) > stars(null, delay));
            assert.ok(helps, `farm ${farm}: ${id} helps a bot somewhere`);
        }
    }
});

test('even fully upgraded, a fast player stays inside the pay ceiling and the three-paid-shift day stays under 400', () => {
    let best = 0;
    for(let night = 1; night <= NIGHTS; night++) for(const farm of [false, true]) best = Math.max(best, ...runs(1.5, farm, night, ALL_UPGRADES).map(r => r.pay));
    assert.ok(best <= SHIFT_PAY_CEILING && best * PAID_SHIFTS_PER_DAY < 400, `${best}`);
});
