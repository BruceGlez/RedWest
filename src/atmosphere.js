// The light, sky and fog of each stage, from the outlaw's home ground (STORY_BIBLE.md section 5). Plain data,
// keyed by outlaw id, so a new stage at the end of OUTLAWS gets DEFAULT_ATMOSPHERE until it is given its own.
// sky: gradient stops from the top of the sky to the horizon. fog and hemi keep the fight readable: the
// ground and the enemies are never darker than a moonlit night. ground and props tint the sand and the
// scenery (white leaves them as they are). offset is where the sun (or moon) sits relative to the player.
// wind (0 to 1) sways the grass and rolls the tumbleweeds (a count, 0 to 4); motes is what floats in the air
// (src/ambience.js): dust, ash, embers, mist or snow. speed drifts them with the wind, fall drops them (a
// negative fall lifts them), count is out of 120 and size is in world units.
// All numbers are first guesses for the eye and for playtesting on a phone.


// horizon: the skyline beyond the fog (src/horizon.js): a style (mesa, peaks, hills, stacks, flat) and how tall, how strongly
// it shows against the haze (0 to 1). terrain: how the ground looks (drawn once per stage by createGroundTexture in textures.js). kit: how many of
// each prop the map gets, and palette: multipliers on the props' colours (white leaves them alone), so every home
// ground has its own layout and its own things in it. kit counts must fit KIT_CAPACITY in the same order.
export const KIT_CAPACITY = { rock: 76, tree: 28, crate: 36, cactus: 24, fence: 40, barrel: 34, tombstone: 40, haystack: 20, spire: 26, wall: 30 };
export const FENCE_GROUP = 3; // fence pieces come in lines of three

const SAND = { base: '#e3b877', blotchDark: 'rgba(200, 140, 80, 0.2)', blotchLight: 'rgba(250, 215, 150, 0.4)', grain: ['rgba(120, 80, 40, 0.18)', 'rgba(255, 235, 190, 0.22)'],
    crack: 'rgba(120, 75, 35, 0.35)', cracks: 16, pebble: 'rgba(110, 80, 55, 0.7)', pebbleHi: 'rgba(255, 240, 210, 0.5)', pebbles: 260,
    scrub: ['rgba(128, 120, 50, 0.75)', 'rgba(150, 110, 50, 0.75)'], scrubs: 70, extra: null, extraColor: null };
const NO_TINT = { rock: [0x888888, 0xa0825f], tree: 0xffffff, crate: 0xffffff, fence: 0xffffff, cactus: 0xffffff };

export const DEFAULT_ATMOSPHERE = {
    mood: 'warm sunset',
    sky: [0x6fb3e0, 0xf4c98e, 0xffb070, 0xf7d7a8],
    fog: { color: 0xf1cf9c, near: 45, far: 110 },
    hemi: { sky: 0xfff1d8, ground: 0xc77f45, intensity: 1.6 },
    sun: { color: 0xffe2b0, intensity: 2.4, offset: [-26, 44, -18] },
    ground: 0xffffff,
    props: 0xffffff,
    wind: 0.3, weeds: 1,
    motes: { color: 0xf0dcb0, size: 0.4, opacity: 0.4, count: 70, speed: 1.5, fall: 0 },
    horizon: { style: 'mesa', height: 1, strength: 0.35 },
    hero: null,
    terrain: SAND,
    kit: { rock: 60, tree: 15, crate: 15, cactus: 20, fence: 15, barrel: 0, tombstone: 0, haystack: 0, spire: 0, wall: 0 },
    palette: NO_TINT
};

export const ATMOSPHERES = {
    'dusty-pete': { // Copper Bit: harsh noon
        mood: 'harsh noon',
        sky: [0x4f9ee6, 0x9cc8ee, 0xf3dfb4, 0xf6e3b8],
        fog: { color: 0xf2dcae, near: 50, far: 120 },
        hemi: { sky: 0xfff6e0, ground: 0xffffff, intensity: 1.7 },
        sun: { color: 0xfff0d2, intensity: 2.9, offset: [-12, 56, -8] },
        ground: 0xffffff, props: 0xffffff,
        horizon: { style: 'mesa', height: 0.9, strength: 0.35 },
        hero: { id: 'piano', at: [-30, 26, 0.4] },
        terrain: { ...SAND, base: '#d9b27a', extra: 'ruts', extraColor: 'rgba(110, 70, 40, 0.28)', pebbles: 200 },
        kit: { rock: 30, tree: 8, crate: 22, cactus: 8, fence: 6, barrel: 22, tombstone: 0, haystack: 0, spire: 0, wall: 0 },
        palette: { ...NO_TINT, crate: 0xe0b890 },
        wind: 0.4, weeds: 2, motes: { color: 0xeed2a0, size: 0.4, opacity: 0.4, count: 70, speed: 1.5, fall: 0 }
    },
    'rattlesnake-rosa': { // Whisper Wash: moonlit blue night
        mood: 'moonlit night',
        sky: [0x0b1330, 0x1a2b58, 0x2c4478, 0x3a5386],
        fog: { color: 0x2b3f6b, near: 38, far: 100 },
        hemi: { sky: 0x93a9ee, ground: 0xc4d0f0, intensity: 1.15 },
        sun: { color: 0xb4c8ff, intensity: 1.3, offset: [30, 46, -22] },
        ground: 0x8ea2d6, props: 0xb8c6ee,
        horizon: { style: 'hills', height: 1.3, strength: 0.5 },
        hero: { id: 'well', at: [34, -22, 0] },
        terrain: { ...SAND, base: '#c8c2b2', blotchDark: 'rgba(120, 130, 140, 0.22)', blotchLight: 'rgba(235, 235, 230, 0.4)', crack: 'rgba(70, 70, 75, 0.4)', cracks: 34, pebble: 'rgba(90, 92, 98, 0.75)', pebbleHi: 'rgba(240, 240, 240, 0.45)', pebbles: 900, scrub: ['rgba(90, 105, 80, 0.7)', 'rgba(110, 100, 70, 0.7)'], scrubs: 50 },
        kit: { rock: 70, tree: 16, crate: 0, cactus: 6, fence: 0, barrel: 0, tombstone: 0, haystack: 0, spire: 0, wall: 0 },
        palette: { ...NO_TINT, rock: [0x66727f, 0x7c8794] },
        wind: 0.25, weeds: 1, motes: { color: 0xa8bcf0, size: 0.35, opacity: 0.4, count: 60, speed: 0.8, fall: 0 }
    },
    'deacon-graves': { // Hollow Hill Chapel: purple dusk
        mood: 'purple dusk',
        sky: [0x241a4a, 0x5a2f7a, 0xc0607a, 0xf0a070],
        fog: { color: 0x6b4670, near: 38, far: 100 },
        hemi: { sky: 0xd9b0ff, ground: 0xe4d8ea, intensity: 1.3 },
        sun: { color: 0xffa070, intensity: 1.9, offset: [-46, 20, -14] },
        ground: 0xd8bdcc, props: 0xe2ccd8,
        horizon: { style: 'hills', height: 1.1, strength: 0.5 },
        hero: { id: 'tower', at: [-32, -28, 0.3] },
        terrain: { ...SAND, base: '#b39a7c', blotchDark: 'rgba(90, 80, 100, 0.22)', blotchLight: 'rgba(210, 195, 175, 0.35)', crack: 'rgba(70, 55, 60, 0.35)', pebble: 'rgba(80, 70, 75, 0.7)', scrub: ['rgba(80, 105, 70, 0.8)', 'rgba(100, 115, 75, 0.8)'], scrubs: 180 },
        kit: { rock: 24, tree: 22, crate: 2, cactus: 0, fence: 5, barrel: 0, tombstone: 34, haystack: 0, spire: 0, wall: 6 },
        palette: { ...NO_TINT, rock: [0x6f6a72, 0x857f88], tree: 0xc0a8a0 },
        wind: 0.35, weeds: 1, motes: { color: 0xe0c4d8, size: 0.4, opacity: 0.45, count: 70, speed: 1, fall: 0.3 }
    },
    'calloway-gang': { // Twin Forks: warm afternoon
        mood: 'warm afternoon',
        sky: [0x5ea6e0, 0xa8d0e6, 0xf8dca0, 0xf8dfa8],
        fog: { color: 0xf3d9a0, near: 50, far: 120 },
        hemi: { sky: 0xfff0d0, ground: 0xffffff, intensity: 1.65 },
        sun: { color: 0xffd48a, intensity: 2.6, offset: [-32, 36, -14] },
        ground: 0xfff0c8, props: 0xfff2d8,
        horizon: { style: 'hills', height: 0.7, strength: 0.3 },
        hero: { id: 'barn', at: [30, 30, 0.5] },
        terrain: { ...SAND, base: '#d6b467', extra: 'furrows', extraColor: 'rgba(130, 90, 40, 0.3)', pebbles: 120, scrub: ['rgba(110, 140, 50, 0.8)', 'rgba(170, 150, 60, 0.8)'], scrubs: 120 },
        kit: { rock: 20, tree: 6, crate: 12, cactus: 4, fence: 12, barrel: 6, tombstone: 0, haystack: 16, spire: 0, wall: 0 },
        palette: { ...NO_TINT, rock: [0x9a8f7a, 0xb09a74] },
        wind: 0.5, weeds: 2, motes: { color: 0xf4dc98, size: 0.45, opacity: 0.5, count: 80, speed: 2, fall: 0.2 }
    },
    'iron-jack': { // Slagtown: grey smoke and furnace glow
        mood: 'smoke and furnace glow',
        sky: [0x4c4846, 0x6e6763, 0x8f8078, 0x9c8a80],
        fog: { color: 0x7d726b, near: 30, far: 88 },
        hemi: { sky: 0xd4ccc4, ground: 0xffffff, intensity: 1.3 },
        sun: { color: 0xe6cdb4, intensity: 1.7, offset: [-24, 40, -20] },
        ground: 0xb2a8a0, props: 0xbcb0a8,
        horizon: { style: 'stacks', height: 1, strength: 0.5 },
        hero: { id: 'furnace', at: [-34, 22, 0] },
        terrain: { ...SAND, base: '#7f7872', blotchDark: 'rgba(40, 36, 34, 0.35)', blotchLight: 'rgba(150, 140, 132, 0.3)', grain: ['rgba(30, 26, 24, 0.3)', 'rgba(180, 170, 160, 0.2)'], crack: 'rgba(255, 110, 40, 0.4)', cracks: 22, pebble: 'rgba(45, 42, 40, 0.8)', pebbleHi: 'rgba(160, 150, 140, 0.4)', scrub: null, scrubs: 0 },
        kit: { rock: 30, tree: 2, crate: 20, cactus: 0, fence: 3, barrel: 26, tombstone: 0, haystack: 0, spire: 0, wall: 10 },
        palette: { ...NO_TINT, rock: [0x4a4744, 0x5c5652], crate: 0xb8b0a8 },
        wind: 0.3, weeds: 0, motes: { color: 0xff9040, size: 0.6, opacity: 0.85, count: 80, speed: 0.8, fall: -2.2 }
    },
    'mesa-morgan': { // Redstone Mesa: blazing red rock
        mood: 'blazing red rock',
        sky: [0xc25a3a, 0xe88a58, 0xf6b070, 0xf6c088],
        fog: { color: 0xe0956a, near: 42, far: 105 },
        hemi: { sky: 0xffd8b0, ground: 0xffffff, intensity: 1.6 },
        sun: { color: 0xffb070, intensity: 3.0, offset: [-28, 42, -12] },
        ground: 0xf6b586, props: 0xf6b98c,
        horizon: { style: 'mesa', height: 1.5, strength: 0.4 },
        hero: { id: 'bridge', at: [0, -38, 0] },
        terrain: { ...SAND, base: '#cf7548', blotchDark: 'rgba(140, 50, 30, 0.28)', blotchLight: 'rgba(240, 160, 110, 0.4)', crack: 'rgba(90, 30, 20, 0.45)', cracks: 24, pebble: 'rgba(130, 55, 35, 0.75)', pebbleHi: 'rgba(250, 190, 140, 0.45)', scrub: null, scrubs: 0 },
        kit: { rock: 50, tree: 4, crate: 8, cactus: 10, fence: 2, barrel: 4, tombstone: 0, haystack: 0, spire: 22, wall: 0 },
        palette: { ...NO_TINT, rock: [0xb5502f, 0xc9693a], cactus: 0xd8e090 },
        wind: 0.7, weeds: 3, motes: { color: 0xf6b080, size: 1.0, opacity: 0.4, count: 90, speed: 3, fall: 0 }
    },
    'silas-vane': { // Vane's Crossing: high-noon glare
        mood: 'high-noon glare',
        sky: [0x7fbceb, 0xd0e4f2, 0xf8f0da, 0xfaf3e0],
        fog: { color: 0xf6eedc, near: 55, far: 130 },
        hemi: { sky: 0xffffff, ground: 0xffffff, intensity: 1.8 },
        sun: { color: 0xfffae8, intensity: 3.2, offset: [-8, 60, -6] },
        ground: 0xf4e6c6, props: 0xfff4de,
        horizon: { style: 'mesa', height: 0.6, strength: 0.25 },
        hero: { id: 'clock', at: [36, 20, 0.2] },
        terrain: { ...SAND, base: '#efdfb9', blotchDark: 'rgba(210, 180, 130, 0.25)', blotchLight: 'rgba(255, 250, 235, 0.5)', crack: 'rgba(130, 100, 60, 0.4)', cracks: 36, pebbles: 90, scrubs: 30 },
        kit: { rock: 10, tree: 8, crate: 10, cactus: 6, fence: 9, barrel: 8, tombstone: 0, haystack: 0, spire: 0, wall: 14 },
        palette: { ...NO_TINT, rock: [0xb0a48c, 0xc4b498], crate: 0xd8c8a8 },
        wind: 1, weeds: 4, motes: { color: 0xf8ecd0, size: 1.0, opacity: 0.45, count: 100, speed: 4.5, fall: 0 }
    },
    'el-espectro': { // Tres Rios: moon-white mist
        mood: 'moon-white mist',
        sky: [0x7d90b0, 0xa4b4cc, 0xc0ccdc, 0xc8d2e0],
        fog: { color: 0xbcc8d8, near: 18, far: 72 },
        hemi: { sky: 0xd0dcf4, ground: 0xc8d4dc, intensity: 1.3 },
        sun: { color: 0xdce8ff, intensity: 1.5, offset: [24, 48, -18] },
        ground: 0xaebcc4, props: 0xc6d0dc,
        horizon: { style: 'hills', height: 0.8, strength: 0.45 },
        hero: { id: 'arch', at: [-28, -34, 0.2] },
        terrain: { ...SAND, base: '#a9b59a', blotchDark: 'rgba(90, 110, 90, 0.28)', blotchLight: 'rgba(210, 225, 205, 0.4)', crack: 'rgba(60, 75, 60, 0.35)', cracks: 10, pebble: 'rgba(85, 95, 85, 0.7)', scrub: ['rgba(70, 110, 70, 0.85)', 'rgba(95, 125, 80, 0.85)'], scrubs: 220 },
        kit: { rock: 26, tree: 18, crate: 0, cactus: 4, fence: 0, barrel: 0, tombstone: 4, haystack: 0, spire: 0, wall: 26 },
        palette: { ...NO_TINT, rock: [0x8a9690, 0xa0aca6], tree: 0xb0c0a8 },
        wind: 0.15, weeds: 0, motes: { color: 0xe2eaf6, size: 2.4, opacity: 0.16, count: 40, speed: 0.6, fall: 0 }
    },
    'lucky-lou': { // The Silver Belle: warm lamps on a river evening
        mood: 'lamplit evening',
        sky: [0x1c2648, 0x4a3a5a, 0xc07a4a, 0xf0a860],
        fog: { color: 0x74503c, near: 38, far: 100 },
        hemi: { sky: 0xffcc90, ground: 0xe0c8a8, intensity: 1.3 },
        sun: { color: 0xffbc78, intensity: 1.9, offset: [-40, 24, -16] },
        ground: 0xd2ac8a, props: 0xdcbc98,
        horizon: { style: 'flat', height: 1, strength: 0.4 },
        hero: { id: 'paddlewheel', at: [32, -30, 0.6] },
        terrain: { ...SAND, base: '#a9784a', blotchDark: 'rgba(90, 55, 30, 0.25)', blotchLight: 'rgba(220, 170, 120, 0.3)', crack: 'rgba(60, 35, 20, 0.5)', cracks: 6, pebbles: 0, scrub: null, scrubs: 0, extra: 'planks', extraColor: 'rgba(50, 30, 15, 0.55)' },
        kit: { rock: 0, tree: 0, crate: 30, cactus: 0, fence: 10, barrel: 30, tombstone: 0, haystack: 0, spire: 0, wall: 8 },
        palette: { ...NO_TINT, crate: 0xd0a070, fence: 0xd8b088 },
        wind: 0.3, weeds: 0, motes: { color: 0xffd898, size: 0.3, opacity: 0.6, count: 70, speed: 0.8, fall: -0.6 }
    },
    'colonel-crane': { // Fort Pell: cold blue dusk, snow on the ramparts
        mood: 'cold blue dusk',
        sky: [0x3a4e7a, 0x6a82ae, 0xb4c4dc, 0xd0dcee],
        fog: { color: 0xbccadc, near: 34, far: 96 },
        hemi: { sky: 0xe0eaff, ground: 0xf0f4ff, intensity: 1.55 },
        sun: { color: 0xdbe6ff, intensity: 1.9, offset: [-30, 34, -20] },
        ground: 0xdfe8f2, props: 0xe4ecf6,
        horizon: { style: 'peaks', height: 1.3, strength: 0.4 },
        hero: { id: 'flag', at: [-30, 28, 0.4] },
        terrain: { ...SAND, base: '#edf1f6', blotchDark: 'rgba(120, 140, 175, 0.25)', blotchLight: 'rgba(255, 255, 255, 0.6)', grain: ['rgba(140, 160, 190, 0.2)', 'rgba(255, 255, 255, 0.35)'], crack: 'rgba(110, 125, 150, 0.3)', cracks: 8, pebble: 'rgba(110, 100, 95, 0.7)', pebbleHi: 'rgba(255, 255, 255, 0.6)', pebbles: 120, scrub: ['rgba(120, 110, 80, 0.7)', 'rgba(140, 125, 90, 0.7)'], scrubs: 20, extra: 'patches', extraColor: 'rgba(110, 90, 75, 0.35)' },
        kit: { rock: 26, tree: 10, crate: 16, cactus: 0, fence: 8, barrel: 8, tombstone: 0, haystack: 0, spire: 0, wall: 20 },
        palette: { ...NO_TINT, rock: [0xc8d0dc, 0xdde3ec], tree: 0xd8dce4, crate: 0xd0d4dc },
        wind: 0.6, weeds: 0, motes: { color: 0xffffff, size: 0.9, opacity: 0.9, count: 120, speed: 2, fall: 3.5 }
    }
};

export function atmosphereFor(outlawId) {
    return ATMOSPHERES[outlawId] ?? DEFAULT_ATMOSPHERE;
}
