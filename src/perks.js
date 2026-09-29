// Playable outlaws (GROWTH_PLAN.md, Phase 1.2): three-starring an outlaw unlocks them as a character with
// one perk and one drawback, a side-grade like the shop guns. Earned only, never sold (tests check both).
//
// Mods (all optional; missing = no change):
//   hearts        extra (or fewer) hearts
//   speed         move speed multiplier
//   fireRate      time-between-shots multiplier (below 1 = faster)
//   dashTime      dash length in seconds (normal 0.15)
//   dashCooldown  seconds before the next dash (normal 2)
//   dashGhost     seconds untouchable after each dash
//   tripleEvery   every Nth shot is a triple shot
//   magazine      { shots, reload }: a pause of `reload` seconds after that many shots
//   bulletSize    bullet size multiplier
//   range         bullet range multiplier

export const BASE_HEARTS = 5;
export const BASE_SPEED = 15;
export const BASE_DASH_TIME = 0.15;
export const BASE_DASH_COOLDOWN = 2;

export const OUTLAW_PERKS = {
    'dusty-pete': { name: 'Barroom Brawler', perk: 'Dashes go twice as far.', drawback: 'Dash recharges in 2.8 s instead of 2.', mods: { dashTime: 0.3, dashCooldown: 2.8 } },
    'rattlesnake-rosa': { name: 'Fast As A Snake', perk: 'Moves 15% faster.', drawback: 'One heart less.', mods: { speed: 1.15, hearts: -1 } },
    'deacon-graves': { name: 'Holy Trinity', perk: 'Every 5th shot is a triple shot.', drawback: 'Fires 15% slower.', mods: { tripleEvery: 5, fireRate: 1.15 } },
    'calloway-gang': { name: 'Thick Skinned', perk: 'One extra heart.', drawback: 'Moves 10% slower.', mods: { hearts: 1, speed: 0.9 } },
    'iron-jack': { name: 'Iron Hide', perk: 'Two extra hearts.', drawback: 'Moves 20% slower and dashes less often.', mods: { hearts: 2, speed: 0.8, dashCooldown: 2.6 } },
    'mesa-morgan': { name: 'Big Bang', perk: 'Bullets are 40% bigger (easier hits).', drawback: 'Shots reach 25% less far.', mods: { bulletSize: 1.4, range: 0.75 } },
    'silas-vane': { name: 'Fan The Hammer', perk: 'Fires 30% faster.', drawback: 'Reloads for 1.2 s after every 6 shots.', mods: { fireRate: 0.7, magazine: { shots: 6, reload: 1.2 } } },
    'el-espectro': { name: 'Ghost Step', perk: 'Untouchable for 0.6 s after each dash.', drawback: 'One heart less.', mods: { dashGhost: 0.6, hearts: -1 } }
};

// Which way each mod helps: +1 when a bigger number is better for the player, -1 when smaller is.
const BETTER_WHEN = { hearts: 1, speed: 1, fireRate: -1, dashTime: 1, dashCooldown: -1, dashGhost: 1, tripleEvery: 1, bulletSize: 1, range: 1 };
const BASELINE = { hearts: 0, speed: 1, fireRate: 1, dashTime: BASE_DASH_TIME, dashCooldown: BASE_DASH_COOLDOWN, dashGhost: 0, tripleEvery: 0, bulletSize: 1, range: 1 };

// For tests: each perk must have at least one upside and one downside.
export function perkSides(mods) {
    let up = 0;
    let down = 0;
    for(const [key, value] of Object.entries(mods)) {
        if(key === 'magazine') { down++; continue; }
        const direction = Math.sign(value - BASELINE[key]) * BETTER_WHEN[key];
        if(direction > 0) up++;
        if(direction < 0) down++;
    }
    return { up, down };
}

// Applies the equipped character's mods to the player between runs.
export function applyPerk(playerStats, mods = {}, inRun = false) {
    playerStats.perk = mods;
    playerStats.maxHp = BASE_HEARTS + (mods.hearts || 0);
    playerStats.speed = BASE_SPEED * (mods.speed || 1);
    playerStats.hp = inRun ? Math.min(playerStats.hp, playerStats.maxHp) : playerStats.maxHp;
}
