// The sound of each place, as numbers (the sound engine in audio.js turns them into noise and tones, so there are no
// new files to download): a bed that plays all the time under the fight, and what each footstep sounds like on the
// ground. Pure data and small functions, so they can be tested.

// Beds. wind: how loud the wind is (0 to 1, scaled by the stage's wind) and how high it whistles. extra: a second layer.
//   night: crickets. bell: a far bell. day: a bird now and then. furnace: a low hum. mist: a slow, soft swell.
//   river: water lapping. The whole bed is kept low: it is a bed, not a sound effect.
export const BEDS = {
    wind: { pitch: 500, extra: null },
    night: { pitch: 380, extra: 'crickets' },
    bell: { pitch: 420, extra: 'bell' },
    day: { pitch: 560, extra: 'birds' },
    furnace: { pitch: 300, extra: 'hum' },
    mist: { pitch: 340, extra: 'swell' },
    river: { pitch: 330, extra: 'water' }
};

// Footsteps. Each is a short burst of filtered noise (filter, freq in Hz, decay in seconds, gain), sometimes with a
// low knock under it (knock in Hz).
export const SURFACES = {
    sand: { filter: 'lowpass', freq: 900, decay: 0.09, gain: 0.11 },
    gravel: { filter: 'bandpass', freq: 2500, decay: 0.07, gain: 0.1, crunch: true },
    grass: { filter: 'lowpass', freq: 600, decay: 0.11, gain: 0.07 },
    soil: { filter: 'lowpass', freq: 700, decay: 0.1, gain: 0.1 },
    cinder: { filter: 'highpass', freq: 3000, decay: 0.06, gain: 0.08, crunch: true },
    rock: { filter: 'bandpass', freq: 1500, decay: 0.05, gain: 0.11 },
    planks: { filter: 'bandpass', freq: 800, decay: 0.08, gain: 0.1, knock: 160 },
    snow: { filter: 'bandpass', freq: 4000, decay: 0.12, gain: 0.07, crunch: true }
};

// The bed for a stage: its own bed and how strongly the wind blows (atmosphere.js gives both).
export function bedFor(sound, wind) {
    const bed = BEDS[sound.bed] ?? BEDS.wind;
    // Wind level is quiet at the low end and never louder than a gentle whoosh.
    return { key: `${sound.bed}:${wind}`, pitch: bed.pitch, level: 0.012 + wind * 0.05, extra: bed.extra };
}

export function footstepFor(surface, left) {
    const spec = SURFACES[surface] ?? SURFACES.sand;
    // Left and right feet differ a touch, so a walk does not sound like a metronome.
    return { ...spec, freq: spec.freq * (left ? 0.95 : 1.05), gain: spec.gain * (left ? 1 : 0.9) };
}
