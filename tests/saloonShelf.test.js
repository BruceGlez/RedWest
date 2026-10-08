import test from 'node:test';
import assert from 'node:assert/strict';
import { changeText, upgradeRows, shelfHtml, shelfNumbersHtml, shelfBuyer } from '../src/saloonShelf.js';
import { UPGRADES, buyUpgrade, saloonAction } from '../src/saloon.js';
import { createSaloonPlace } from '../src/places/saloon.js';
import { createProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';

const T0 = new Date('2026-10-01T08:00:00Z');
function profile(dollars = 0, upgrades = {}) {
    const p = createProfile(T0);
    p.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'dusty-pete')] = 1;
    p.balances.dollars = dollars;
    Object.assign(p.town.saloon.upgrades, upgrades);
    return p;
}
const clone = p => JSON.parse(JSON.stringify(p));

test('the shelf lists every upgrade in order with its next price and what it changes', () => {
    const rows = upgradeRows(profile(1000));
    assert.deepEqual(rows.map(r => r.id), UPGRADES.map(u => u.id));
    assert.deepEqual(rows.map(r => r.price), UPGRADES.map(u => u.levels[0]));
    assert.ok(rows.every(r => r.can && r.change && r.why === ''));
    assert.equal(changeText('stove', 0), 'BEANS 3 s to 2.25 s');
    assert.equal(changeText('stove', 1), 'BEANS 2.25 s to 1.65 s');
    assert.equal(changeText('oven', 0), 'CORNBREAD 4 s to 3 s');
    assert.equal(changeText('stool', 0), '4 seats to 5');
    assert.match(changeText('taps', 0), /2 AT ONCE/);
    assert.match(changeText('cushions', 0), /3 s LONGER/);
    assert.equal(changeText('nonsense', 0), '');
});

test('a button never offers what the rules would refuse, and a bought level moves the row on', () => {
    const states = [profile(0), profile(29), profile(30), profile(500, { stove: 1 }), profile(500, { stove: 2, oven: 2, stool: 1, taps: 1, cushions: 1 }), profile(89, { stove: 1 }), { balances: {}, town: {} }, null];
    for(const p of states) {
        for(const row of upgradeRows(p)) {
            let ok = true;
            try { buyUpgrade(clone(p ?? profile(0)), { id: row.id }, T0); } catch { ok = false; }
            if(p?.stats) assert.equal(row.can, ok, `${row.id} with ${JSON.stringify([p.balances.dollars, p.town.saloon.upgrades])}`);
            assert.equal(row.why === '', row.can);
        }
    }
    const p = profile(500);
    const before = upgradeRows(p).find(r => r.id === 'stove');
    assert.equal(before.price, 30);
    saloonAction(p, { action: 'upgrade', id: 'stove' }, T0);
    const after = upgradeRows(p).find(r => r.id === 'stove');
    assert.deepEqual([after.level, after.price, after.change], [1, 90, 'BEANS 2.25 s to 1.65 s']);
    saloonAction(p, { action: 'upgrade', id: 'stove' }, T0);
    const best = upgradeRows(p).find(r => r.id === 'stove');
    assert.deepEqual([best.level, best.price, best.why, best.can], [2, null, 'BEST', false]);
});

test('the shelf\'s card has a BUY per piece and says what is short; the bar\'s card keeps the numbers without buttons', () => {
    const html = shelfHtml(profile(35));
    assert.match(html, /you have \$35/);
    assert.match(html, /data-buy-upgrade="stove"[^>]*>BUY/);
    assert.match(html, /data-buy-upgrade="stool"[^>]*disabled[^>]*>NOT ENOUGH DOLLARS/);
    assert.equal((html.match(/data-buy-upgrade=/g) ?? []).length, UPGRADES.length);
    const numbers = shelfNumbersHtml(profile(35));
    assert.ok(!numbers.includes('data-buy-upgrade'), 'no buy button on the bar');
    assert.match(numbers, /shelf is by the door/);
    assert.match(numbers, /HOTTER STOVE <b>0\/2<\/b> BEANS 3 s to 2.25 s, \$30/);
    assert.match(shelfHtml(profile(0, { stove: 2 })), /THE BEST/);
    assert.doesNotMatch(shelfHtml(profile(0)), /limited|only \d|hurry|sale|expires/i, 'no scarcity words');
});

const host = (p, wallet, log = []) => ({
    profile: () => p, markVisited: () => {}, wallet, track: x => log.push(['track', x]), toast: (t, bad) => log.push([bad ? 'bad' : 'toast', t]),
    onProfile: next => { p = next; log.push(['profile']); }, act: async (fn, onError) => { try { await fn(); } catch(e) { onError(e.message); } }
});

test('buying from the shelf goes through the wallet\'s saloon call and redraws from the new profile', async () => {
    const log = [], calls = [];
    const p = profile(100);
    const wallet = { saloon: async body => { calls.push(body); const next = clone(p); const result = saloonAction(next, body, T0); return { result, profile: next }; } };
    const place = createSaloonPlace(host(p, wallet, log));
    assert.equal(place.click({ dataset: { buyUpgrade: 'stove' }, hasAttribute: () => false }), true);
    await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(calls, [{ action: 'upgrade', id: 'stove' }]);
    assert.deepEqual(log.find(l => l[0] === 'toast'), ['toast', 'Bought hotter stove for $30.']);
    assert.ok(log.some(l => l[0] === 'track' && l[1] === 'saloon_upgrade'));
    assert.equal(place.click({ dataset: { buyUpgrade: 'constructor' }, hasAttribute: () => false }), true, 'not the shelf\'s goods, but still swallowed');
    assert.equal(calls.length, 1, 'and nothing is sent');
    assert.equal(place.click({ dataset: { plant: 'wheat' }, hasAttribute: () => false }), false);
});

test('a refused purchase shows the shop\'s own words and changes nothing', async () => {
    const log = [];
    const p = profile(5);
    const wallet = { saloon: async body => { const next = clone(p); return { result: saloonAction(next, body, T0), profile: next }; } };
    const place = createSaloonPlace(host(p, wallet, log));
    place.click({ dataset: { buyUpgrade: 'stove' }, hasAttribute: () => false });
    await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(log.filter(l => l[0] !== 'track'), [['bad', 'Not enough bounty dollars.']]);
});

test('the shelf is a card of the saloon, shut with the saloon, and the bar card carries the numbers', () => {
    const open = createSaloonPlace(host(profile(50)));
    assert.match(open.card('shelf'), /THE UPGRADE SHELF/);
    assert.match(open.card('shelf'), /data-buy-upgrade="stove"/);
    assert.match(open.card('bar'), /shelf is by the door/);
    assert.ok(!/data-buy-upgrade/.test(open.card('bar')));
    const shut = createSaloonPlace(host(createProfile(T0)));
    assert.equal(shut.card('shelf'), '');
});
