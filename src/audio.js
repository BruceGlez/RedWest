import { SFX, MUSIC, VOICE } from './audioManifest.js';
import { DEMO, assetUrl } from './demo.js';
import { footstepFor } from './soundscape.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
const musicGain = audioCtx.createGain();
const sfxGain = audioCtx.createGain();
// Music volume scales both the recorded tracks and the synthesized fallback loop.
const synthMusicGain = audioCtx.createGain();
const fileMusicGain = audioCtx.createGain();
const AUDIO_SETTINGS_KEY = 'redWestAudioSettings';
const DEFAULT_MUSIC_VOLUME = 0.6;
const BASE_SFX_GAIN = 1.0;

masterGain.gain.value = 0.55;
musicGain.gain.value = DEFAULT_MUSIC_VOLUME;
sfxGain.gain.value = BASE_SFX_GAIN;
synthMusicGain.gain.value = 0.18 / DEFAULT_MUSIC_VOLUME; // the synth loop's original level at the default volume
fileMusicGain.gain.value = 0.6;

synthMusicGain.connect(musicGain);
fileMusicGain.connect(musicGain);
musicGain.connect(masterGain);
sfxGain.connect(masterGain);
// A limiter on the whole mix: many shots and a big explosion in one frame can no longer clip.
const limiter = audioCtx.createDynamicsCompressor();
limiter.threshold.value = -10;
limiter.knee.value = 6;
limiter.ratio.value = 12;
limiter.attack.value = 0.003;
limiter.release.value = 0.2;
masterGain.connect(limiter);
limiter.connect(audioCtx.destination);
// The bed under the fight (wind, crickets...) and the footsteps have their own level, and follow the effects switch.
const ambienceGain = audioCtx.createGain();
ambienceGain.gain.value = 1;
ambienceGain.connect(masterGain);

let musicIntervalId = null;
let musicStep = 0;
let musicEnabled = true;
let sfxEnabled = true;
let musicVolume = DEFAULT_MUSIC_VOLUME;

function loadAudioSettings() {
    try {
        const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
        if(!raw) return;
        const parsed = JSON.parse(raw);
        if(typeof parsed.musicEnabled === 'boolean') musicEnabled = parsed.musicEnabled;
        if(typeof parsed.sfxEnabled === 'boolean') sfxEnabled = parsed.sfxEnabled;
        if(typeof parsed.musicVolume === 'number' && parsed.musicVolume >= 0 && parsed.musicVolume <= 1) musicVolume = parsed.musicVolume;
    } catch {
        // Use defaults if settings are missing or malformed.
    }
}

function persistAudioSettings() {
    try {
        localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ musicEnabled, sfxEnabled, musicVolume }));
    } catch {
        // Settings still apply for this session.
    }
}

function applyAudioSettings() {
    musicGain.gain.value = musicEnabled ? musicVolume : 0;
    sfxGain.gain.value = sfxEnabled ? BASE_SFX_GAIN : 0;
    ambienceGain.gain.value = sfxEnabled ? 1 : 0;
}

function scheduleTone(freq, duration, when, volume, type = 'triangle') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(synthMusicGain);
    osc.start(when);
    osc.stop(when + duration);
}

function playKick(when) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, when);
    osc.frequency.exponentialRampToValueAtTime(38, when + 0.15);
    gain.gain.setValueAtTime(0.22, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
    osc.connect(gain);
    gain.connect(synthMusicGain);
    osc.start(when);
    osc.stop(when + 0.16);
}

function startSynthTrack() {
    if(musicIntervalId !== null) return;
    const bassPattern = [110, 110, 123.47, 98, 110, 110, 123.47, 98];
    const leadPattern = [329.63, 293.66, 261.63, 293.66, 329.63, 392.0, 329.63, 293.66];
    const stepDuration = 0.3;

    musicIntervalId = setInterval(() => {
        const now = audioCtx.currentTime + 0.03;
        const idx = musicStep % bassPattern.length;
        scheduleTone(bassPattern[idx], 0.24, now, 0.07, 'triangle');
        if((musicStep % 2) === 0) scheduleTone(leadPattern[idx], 0.12, now + 0.05, 0.045, 'square');
        if((musicStep % 4) === 0) playKick(now);
        musicStep++;
    }, stepDuration * 1000);
}

function stopSynthTrack() {
    if(musicIntervalId === null) return;
    clearInterval(musicIntervalId);
    musicIntervalId = null;
}

// ---------- Recorded audio (public/audio, made by tools/elevenlabs.mjs) ----------
// Each file loads once. Until it has loaded, or if it fails, the synthesized sound plays instead.
const buffers = new Map(); // 'dir/key' -> AudioBuffer, or null when the file failed
const loading = new Map(); // 'dir/key' -> Promise<AudioBuffer|null>

function loadBuffer(dir, key) {
    const id = `${dir}/${key}`;
    if(!loading.has(id)) {
        const url = assetUrl(`audio/${id}.mp3`);
        loading.set(id, fetch(url)
            .then(response => {
                if(!response.ok) throw new Error(`${response.status}`);
                return response.arrayBuffer();
            })
            .then(data => new Promise((resolve, reject) => audioCtx.decodeAudioData(data, resolve, reject)))
            .then(buffer => {
                buffers.set(id, buffer);
                return buffer;
            })
            .catch(() => {
                buffers.set(id, null);
                return null;
            }));
    }
    return loading.get(id);
}

function playBuffer(buffer, destination, volume = 1, rate = 1) {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    if(volume === 1) source.connect(destination);
    else {
        const gain = audioCtx.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(destination);
    }
    source.start();
    return source;
}

// Every download started so far (the entry screen's loading bar counts them).
export function audioDownloads() {
    return [...loading.values()];
}

// Effects are small, so they all load up front, with the menu music so it is ready for the first tap.
for(const key of Object.keys(SFX)) loadBuffer('sfx', key);
if(!DEMO) loadBuffer('music', 'home');

// Old sound names from before the recorded effects.
const SFX_ALIASES = { shoot: 'shot-revolver', thud: 'hit' };
// When a recorded effect is missing, the closest built-in beep plays.
const BEEP_FOR = {
    'shot-revolver': 'shoot', 'shot-twins': 'shoot', 'shot-rifle': 'shoot', 'shot-shotgun': 'shoot',
    'shot-sawedoff': 'shoot', 'shot-buffalo': 'shoot', 'enemy-shot': 'shoot', dash: 'shoot', fuse: 'shoot',
    hurt: 'hit', clang: 'hit', howl: 'heatUp', 'outlaw-down': 'heatUp', coin: 'powerup', bounty: 'powerup'
};
// Many enemies can fire in the same frame; one copy per key per 30 ms keeps it from clipping.
const lastPlayedAt = new Map();
const REPEAT_GAP = 0.03;
// Gunshots are the most repeated sound, so they sit under the rest of the mix (playtest: "a bit
// overwhelming"), and each one is pitched slightly differently so rapid fire does not drone.
export const SFX_MIX = {
    'shot-revolver': 0.45, 'shot-twins': 0.4, 'shot-rifle': 0.5, 'shot-shotgun': 0.5, 'shot-sawedoff': 0.5,
    'shot-buffalo': 0.6, 'enemy-shot': 0.3
};
const REPEAT_GAPS = { 'enemy-shot': 0.08 };

function playRecordedSfx(key) {
    const buffer = buffers.get(`sfx/${key}`);
    if(!buffer) return false;
    const now = audioCtx.currentTime;
    if(now - (lastPlayedAt.get(key) ?? -1) < (REPEAT_GAPS[key] ?? REPEAT_GAP)) return true;
    lastPlayedAt.set(key, now);
    const isShot = key in SFX_MIX;
    if(isShot) {
        // Each shot is pitched a little differently and a little brighter or duller, so rapid fire does not drone.
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.93 + Math.random() * 0.14;
        const tone = audioCtx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 7000 + Math.random() * 9000;
        const level = audioCtx.createGain();
        level.gain.value = SFX_MIX[key];
        source.connect(tone);
        tone.connect(level);
        level.connect(sfxGain);
        source.start();
    } else {
        playBuffer(buffer, sfxGain, SFX_MIX[key] ?? 1, 1);
    }
    return true;
}

// ---------- Music: a recorded loop per screen, the synth loop as fallback ----------
let musicTrack = DEMO ? 'fight' : 'home';
let musicSource = null;
let musicSourceTrack = null;
const switchPending = new Set(); // tracks that will replace the synth loop once loaded

// Only one music source ever exists. Each step is guarded on its own so a failing stop()
// (seen on iPhone) still disconnects the old loop instead of leaving it playing untracked.
function stopRecordedMusic() {
    const source = musicSource;
    musicSource = null;
    musicSourceTrack = null;
    if(!source) return;
    try { source.stop(); } catch { /* already stopped */ }
    try { source.disconnect(); } catch { /* already disconnected */ }
}

function startBackgroundTrack() {
    const id = `music/${musicTrack}`;
    const buffer = buffers.get(id);
    if(buffer) {
        stopSynthTrack();
        if(musicSourceTrack === musicTrack) return;
        stopRecordedMusic();
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(fileMusicGain);
        musicSource = source;
        musicSourceTrack = musicTrack;
        try {
            source.start();
        } catch {
            stopRecordedMusic();
        }
        return;
    }
    // Not loaded (yet): keep the synth loop going, then switch once the file arrives.
    stopRecordedMusic();
    startSynthTrack();
    if(!buffers.has(id) && !switchPending.has(id)) {
        switchPending.add(id);
        const wanted = musicTrack;
        loadBuffer('music', wanted).then(loaded => {
            switchPending.delete(id);
            if(loaded && musicEnabled && musicTrack === wanted) startBackgroundTrack();
        });
    }
}

function stopBackgroundTrack() {
    stopSynthTrack();
    stopRecordedMusic();
}

loadAudioSettings();
applyAudioSettings();

// Called on every tap and key press: unlocks audio, and starts the music only if none is playing.
// ---------- Place sounds, made from noise and tones (no files): the bed under the fight, and footsteps ----------
const noiseBuffer = (() => {
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
})();

let bed = null; // { key, nodes: [stoppable...], gain }

function loopingNoise(destination, filterType, freq, q = 0.7) {
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    source.connect(filter);
    filter.connect(destination);
    source.start();
    return { source, filter };
}

// A slow wobble on a parameter: freq Hz, depth as a share of the parameter's own value.
function wobble(param, base, freq, depth, nodes) {
    const lfo = audioCtx.createOscillator();
    const amount = audioCtx.createGain();
    lfo.frequency.value = freq;
    amount.gain.value = base * depth;
    lfo.connect(amount);
    amount.connect(param);
    lfo.start();
    nodes.push(lfo);
}

// Plays the bed for a stage (soundscape.bedFor). A stage change fades the old bed out and the new one in.
export function setBed(spec) {
    if(bed?.key === spec.key) return;
    stopBed();
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    gain.connect(ambienceGain);
    const nodes = [];
    const wind = loopingNoise(gain, 'bandpass', spec.pitch, 0.6);
    nodes.push(wind.source);
    wobble(wind.filter.frequency, spec.pitch, 0.11, 0.35, nodes); // gusts rise and fall
    // The second layer of some beds, each very quiet.
    const layer = audioCtx.createGain();
    layer.gain.value = 0;
    layer.connect(gain);
    if(spec.extra === 'crickets') {
        const tone = audioCtx.createOscillator(); tone.frequency.value = 4300; tone.connect(layer); tone.start(); nodes.push(tone);
        wobble(layer.gain, 0.01, 7, 1, nodes); layer.gain.value = 0.012;
    } else if(spec.extra === 'hum') {
        const tone = audioCtx.createOscillator(); tone.type = 'sawtooth'; tone.frequency.value = 55;
        const low = audioCtx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 180;
        tone.connect(low); low.connect(layer); tone.start(); nodes.push(tone); layer.gain.value = 0.05;
    } else if(spec.extra === 'water') {
        const water = loopingNoise(layer, 'lowpass', 420); nodes.push(water.source);
        wobble(layer.gain, 0.04, 0.35, 1, nodes); layer.gain.value = 0.05;
    } else if(spec.extra === 'swell') {
        const swell = loopingNoise(layer, 'lowpass', 300); nodes.push(swell.source);
        wobble(layer.gain, 0.03, 0.08, 1, nodes); layer.gain.value = 0.04;
    } else if(spec.extra === 'bell' || spec.extra === 'birds') {
        // Now and then: a single soft tone, on a slow timer.
        const timer = setInterval(() => {
            if(audioCtx.state !== 'running') return;
            const t = audioCtx.currentTime;
            const tone = audioCtx.createOscillator();
            const envelope = audioCtx.createGain();
            tone.type = 'sine';
            tone.frequency.value = spec.extra === 'bell' ? 392 : 2200 + Math.random() * 900;
            envelope.gain.setValueAtTime(0.0001, t);
            envelope.gain.exponentialRampToValueAtTime(spec.extra === 'bell' ? 0.03 : 0.012, t + 0.02);
            envelope.gain.exponentialRampToValueAtTime(0.0001, t + (spec.extra === 'bell' ? 2.5 : 0.18));
            tone.connect(envelope); envelope.connect(gain);
            tone.start(t); tone.stop(t + 2.6);
        }, spec.extra === 'bell' ? 11000 : 5000);
        nodes.push({ stop: () => clearInterval(timer) });
    }
    gain.gain.linearRampToValueAtTime(spec.level, audioCtx.currentTime + 1.5);
    bed = { key: spec.key, nodes, gain };
}

function stopBed() {
    if(!bed) return;
    const old = bed;
    bed = null;
    const now = audioCtx.currentTime;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + 0.8);
    setTimeout(() => {
        for(const node of old.nodes) { try { node.stop(); } catch { /* already stopped */ } }
        old.gain.disconnect();
    }, 1000);
}

// One footstep on the given ground (SURFACES in soundscape.js).
let lastStepAt = 0;
export function playFootstep(surface, left) {
    const now = audioCtx.currentTime;
    if(audioCtx.state !== 'running' || now - lastStepAt < 0.08) return;
    lastStepAt = now;
    const spec = footstepFor(surface, left);
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = spec.filter;
    filter.frequency.value = spec.freq;
    filter.Q.value = 0.8;
    const envelope = audioCtx.createGain();
    envelope.gain.setValueAtTime(spec.gain, now);
    if(spec.crunch) envelope.gain.setValueAtTime(spec.gain * 0.3, now + spec.decay * 0.35); // a second grain: it crunches
    if(spec.crunch) envelope.gain.setValueAtTime(spec.gain * 0.8, now + spec.decay * 0.4);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + spec.decay);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(ambienceGain);
    source.start(now, Math.random(), spec.decay + 0.02);
    if(spec.knock) {
        const knock = audioCtx.createOscillator();
        const knockGain = audioCtx.createGain();
        knock.frequency.value = spec.knock;
        knockGain.gain.setValueAtTime(spec.gain * 1.2, now);
        knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
        knock.connect(knockGain);
        knockGain.connect(ambienceGain);
        knock.start(now);
        knock.stop(now + 0.08);
    }
}

export function resumeAudio() {
    if(audioCtx.state !== 'running' && audioCtx.state !== 'closed') audioCtx.resume().catch(() => {});
    if(musicEnabled && !musicSource && musicIntervalId === null) startBackgroundTrack();
}

// Plays a sound by its key in src/audioManifest.js (or an old name like 'shoot').
export function playSound(type) {
    resumeAudio();
    if(!sfxEnabled) return;
    const key = SFX_ALIASES[type] || type;
    if(playRecordedSfx(key)) return;
    playBeep(BEEP_FOR[key] || key);
}

function playBeep(type) {
    const now = audioCtx.currentTime;

    if(type === 'shoot') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if(type === 'boom') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(15, now + 0.2);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if(type === 'powerup') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1000, now + 0.1);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if(type === 'break') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.14);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if(type === 'heatUp') {
        // Two quick rising notes: the chain paid off.
        [520, 780].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const start = now + (i * 0.07);
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.04, start);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
            osc.connect(gain);
            gain.connect(sfxGain);
            osc.start(start);
            osc.stop(start + 0.1);
        });
    } else if(type === 'heatLost') {
        // A falling tone: Heat was wiped by damage.
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.36);
    } else if(type === 'hit' || type === 'thud') {
        const bodyOsc = audioCtx.createOscillator();
        const clickOsc = audioCtx.createOscillator();
        const bodyGain = audioCtx.createGain();
        const clickGain = audioCtx.createGain();

        bodyOsc.type = 'square';
        bodyOsc.frequency.setValueAtTime(220, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        bodyGain.gain.setValueAtTime(0.09, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(1200, now);
        clickOsc.frequency.exponentialRampToValueAtTime(350, now + 0.03);
        clickGain.gain.setValueAtTime(0.045, now);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

        bodyOsc.connect(bodyGain);
        clickOsc.connect(clickGain);
        bodyGain.connect(sfxGain);
        clickGain.connect(sfxGain);

        bodyOsc.start(now);
        clickOsc.start(now);
        bodyOsc.stop(now + 0.1);
        clickOsc.stop(now + 0.04);
    }
}

// Switches the music loop: 'home', 'fight' or 'showdown'.
export function setMusicTrack(track) {
    if(DEMO) track = 'fight'; // the playable ad carries one music track
    if(!MUSIC[track] || track === musicTrack) return;
    musicTrack = track;
    if(musicEnabled && (musicIntervalId !== null || musicSource)) startBackgroundTrack();
}

// Voice lines load when first needed. One line at a time; a line that takes over
// 2 seconds to arrive is skipped so it never plays out of context.
let voiceSource = null;
export function playVoice(key) {
    if(!VOICE[key] || !sfxEnabled) return;
    const requestedAt = performance.now();
    loadBuffer('voice', key).then(buffer => {
        if(!buffer || !sfxEnabled || performance.now() - requestedAt > 2000) return;
        if(voiceSource) {
            try { voiceSource.stop(); } catch { /* already stopped */ }
        }
        voiceSource = playBuffer(buffer, sfxGain, 1.2);
    });
}

export function getAudioSettings() {
    return { musicEnabled, sfxEnabled, musicVolume };
}

export function setMusicVolume(volume) {
    musicVolume = Math.min(1, Math.max(0, Number(volume) || 0));
    applyAudioSettings();
    persistAudioSettings();
}

export function setMusicEnabled(enabled) {
    musicEnabled = !!enabled;
    if(musicEnabled) startBackgroundTrack();
    else stopBackgroundTrack();
    applyAudioSettings();
    persistAudioSettings();
}

export function setSfxEnabled(enabled) {
    sfxEnabled = !!enabled;
    applyAudioSettings();
    persistAudioSettings();
}

export function toggleMusicEnabled() {
    setMusicEnabled(!musicEnabled);
    return musicEnabled;
}

export function toggleSfxEnabled() {
    setSfxEnabled(!sfxEnabled);
    return sfxEnabled;
}
