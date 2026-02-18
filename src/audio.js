const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
const musicGain = audioCtx.createGain();
const sfxGain = audioCtx.createGain();
const AUDIO_SETTINGS_KEY = 'redWestAudioSettings';
const BASE_MUSIC_GAIN = 0.18;
const BASE_SFX_GAIN = 1.0;

masterGain.gain.value = 0.55;
musicGain.gain.value = BASE_MUSIC_GAIN;
sfxGain.gain.value = BASE_SFX_GAIN;

musicGain.connect(masterGain);
sfxGain.connect(masterGain);
masterGain.connect(audioCtx.destination);

let musicIntervalId = null;
let musicStep = 0;
let musicEnabled = true;
let sfxEnabled = true;

function loadAudioSettings() {
    try {
        const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
        if(!raw) return;
        const parsed = JSON.parse(raw);
        if(typeof parsed.musicEnabled === 'boolean') musicEnabled = parsed.musicEnabled;
        if(typeof parsed.sfxEnabled === 'boolean') sfxEnabled = parsed.sfxEnabled;
    } catch {
        // Use defaults if settings are missing or malformed.
    }
}

function persistAudioSettings() {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ musicEnabled, sfxEnabled }));
}

function applyAudioSettings() {
    musicGain.gain.value = musicEnabled ? BASE_MUSIC_GAIN : 0;
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
    gain.connect(musicGain);
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
    gain.connect(musicGain);
    osc.start(when);
    osc.stop(when + 0.16);
}

function startBackgroundTrack() {
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

function stopBackgroundTrack() {
    if(musicIntervalId === null) return;
    clearInterval(musicIntervalId);
    musicIntervalId = null;
}

loadAudioSettings();
applyAudioSettings();

export function resumeAudio() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    if(musicEnabled) startBackgroundTrack();
}

export function playSound(type) {
    resumeAudio();
    if(!sfxEnabled) return;
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

export function getAudioSettings() {
    return { musicEnabled, sfxEnabled };
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
