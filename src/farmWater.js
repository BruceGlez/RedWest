import { OUTLAWS } from './outlaws.js';

// Morgan's Channel waters Calloway Farm (PLACES.md, step H2). The rules are here with no rendering, so the server, the offline
// wallet and the scenes all use the same numbers (tests/farmWater.test.js).
//
// - The Channel opens with the first star on Mad Mesa Morgan and reads nothing else about him.
// - While it is open and the farm is open, crops grow 10% sooner ("watered"): a crop that takes 20 minutes takes 18. Nothing else on
//   the farm changes (the egg basket and the stand's prices are the farm's own), and it never touches combat.
// - It is a link and only a bonus: with either end shut the farm grows at its normal speed, exactly as it does alone.
// - Nothing is timed for pay and nothing is bought with real money: the water is simply there.

export const CHANNEL_OUTLAW = 'mesa-morgan';
// How long a watered crop takes, as a share of its normal time.
export const WATER_FACTOR = 0.9;

const CHANNEL_INDEX = OUTLAWS.findIndex(o => o.id === CHANNEL_OUTLAW);

export function channelOpen(profile) {
    return ((profile.stats?.stageStars?.[CHANNEL_INDEX]) & 1) !== 0;
}

// What the Channel does for a crop: its growing time in minutes, watered or not.
export const growMinutes = (crop, watered) => (watered ? crop.minutes * WATER_FACTOR : crop.minutes);
