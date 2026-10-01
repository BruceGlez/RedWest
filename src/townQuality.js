// How much work LOOK (src/townLook.js) does on the town screen, and when it does less. Three levels:
//   high:   the full look: bloom, colour grade, vignette, with anti-aliased edges.
//   medium: the same look at half-resolution bloom, cheaper edges and a capped pixel density (about 60% of the pixels).
//   low:    only the painted shading and the dusk sky: no post-processing at all.
// The level is "auto" by default: it starts at the best the device managed last time and steps down, never up, when the
// town runs slowly. It can also be set by hand (the QUALITY button, or ?quality=high|medium|low|auto). Pure rules, so they
// can be unit tested.

export const LEVELS = ['high', 'medium', 'low'];

export const QUALITY = {
    high:   { post: true,  samples: 4, bloomScale: 1,   pixelRatioCap: Infinity },
    medium: { post: true,  samples: 2, bloomScale: 0.5, pixelRatioCap: 1.25 },
    low:    { post: false, samples: 0, bloomScale: 0,   pixelRatioCap: Infinity }
};

// The choices the QUALITY button goes through.
export const CHOICES = ['auto', 'high', 'medium', 'low'];
export const nextChoice = choice => CHOICES[(CHOICES.indexOf(choice) + 1) % CHOICES.length] ?? 'auto';

export const FRAME_FLOOR = 40;   // frames a second below which the town counts as running slowly
export const GRACE_SECONDS = 2;  // ignored at the start of a level: shaders compile, the first frames hitch
export const SLOW_SECONDS = 2;   // slow for this long (in total, the average) before stepping down
export const HITCH = 0.5;        // a single frame longer than this is a tab switch or a stall, not slowness

// Watches frame times and says when to drop a level. Only ever steps down.
export function createGovernor({ level = 'high', auto = true } = {}) {
    const state = { level, auto, average: 0, slow: 0, age: 0 };
    return {
        get level() { return state.level; },
        get auto() { return state.auto; },
        set auto(value) { state.auto = !!value; },
        // Set the level by hand (or after a restart): the watch starts again.
        set(next) {
            state.level = LEVELS.includes(next) ? next : 'high';
            state.average = state.slow = state.age = 0;
        },
        // One frame took `dt` seconds. Returns the new level if it just stepped down, otherwise null.
        observe(dt) {
            state.age += dt;
            if(!state.auto || state.level === 'low' || !(dt > 0) || dt > HITCH) return null;
            state.average = state.average === 0 ? dt : state.average * 0.92 + dt * 0.08;
            if(state.age < GRACE_SECONDS) return null;
            if(1 / state.average < FRAME_FLOOR) state.slow += dt;
            else state.slow = Math.max(0, state.slow - dt * 2); // a good spell pays the debt back twice as fast
            if(state.slow < SLOW_SECONDS) return null;
            state.level = LEVELS[LEVELS.indexOf(state.level) + 1];
            state.average = state.slow = state.age = 0; // the new level gets its own grace and its own chance
            return state.level;
        }
    };
}

// ---------- What the player chose, and the best level the device managed, kept on this device ----------

const KEY = 'redWestTownQuality.v1';
const read = storage => { try { return JSON.parse(storage.getItem(KEY)) || {}; } catch { return {}; } };

// { choice: 'auto' | a level, floor: the level auto starts from }
export function loadQuality(storage = globalThis.localStorage) {
    const raw = read(storage);
    return {
        choice: CHOICES.includes(raw.choice) ? raw.choice : 'auto',
        floor: LEVELS.includes(raw.floor) ? raw.floor : 'high'
    };
}

export function saveQuality(pref, storage = globalThis.localStorage) {
    try { storage.setItem(KEY, JSON.stringify({ choice: pref.choice, floor: pref.floor })); } catch { /* private mode */ }
}

// The level to start at for a saved choice (a URL choice, if any, wins for this page load).
export function startLevel(pref, urlChoice = null) {
    const choice = CHOICES.includes(urlChoice) ? urlChoice : pref.choice;
    return { choice, level: choice === 'auto' ? pref.floor : choice, auto: choice === 'auto' };
}
