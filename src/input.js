import * as THREE from 'three';
import { gameState } from './state.js';
import { chase } from './stages/chaseCamera.js';

export const keys = { w:false, a:false, s:false, d:false, shift:false, space: false, mouse: false, restartRequested: false, confirmYes: false, confirmNo: false, pauseToggleRequested: false, settingsToggleRequested: false, musicToggleRequested: false, sfxToggleRequested: false, weaponSwitchRequested: false, bankRequested: false, rideOnRequested: false, startRequested: false, interactRequested: false, throwRequested: false, cycleRequested: false, orbitLeft: false, orbitRight: false };
// Right-button drag for the chase camera: pixels dragged since the camera last read them (src/stages/chaseCamera.js).
export const orbitDrag = { active: false, dx: 0, dy: 0 };
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
        if(e.code === 'KeyZ') keys.orbitLeft = true;                // swing the chase camera round
        if(e.code === 'KeyX' && !gameState.isConfirming) keys.orbitRight = true;
        if(e.code === 'KeyF') keys.throwRequested = true;           // throw the selected element (Section 1: dynamite, whiskey)
        if(e.code === 'KeyV') keys.cycleRequested = true;           // swap to the next element
        if(e.code === 'KeyE') keys.interactRequested = true;        // doors, levers, hiding places, the dialogue box (src/dialogue.js)
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
        if(e.code === 'KeyZ') keys.orbitLeft = false;
        if(e.code === 'KeyX') keys.orbitRight = false;
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
        keys.interactRequested = false;
        keys.throwRequested = false;
        keys.cycleRequested = false;
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
        if(orbitDrag.active) { orbitDrag.dx += e.movementX || 0; orbitDrag.dy += e.movementY || 0; }
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('mousedown', e => { if(e.button === 2 && chase.enabled) { orbitDrag.active = true; return; } keys.mouse = true; });
    window.addEventListener('mouseup', e => { if(e.button === 2 && chase.enabled) { orbitDrag.active = false; return; } keys.mouse = false; });
    window.addEventListener('contextmenu', e => { if(chase.enabled) e.preventDefault(); });
}
