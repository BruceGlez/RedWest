import { STAR_DEFEATED } from './progress.js';

// The Arena: practice fights that save nothing (no progress, stars, run log, earnings or leaderboard entries). It is a place in
// Frontier Town (src/townPanel.js). Boss fights are one of its options; the list of options lives here so more can be added.
// A boss opens in the Arena once you have beaten them on the Wanted Road (the first star, the same rule the jail and the
// districts use). Opening the game with ?arena shows the same list as a full screen, for testing; ?arena=all unlocks every boss.
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export const ARENA_MODES = [
    { id: 'bosses', name: 'BOSS FIGHTS', blurb: 'Fight an outlaw you have beaten on the Wanted Road.' }
];

export const arena = {
    enabled: params.has('arena'),     // the run being started or played is an Arena run
    unlockAll: params.get('arena') === 'all',
    fromTown: false,                  // started from the town's Arena (it ends with the run); ?arena stays on
    mode: 'bosses',
    outlaw: 0,
    invincible: false, // hearts refill, so every attack can be watched safely
    gang: false // also send the outlaw's gang, as in a real final pursuit
};

// Has the player beaten this outlaw on the Wanted Road? (`progress.stars[i]` is a bit mask; the first bit is "defeated".)
export function bossBeaten(progress, index) {
    return (((progress?.stars?.[index]) | 0) & STAR_DEFEATED) !== 0;
}

// Every outlaw with whether the Arena lets you fight them yet.
export function arenaRoster(progress, outlaws, { unlockAll = false } = {}) {
    return outlaws.map((outlaw, index) => ({ index, outlaw, unlocked: unlockAll || bossBeaten(progress, index) }));
}

// Start a boss fight from the town's Arena. Returns false (and changes nothing) if that boss is still locked.
export function beginTownFight(index, progress, { unlockAll = arena.unlockAll } = {}) {
    if(!unlockAll && !bossBeaten(progress, index)) return false;
    arena.enabled = true;
    arena.fromTown = true;
    arena.outlaw = index;
    return true;
}

// The run is over and the player is back at the home screen: a fight started from the town is no longer an Arena run.
export function endTownFight() {
    if(!arena.fromTown) return false;
    arena.enabled = false;
    arena.fromTown = false;
    return true;
}
