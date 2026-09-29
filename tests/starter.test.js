import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, getProduct, nuggetsInMoney } from '../src/products.js';
import { SHOP_ITEMS } from '../src/cosmetics.js';
import { createProfile, grantProduct, restoreProduct, buyItem, ownsItem } from '../src/profile.js';

const kit = getProduct('starter_pack');

test("the Deputy's Kit gives its items and nuggets once, and its content is fixed", () => {
    const p = createProfile();
    assert.equal(grantProduct(p, kit, 'rc:1'), true);
    assert.equal(p.balances.nuggets, kit.nuggets);
    for(const id of kit.items) assert.ok(ownsItem(p, id), id);
    assert.equal(grantProduct(p, kit, 'rc:1'), false, 'the same transaction twice');
    grantProduct(p, kit, 'stripe:2');
    assert.equal(p.balances.nuggets, kit.nuggets, 'a second purchase never pays the nuggets again');
    assert.deepEqual(p.bought, ['starter_pack']);
});

test('restoring on a new device brings back the items, not the nuggets', () => {
    const p = createProfile();
    restoreProduct(p, kit);
    assert.equal(p.balances.nuggets, 0);
    for(const id of kit.items) assert.ok(ownsItem(p, id), id);
});

test('kit items cannot be bought separately', () => {
    const p = createProfile();
    p.balances = { dollars: 1e9, nuggets: 1e9 };
    for(const id of kit.items) assert.throws(() => buyItem(p, id), { code: 'earned' });
});

test('nugget prices fit the packs, so nobody is pushed to buy more than they need', () => {
    const packs = PRODUCTS.filter(p => p.kind === 'nuggets').map(p => p.nuggets);
    for(const item of SHOP_ITEMS.filter(i => i.currency === 'nuggets')) {
        assert.ok(packs[0] % item.price === 0, `${item.id} (${item.price}) divides the smallest pack (${packs[0]})`);
    }
});

test('every nugget price has a real-money estimate', () => {
    assert.equal(nuggetsInMoney(100), '$0.99');
    assert.equal(nuggetsInMoney(50), '$0.50');
});
