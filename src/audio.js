import { SFX, MUSIC, VOICE } from './audioManifest.js';

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
masterGain.connect(audioCtx.destination);

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
        const url = new URL(`audio/${id}.mp3`, document.baseURI);
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

function playBuffer(buffer, destination, volume = 1) {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
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

// Effects are small, so they all load up front, with the menu music so it is ready for the first tap.
for(const key of Object.keys(SFX)) loadBuffer('sfx', key);
loadBuffer('music', 'home');

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

function playRecordedSfx(key) {
    const buffer = buffers.get(`sfx/${key}`);
    if(!buffer) return false;
    const now = audioCtx.currentTime;
    if(now - (lastPlayedAt.get(key) ?? -1) < REPEAT_GAP) return true;
    lastPlayedAt.set(key, now);
    playBuffer(buffer, sfxGain);
    return true;
}

// ---------- Music: a recorded loop per screen, the synth loop as fallback ----------
let musicTrack = 'home';
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
