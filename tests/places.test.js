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

test('the farm and the parlour are registered, and each says its own way in', async () => {
    const { createPlaces: create } = await import('../src/places/index.js');
    const host = { screen: null, profile: () => null, progress: () => null, companion: () => ({}), isCardOpen: () => false };
    const places = create(host);
    assert.deepEqual(places.map(p => p.id).sort(), ['ranch', 'undertaker']);
    assert.equal(places.find(p => p.entrance('enter-ranch')).id, 'ranch');
    assert.equal(places.find(p => p.entrance('undertaker')).id, 'undertaker');
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
