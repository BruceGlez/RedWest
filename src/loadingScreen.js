// Entry screen: the RED WEST title with a loading bar while the first things a player sees load (fonts,
// sounds, character pictures, their character and the next outlaw). It is in index.html, so it shows
// before any code runs; this fills the bar and lifts it. A slow or failed download never keeps a player
// out: after MAX_WAIT the game opens anyway and the rest keeps loading behind it.
const MIN_SHOW = 700; // ms, so the screen reads as a title card rather than a flicker
const MAX_WAIT = 12000;
const TIPS = [
    'Tap the right side to quick-fire at the nearest outlaw.',
    'Bank the bounty, or ride on for more at higher Heat.',
    'The Jail pays for every outlaw you beat, even while you are away.',
    'Dash through danger: you cannot be hit mid-dash.',
    'Each outlaw has a signature move. Read the WANTED poster.',
    'Three stars on an outlaw lets you play as them.'
];

export function createLoadingScreen() {
    const el = document.getElementById('loading-screen');
    const fill = document.getElementById('loading-fill');
    const label = document.getElementById('loading-label');
    const tip = document.getElementById('loading-tip');
    const startedAt = performance.now();
    let total = 0;
    let done = 0;
    const tracked = [];
    let finished = false;
    tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

    function render() {
        const share = total ? done / total : 0;
        fill.style.width = `${Math.round(8 + share * 92)}%`;
        label.textContent = share >= 1 ? 'READY' : `LOADING ${Math.round(share * 100)}%`;
    }
    render();

    return {
        // Counts a download toward the bar. Failures count as done: the game has fallbacks for each.
        track(promise) {
            total++;
            tracked.push(promise);
            render();
            Promise.resolve(promise).catch(() => {}).finally(() => { done++; render(); });
            return promise;
        },
        // Resolves when everything tracked so far has settled (or MAX_WAIT passed), after lifting the screen.
        finish() {
            const all = Promise.allSettled(tracked);
            const timeout = new Promise(resolve => setTimeout(resolve, MAX_WAIT));
            return Promise.race([all, timeout]).then(() => new Promise(resolve => {
                if(finished) return resolve();
                finished = true;
                done = total;
                render();
                setTimeout(() => {
                    el.classList.add('loaded');
                    setTimeout(() => { el.remove(); resolve(); }, 350);
                }, Math.max(0, MIN_SHOW - (performance.now() - startedAt)));
            }));
        }
    };
}
