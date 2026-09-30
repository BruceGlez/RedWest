// Two separate town integrations, each with its own switch, so either can be on or off without the other:
//   look: the art direction pass (src/townLook.js): painted shading, sky, bloom, colour grade, vignette.
//   walk: the walkable town (src/townWalk.js): the marshal walks the streets and steps up to doors.
// Default is on for both. A URL parameter (?look=off, ?walk=off) wins for that page load; otherwise the
// last choice made with the TOWN screen's buttons is remembered on the device.

const KEY = 'redWestTownFeatures.v1';
export const FEATURES = ['look', 'walk'];

function stored() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

// `search` is the URL query string (injectable for tests).
export function featureOn(name, search = globalThis.location?.search ?? '', saved = stored()) {
    const param = new URLSearchParams(search).get(name);
    if(param === 'off' || param === '0') return false;
    if(param === 'on' || param === '1') return true;
    return saved[name] !== false;
}

export function rememberFeature(name, on) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...stored(), [name]: !!on })); } catch { /* private mode */ }
}
