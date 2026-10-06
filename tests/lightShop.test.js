import test from 'node:test';
import assert from 'node:assert/strict';
import { shopRows, kitLine, lightShopHtml } from '../src/lightShop.js';
import { LIGHT_ITEMS, OIL_CAPACITY, CARRY_LIMIT, MATCH_LIMIT, SHOP_MARKUP, priceOf, buyLight } from '../src/mineLight.js';
import { createUndertakerPlace } from '../src/places/undertaker.js';
import { createProfile } from '../src/profile.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const profile = ({ dollars = 500, light = {}, nuggets = 0 } = {}) => {
    const p = createProfile(T0);
    p.balances.dollars = dollars;
    p.balances.nuggets = nuggets;
    Object.assign(p.mine.light, light);
    return p;
};
const row = (rows, id) => rows.find(r => r.id === id);

test('the shop sells the four things, in dollars, at the prices the rules give', () => {
    const rows = shopRows(profile(), 'grimsby');
    assert.deepEqual(rows.map(r => r.id), ['lantern', 'oil', 'torches', 'matches']);
    for(const r of rows) {
        assert.equal(r.price, LIGHT_ITEMS[r.id].dollars, `${r.id} at Mr. Grimsby's is the listed price`);
        assert.ok(Number.isInteger(r.price) && r.price > 0);
        assert.deepEqual(Object.keys(r).sort(), ['blurb', 'can', 'id', 'name', 'price', 'why'], 'a row has a dollar price and nothing else');
    }
});

test('the general store charges a little more and sells nothing else different', () => {
    const grimsby = shopRows(profile(), 'grimsby');
    const store = shopRows(profile(), 'store');
    for(let i = 0; i < 4; i++) {
        assert.equal(store[i].id, grimsby[i].id);
        assert.equal(store[i].price, priceOf(store[i].id, 'store'));
        assert.ok(store[i].price >= grimsby[i].price && store[i].price <= Math.ceil(grimsby[i].price * SHOP_MARKUP.store));
    }
    assert.ok(store.some((r, i) => r.price > grimsby[i].price));
});

test('light is never priced in nuggets: spending shows in dollars only and the card never says nuggets', () => {
    const p = profile({ dollars: 500, nuggets: 777 });
    const html = lightShopHtml(p, 'grimsby');
    assert.ok(!/nugget|gold|real money|◆/i.test(html), 'the card names no other currency');
    assert.match(html, /Bounty Dollars only/);
    const before = JSON.stringify(p.balances);
    buyLight(p, 'lantern', 'grimsby');
    assert.equal(p.balances.nuggets, 777);
    assert.equal(p.balances.dollars, 500 - LIGHT_ITEMS.lantern.dollars);
    assert.notEqual(JSON.stringify(p.balances), before);
    // And with nuggets but no dollars nothing can be bought.
    const nuggetsOnly = profile({ dollars: 0, nuggets: 9999 });
    assert.ok(shopRows(nuggetsOnly).every(r => !r.can));
    assert.equal(row(shopRows(nuggetsOnly), 'lantern').why, 'NOT ENOUGH DOLLARS');
});

test('a button is offered exactly when the rules would take the sale (the same refusals)', () => {
    const states = [
        profile(), profile({ dollars: 0 }), profile({ dollars: 59 }), profile({ dollars: 60 }),
        profile({ light: { lantern: true, oil: 100 } }), profile({ light: { lantern: true, oil: OIL_CAPACITY } }),
        profile({ light: { torches: CARRY_LIMIT } }), profile({ light: { torches: CARRY_LIMIT - 1 } }),
        profile({ light: { matches: MATCH_LIMIT } }), profile({ dollars: 4 }), profile({ dollars: 5, light: { lantern: true, oil: 0 } })
    ];
    for(const shop of ['grimsby', 'store']) {
        for(const p of states) {
            for(const r of shopRows(p, shop)) {
                let ok = true;
                try { buyLight(JSON.parse(JSON.stringify(p)), r.id, shop); } catch { ok = false; }
                assert.equal(r.can, ok, `${shop} ${r.id} with ${JSON.stringify([p.balances.dollars, p.mine.light])}`);
                assert.equal(r.why === '', r.can);
            }
        }
    }
});

test('the kit line says what he has', () => {
    assert.equal(kitLine(profile()), 'NO LANTERN, 0 TORCHES, 0 MATCHES');
    assert.equal(kitLine(profile({ light: { lantern: true, oil: 900, torches: 1, matches: 5 } })), 'LANTERN: 15m OF OIL, 1 TORCH, 5 MATCHES');
    assert.equal(kitLine({}), 'NO LANTERN, 0 TORCHES, 0 MATCHES', 'an unloaded profile has an empty kit');
});

function host(p, wallet, calls = []) {
    return {
        profile: () => p, progress: () => ({ stars: [] }), closeCard: () => calls.push(['close']), openBuilding: id => calls.push(['open', id]),
        onProfile: next => calls.push(['profile', next]), track: e => calls.push(['track', e]), toast: (t, err) => calls.push(['toast', t, !!err]),
        act: async (work, onError) => { try { await work(); } catch(error) { onError(error.message); } }, wallet
    };
}
const click = (place, dataset) => place.click({ dataset, hasAttribute: () => false });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Mr. Grimsby\'s card carries the shop, with his name, his line and the BUY buttons', () => {
    const html = createUndertakerPlace(host(profile(), {})).card('grimsby');
    assert.match(html, /MR\. GRIMSBY/);
    assert.equal((html.match(/data-buy-light=/g) ?? []).length, 4);
    assert.match(html, /data-buy-light="lantern" data-shop="grimsby">BUY/);
    assert.match(html, /data-buy-light="oil" data-shop="grimsby" disabled>NEEDS A LANTERN/);
    assert.equal(createUndertakerPlace(host(null, {})).card('grimsby').includes('data-buy-light'), false, 'no profile, no shop');
    assert.equal(createUndertakerPlace(host(profile(), {})).card('nowhere'), '');
});

test('BUY runs the wallet, hands the new profile back, says what was bought, and leaves the card open', async () => {
    const calls = [];
    const wallet = { buyLight: async body => { calls.push(['wallet', body]); return { result: { id: body.item, price: 60 }, profile: { marker: 'new' } }; } };
    const place = createUndertakerPlace(host(profile(), wallet, calls));
    assert.equal(click(place, { buyLight: 'lantern', shop: 'grimsby' }), true);
    await settle();
    assert.deepEqual(calls, [['wallet', { item: 'lantern', shop: 'grimsby' }], ['profile', { marker: 'new' }], ['track', 'light_buy'], ['toast', 'Bought lantern for $60.', false]]);
});

test('a refused sale is told as an error toast; an unknown item or another button is not sold or taken', async () => {
    const calls = [];
    const wallet = { buyLight: async () => { throw new Error('Not enough bounty dollars.'); } };
    const place = createUndertakerPlace(host(profile(), wallet, calls));
    click(place, { buyLight: 'oil', shop: 'grimsby' });
    await settle();
    assert.deepEqual(calls.at(-1), ['toast', 'Not enough bounty dollars.', true]);
    calls.length = 0;
    assert.equal(click(place, { buyLight: 'diamonds', shop: 'grimsby' }), true, 'the shop swallows what it does not sell');
    assert.equal(click(place, {}), false);
    await settle();
    assert.deepEqual(calls, [], 'nothing was asked of the wallet');
});

test('before the wallet can sell light the shop says so instead of failing', async () => {
    const calls = [];
    click(createUndertakerPlace(host(profile(), {}, calls)), { buyLight: 'lantern', shop: 'grimsby' });
    await settle();
    assert.deepEqual(calls, [['toast', 'The shop is not open yet.', true]]);
});
