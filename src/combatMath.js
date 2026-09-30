// The numbers of combat feel, kept free of the renderer so they can be tested: what an impact throws, how a
// defeated enemy tumbles, and how hard a gun kicks the camera. Presentation only; no rule reads any of it.

// What each kind of impact throws. count and size are per burst, speed is the outward speed in units per second,
// lift is extra upward speed, gravity pulls the bits down, life is in seconds. colors are picked at random.
export const IMPACTS = {
    dust: { count: 6, size: [0.5, 0.9], speed: 4, lift: 4, gravity: 6, life: 0.55, colors: [0xd8c08a, 0xe8d8a8, 0xc4a870] },
    stone: { count: 6, size: [0.3, 0.6], speed: 7, lift: 5, gravity: 24, life: 0.5, colors: [0x8a8a8a, 0xa8a8a8, 0x6f6f6f] },
    sparks: { count: 7, size: [0.2, 0.32], speed: 14, lift: 4, gravity: 22, life: 0.35, colors: [0xffe08a, 0xffffff, 0xffb040] },
    splinters: { count: 6, size: [0.25, 0.45], speed: 9, lift: 6, gravity: 26, life: 0.6, colors: [0x9a6a3a, 0xc89860, 0x7a4a24] },
    leaves: { count: 6, size: [0.3, 0.5], speed: 8, lift: 5, gravity: 18, life: 0.6, colors: [0x5fbf5f, 0x3f9f4f, 0xa0d070] },
    straw: { count: 7, size: [0.25, 0.4], speed: 6, lift: 6, gravity: 12, life: 0.7, colors: [0xe0c266, 0xc9a84a] },
    hit: { count: 6, size: [0.3, 0.55], speed: 8, lift: 5, gravity: 20, life: 0.4, colors: [0xffaa00, 0xffd54f, 0xffffff] },
    // A cartoon puff where a defeated enemy stood.
    poof: { count: 9, size: [0.7, 1.3], speed: 6, lift: 3, gravity: 3, life: 0.6, colors: [0xf0e8d8, 0xe0d4be, 0xffffff] }
};

// What each obstacle throws when a bullet hits it.
const OBSTACLE_IMPACT = {
    rock: 'stone', spire: 'stone', wall: 'stone', tombstone: 'stone',
    crate: 'splinters', fence: 'splinters', tree: 'splinters', barrel: 'splinters',
    cactus: 'leaves', haystack: 'straw'
};
export function impactForObstacle(type) {
    return OBSTACLE_IMPACT[type] ?? 'dust';
}

// How long a defeated enemy takes to go: the tumble, then a quick pop away. An imported model plays its own
// fall clip for up to `clipSeconds` first (capped, so a long clip never keeps a corpse on screen).
export const TUMBLE_SECONDS = 0.45;
export const POP_SECONDS = 0.14;
export const MAX_CLIP_SECONDS = 1.1;
export function deathLength(clipSeconds = 0) {
    return (clipSeconds > 0 ? Math.min(clipSeconds, MAX_CLIP_SECONDS) : TUMBLE_SECONDS) + POP_SECONDS;
}

// The pose of a box-built enemy `t` seconds into its fall: how far it has tipped over backwards (radians), a hop
// (units up) and its size (1 to 0). It tips over quickly, hops once, lies still, and pops away at the very end.
export function deathPose(t, total = deathLength()) {
    const fall = Math.max(0.01, total - POP_SECONDS);
    const k = Math.min(1, Math.max(0, t / fall));
    const tip = (1 - (1 - k) * (1 - k)) * (Math.PI / 2);
    const hop = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 1.4;
    const pop = t <= fall ? 1 : Math.max(0, 1 - (t - fall) / POP_SECONDS);
    return { tip, hop, scale: pop };
}

// Camera kick for one shot, from the gun's numbers: a pistol barely moves the view, a shotgun or a buffalo gun
// shoves it. Returns units of camera offset (the direction is set by the caller, against the aim).
export function weaponKick(stats) {
    const power = (stats.pellets > 1 ? 0.18 + stats.pellets * 0.012 : 0) + stats.damage * 0.08 + stats.size * 0.03;
    return Math.min(0.5, Math.max(0.05, power));
}

// The muzzle flash for one shot: how big and how long, from the gun's numbers.
export function muzzleFlash(stats) {
    const size = Math.min(2.4, 0.9 + stats.size * 0.5 + (stats.pellets > 1 ? 0.35 : 0));
    return { size, life: 0.07 };
}
