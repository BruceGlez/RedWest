// Playable ad (GROWTH_PLAN.md, Phase 4.1): `npm run build:demo` builds the game in "demo" mode and
// tools/inline-demo.mjs packs it into one HTML file for ad networks. The demo skips the home screen: the
// first tap starts a fight with Dusty Pete and his gang. When the outlaw falls, the player dies, or after
// DEMO_SECONDS, an end card offers the full game. Only real gameplay is shown (no fake scenes).

const env = import.meta.env || {};
export const DEMO = env.MODE === 'demo';
export const DEMO_SECONDS = 45;
export const STORE_URL = env.VITE_STORE_URL || 'https://bruceglez.github.io/RedWest/';

// Files packed into the demo page (tools/inline-demo.mjs) are looked up here first.
export function assetUrl(path) {
    return (typeof window !== 'undefined' && window.__RW_ASSETS?.[path]) || path;
}

// Ad networks give playable ads an MRAID object to open the store; otherwise a normal link.
export function openStore() {
    if(typeof mraid !== 'undefined' && mraid?.open) mraid.open(STORE_URL);
    else window.open(STORE_URL, '_blank', 'noopener');
}

let ended = false;
export function showDemoEnd(title) {
    if(ended) return;
    ended = true;
    const card = document.getElementById('demo-end');
    document.getElementById('demo-end-title').textContent = title;
    card.style.display = 'flex';
}
