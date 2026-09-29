// First-party gameplay statistics, only for players who opted in (src/privacy.js) and never for
// players under 13. No third-party SDK, no advertising id. The server keeps just the days played and a
// count per event (server/app.js, /api/events), which is enough for return rates and where players stop.

// The only events that exist. The server rejects anything else.
export const ANALYTICS_EVENTS = ['session_start', 'run_start', 'run_end', 'outlaw_win', 'shop_open', 'records_open', 'purchase_start'];
const ALLOWED = new Set(ANALYTICS_EVENTS);
const FLUSH_MS = 30000;
const MAX_BATCH = 50;

let enabled = false;
let send = null; // (names: string[]) => Promise, set once the wallet can talk to the server
let queue = [];
let timer = null;

function flush() {
    if(!enabled || !send || !queue.length) return;
    const batch = queue.splice(0, MAX_BATCH);
    send(batch).catch(() => {}); // statistics are best effort; a failed batch is dropped
}

// sender: null when offline (the local playtest wallet), so nothing is collected at all.
export function configureAnalytics({ allowed, sender }) {
    enabled = !!allowed && typeof sender === 'function';
    send = enabled ? sender : null;
    if(!enabled) queue = [];
    if(enabled && !timer && typeof window !== 'undefined') {
        timer = setInterval(flush, FLUSH_MS);
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') flush(); });
    }
}

export function track(name) {
    if(!enabled || !ALLOWED.has(name)) return;
    queue.push(name);
    if(queue.length >= MAX_BATCH) flush();
}
