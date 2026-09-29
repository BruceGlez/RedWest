import { keys, touch } from './input.js';

// Twin-stick touch controls: the left half of the screen moves, the right half aims and fires.
// Sticks float: each appears where the thumb lands. Only active on touch devices.
const STICK_RADIUS = 56;
const DEAD_ZONE = 0.18;
export const FIRE_THRESHOLD = 0.35;
const TAP_MS = 250;
const AUTO_FIRE_KEY = 'redWestAutoFire';

// Archero-style option: fire at the nearest enemy automatically whenever you stop moving.
function loadAutoFire() {
    try {
        return localStorage.getItem(AUTO_FIRE_KEY) === '1';
    } catch {
        return false;
    }
}

function setAutoFire(enabled) {
    touch.autoFire = enabled;
    try {
        localStorage.setItem(AUTO_FIRE_KEY, enabled ? '1' : '0');
    } catch {
        // Keeps working for this session.
    }
    const button = document.getElementById('settings-autofire-btn');
    if(button) {
        button.textContent = `Auto-fire when still: ${enabled ? 'ON' : 'OFF'}`;
        button.className = enabled ? '' : 'off';
    }
}

// Screen-space drag from the stick origin -> normalized vector (length <= 1) with a dead zone.
// The camera looks down the world -Z axis, so screen x/y map directly onto world x/z.
export function stickVector(originX, originY, x, y, radius = STICK_RADIUS) {
    const dx = x - originX;
    const dy = y - originY;
    const length = Math.hypot(dx, dy);
    if(length === 0) return { x: 0, y: 0, magnitude: 0 };
    const magnitude = Math.min(1, length / radius);
    if(magnitude < DEAD_ZONE) return { x: 0, y: 0, magnitude: 0 };
    return { x: (dx / length) * magnitude, y: (dy / length) * magnitude, magnitude };
}

export function isTouchDevice() {
    return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

// onTap fires for a quick touch that barely moves (Brawl Stars-style quick fire).
function createStick(zone, onChange, onTap = null) {
    const base = zone.querySelector('.stick-base');
    const knob = zone.querySelector('.stick-knob');
    let pointerId = null;
    let originX = 0;
    let originY = 0;
    let downAt = 0;
    let maxMagnitude = 0;

    function place(x, y) {
        const rect = zone.getBoundingClientRect();
        base.style.left = `${x - rect.left}px`;
        base.style.top = `${y - rect.top}px`;
    }

    function release(tapped = false) {
        pointerId = null;
        if(tapped && onTap) onTap();
        base.classList.remove('active');
        knob.style.transform = 'translate(-50%, -50%)';
        onChange({ x: 0, y: 0, magnitude: 0 }, false);
    }

    zone.addEventListener('pointerdown', event => {
        if(pointerId !== null) return;
        event.preventDefault();
        pointerId = event.pointerId;
        try {
            zone.setPointerCapture(pointerId); // keep tracking the thumb if it slides off the zone
        } catch {
            // Not every browser allows capture for every pointer; tracking still works inside the zone.
        }
        originX = event.clientX;
        originY = event.clientY;
        downAt = performance.now();
        maxMagnitude = 0;
        place(originX, originY);
        base.classList.add('active');
        onChange({ x: 0, y: 0, magnitude: 0 }, true);
    });
    zone.addEventListener('pointermove', event => {
        if(event.pointerId !== pointerId) return;
        event.preventDefault();
        const v = stickVector(originX, originY, event.clientX, event.clientY);
        maxMagnitude = Math.max(maxMagnitude, v.magnitude);
        knob.style.transform = `translate(calc(-50% + ${v.x * STICK_RADIUS}px), calc(-50% + ${v.y * STICK_RADIUS}px))`;
        onChange(v, true);
    });
    zone.addEventListener('pointerup', event => {
        if(event.pointerId !== pointerId) return;
        release(performance.now() - downAt < TAP_MS && maxMagnitude < FIRE_THRESHOLD);
    });
    for(const type of ['pointercancel', 'lostpointercapture']) {
        zone.addEventListener(type, event => { if(event.pointerId === pointerId) release(); });
    }
    return { release };
}

function holdButton(button, onDown, onUp = () => {}) {
    button.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        button.classList.add('pressed');
        onDown();
    });
    for(const type of ['pointerup', 'pointercancel', 'pointerleave']) {
        button.addEventListener(type, () => {
            button.classList.remove('pressed');
            onUp();
        });
    }
}

export function setupTouchControls() {
    if(!isTouchDevice()) return false;
    document.body.classList.add('touch');
    touch.enabled = true;

    const moveStick = createStick(document.getElementById('stick-move'), v => {
        touch.moveX = v.x;
        touch.moveY = v.y;
    });
    const aimStick = createStick(document.getElementById('stick-aim'), (v, held) => {
        touch.aiming = held && v.magnitude > 0;
        if(v.magnitude > 0) {
            touch.aimX = v.x;
            touch.aimY = v.y;
        }
        touch.firing = held && v.magnitude >= FIRE_THRESHOLD;
    }, () => {
        touch.quickFireAt = performance.now();
    });

    setAutoFire(loadAutoFire());
    document.getElementById('settings-autofire-btn')?.addEventListener('click', () => setAutoFire(!touch.autoFire));

    holdButton(document.getElementById('btn-dash'), () => { keys.shift = true; }, () => { keys.shift = false; });
    holdButton(document.getElementById('btn-swap'), () => { keys.weaponSwitchRequested = true; });
    holdButton(document.getElementById('btn-pause'), () => { keys.pauseToggleRequested = true; });

    // PLAY also takes the browser fullscreen in landscape where that is allowed.
    document.getElementById('play-btn').addEventListener('click', enterAppMode);
    document.getElementById('restart-msg').addEventListener('click', () => {
        if(document.getElementById('restart-msg').style.display !== 'none') keys.restartRequested = true;
    });

    // Lifting every finger (e.g. a notification or app switch) must not leave a stick held.
    window.addEventListener('blur', () => {
        moveStick.release();
        aimStick.release();
        keys.shift = false;
    });
    return true;
}

function enterAppMode() {
    const root = document.documentElement;
    if(document.fullscreenElement || !root.requestFullscreen) return;
    // No orientation lock: the game plays upright or sideways.
    root.requestFullscreen({ navigationUI: 'hide' })
        .catch(() => { /* iOS Safari and some browsers refuse; the home-screen app is fullscreen anyway. */ });
}
