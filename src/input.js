import * as THREE from 'three';
import { gameState } from './state.js';

export const keys = { w:false, a:false, s:false, d:false, shift:false, space: false, mouse: false, restartRequested: false, confirmYes: false, confirmNo: false, pauseToggleRequested: false, settingsToggleRequested: false, musicToggleRequested: false, sfxToggleRequested: false, weaponSwitchRequested: false, bankRequested: false, rideOnRequested: false, startRequested: false };
// Analog state from the on-screen sticks (touchControls.js). Unused on desktop.
export const touch = { enabled: false, moveX: 0, moveY: 0, aiming: false, aimX: 0, aimY: 1, firing: false, quickFireAt: 0, autoFire: false };
export const mouse = new THREE.Vector2();

export function setupInputs() {
    window.addEventListener('keydown', e => {
        // [FIX] Ignore game controls if typing in the Name Input
        if (e.target.tagName === 'INPUT') return;

        if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
        if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
        if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true;
        if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;
        if(e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
        if(e.code === 'Space') keys.space = true;
        // While the mine asks "go down?" the keys answer it: ENTER, E or Y go; ESC, X or Backspace stay.
        if(gameState.isConfirming) {
            if(e.code === 'Enter' || e.code === 'KeyE' || e.code === 'KeyY') keys.confirmYes = true;
            else if(e.code === 'Escape' || e.code === 'KeyX' || e.code === 'Backspace') keys.confirmNo = true;
            return;
        }
        if(e.code === 'KeyP' || e.code === 'Escape') keys.pauseToggleRequested = true;
        if(e.code === 'KeyO') keys.settingsToggleRequested = true;
        if(e.code === 'KeyM') keys.musicToggleRequested = true;
        if(e.code === 'KeyN') keys.sfxToggleRequested = true;
        if(e.code === 'KeyQ') keys.weaponSwitchRequested = true;
        if(e.code === 'KeyB') keys.bankRequested = true;
        if(e.code === 'KeyC') keys.rideOnRequested = true;
        
        // Only allow restart if the input section is hidden (meaning score is saved)
        if(e.code === 'KeyR' && gameState.isGameOver && document.getElementById('restart-msg').style.display !== 'none') {
            keys.restartRequested = true;
        }
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
        keys.restartRequested = false;
        keys.confirmYes = false;
        keys.confirmNo = false;
        keys.pauseToggleRequested = false;
        keys.settingsToggleRequested = false;
        keys.musicToggleRequested = false;
        keys.sfxToggleRequested = false;
        keys.weaponSwitchRequested = false;
        keys.bankRequested = false;
        keys.rideOnRequested = false;
        keys.startRequested = false;
        touch.moveX = 0;
        touch.moveY = 0;
        touch.aiming = false;
        touch.firing = false;
        touch.quickFireAt = 0;
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
