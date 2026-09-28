// Guns. The player carries two: a sidearm (primary) and a long gun (secondary), swapped with
// Q / SWAP. Shop guns are side-grades, each with a trade-off, and are only ever sold for earned
// Bounty Dollars: paid Gold Nuggets never buy power, so leaderboards stay fair.
//
// Stats: pellets per shot, spread (radians across all pellets, or random jitter for one pellet),
// speed (units/s), fireRate (seconds between shots), damage per pellet, pierce (extra enemies a
// bullet passes through), range (units before the bullet drops), size (how big the bullet looks).

export const WEAPON_SLOTS = ['primary', 'secondary'];

export const WEAPONS = [
    {
        id: 'gun-revolver', slot: 'primary', name: 'Peacemaker', short: 'REVOLVER', price: 0, currency: 'dollars',
        blurb: 'Reliable all-rounder. Every shot goes where you aim.',
        stats: { pellets: 1, spread: 0, speed: 70, fireRate: 0.2, damage: 1, pierce: 0, range: 100, size: 1 }
    },
    {
        id: 'gun-twins', slot: 'primary', name: 'Twin Pistols', short: 'TWINS', price: 500, currency: 'dollars',
        blurb: 'Fires almost twice as fast, but shots wander. Misses cool your Heat.',
        stats: { pellets: 1, spread: 0.14, speed: 66, fireRate: 0.12, damage: 1, pierce: 0, range: 60, size: 0.85 }
    },
    {
        id: 'gun-rifle', slot: 'primary', name: 'Repeater Rifle', short: 'RIFLE', price: 650, currency: 'dollars',
        blurb: 'Slower, but fast bullets go through two enemies and fly far.',
        stats: { pellets: 1, spread: 0, speed: 110, fireRate: 0.38, damage: 1, pierce: 1, range: 130, size: 1.2 }
    },
    {
        id: 'gun-shotgun', slot: 'secondary', name: 'Scattergun', short: 'SHOTGUN', price: 0, currency: 'dollars',
        blurb: 'Seven-pellet spread for crowds up close.',
        stats: { pellets: 7, spread: 0.38, speed: 62, fireRate: 0.75, damage: 1, pierce: 0, range: 100, size: 0.7 }
    },
    {
        id: 'gun-sawedoff', slot: 'secondary', name: 'Sawed-Off', short: 'SAWED-OFF', price: 450, currency: 'dollars',
        blurb: 'Ten pellets in a wide blast, but only at close range.',
        stats: { pellets: 10, spread: 0.75, speed: 58, fireRate: 0.9, damage: 1, pierce: 0, range: 22, size: 0.65 }
    },
    {
        id: 'gun-buffalo', slot: 'secondary', name: 'Buffalo Gun', short: 'BUFFALO', price: 900, currency: 'dollars',
        blurb: 'One huge slug: 4 damage, goes through three enemies. Very slow to reload.',
        stats: { pellets: 1, spread: 0, speed: 130, fireRate: 1.2, damage: 4, pierce: 2, range: 140, size: 1.9 }
    }
];

const BY_ID = new Map(WEAPONS.map(weapon => [weapon.id, weapon]));

export function getWeapon(id) {
    return BY_ID.get(id) ?? null;
}

export function defaultWeapon(slot) {
    return WEAPONS.find(weapon => weapon.slot === slot && weapon.price === 0);
}

// Simple 1-5 bars for the shop card.
export function weaponBars(weapon) {
    const s = weapon.stats;
    const clamp = v => Math.max(1, Math.min(5, Math.round(v)));
    return {
        POWER: clamp(1 + Math.log2(s.damage * s.pellets * (1 + s.pierce)) * 1.1),
        SPEED: clamp(0.6 / s.fireRate),
        RANGE: clamp(s.range / 28)
    };
}
