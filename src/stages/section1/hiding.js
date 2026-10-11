// Hiding (docs/design/pete-section1-gameplay.md, M1). Pure rules, no THREE, so it tests without a browser.
//
// A hiding place is a marker with a radius. Press E inside it to hide. While hidden, guards that have not seen the marshal ignore him and
// guards that have lose track after LOSE_TRACK seconds (src/stages/section1/guards.js reads `hidden` and `hiddenFor`). Limits, so nobody
// camps for ever: at most MAX_SECONDS hidden at a time, then COOLDOWN before the next hide. Firing from a hiding place reveals the marshal.
// Hiding never changes damage, ammo or speed outside it (AGENTS.md rule 6); inside it the marshal moves at SLOW of his speed.

export const HIDE = { MAX_SECONDS: 8, COOLDOWN: 4, SLOW: 0.6, FIRE_COOLDOWN: 1.5, LOSE_TRACK: 3 };

export function createHidingState() {
    return { hidden: false, hideId: null, left: 0, cooldown: 0, hiddenFor: 0, reason: null };
}

// `here`: the hiding place the marshal stands in (or null). `pressed`: E was pressed this frame. `fired`: he shot this frame.
// Returns the state (mutated) so a caller can read `hidden` and `reason` ('time', 'left', 'fired', 'toggle') on the frame it ended.
export function stepHiding(state, dt, { here = null, pressed = false, fired = false } = {}) {
    state.reason = null;
    if(state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);
    if(!state.hidden) {
        state.hiddenFor = 0;
        if(here && pressed && state.cooldown <= 0) {
            state.hidden = true;
            state.hideId = here.id;
            state.left = HIDE.MAX_SECONDS;
            state.reason = 'hid';
        }
        return state;
    }
    const end = reason => {
        state.hidden = false;
        state.hideId = null;
        state.left = 0;
        state.hiddenFor = 0;
        state.reason = reason;
    };
    state.left -= dt;
    state.hiddenFor += dt;
    if(fired) { end('fired'); state.cooldown = Math.max(state.cooldown, HIDE.FIRE_COOLDOWN); }
    else if(!here || here.id !== state.hideId) end('left');
    else if(pressed) end('toggle');
    else if(state.left <= 0) { end('time'); state.cooldown = HIDE.COOLDOWN; }
    return state;
}

export const isHidden = state => !!state?.hidden;
// The speed the marshal moves at: slower while hidden.
export const speedScale = state => isHidden(state) ? HIDE.SLOW : 1;
export function resetHiding(state) { Object.assign(state, createHidingState()); return state; }
