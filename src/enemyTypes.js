// Every regular enemy in one place: stats for spawning, the wave director's cost and weight,
// the stage (Wanted Road index) where it first appears, and Bounty Book text.
// Speeds are base values; spawnEnemy scales them with the pursuit and the outlaw stage.

export const ENEMY_TYPES = {
    bandit: {
        name: 'BANDIT', stage: 0, cost: 1.0, weight: 2.4, cap: 10, hp: 1, speed: 7, behavior: 'chase', danger: 1,
        blurb: 'Hired guns with more nerve than aim. They rush you in packs.',
        tip: 'Keep moving. They only hurt up close.'
    },
    wolf: {
        name: 'WOLF', stage: 0, cost: 1.2, weight: 0.9, cap: 4, hp: 1, speed: 10, behavior: 'chase', danger: 2,
        blurb: 'Fast, hungry and loyal to whoever feeds them.',
        tip: 'Shoot them early: they close distance quickly.'
    },
    gunslinger: {
        name: 'GUNSLINGER', stage: 0, cost: 2.0, weight: 0.5, cap: 1, hp: 1, speed: 5, behavior: 'shooter', danger: 2,
        blurb: 'Stops at range and fires when the arm comes up.',
        tip: 'Watch the raised arm, then dodge or dash.'
    },
    rattler: {
        name: 'RATTLER', stage: 1, cost: 0.8, weight: 1.6, cap: 6, hp: 1, speed: 12, behavior: 'zigzag', danger: 2, hitRadius: 1.5,
        blurb: 'Rosa’s pets. Low, quick and never in a straight line.',
        tip: 'Lead your shots, or let the shotgun spread do the work.'
    },
    rifleman: {
        name: 'RIFLEMAN', stage: 2, cost: 2.2, weight: 1.0, cap: 2, hp: 2, speed: 4.5, behavior: 'sniper', danger: 3,
        blurb: 'Keeps his distance. A red line shows where the shot will land.',
        tip: 'Step off the red line before it fires.'
    },
    dynamiter: {
        name: 'DYNAMITER', stage: 3, cost: 2.0, weight: 1.1, cap: 2, hp: 2, speed: 5.5, behavior: 'lobber', danger: 3,
        blurb: 'Lobs dynamite where you are standing. The ring shows the blast.',
        tip: 'Leave the ring before the fuse runs out.'
    },
    brute: {
        name: 'BRUTE', stage: 4, cost: 3.0, weight: 0.8, cap: 2, hp: 7, speed: 3.5, behavior: 'charger', danger: 3, heavy: true, hitRadius: 2.4,
        blurb: 'Armoured and slow, until he lowers his head and charges.',
        tip: 'When he shakes, sidestep. He cannot turn mid-charge.'
    },
    rider: {
        name: 'RIDER', stage: 5, cost: 2.5, weight: 0.9, cap: 2, hp: 3, speed: 9, behavior: 'rider', danger: 3, heavy: true, hitRadius: 2.4,
        blurb: 'Circles on horseback, then rides straight through you.',
        tip: 'Watch for the rear-up, then move sideways, not back.'
    },
    duelist: {
        name: 'DUELIST', stage: 6, cost: 2.2, weight: 1.0, cap: 3, hp: 2, speed: 6.5, behavior: 'scattergun', danger: 3,
        blurb: 'Walks right up and empties a sawn-off shotgun.',
        tip: 'Keep your distance: the spread is deadly close in.'
    },
    ghost: {
        name: 'GHOST', stage: 7, cost: 2.0, weight: 1.2, cap: 3, hp: 2, speed: 7, behavior: 'phantom', danger: 3,
        blurb: 'El Espectro’s riders fade from sight and reappear beside you.',
        tip: 'Bullets pass through while faded. Fire when they flicker back.'
    },
    knifer: {
        name: 'KNIFE THROWER', stage: 8, cost: 1.8, weight: 1.3, cap: 4, hp: 2, speed: 9, behavior: 'knives', danger: 3,
        blurb: 'Lucky Lou’s riverboat crew: they dart in and throw three knives at once.',
        tip: 'The knives fly straight. Step sideways when the arm goes back.'
    },
    trooper: {
        name: 'TROOPER', stage: 9, cost: 2.4, weight: 1.1, cap: 3, hp: 3, speed: 5.5, behavior: 'volley', danger: 3,
        blurb: 'The Colonel’s renegade cavalry. They hold their ground and fire three-round bursts.',
        tip: 'Close in between bursts: they reload before the next one.'
    }
};

// 3D models (public/models, art lane) for the regular enemies that have one: the file and the height in game units (the player is 6
// tall and the box figures about 5.4). A type without a row, or whose file has not loaded yet, is the box figure. A mine monster that
// borrows a look (MINE_MONSTERS[id].look) uses the row of that look.
export const ENEMY_MODELS = {
    bandit: { file: 'models/bandit.glb', height: 5.4 },
    gunslinger: { file: 'models/gunslinger.glb', height: 5.4 },
    rifleman: { file: 'models/rifleman.glb', height: 5.4 },
    dynamiter: { file: 'models/dynamiter.glb', height: 5.4 },
    knifer: { file: 'models/knifer.glb', height: 5.4 },
    duelist: { file: 'models/duelist.glb', height: 5.4 },
    brute: { file: 'models/brute.glb', height: 6.4 },
    ghost: { file: 'models/ghost.glb', height: 5.4 }
};

export const ENEMY_ORDER = Object.keys(ENEMY_TYPES);

// Types that can appear against the outlaw at `stage`. The newest one is featured (appears in
// the opening pursuit and more often), earlier special types stay in the mix less often.
export function rosterFor(stage) {
    return ENEMY_ORDER.filter(id => ENEMY_TYPES[id].stage <= stage);
}

export function featuredFor(stage) {
    return ENEMY_ORDER.find(id => ENEMY_TYPES[id].stage === stage && stage > 0) ?? null;
}

// Base director numbers for one pursuit of one stage.
export function rosterWave(stage, wave) {
    const weights = {};
    const caps = {};
    const featured = featuredFor(stage);
    for(const id of rosterFor(stage)) {
        const def = ENEMY_TYPES[id];
        let weight = def.weight;
        if(id === 'bandit') weight = Math.max(0.8, 2.4 - (wave * 0.12));
        if(id === 'wolf') weight = Math.min(2.2, 0.8 + (wave * 0.16));
        if(id === 'gunslinger') weight = Math.min(2.4, 0.3 + (wave * 0.2));
        if(def.stage > 0) weight *= id === featured ? 2.2 : 0.6;
        weights[id] = weight;
        let cap = def.cap;
        if(id === 'bandit') cap = 10 + Math.floor(wave * 0.8);
        if(id === 'wolf') cap = 4 + Math.floor(wave * 0.45);
        if(id === 'gunslinger') cap = Math.max(1, Math.floor(wave / 2));
        if(def.stage > 0) cap += Math.floor(wave / 3);
        caps[id] = cap;
    }
    return { weights, caps };
}

export function enemyCost(id) {
    return ENEMY_TYPES[id]?.cost ?? 1;
}
