// src/audio.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export function resumeAudio() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
}

export function playSound(type) {
    resumeAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if(type === 'shoot') {
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(300, now); 
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if(type === 'boom') {
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(100, now); 
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.2);
        gain.gain.setValueAtTime(0.1, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if(type === 'powerup') {
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(600, now); 
        osc.frequency.linearRampToValueAtTime(1000, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); 
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if(type === 'thud') {
        osc.type = 'square'; 
        osc.frequency.setValueAtTime(100, now); 
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); 
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    }
}