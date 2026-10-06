import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPlace, createPlaces, clearPlaces } from '../src/places/registry.js';

test('createPlaces builds one instance per registered place, each given the host', () => {
    clearPlaces();
    const seen = [];
    registerPlace(host => { seen.push(host); return { id: 'a', entrance: id => id === 'door-a' }; });
    registerPlace(host => { seen.push(host); return { id: 'b', entrance: id => id === 'door-b' }; });
    const host = { marker: true };
    const places = createPlaces(host);
    assert.deepEqual(places.map(p => p.id), ['a', 'b']);
    assert.deepEqual(seen, [host, host]);
    assert.equal(places.find(p => p.entrance('door-b')).id, 'b');
    assert.equal(places.find(p => p.entrance('nowhere')), undefined);
    clearPlaces();
});

test('registerPlace only takes a factory', () => {
    assert.throws(() => registerPlace({ id: 'x' }), /factory/);
});

test('the farm, the parlour, the cellar and the store are registered, and each says its own way in', async () => {
    const { createPlaces: create } = await import('../src/places/index.js');
    const host = { screen: null, profile: () => null, progress: () => null, companion: () => ({}), isCardOpen: () => false };
    const places = create(host);
    assert.deepEqual(places.map(p => p.id).sort(), ['canal', 'cellar', 'chapel', 'copper', 'crossing', 'ranch', 'store', 'undertaker']);
    assert.equal(places.find(p => p.entrance('enter-ranch')).id, 'ranch');
    assert.equal(places.find(p => p.entrance('enter-crossing')).id, 'crossing');
    assert.equal(places.find(p => p.entrance('enter-canal')).id, 'canal');
    assert.equal(places.find(p => p.entrance('enter-copper')).id, 'copper');
    assert.equal(places.find(p => p.entrance('enter-chapel')).id, 'chapel');
    assert.equal(places.find(p => p.entrance('undertaker')).id, 'undertaker');
    assert.equal(places.find(p => p.entrance('store')).id, 'store');
    assert.equal(places.find(p => p.entrance('train')), undefined);
    for(const p of places) {
        assert.equal(p.canEnter(), false, `${p.id} cannot be entered before the profile has loaded`);
        assert.equal(p.click({ dataset: {}, hasAttribute: () => false }), false, `${p.id} ignores buttons that are not its own`);
    }
});

test('the parlour card names Mr. Grimsby and ignores other doors', async () => {
    const { createUndertakerPlace } = await import('../src/places/undertaker.js');
    const place = createUndertakerPlace({ progress: () => ({ stars: [1, 0, 0] }), profile: () => ({}) });
    assert.match(place.card('grimsby'), /MR\. GRIMSBY/);
    assert.equal(place.card('anything-else'), '');
});

test('a farm button runs the wallet, hands the new profile back and says what happened', async () => {
    const { createFarmPlace } = await import('../src/places/farm.js');
    const calls = [];
    const newProfile = { marker: 'new' };
    const host = {
        profile: () => ({ town: { farm: { plots: [], store: {} } }, stats: { stageStars: [] } }),
        wallet: { farm: async body => { calls.push(['wallet', body]); return { profile: newProfile, result: { dollars: 12 } }; } },
        onProfile: profile => calls.push(['profile', profile]),
        track: event => calls.push(['track', event]),
        toast: (text, error) => calls.push(['toast', text, !!error]),
        closeCard: () => calls.push(['close']),
        act: async (work, onError) => { try { await work(); } catch(error) { onError(error.message, true); } }
    };
    const place = createFarmPlace(host);
    const handled = place.click({ dataset: { sell: 'all' }, hasAttribute: () => false });
    assert.equal(handled, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, [
        ['close'],
        ['wallet', { action: 'sell', good: 'all' }],
        ['profile', newProfile],
        ['track', 'farm_sell'],
        ['toast', 'Sold for $12.', false]
    ]);
});

test('a farm action that the wallet refuses is told to the player as an error toast', async () => {
    const { createFarmPlace } = await import('../src/places/farm.js');
    const toasts = [];
    const host = {
        profile: () => ({}), closeCard: () => {}, track: () => {}, onProfile: () => {},
        wallet: { farm: async () => { throw new Error('Nothing to sell.'); } },
        toast: (text, error) => toasts.push([text, !!error]),
        act: async (work, onError) => { try { await work(); } catch(error) { onError(error.message, true); } }
    };
    createFarmPlace(host).click({ dataset: { sell: 'wheat' }, hasAttribute: () => false });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(toasts, [['Nothing to sell.', true]]);
});
