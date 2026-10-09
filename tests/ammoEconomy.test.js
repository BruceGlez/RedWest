import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createAmmoState,
    consumeAmmo,
    addAmmo,
    hasAmmo,
    createLootCrate,
    isNearCrate,
    lootCrate,
    buyStoreAmmo,
    STARTING_AMMO,
    MAX_AMMO_CAPACITY,
    AMMO_STORE_ITEM
} from '../src/ammoEconomy.js';

test('createAmmoState initializes with default starting ammo and capacity', () => {
    const state = createAmmoState();
    assert.equal(state.current, STARTING_AMMO);
    assert.equal(state.max, MAX_AMMO_CAPACITY);
    assert.equal(state.shotsFired, 0);
    assert.equal(state.cratesLooted, 0);
    assert.equal(hasAmmo(state), true);
});

test('consumeAmmo decrements bullets and tracks shots fired', () => {
    const state = createAmmoState(5);
    assert.equal(consumeAmmo(state, 1), true);
    assert.equal(state.current, 4);
    assert.equal(state.shotsFired, 1);

    assert.equal(consumeAmmo(state, 4), true);
    assert.equal(state.current, 0);
    assert.equal(state.shotsFired, 5);
    assert.equal(hasAmmo(state), false);

    // Dry fire when empty
    assert.equal(consumeAmmo(state, 1), false);
    assert.equal(state.current, 0);
    assert.equal(state.shotsFired, 5);
});

test('addAmmo respects maximum capacity limits', () => {
    const state = createAmmoState(20, 50);
    const added = addAmmo(state, 20);
    assert.equal(added, 20);
    assert.equal(state.current, 40);

    const overflow = addAmmo(state, 20);
    assert.equal(overflow, 10);
    assert.equal(state.current, 50);
});

test('lootCrate gives ammo to player and marks crate opened', () => {
    const ammoState = createAmmoState(10);
    const crate = createLootCrate('crate-1', 10, 20, { type: 'ammo', amount: 15 });

    assert.equal(crate.opened, false);
    assert.equal(isNearCrate(crate, 10, 21), true);
    assert.equal(isNearCrate(crate, 50, 50), false);

    const res = lootCrate(crate, ammoState);
    assert.equal(res.success, true);
    assert.equal(res.type, 'ammo');
    assert.equal(res.amount, 15);
    assert.equal(crate.opened, true);
    assert.equal(ammoState.current, 25);
    assert.equal(ammoState.cratesLooted, 1);

    // Opening again fails
    const reOpen = lootCrate(crate, ammoState);
    assert.equal(reOpen.success, false);
});

test('lootCrate restores health to playerStats', () => {
    const playerStats = { hp: 2, maxHp: 5 };
    const crate = createLootCrate('crate-hp', 0, 0, { type: 'health', amount: 2 });
    const res = lootCrate(crate, null, playerStats);
    assert.equal(res.success, true);
    assert.equal(playerStats.hp, 4);
});

test('buyStoreAmmo uses wallet to purchase reserve ammo rounds', () => {
    let dollars = 20;
    const wallet = {
        balance: () => dollars,
        pay: cost => {
            if(dollars >= cost.dollars) {
                dollars -= cost.dollars;
                return true;
            }
            return false;
        }
    };

    const buy1 = buyStoreAmmo(wallet, 0);
    assert.equal(buy1.success, true);
    assert.equal(buy1.reserve, AMMO_STORE_ITEM.rounds);
    assert.equal(dollars, 5);

    // Second purchase fails due to insufficient funds
    const buy2 = buyStoreAmmo(wallet, buy1.reserve);
    assert.equal(buy2.success, false);
    assert.equal(buy2.reason, 'insufficient-funds');
    assert.equal(buy2.reserve, 30);
});
