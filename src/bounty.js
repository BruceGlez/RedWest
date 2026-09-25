import { heatMultiplier } from './heat.js';

// The outlaw's bounty is only paid when the player leaves the fight: bank it immediately,
// or ride on into the bonus pursuit and collect it on escape. Dying while riding on forfeits
// the bounty and everything earned after the outlaw fell.
export const OUTLAW_BOUNTY = 50;
export const FINAL_PURSUIT = 3;
export const BONUS_PURSUIT_SECONDS = 30;

export function createBountyState() {
    return { status: 'none', amount: 0, heatAtOffer: 0, scoreAtRideOn: 0 };
}

export function offerBounty(bounty, heatLevel) {
    bounty.status = 'offered';
    bounty.heatAtOffer = heatLevel;
    bounty.amount = Math.round(OUTLAW_BOUNTY * heatMultiplier(heatLevel));
    return bounty.amount;
}

export function bankBounty(bounty, score) {
    if(bounty.status !== 'offered') return score;
    bounty.status = 'banked';
    return score + bounty.amount;
}

export function rideOn(bounty, score) {
    if(bounty.status !== 'offered') return;
    bounty.status = 'riding';
    bounty.scoreAtRideOn = score;
}

export function escapeWithBounty(bounty, score) {
    if(bounty.status !== 'riding') return score;
    bounty.status = 'escaped';
    return score + bounty.amount;
}

export function forfeitBounty(bounty, score) {
    if(bounty.status !== 'riding') return score;
    bounty.status = 'forfeited';
    return bounty.scoreAtRideOn;
}
