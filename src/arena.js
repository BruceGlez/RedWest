// Boss Arena (open the game with ?arena): pick any outlaw and fight them straight away, for practice
// and playtesting. Nothing is saved: no progress, stars, run log, earnings or leaderboard entries.
export const arena = {
    enabled: typeof location !== 'undefined' && new URLSearchParams(location.search).has('arena'),
    outlaw: 0,
    invincible: false, // hearts refill, so every attack can be watched safely
    gang: false // also send the outlaw's gang, as in a real final pursuit
};
