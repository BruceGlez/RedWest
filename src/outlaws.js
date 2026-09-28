// The Wanted Road: each stage is a named outlaw with a signature threat. Later outlaws combine
// threats and scale enemy speed, numbers and boss toughness. All numbers here are first guesses
// for playtesting.

export const MODIFIERS = {
    FAST_WOLVES: { label: 'WOLF PACK', detail: 'More wolves, and they run faster.' },
    SHARPSHOOTERS: { label: 'SHARPSHOOTERS', detail: 'Gunslingers fire faster and straighter.' },
    SWARM: { label: 'SWARM', detail: 'Bigger gangs that arrive quicker.' },
    HEAVY_HITTERS: { label: 'HEAVY HITTERS', detail: 'Tougher gunslingers with harder-hitting shots.' }
};

export const OUTLAWS = [
    { id: 'dusty-pete', name: 'DUSTY PETE', title: 'The Saloon Brawler', modifiers: [], bounty: 50,
        colors: { hat: 0x7a4a26, coat: 0x7a5230, poncho: 0x3b2a1a, bandana: 0xc62828 } },
    { id: 'rattlesnake-rosa', name: 'RATTLESNAKE ROSA', title: 'Runs With Wolves', modifiers: ['FAST_WOLVES'], bounty: 75,
        colors: { hat: 0x33691e, coat: 0x2e7d32, poncho: 0x1b3d1f, bandana: 0xfbc02d } },
    { id: 'deacon-graves', name: 'DEACON GRAVES', title: 'The Preacher Gun', modifiers: ['SHARPSHOOTERS'], bounty: 100,
        colors: { hat: 0x151515, coat: 0x212121, poncho: 0x4a148c, bandana: 0xeeeeee } },
    { id: 'calloway-gang', name: 'THE CALLOWAYS', title: 'Brothers By The Dozen', modifiers: ['SWARM'], bounty: 125,
        colors: { hat: 0xc9a36b, coat: 0x5d4037, poncho: 0xbf360c, bandana: 0x1565c0 } },
    { id: 'iron-jack', name: 'IRON JACK HARLAN', title: 'Bulletproof, They Say', modifiers: ['HEAVY_HITTERS'], bounty: 150,
        colors: { hat: 0x546e7a, coat: 0x455a64, poncho: 0x263238, bandana: 0xff6f00 } },
    { id: 'mesa-morgan', name: 'MAD MESA MORGAN', title: 'Queen Of The Badlands', modifiers: ['SWARM', 'FAST_WOLVES'], bounty: 200,
        colors: { hat: 0x880e4f, coat: 0xad1457, poncho: 0x4e342e, bandana: 0xffd54f } },
    { id: 'silas-vane', name: 'SILAS VANE', title: 'Six-Gun Silas', modifiers: ['SHARPSHOOTERS', 'HEAVY_HITTERS'], bounty: 250,
        colors: { hat: 0x1a237e, coat: 0x0d47a1, poncho: 0x111111, bandana: 0xb71c1c } },
    { id: 'el-espectro', name: 'EL ESPECTRO', title: 'The Ghost Of Red West', modifiers: ['FAST_WOLVES', 'SHARPSHOOTERS', 'SWARM', 'HEAVY_HITTERS'], bounty: 350,
        colors: { hat: 0xf5f5f5, coat: 0xeeeeee, poncho: 0x37474f, bandana: 0x6a1b9a } }
];

export const STAR_GOALS = ['Defeat the outlaw', 'Collect the bounty at Heat 2+', 'Ride on and escape'];

export function getOutlaw(index) {
    return OUTLAWS[Math.max(0, Math.min(OUTLAWS.length - 1, index))];
}

// Stage difficulty on top of the per-pursuit scaling.
export function outlawDifficulty(index) {
    const tier = Math.max(0, index);
    return {
        enemySpeed: 1 + (tier * 0.04),
        budget: 1 + (tier * 0.08),
        spawnInterval: Math.max(0.75, 1 - (tier * 0.03)),
        bossHp: 16 + (tier * 3),
        bossSpeed: 3.4 + (tier * 0.12)
    };
}

// Adjust the wave director's numbers for this outlaw. Returns new objects; inputs are untouched.
export function applyOutlawToWave(wave, index) {
    const outlaw = getOutlaw(index);
    const difficulty = outlawDifficulty(index);
    const weights = { ...wave.weights };
    const caps = { ...wave.caps };
    let budget = wave.budget * difficulty.budget;
    let interval = wave.interval * difficulty.spawnInterval;
    for(const id of outlaw.modifiers) {
        if(id === 'SWARM') {
            budget *= 1.35; interval *= 0.78;
            weights.bandit *= 1.8; weights.wolf *= 1.4; weights.gunslinger *= 0.65;
        } else if(id === 'SHARPSHOOTERS') {
            weights.gunslinger *= 1.9; weights.wolf *= 0.8;
        } else if(id === 'FAST_WOLVES') {
            interval *= 0.86; weights.wolf *= 2.2; caps.wolf += 3;
        } else if(id === 'HEAVY_HITTERS') {
            budget *= 1.15; interval *= 1.06;
            weights.bandit *= 0.75; weights.gunslinger *= 1.35;
        }
    }
    return { budget, interval, weights, caps };
}

// Adjust one enemy's stats for this outlaw. Returns a new object.
export function applyOutlawToEnemy(type, stats, index) {
    const outlaw = getOutlaw(index);
    const difficulty = outlawDifficulty(index);
    const result = { ...stats };
    if(type === 'boss') {
        result.hp = difficulty.bossHp;
        result.speed = difficulty.bossSpeed;
    } else {
        result.speed *= difficulty.enemySpeed;
    }
    const shooter = type === 'gunslinger' || type === 'boss';
    if(outlaw.modifiers.includes('SHARPSHOOTERS') && shooter) {
        result.shootCooldown *= 0.72;
        result.projectileSpeed = 52;
        result.aimSpread = 0.8;
    }
    if(outlaw.modifiers.includes('FAST_WOLVES') && type === 'wolf') result.speed *= 1.35;
    if(outlaw.modifiers.includes('HEAVY_HITTERS') && shooter) {
        result.hp += 1;
        result.projectileSpeed *= 1.1;
    }
    return result;
}
