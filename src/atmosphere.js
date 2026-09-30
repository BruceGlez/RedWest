// The light, sky and fog of each stage, from the outlaw's home ground (STORY_BIBLE.md section 5). Plain data,
// keyed by outlaw id, so a new stage at the end of OUTLAWS gets DEFAULT_ATMOSPHERE until it is given its own.
// sky: gradient stops from the top of the sky to the horizon. fog and hemi keep the fight readable: the
// ground and the enemies are never darker than a moonlit night. ground and props tint the sand and the
// scenery (white leaves them as they are). offset is where the sun (or moon) sits relative to the player.
// wind (0 to 1) sways the grass and rolls the tumbleweeds (a count, 0 to 4); motes is what floats in the air
// (src/ambience.js): dust, ash, embers, mist or snow. speed drifts them with the wind, fall drops them (a
// negative fall lifts them), count is out of 120 and size is in world units.
// All numbers are first guesses for the eye and for playtesting on a phone.

export const DEFAULT_ATMOSPHERE = {
    mood: 'warm sunset',
    sky: [0x6fb3e0, 0xf4c98e, 0xffb070, 0xf7d7a8],
    fog: { color: 0xf1cf9c, near: 45, far: 110 },
    hemi: { sky: 0xfff1d8, ground: 0xc77f45, intensity: 1.6 },
    sun: { color: 0xffe2b0, intensity: 2.4, offset: [-26, 44, -18] },
    ground: 0xffffff,
    props: 0xffffff,
    wind: 0.3, weeds: 1,
    motes: { color: 0xf0dcb0, size: 0.4, opacity: 0.4, count: 70, speed: 1.5, fall: 0 }
};

export const ATMOSPHERES = {
    'dusty-pete': { // Copper Bit: harsh noon
        mood: 'harsh noon',
        sky: [0x4f9ee6, 0x9cc8ee, 0xf3dfb4, 0xf6e3b8],
        fog: { color: 0xf2dcae, near: 50, far: 120 },
        hemi: { sky: 0xfff6e0, ground: 0xd9a465, intensity: 1.7 },
        sun: { color: 0xfff0d2, intensity: 2.9, offset: [-12, 56, -8] },
        ground: 0xffffff, props: 0xffffff,
        wind: 0.4, weeds: 2, motes: { color: 0xeed2a0, size: 0.4, opacity: 0.4, count: 70, speed: 1.5, fall: 0 }
    },
    'rattlesnake-rosa': { // Whisper Wash: moonlit blue night
        mood: 'moonlit night',
        sky: [0x0b1330, 0x1a2b58, 0x2c4478, 0x3a5386],
        fog: { color: 0x2b3f6b, near: 38, far: 100 },
        hemi: { sky: 0x93a9ee, ground: 0x3a4a78, intensity: 1.15 },
        sun: { color: 0xb4c8ff, intensity: 1.3, offset: [30, 46, -22] },
        ground: 0x8ea2d6, props: 0xb8c6ee,
        wind: 0.25, weeds: 1, motes: { color: 0xa8bcf0, size: 0.35, opacity: 0.4, count: 60, speed: 0.8, fall: 0 }
    },
    'deacon-graves': { // Hollow Hill Chapel: purple dusk
        mood: 'purple dusk',
        sky: [0x241a4a, 0x5a2f7a, 0xc0607a, 0xf0a070],
        fog: { color: 0x6b4670, near: 38, far: 100 },
        hemi: { sky: 0xd9b0ff, ground: 0x7a4a55, intensity: 1.3 },
        sun: { color: 0xffa070, intensity: 1.9, offset: [-46, 20, -14] },
        ground: 0xd8bdcc, props: 0xe2ccd8,
        wind: 0.35, weeds: 1, motes: { color: 0xe0c4d8, size: 0.4, opacity: 0.45, count: 70, speed: 1, fall: 0.3 }
    },
    'calloway-gang': { // Twin Forks: warm afternoon
        mood: 'warm afternoon',
        sky: [0x5ea6e0, 0xa8d0e6, 0xf8dca0, 0xf8dfa8],
        fog: { color: 0xf3d9a0, near: 50, far: 120 },
        hemi: { sky: 0xfff0d0, ground: 0xc9954f, intensity: 1.65 },
        sun: { color: 0xffd48a, intensity: 2.6, offset: [-32, 36, -14] },
        ground: 0xfff0c8, props: 0xfff2d8,
        wind: 0.5, weeds: 2, motes: { color: 0xf4dc98, size: 0.45, opacity: 0.5, count: 80, speed: 2, fall: 0.2 }
    },
    'iron-jack': { // Slagtown: grey smoke and furnace glow
        mood: 'smoke and furnace glow',
        sky: [0x4c4846, 0x6e6763, 0x8f8078, 0x9c8a80],
        fog: { color: 0x7d726b, near: 30, far: 88 },
        hemi: { sky: 0xd4ccc4, ground: 0xc8602a, intensity: 1.3 },
        sun: { color: 0xe6cdb4, intensity: 1.7, offset: [-24, 40, -20] },
        ground: 0xb2a8a0, props: 0xbcb0a8,
        wind: 0.3, weeds: 0, motes: { color: 0xff9040, size: 0.6, opacity: 0.85, count: 80, speed: 0.8, fall: -2.2 }
    },
    'mesa-morgan': { // Redstone Mesa: blazing red rock
        mood: 'blazing red rock',
        sky: [0xc25a3a, 0xe88a58, 0xf6b070, 0xf6c088],
        fog: { color: 0xe0956a, near: 42, far: 105 },
        hemi: { sky: 0xffd8b0, ground: 0xd0602f, intensity: 1.6 },
        sun: { color: 0xffb070, intensity: 3.0, offset: [-28, 42, -12] },
        ground: 0xf6b586, props: 0xf6b98c,
        wind: 0.7, weeds: 3, motes: { color: 0xf6b080, size: 1.0, opacity: 0.4, count: 90, speed: 3, fall: 0 }
    },
    'silas-vane': { // Vane's Crossing: high-noon glare
        mood: 'high-noon glare',
        sky: [0x7fbceb, 0xd0e4f2, 0xf8f0da, 0xfaf3e0],
        fog: { color: 0xf6eedc, near: 55, far: 130 },
        hemi: { sky: 0xffffff, ground: 0xe0b878, intensity: 1.8 },
        sun: { color: 0xfffae8, intensity: 3.2, offset: [-8, 60, -6] },
        ground: 0xf4e6c6, props: 0xfff4de,
        wind: 1, weeds: 4, motes: { color: 0xf8ecd0, size: 1.0, opacity: 0.45, count: 100, speed: 4.5, fall: 0 }
    },
    'el-espectro': { // Tres Rios: moon-white mist
        mood: 'moon-white mist',
        sky: [0x7d90b0, 0xa4b4cc, 0xc0ccdc, 0xc8d2e0],
        fog: { color: 0xbcc8d8, near: 18, far: 72 },
        hemi: { sky: 0xd0dcf4, ground: 0x8a98b0, intensity: 1.3 },
        sun: { color: 0xdce8ff, intensity: 1.5, offset: [24, 48, -18] },
        ground: 0xaebcc4, props: 0xc6d0dc,
        wind: 0.15, weeds: 0, motes: { color: 0xe2eaf6, size: 2.4, opacity: 0.16, count: 40, speed: 0.6, fall: 0 }
    },
    'lucky-lou': { // The Silver Belle: warm lamps on a river evening
        mood: 'lamplit evening',
        sky: [0x1c2648, 0x4a3a5a, 0xc07a4a, 0xf0a860],
        fog: { color: 0x74503c, near: 38, far: 100 },
        hemi: { sky: 0xffcc90, ground: 0x6a4630, intensity: 1.3 },
        sun: { color: 0xffbc78, intensity: 1.9, offset: [-40, 24, -16] },
        ground: 0xd2ac8a, props: 0xdcbc98,
        wind: 0.3, weeds: 0, motes: { color: 0xffd898, size: 0.3, opacity: 0.6, count: 70, speed: 0.8, fall: -0.6 }
    },
    'colonel-crane': { // Fort Pell: cold blue dusk, snow on the ramparts
        mood: 'cold blue dusk',
        sky: [0x3a4e7a, 0x6a82ae, 0xb4c4dc, 0xd0dcee],
        fog: { color: 0xbccadc, near: 34, far: 96 },
        hemi: { sky: 0xe0eaff, ground: 0xaebcd4, intensity: 1.55 },
        sun: { color: 0xdbe6ff, intensity: 1.9, offset: [-30, 34, -20] },
        ground: 0xdfe8f2, props: 0xe4ecf6,
        wind: 0.6, weeds: 0, motes: { color: 0xffffff, size: 0.9, opacity: 0.9, count: 120, speed: 2, fall: 3.5 }
    }
};

export function atmosphereFor(outlawId) {
    return ATMOSPHERES[outlawId] ?? DEFAULT_ATMOSPHERE;
}
