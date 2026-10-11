// The tray for the found elements of Section 1 (Dynamite, Whiskey) and the hiding pip (docs/design/pete-section1-gameplay.md, sections 4 and 6).
// Two slots at the bottom left: tap one to pick it, tap THROW (or press F) to throw it. A "HIDDEN" pip counts the seconds left in a hiding place.
// On a keyboard F, V and E do the same; the tray shows the keys. The model is plain data so it tests without a browser.

import { keys, touch } from './input.js';

const LABELS = { dynamite: 'DYNAMITE', whiskey: 'WHISKEY' };
const ORDER = ['dynamite', 'whiskey'];

// What to draw, from the Section 1 runtime: { slots: {dynamite, whiskey}, selected, cooldown } and the hiding state. Null when there is nothing to show.
export function trayModel(elements, hiding) {
    const slots = ORDER.map(id => ({ id, label: LABELS[id], count: elements?.slots?.[id] ?? 0, selected: elements?.selected === id }));
    const holding = slots.some(s => s.count > 0);
    const hidden = !!hiding?.hidden;
    if(!holding && !hidden && !(hiding?.cooldown > 0)) return null;
    return {
        slots: holding ? slots : [],
        ready: (elements?.cooldown ?? 0) <= 0,
        hint: touch.enabled ? '' : 'F THROW  V SWAP',
        pip: hidden ? `HIDDEN ${Math.ceil(hiding.left)}s` : (hiding?.cooldown > 0 ? `HIDE READY IN ${Math.ceil(hiding.cooldown)}s` : '')
    };
}

let root = null;
let slotsBox = null, pip = null, hint = null, throwButton = null;
let pick = null;            // set by the mode: choose an element by id

export function mountElementTray(doc = globalThis.document, onPick = null) {
    pick = onPick;
    if(root || !doc?.body) return root;
    root = doc.createElement('div');
    root.id = 'element-tray';
    root.className = 'element-tray';
    root.style.display = 'none';
    pip = doc.createElement('div'); pip.className = 'element-pip';
    slotsBox = doc.createElement('div'); slotsBox.className = 'element-slots';
    hint = doc.createElement('div'); hint.className = 'element-hint';
    throwButton = doc.createElement('button');
    throwButton.type = 'button'; throwButton.className = 'element-throw'; throwButton.textContent = 'THROW';
    throwButton.addEventListener('pointerdown', e => { e.preventDefault(); keys.throwRequested = true; });
    root.append(pip, slotsBox, throwButton, hint);
    doc.body.appendChild(root);
    return root;
}

export function renderElementTray(model, doc = globalThis.document) {
    const r = root ?? mountElementTray(doc);
    if(!r) return;
    if(!model) { r.style.display = 'none'; return; }
    r.style.display = 'flex';
    pip.textContent = model.pip;
    pip.style.display = model.pip ? 'block' : 'none';
    hint.textContent = model.hint;
    throwButton.style.display = touch.enabled && model.slots.length ? 'block' : 'none';
    throwButton.disabled = !model.ready;
    slotsBox.textContent = '';
    for(const slot of model.slots) {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = `element-slot${slot.selected ? ' selected' : ''}${slot.count === 0 ? ' empty' : ''}`;
        b.textContent = `${slot.label} ${slot.count}`;
        b.addEventListener('pointerdown', e => { e.preventDefault(); if(slot.count > 0) pick?.(slot.id); });
        slotsBox.appendChild(b);
    }
}

export function resetElementTray() { root?.remove(); root = null; slotsBox = pip = hint = throwButton = null; pick = null; }
