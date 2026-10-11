// Section 1's rules at run time: the marshal presses E by a door, a lever, a hiding place or a notice and this decides what happens.
// No THREE and no document: the mode passes in the marshal's place, what he pressed and the dialogue, so it tests in node.
// The state it keeps (`state`) is what the scene reads to swing a door or lift a gate (src/placePeteSection1.js).

import { HIDE, createHidingState, stepHiding, speedScale, resetHiding } from './hiding.js';
import { createBreakables, shoot, blastAt, step as stepBreakables, takeStack } from './breakables.js';
import { createElements, resetElements, give, cycle, throwSelected, step as stepElements, slowAt, comboHint, summary, addPuddle } from './elements.js';
import { ODELL, BEAT_LINES } from './story.js';
import { buildInteractables, nearestInteractable, promptFor, LORE } from './interactables.js';

export function createSection1Runtime(markers = []) {
    const interactables = buildInteractables(markers);
    const breakables = createBreakables(markers);
    const elements = createElements();
    const state = { doors: {}, leverPulled: false, hiding: createHidingState(), seen: {}, near: null, prompt: null, broken: {}, stackTaken: false, beats: {} };

    function reset() {
        state.doors = {};
        state.leverPulled = false;
        resetHiding(state.hiding);
        state.seen = {};
        state.near = null;
        state.prompt = null;
        state.broken = {};
        state.stackTaken = false;
        state.beats = {};
        breakables.items = createBreakables(markers).items;
        breakables.pending = [];
        resetElements(elements);
    }

    // Returns { prompt, speedMult, revealed, said } for this frame. `pressed`: E (or ACT) this frame. `fired`: he is shooting.
    function step({ x, z, dt, pressed = false, fired = false, dialogue = null, banner = null, heal = null }) {
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
            said = use(near, dialogue, banner, heal);
        }
        stepHiding(state.hiding, dt, { here: hideHere, pressed: pressed && useHide, fired });
        const shown = state.hiding.hidden ? hideHere : near;
        state.prompt = promptFor(shown, state);
        return { prompt: state.prompt, speedMult: speedScale(state.hiding), revealed: state.hiding.reason === 'fired', said };
    }

    // A story beat happens once: the banner line shows and the beat is remembered (state.beats). Returns true the first time.
    function beat(name, banner) {
        if(state.beats[name]) return false;
        state.beats[name] = true;
        if(BEAT_LINES[name]) banner?.(BEAT_LINES[name]);
        return true;
    }

    function use(item, dialogue, banner, heal) {
        switch(item.kind) {
        case 'npc': {
            const first = !state.beats.witness;
            dialogue?.open({
                speaker: ODELL.speaker, lines: first ? ODELL.first : ODELL.again, closeAt: { x: item.x, z: item.z, r: item.r + 8 }, id: item.id,
                onDone: () => { if(first) { state.beats.witness = true; heal?.(ODELL.healAmount); } }
            });
            return 'npc';
        }
        case 'door': {
            const d = state.doors[item.id] ?? (state.doors[item.id] = { open: false });
            d.open = !d.open;
            if(d.open && item.id === 'I15') beat('ledger', banner);       // the shack's claim ledger page
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
        case 'stack': {
            const n = takeStack(breakables);
            if(!n) return null;
            state.stackTaken = true;
            const got = give(elements, 'dynamite', n);
            banner?.(got ? `DYNAMITE x${got}. F throws it, V swaps.` : 'You cannot carry more dynamite.');
            return 'stack';
        }
        case 'vantage':
            state.seen[item.id] = true;
            banner?.('The Flume Bridge lies ahead. Smoke, and men on the deck.');
            return 'vantage';
        default:
            return null;
        }
    }

    // Breakables and elements for one frame. `bullets`: [{ x, z }] of the marshal's bullets in flight. `throwPressed`/`cyclePressed`: F / V.
    // `facing`: where he looks. Returns the events for the mode to apply: blast, burn, puddle, fire, combo, break, give-banners are handled here.
    function tick({ dt, x, z, bullets = [], throwPressed = false, cyclePressed = false, facing = { x: 0, z: 1 }, banner = null }) {
        const events = [];
        const at = { x, z };
        const take = list => {
            for(const e of list) {
                if(e.kind === 'break') state.broken[e.id] = true;
                else if(e.kind === 'give') { if(give(elements, e.element, e.n)) { const hint = comboHint(elements); banner?.(hint ?? `WHISKEY x${elements.slots.whiskey}. F throws it, V swaps.`); } }
                else if(e.kind === 'puddle') addPuddle(elements, e.x, e.z);
                else if(e.kind === 'blast') blastAt(breakables, e.x, e.z, e.radius, e.source);
                events.push(e);
            }
        };
        for(const b of bullets) take(shoot(breakables, b.x, b.z, at));
        take(stepBreakables(breakables, dt, at));
        if(cyclePressed) cycle(elements);
        if(throwPressed) {
            const t = throwSelected(elements, x, z, facing.x, facing.z);
            if(t.ok) events.push({ kind: 'throw', type: t.type, x: t.x, z: t.z });
        }
        take(stepElements(elements, dt));
        const hint = comboHint(elements);
        if(hint) banner?.(hint);
        return events;
    }

    // Something found in the world goes in the pack (the Stash crates hold Whiskey). Returns how many fitted.
    function grant(type, n, banner) {
        const got = give(elements, type, n);
        if(got) { const hint = comboHint(elements); banner?.(hint ?? `${type.toUpperCase()} x${elements.slots[type]}. F throws it, V swaps.`); }
        return got;
    }

    return { interactables, state, step, tick, reset, beat, grant, breakables, elements, slowAt: (x, z) => slowAt(elements, x, z), summary: () => summary(elements), HIDE };
}
