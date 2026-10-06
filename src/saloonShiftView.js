import { createShift, SEATS, STATIONS, SHIFT_SECONDS } from './saloonShift.js';
import { getDish, crowd } from './saloon.js';

// The screen for one shift behind Dusty Pete's bar (src/saloonShift.js has the game, src/places/saloon.js opens this from the bar's card).
// A layer over the town screen: the seats with each customer's dish and patience, a COOK or SERVE button, and the three stations. When the
// shift ends it hands the summary to `finish`, which settles it with the wallet, and shows what was paid. Nothing here touches the profile.

const stationName = id => id.toUpperCase();

// host: the element to put the layer on. options: { night, farm, seed, finish(summary) -> Promise<{ served, stars, dollars, paid, paidLeft }>, onClose, onAgain(night) }.
export function openShift(host, { night, farm, seed = Date.now() % 100000, finish, onClose, onAgain }) {
    const shift = createShift({ night, farm, seed });
    const layer = document.createElement('div');
    layer.className = 'saloon-shift';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', `Night ${night} at Dusty Pete's bar`);
    layer.innerHTML = `<div class="saloon-head"><b>NIGHT ${night}</b><span class="saloon-time"></span><span class="saloon-combo"></span>`
        + `<button type="button" class="shop-action saloon-quit">CLOSE UP</button></div>`
        + `<div class="saloon-seats">${Array.from({ length: SEATS }, (_, i) => `<div class="saloon-seat" data-seat="${i}"></div>`).join('')}</div>`
        + `<div class="saloon-stations">${STATIONS.map(s => `<span class="saloon-station" data-station="${s}">${stationName(s)}</span>`).join('')}</div>`
        + `<div class="saloon-result" style="display:none;"></div>`;
    host.appendChild(layer);
    const $ = sel => layer.querySelector(sel);
    const seatEls = [...layer.querySelectorAll('.saloon-seat')];
    let last = performance.now();
    let timer = null;
    let closed = false;
    let ended = false;

    function draw() {
        const view = shift.view();
        seatEls.forEach((el, i) => {
            const c = view[i];
            if(!c) { el.className = 'saloon-seat empty'; el.innerHTML = '<span class="saloon-empty">EMPTY SEAT</span>'; return; }
            const dish = getDish(c.dish);
            const state = c.ready ? 'ready' : c.cooking ? 'cooking' : 'waiting';
            el.className = `saloon-seat ${state}${c.quick ? '' : ' late'}`;
            const action = c.ready ? `<button type="button" class="shop-action collect" data-serve="${i}">SERVE</button>`
                : c.cooking ? '<span class="saloon-note">COOKING</span>'
                : `<button type="button" class="shop-action upgrade" data-cook="${i}"${shift.state.stations[c.station] ? ' disabled' : ''}>COOK ON THE ${stationName(c.station)}</button>`;
            el.innerHTML = `<b>${dish.name}</b><div class="farm-bar"><i style="width:${Math.round(c.share * 100)}%"></i></div>${action}`;
        });
        for(const s of STATIONS) layer.querySelector(`[data-station="${s}"]`).classList.toggle('busy', !!shift.state.stations[s]);
        $('.saloon-time').textContent = `${Math.max(0, Math.ceil(SHIFT_SECONDS - shift.state.time))}s`;
        $('.saloon-combo').textContent = shift.state.combo > 1 ? `COMBO x${shift.state.combo}` : `${shift.state.served.length} of ${crowd(night)} served`;
    }
    function tick() {
        const now = performance.now();
        shift.update(Math.min(0.25, (now - last) / 1000)); // a tab that was asleep never costs the player a customer
        last = now;
        draw();
        if(shift.over) end();
    }
    function stop() {
        clearInterval(timer);
        timer = null;
    }
    function close() {
        if(closed) return;
        closed = true;
        stop();
        layer.remove();
        onClose?.();
    }
    function showResult(text, buttons) {
        const box = $('.saloon-result');
        box.style.display = '';
        box.innerHTML = `<div class="town-card"><div class="town-sign"><span>NIGHT ${night}</span></div><p class="town-blurb">${text}</p><div class="town-actions farm-actions">${buttons}</div></div>`;
    }
    async function settle(summary) {
        showResult('Counting the till...', '');
        try {
            const r = await finish(summary);
            const pay = r.paid ? `$${r.dollars} in wages and tips. ${r.paidLeft} paid ${r.paidLeft === 1 ? 'shift' : 'shifts'} left today.` : 'Free practice: no wages today, but the stars count.';
            showResult(`Served ${r.served} of ${crowd(night)}. ${'*'.repeat(r.stars) || 'No stars'}. ${pay}`,
                `<button type="button" class="shop-action collect" data-again>ANOTHER SHIFT</button><button type="button" class="shop-action" data-done>DONE</button>`);
        } catch(error) {
            showResult(`Could not count the till: ${error.message}`, `<button type="button" class="shop-action collect" data-retry>TRY AGAIN</button><button type="button" class="shop-action" data-done>LEAVE IT</button>`);
        }
    }
    function end() {
        if(ended) return;
        ended = true;
        stop();
        const summary = shift.summary();
        if(!summary.served.length) { // nothing served: nothing to settle, and it must not use up a paid shift
            const left = shift.state.missed ? 'Everyone walked out.' : 'The bar was quiet.';
            showResult(`${left} Nothing was served, so nothing is counted.`, `<button type="button" class="shop-action collect" data-again>ANOTHER SHIFT</button><button type="button" class="shop-action" data-done>DONE</button>`);
            return;
        }
        settle(summary);
    }
    layer.addEventListener('click', event => {
        const button = event.target.closest('button');
        if(!button || button.disabled) return;
        if(button.dataset.cook !== undefined) shift.cook(Number(button.dataset.cook));
        else if(button.dataset.serve !== undefined) {
            shift.serve(Number(button.dataset.serve));
        } else if(button.classList.contains('saloon-quit')) {
            if(!ended) { shift.state.over = true; end(); }
        } else if(button.hasAttribute('data-again')) {
            close();
            onAgain?.(night);
        } else if(button.hasAttribute('data-retry')) {
            settle(shift.summary());
        } else if(button.hasAttribute('data-done')) {
            close();
        }
        draw();
        if(shift.over) end();
    });
    draw();
    timer = setInterval(tick, 100);
    return { close, shift, get active() { return !closed; } };
}
