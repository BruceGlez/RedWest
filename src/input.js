import * as THREE from 'three';
import { gameState } from './state.js';

export const keys = { w:false, a:false, s:false, d:false, shift:false, space: false, mouse: false };
export const mouse = new THREE.Vector2();

export function setupInputs() {
    window.addEventListener('keydown', e => {
        if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
        if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
        if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true;
        if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;
        if(e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
        if(e.code === 'Space') keys.space = true;
        if(e.code === 'KeyR' && gameState.isGameOver) location.reload();
    });

    window.addEventListener('keyup', e => {
        if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false;
        if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false;
        if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = false;
        if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false;
        if(e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
        if(e.code === 'Space') keys.space = false;
    });

    window.addEventListener('blur', () => {
        Object.keys(keys).forEach(k => keys[k] = false);
    });

    window.addEventListener('mousemove', e => {
        const x = e.clientX;
        const y = e.clientY;
        const ch = document.getElementById('crosshair');
        if(ch) {
            ch.style.left = x + 'px';
            ch.style.top = y + 'px';
        }
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('mousedown', () => { keys.mouse = true; });
    window.addEventListener('mouseup', () => { keys.mouse = false; });
}