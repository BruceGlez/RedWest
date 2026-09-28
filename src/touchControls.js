import { keys, touch } from './input.js';

// Twin-stick touch controls: the left half of the screen moves, the right half aims and fires.
// Sticks float: each appears where the thumb lands. Only active on touch devices.
const STICK_RADIUS = 56;
const DEAD_ZONE = 0.18;
export const FIRE_THRESHOLD = 0.35;

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

function createStick(zone, onChange) {
    const base = zone.querySelector('.stick-base');
    const knob = zone.querySelector('.stick-knob');
    let pointerId = null;
    let originX = 0;
    let originY = 0;

    function place(x, y) {
        const rect = zone.getBoundingClientRect();
        base.style.left = `${x - rect.left}px`;
        base.style.top = `${y - rect.top}px`;
    }

    function release() {
        pointerId = null;
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
        place(originX, originY);
        base.classList.add('active');
        onChange({ x: 0, y: 0, magnitude: 0 }, true);
    });
    zone.addEventListener('pointermove', event => {
        if(event.pointerId !== pointerId) return;
        event.preventDefault();
        const v = stickVector(originX, originY, event.clientX, event.clientY);
        knob.style.transform = `translate(calc(-50% + ${v.x * STICK_RADIUS}px), calc(-50% + ${v.y * STICK_RADIUS}px))`;
        onChange(v, true);
    });
    for(const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
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
    });

    holdButton(document.getElementById('btn-dash'), () => { keys.shift = true; }, () => { keys.shift = false; });
    holdButton(document.getElementById('btn-swap'), () => { keys.weaponSwitchRequested = true; });
    holdButton(document.getElementById('btn-pause'), () => { keys.pauseToggleRequested = true; });

    // Tap anywhere on the start screen (outside its buttons) to draw; go fullscreen landscape where allowed.
    document.getElementById('start-screen').addEventListener('click', event => {
        if(event.target.closest('button')) return;
        keys.startRequested = true;
        enterAppMode();
    });
    document.getElementById('restart-msg').addEventListener('click', () => {
        if(document.getElementById('input-section').style.display === 'none') keys.restartRequested = true;
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
    root.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation?.lock?.('landscape'))
        .catch(() => { /* iOS Safari and some browsers refuse; the home-screen app is fullscreen anyway. */ });
}
