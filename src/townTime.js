// The time of day in Frontier Town (TOWN_PLAN.md, a town that reacts): while the town is open the light slowly goes
// from the dusk it has always had, through night and a pink dawn and a hazy day, and back to dusk. A whole round takes
// ten minutes, so it is a slow change you notice, not a flicker. Pure numbers, so it can be unit tested; the scene
// applies them (src/townScene.js setTimeOfDay). `?time=off` keeps it at dusk.

export const CYCLE_SECONDS = 600;

// Colours are 0xRRGGBB. hemiSky / hemiGround / hemiI: the sky light. sun / sunI: the low sun (or the moon).
// sky: background and fog. glow: the warm band at the horizon. lamps: the glow of lamp and window materials.
// lights: how strong the real lamp lights are. bg: brightness of the painted sky when LOOK is on.
// `at` is the point in the round, 0 to 1; the round starts and ends at dusk.
export const KEYFRAMES = [
    { at: 0.00, name: 'dusk',  hemiSky: 0x8fc3cf, hemiGround: 0x5a3a24, hemiI: 2.4, sun: 0xffa860, sunI: 2.8, sky: 0x1d3640, glow: 0.35, lamps: 1.0, lights: 1.0, bg: 1.0 },
    { at: 0.30, name: 'night', hemiSky: 0x24385c, hemiGround: 0x181420, hemiI: 1.3, sun: 0x7f94d0, sunI: 1.0, sky: 0x08101c, glow: 0.0,  lamps: 1.5, lights: 1.6, bg: 0.4 },
    { at: 0.58, name: 'dawn',  hemiSky: 0xc9a8b8, hemiGround: 0x6a4a40, hemiI: 2.0, sun: 0xffb08a, sunI: 2.2, sky: 0x4a4252, glow: 0.5,  lamps: 0.8, lights: 0.6, bg: 0.9 },
    { at: 0.78, name: 'day',   hemiSky: 0xcfe3ee, hemiGround: 0x8a6a48, hemiI: 2.8, sun: 0xffe9c4, sunI: 3.2, sky: 0x6f93a8, glow: 0.05, lamps: 0.25, lights: 0.1, bg: 1.7 },
    { at: 1.00, name: 'dusk',  hemiSky: 0x8fc3cf, hemiGround: 0x5a3a24, hemiI: 2.4, sun: 0xffa860, sunI: 2.8, sky: 0x1d3640, glow: 0.35, lamps: 1.0, lights: 1.0, bg: 1.0 }
];

const COLOURS = ['hemiSky', 'hemiGround', 'sun', 'sky'];
const NUMBERS = ['hemiI', 'sunI', 'glow', 'lamps', 'lights', 'bg'];

const mixNumber = (a, b, u) => a + (b - a) * u;
function mixColour(a, b, u) {
    const channel = shift => Math.round(mixNumber((a >> shift) & 255, (b >> shift) & 255, u));
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
const ease = u => u * u * (3 - 2 * u); // slow in, slow out

// The light at a moment, `seconds` into the town's day (any number of seconds; it repeats).
export function skyAt(seconds) {
    const f = ((seconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS / CYCLE_SECONDS;
    let i = 0;
    while(i < KEYFRAMES.length - 2 && f >= KEYFRAMES[i + 1].at) i++;
    const a = KEYFRAMES[i], b = KEYFRAMES[i + 1];
    const u = ease(Math.max(0, Math.min(1, (f - a.at) / (b.at - a.at))));
    const out = { name: u < 0.5 ? a.name : b.name };
    for(const key of COLOURS) out[key] = mixColour(a[key], b[key], u);
    for(const key of NUMBERS) out[key] = mixNumber(a[key], b[key], u);
    return out;
}
