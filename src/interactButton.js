// The ACT button for touch screens: it shows when the marshal stands by something he can use (a door, a lever, a hiding place) and sets the
// same flag the E key sets (src/input.js: keys.interactRequested). On a keyboard the HUD prompt names the key instead and the button stays hidden.

import { keys, touch } from './input.js';

let button = null;

export function mountInteractButton(doc = globalThis.document) {
    if(button || !doc?.body) return button;
    button = doc.createElement('button');
    button.id = 'interact-button';
    button.className = 'interact-button';
    button.type = 'button';
    button.style.display = 'none';
    button.addEventListener('pointerdown', e => { e.preventDefault(); keys.interactRequested = true; });
    doc.body.appendChild(button);
    return button;
}

// text: what to show ("OPEN DOOR"), or null to hide. Only touch screens get the button.
export function setInteractHint(text, doc = globalThis.document) {
    const b = button ?? mountInteractButton(doc);
    if(!b) return;
    if(!text || !touch.enabled) { b.style.display = 'none'; return; }
    b.textContent = text;
    b.style.display = 'block';
}

// For tests: forget the page's button.
export function resetInteractButton() { button = null; }
