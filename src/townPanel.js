import { OUTLAWS } from './outlaws.js';
import { BUILDINGS, buildingEffects, jailedOutlaws, jailRate, jailCapacity, jailStored, hoursUntilFull, upgradeCost } from './town.js';
import { track } from './analytics.js';

// The Frontier Town screen (src/town.js has the rules) and the badge on the home screen's TOWN button.
export function createTownPanel({ wallet, onProfile, ui }) {
    const $ = id => document.getElementById(id);
    const els = {
        button: $('town-btn'),
        badge: $('town-badge'),
        screen: $('town-screen'),
        grid: $('town-grid'),
        dollars: $('town-dollars'),
        message: $('town-message')
    };
    let profile = null;
    let confirmUpgrade = null; // building id armed for a second tap
    let busy = false;

    const money = n => `$${Math.round(n).toLocaleString()}`;
    const duration = hours => {
        const total = Math.ceil(hours * 60);
        return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total}m`;
    };
    const isOpen = () => els.screen.style.display !== 'none';

    function say(text, error = false) {
        els.message.textContent = text;
        els.message.classList.toggle('error', error);
    }

    function jailBody() {
        const rate = jailRate(profile);
        const jailed = jailedOutlaws(profile).length;
        const hours = buildingEffects(profile.town, 'jail').jailHours;
        if(!rate) {
            return `<p class="town-stat">No prisoners yet. Beat ${OUTLAWS[0].name} to fill your first cell.</p>`;
        }
        const stored = jailStored(profile);
        const capacity = jailCapacity(profile);
        const pct = Math.min(100, Math.round((stored / capacity) * 100));
        const until = hoursUntilFull(profile);
        return `<p class="town-stat">${jailed} of ${OUTLAWS.length} outlaws jailed · ${money(rate)} an hour · holds ${hours} hours</p>`
            + `<div class="job-bar"><div class="job-fill" style="width:${pct}%"></div></div>`
            + `<p class="town-stat">${money(stored)} waiting${until > 0 ? ` · full in ${duration(until)}` : ' · FULL'}</p>`
            + `<div class="town-actions"><button type="button" class="shop-action collect" data-collect${stored > 0 ? '' : ' disabled'}>COLLECT ${money(stored)}</button></div>`;
    }

    function nextLevelText(building) {
        const level = profile.town.levels[building.id];
        const next = building.levels[level]?.effects;
        if(!next) return 'Top level.';
        if(building.id === 'jail') {
            const base = jailedOutlaws(profile).reduce((sum, outlaw) => sum + outlaw.bounty, 0) / 10;
            return `Next level: ${money(base * next.jailRate)} an hour (+${Math.round((next.jailRate - 1) * 100)}%), holds ${next.jailHours} hours.`;
        }
        if(building.id === 'sheriff') return `Next level: daily jobs pay +${Math.round((next.jobRewards - 1) * 100)}%.`;
        return '';
    }

    function card(building) {
        const level = profile.town.levels[building.id];
        const cost = upgradeCost(profile, building.id);
        const armed = confirmUpgrade === building.id;
        let body = '';
        const actions = [];
        if(building.id === 'jail') body = jailBody();
        if(building.id === 'sheriff') {
            const bonus = Math.round((buildingEffects(profile.town, 'sheriff').jobRewards - 1) * 100);
            body = `<p class="town-stat">${bonus ? `Daily jobs pay +${bonus}%.` : 'Daily jobs pay their normal reward.'}</p>`;
            actions.push('<button type="button" class="shop-action" data-jobs>DAILY JOBS</button>');
        }
        if(building.opens) actions.push(`<button type="button" class="shop-action" data-open="${building.opens}">OPEN</button>`);
        if(cost !== null) {
            const affordable = profile.balances.dollars >= cost;
            actions.push(`<button type="button" class="shop-action upgrade${armed ? ' confirm' : ''}" data-upgrade="${building.id}"${affordable ? '' : ' disabled'}>`
                + `${armed ? `CONFIRM ${money(cost)}` : `UPGRADE ${money(cost)}`}</button>`);
        }
        const levels = building.levels.length;
        return `<div class="town-card" data-building="${building.id}">`
            + `<div class="town-sign"><span>${building.name}</span>${levels > 1 ? `<span class="town-level">LV ${level} / ${levels}</span>` : ''}</div>`
            + `<p class="town-blurb">${building.blurb}</p>${body}`
            + (levels > 1 ? `<p class="town-next">${nextLevelText(building)}</p>` : '')
            + (actions.length ? `<div class="town-actions">${actions.join('')}</div>` : '')
            + '</div>';
    }

    function renderBadge() {
        if(!profile) return;
        const stored = jailStored(profile);
        const full = stored > 0 && stored >= jailCapacity(profile);
        els.badge.style.display = stored > 0 ? '' : 'none';
        els.badge.textContent = full ? 'FULL' : money(stored);
        els.badge.classList.toggle('full', full);
    }

    function render() {
        renderBadge();
        if(!profile || !isOpen()) return;
        els.dollars.textContent = profile.balances.dollars.toLocaleString();
        els.grid.innerHTML = BUILDINGS.map(card).join('');
    }

    async function act(work) {
        if(busy) return;
        busy = true;
        try {
            await work();
        } catch(error) {
            say(error.message, true);
        } finally {
            busy = false;
            render();
        }
    }

    els.grid.addEventListener('click', event => {
        const button = event.target.closest('button');
        if(!button || button.disabled) return;
        if(button.hasAttribute('data-collect')) {
            confirmUpgrade = null;
            act(async () => {
                const result = await wallet.collectJail();
                onProfile(result.profile);
                track('town_collect');
                say(result.collected ? `Collected ${money(result.collected)} in bounties.` : 'Nothing to collect yet.');
            });
        } else if(button.dataset.upgrade) {
            const id = button.dataset.upgrade;
            if(confirmUpgrade !== id) {
                confirmUpgrade = id; // first tap arms CONFIRM, like every purchase
                say('');
                render();
                return;
            }
            confirmUpgrade = null;
            act(async () => {
                onProfile(await wallet.upgradeBuilding(id));
                track('building_upgrade');
                say(`${BUILDINGS.find(b => b.id === id).name} upgraded.`);
            });
        } else if(button.hasAttribute('data-jobs')) {
            ui.openJobs();
        } else if(button.dataset.open) {
            ui.openShop(button.dataset.open);
        }
    });
    // A tap anywhere else cancels an armed upgrade.
    document.addEventListener('click', event => {
        if(confirmUpgrade && !event.target.closest?.('[data-upgrade]')) {
            confirmUpgrade = null;
            render();
        }
    });
    els.button.addEventListener('click', () => {
        track('town_open');
        confirmUpgrade = null;
        say('');
        ui.showTown();
        render();
    });
    // Keep the jail's numbers and the badge ticking while the game is open.
    setInterval(render, 30000);

    return {
        setProfile(next) {
            profile = next;
            render();
        }
    };
}
