import * as THREE from 'three';
import { edgeIndicator } from './aimAssist.js';

// Game feel ("juice"): screen shake, hit-stop, haptics, floating text and off-screen enemy
// arrows. Everything here is presentation only; gameplay rules never read it.

let trauma = 0;
let hitStopUntil = 0;

export function addShake(amount) {
    trauma = Math.min(1, trauma + amount);
}

// Camera offset for this frame; trauma decays so shakes settle quickly.
export function shakeOffset(dt, time) {
    trauma = Math.max(0, trauma - (dt * 2.2));
    const strength = trauma * trauma * 1.4;
    return {
        x: Math.sin(time * 0.071) * strength,
        z: Math.sin((time * 0.083) + 1.7) * strength
    };
}

// Freeze gameplay for a moment on big impacts. `now` uses the requestAnimationFrame clock.
export function hitStop(ms, now = performance.now()) {
    hitStopUntil = Math.max(hitStopUntil, now + ms);
}

export function timeScale(now) {
    return now < hitStopUntil ? 0.04 : 1;
}

export function resetFeedback() {
    trauma = 0;
    hitStopUntil = 0;
    for(const item of floaters) item.el.style.display = 'none';
    floaters.length = 0;
    for(const arrow of arrows) arrow.style.display = 'none';
}

const HAPTIC_STYLE = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
const VIBRATE_MS = { light: 12, medium: 25, heavy: 45 };

// Native iOS/Android app: Capacitor Haptics. Browsers: the Vibration API (Android; iOS Safari has none).
export function haptic(kind = 'light') {
    try {
        const nativeHaptics = window.Capacitor?.Plugins?.Haptics;
        if(nativeHaptics && window.Capacitor?.isNativePlatform?.()) {
            nativeHaptics.impact({ style: HAPTIC_STYLE[kind] || 'LIGHT' });
        } else {
            navigator.vibrate?.(VIBRATE_MS[kind] || 12);
        }
    } catch {
        // Haptics are a bonus; never let them interrupt play.
    }
}

// ---------- Floating text (score pops, damage) ----------
const floaters = [];
const pool = [];
let layer = null;
const projected = new THREE.Vector3();

function getLayer() {
    if(!layer) layer = document.getElementById('fx-layer');
    return layer;
}

export function floatText(text, worldPosition, className = '') {
    const host = getLayer();
    if(!host) return;
    const el = pool.pop() || document.createElement('div');
    el.className = `float-text ${className}`.trim();
    el.textContent = text;
    el.style.display = 'block';
    host.appendChild(el);
    floaters.push({ el, position: worldPosition.clone(), age: 0 });
    if(floaters.length > 24) recycle(floaters.shift());
}

function recycle(item) {
    item.el.style.display = 'none';
    pool.push(item.el);
}

// ---------- Off-screen enemy arrows ----------
const arrows = [];
const MAX_ARROWS = 8;

function getArrow(i) {
    if(!arrows[i]) {
        const el = document.createElement('div');
        el.className = 'edge-arrow';
        getLayer()?.appendChild(el);
        arrows[i] = el;
    }
    return arrows[i];
}

export function updateFeedback(dt, camera, enemies, playerPosition) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    for(let i = floaters.length - 1; i >= 0; i--) {
        const item = floaters[i];
        item.age += dt;
        if(item.age > 0.9) {
            recycle(item);
            floaters.splice(i, 1);
            continue;
        }
        projected.copy(item.position).setY(item.position.y + 3 + (item.age * 4)).project(camera);
        item.el.style.transform = `translate(${(projected.x + 1) * width / 2}px, ${(1 - projected.y) * height / 2}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.35 - item.age)})`;
        item.el.style.opacity = String(Math.min(1, (0.9 - item.age) * 3));
    }

    // Nearest off-screen enemies first; the outlaw always gets an arrow.
    const offscreen = [];
    for(const enemy of enemies) {
        projected.copy(enemy.position).setY(2).project(camera);
        const edge = edgeIndicator(projected.x, projected.y, width, height);
        if(!edge) continue;
        const distance = enemy.position.distanceTo(playerPosition);
        offscreen.push({ edge, distance, boss: enemy.userData.type === 'boss' });
    }
    offscreen.sort((a, b) => (b.boss - a.boss) || (a.distance - b.distance));
    for(let i = 0; i < MAX_ARROWS; i++) {
        const info = offscreen[i];
        const arrow = getArrow(i);
        if(!arrow) continue;
        if(!info) {
            arrow.style.display = 'none';
            continue;
        }
        arrow.style.display = 'block';
        arrow.classList.toggle('boss', info.boss);
        arrow.style.opacity = String(Math.max(0.35, 1 - (info.distance / 90)));
        arrow.style.transform = `translate(${info.edge.x}px, ${info.edge.y}px) translate(-50%, -50%) rotate(${info.edge.angle}rad)`;
    }
}
