import test from 'node:test';
import assert from 'node:assert/strict';
import { createBountyState, offerBounty, bankBounty, rideOn, escapeWithBounty, forfeitBounty, OUTLAW_BOUNTY } from '../src/bounty.js';
import { heatMultiplier } from '../src/heat.js';

test('the bounty scales with Heat when the outlaw falls', () => {
    assert.equal(offerBounty(createBountyState(), 0), OUTLAW_BOUNTY);
    assert.equal(offerBounty(createBountyState(), 4), OUTLAW_BOUNTY * heatMultiplier(4));
});

test('banking pays the bounty immediately and only once', () => {
    const bounty = createBountyState();
    offerBounty(bounty, 2);
    const score = bankBounty(bounty, 100);
    assert.equal(score, 200);
    assert.equal(bounty.status, 'banked');
    assert.equal(bankBounty(bounty, score), score);
});

test('riding on pays the bounty on escape and keeps bonus score', () => {
    const bounty = createBountyState();
    offerBounty(bounty, 1);
    rideOn(bounty, 100);
    assert.equal(escapeWithBounty(bounty, 160), 235);
    assert.equal(bounty.status, 'escaped');
});

test('dying while riding on forfeits the bounty and bonus score', () => {
    const bounty = createBountyState();
    offerBounty(bounty, 3);
    rideOn(bounty, 100);
    assert.equal(forfeitBounty(bounty, 180), 100);
    assert.equal(bounty.status, 'forfeited');
});

test('dying before the outlaw falls leaves the score alone', () => {
    assert.equal(forfeitBounty(createBountyState(), 80), 80);
});
