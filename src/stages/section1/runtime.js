// Section 1's rules at run time: the marshal presses E by a door, a lever, a hiding place or a notice and this decides what happens.
// No THREE and no document: the mode passes in the marshal's place, what he pressed and the dialogue, so it tests in node.
// The state it keeps (`state`) is what the scene reads to swing a door or lift a gate (src/placePeteSection1.js).

import { HIDE, createHidingState, stepHiding, speedScale, resetHiding } from './hiding.js';
import { buildInteractables, nearestInteractable, promptFor, LORE } from './interactables.js';

export function createSection1Runtime(markers = []) {
    const interactables = buildInteractables(markers);
    const state = { doors: {}, leverPulled: false, hiding: createHidingState(), seen: {}, near: null, prompt: null };

    function reset() {
        state.doors = {};
        state.leverPulled = false;
        resetHiding(state.hiding);
        state.seen = {};
        state.near = null;
        state.prompt = null;
    }

    // Returns { prompt, speedMult, revealed, said } for this frame. `pressed`: E (or ACT) this frame. `fired`: he is shooting.
    function step({ x, z, dt, pressed = false, fired = false, dialogue = null, banner = null }) {
        // A dialogue that is open takes the press (it goes to the next line) and nothing else happens.
        if(dialogue?.isOpen()) {
            if(pressed) dialogue.advance();
            dialogue.update(x, z);
            state.prompt = null;
            stepHiding(state.hiding, dt, { here: null, pressed: false, fired });
            return { prompt: null, speedMult: speedScale(state.hiding), revealed: state.hiding.reason === 'fired', said: null };
        }
        const hideHere = nearestInteractable(interactables, x, z, ['hide']);
        const near = nearestInteractable(interactables, x, z);
        state.near = near;
        // A press goes to the best thing in reach; a hiding place only if nothing else is (a door beside a bush opens the door).
        const useHide = !!hideHere && (!near || near.kind === 'hide' || state.hiding.hidden);
        let said = null;
        if(pressed && near && near.kind !== 'hide' && !state.hiding.hidden) {
            said = use(near, dialogue, banner);
        }
        stepHiding(state.hiding, dt, { here: hideHere, pressed: pressed && useHide, fired });
        const shown = state.hiding.hidden ? hideHere : near;
        state.prompt = promptFor(shown, state);
        return { prompt: state.prompt, speedMult: speedScale(state.hiding), revealed: state.hiding.reason === 'fired', said };
    }

    function use(item, dialogue, banner) {
        switch(item.kind) {
        case 'door': {
            const d = state.doors[item.id] ?? (state.doors[item.id] = { open: false });
            d.open = !d.open;
            return d.open ? 'door-open' : 'door-close';
        }
        case 'lever':
            if(state.leverPulled) return null;
            state.leverPulled = true;
            banner?.('The yard gate groans open.');
            return 'lever';
        case 'lore': {
            const card = LORE[item.id];
            state.seen[item.id] = true;
            if(card && dialogue) dialogue.open({ speaker: card.speaker, lines: card.lines, closeAt: { x: item.x, z: item.z, r: item.r + 6 }, id: item.id });
            return card ? 'lore' : null;
        }
        case 'vantage':
            state.seen[item.id] = true;
            banner?.('The Flume Bridge lies ahead. Smoke, and men on the deck.');
            return 'vantage';
        default:
            return null;
        }
    }

    return { interactables, state, step, reset, HIDE };
}
