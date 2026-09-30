import test from 'node:test';
import assert from 'node:assert/strict';
import { featureOn, FEATURES } from '../src/townFeatures.js';

test('both town features are on by default and are separate switches', () => {
    assert.deepEqual(FEATURES, ['look', 'walk']);
    assert.equal(featureOn('look', '', {}), true);
    assert.equal(featureOn('walk', '', {}), true);
});

test('a URL parameter turns one feature off without touching the other', () => {
    assert.equal(featureOn('look', '?look=off', {}), false);
    assert.equal(featureOn('walk', '?look=off', {}), true);
    assert.equal(featureOn('walk', '?walk=0&look=on', {}), false);
    assert.equal(featureOn('look', '?walk=0&look=on', {}), true);
});

test('the last choice is remembered, and the URL beats it for that page load', () => {
    assert.equal(featureOn('walk', '', { walk: false }), false);
    assert.equal(featureOn('look', '', { walk: false }), true);
    assert.equal(featureOn('walk', '?walk=on', { walk: false }), true);
});
