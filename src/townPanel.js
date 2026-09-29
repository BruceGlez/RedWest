import { OUTLAWS } from './outlaws.js';
import { eventForWeek, eventEndsAt, TIER_DOLLARS, EVENT_COSMETICS, ALL_COSMETICS_OWNED_DOLLARS } from './events.js';
import { weekKey } from './profile.js';
import { BUILDINGS, buildingEffects, jailedOutlaws, jailRate, jailCapacity, jailStored, hoursUntilFull, upgradeCost } from './town.js';
import { track } from './analytics.js';
import { remindersSupported, remindersEnabled, remindersAsked, enableReminders, disableReminders, updateJailReminder } from './reminders.js';
import { createTownScene, TOWN_LAYOUT } from './townScene.js';

// The Frontier Town screen (src/town.js has the rules): a 3D town at dusk (src/townScene.js) with a label over
// each building; tapping a building or its label opens its card in a sheet. Also the TOWN button's badge.
export function createTownPanel({ wallet, onProfile, ui, onRideOut }) {
    const $ = id => document.getElementById(id);
    const els = {
        button: $('town-btn'),
        badge: $('town-badge'),
        screen: $('town-screen'),
        grid: $('town-grid'),
        sheet: $('town-sheet'),
        sheetClose: $('town-sheet-close'),
        touch: $('town-touch'),
        labels: $('town-labels'),
        dollars: $('town-dollars'),
        message: $('town-message'),
        reminder: $('town-reminder'),
        reminderYes: $('town-reminder-yes'),
        reminderNo: $('town-reminder-no'),
        reminderSetting: $('settings-reminders-btn')
    };
    let profile = null;
    let town3d = null; // built the first time the town opens
    let openId = null; // the building whose card is showing
    let confirmUpgrade = null; // building id armed for a second tap
    let busy = false;

    const money = n => `$${Math.round(n).toLocaleString()}`;
    const duration = hours => {
        const total = Math.ceil(hours * 60);
        return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total}m`;
    };
    const endsIn = hours => (hours >= 24 ? `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h` : duration(hours));
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

    // The weekly Most Wanted event, on the Sheriff's notice board.
    function eventCard() {
        const now = new Date();
        const event = eventForWeek(weekKey(now));
        const mine = profile.event?.week === event.week ? profile.event : { best: 0, tiers: 0 };
        const outlaw = OUTLAWS[event.outlaw];
        const prize = EVENT_COSMETICS.find(item => !profile.owned.includes(item.id));
        const targets = event.targets.map((target, i) => {
            const done = i < mine.tiers;
            const extra = i === event.targets.length - 1 ? (prize ? ` + ${prize.name} ${prize.slot}` : ` + $${ALL_COSMETICS_OWNED_DOLLARS}`) : '';
            return `<li class="${done ? 'done' : ''}"><span>${done ? '&#10003;' : '&#9675;'} Score ${target.toLocaleString()}</span><b>$${TIER_DOLLARS[i]}${extra}</b></li>`;
        }).join('');
        return `<div class="town-card event-card">`
            + `<div class="town-sign"><span>MOST WANTED THIS WEEK</span><span class="town-level">ENDS IN ${endsIn((eventEndsAt(now) - now) / 3600000)}</span></div>`
            + `<p class="town-stat">${outlaw.name} · ${event.twist.name}: ${event.twist.detail}</p>`
            + `<p class="town-blurb">Free to enter, as often as you like. Reach each score for its prize. `
            + `Event runs do not move the Wanted Road. Your best this week: <b>${mine.best.toLocaleString()}</b></p>`
            + `<ol class="event-targets">${targets}</ol>`
            + '<div class="town-actions"><button type="button" class="shop-action collect" data-ride>RIDE OUT</button></div>'
            + '</div>';
    }

    // Buildings that are only scenery for now.
    function soonCard(spot) {
        return `<div class="town-card" data-building="${spot.id}"><div class="town-sign"><span>${spot.label}</span></div>`
            + `<p class="town-blurb">${spot.soon}.</p></div>`;
    }

    function sheetHtml(id) {
        if(id === 'depot') return eventCard();
        const building = BUILDINGS.find(b => b.id === id);
        if(building) return card(building);
        const spot = TOWN_LAYOUT.find(s => s.id === id);
        return spot ? soonCard(spot) : '';
    }

    // ---------- Building labels over the 3D town ----------
    const labelEls = new Map();
    for(const spot of TOWN_LAYOUT) {
        const label = document.createElement('button');
        label.type = 'button';
        label.className = `town-label${spot.soon ? ' soon' : ''}${spot.id === 'depot' ? ' event' : ''}`;
        label.dataset.openBuilding = spot.id;
        els.labels.append(label);
        labelEls.set(spot.id, label);
    }
    function renderLabels() {
        const stored = jailStored(profile);
        const full = stored > 0 && stored >= jailCapacity(profile);
        for(const spot of TOWN_LAYOUT) {
            const label = labelEls.get(spot.id);
            const building = BUILDINGS.find(b => b.id === spot.id);
            let extra = '';
            if(building && building.levels.length > 1) extra = `<small>LV ${profile.town.levels[spot.id]}</small>`;
            if(spot.id === 'jail' && stored > 0) extra += `<span class="town-bubble${full ? ' full' : ''}">${full ? 'FULL ' : ''}${money(stored)}</span>`;
            if(spot.id === 'depot') extra = `<small>${OUTLAWS[eventForWeek(weekKey(new Date())).outlaw].name}</small>`;
            label.innerHTML = `<span>${spot.label}</span>${extra}`;
        }
    }

    function openBuilding(id) {
        openId = id;
        confirmUpgrade = null;
        say('');
        render();
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
        renderLabels();
        town3d?.setLevels(profile.town.levels);
        els.sheet.style.display = openId ? '' : 'none';
        if(openId) els.grid.innerHTML = sheetHtml(openId);
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
                // The first collect is the moment to offer reminders (never at launch).
                if(result.collected && remindersSupported() && !remindersAsked()) els.reminder.style.display = 'flex';
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
        } else if(button.hasAttribute('data-ride')) {
            onRideOut(eventForWeek(weekKey(new Date())));
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
        openId = null;
        say('');
        if(!town3d) town3d = createTownScene();
        town3d.resize(window.innerWidth, window.innerHeight);
        ui.showTown();
        render();
    });
    els.labels.addEventListener('click', event => {
        const label = event.target.closest('[data-open-building]');
        if(label) openBuilding(label.dataset.openBuilding);
    });
    els.sheetClose.addEventListener('click', () => {
        openId = null;
        render();
    });
    window.addEventListener('resize', () => town3d?.resize(window.innerWidth, window.innerHeight));

    // ---------- Looking around: drag to pan, pinch or scroll to zoom, tap a building ----------
    const pointers = new Map();
    let dragged = 0;
    let pinchFrom = 0;
    const YAW = 0.52; // matches the camera in src/townScene.js
    els.touch.addEventListener('pointerdown', event => {
        els.touch.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        dragged = 0;
        if(pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinchFrom = Math.hypot(a.x - b.x, a.y - b.y);
        }
    });
    els.touch.addEventListener('pointermove', event => {
        const last = pointers.get(event.pointerId);
        if(!last || !town3d) return;
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        last.x = event.clientX;
        last.y = event.clientY;
        dragged += Math.abs(dx) + Math.abs(dy);
        if(pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const now = Math.hypot(a.x - b.x, a.y - b.y);
            if(pinchFrom > 0 && now > 0) town3d.zoom(pinchFrom / now);
            pinchFrom = now;
            return;
        }
        // Screen drag moves the ground under the finger (camera yaw taken into account).
        const scale = town3d.distance / window.innerHeight * 0.85;
        const rightX = Math.cos(YAW), rightZ = -Math.sin(YAW);
        const upX = -Math.sin(YAW), upZ = -Math.cos(YAW);
        town3d.pan((-dx * rightX + dy * upX) * scale, (-dx * rightZ + dy * upZ) * scale);
    });
    const release = event => {
        const wasTap = pointers.size === 1 && dragged < 10;
        pointers.delete(event.pointerId);
        if(pointers.size < 2) pinchFrom = 0;
        if(wasTap && town3d && event.type === 'pointerup') {
            const id = town3d.pick((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
            if(id) openBuilding(id);
            else if(openId) { openId = null; render(); }
        }
    };
    els.touch.addEventListener('pointerup', release);
    els.touch.addEventListener('pointercancel', release);
    els.touch.addEventListener('wheel', event => {
        event.preventDefault();
        town3d?.zoom(event.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
    // Keep the jail's numbers and the badge ticking while the game is open.
    setInterval(render, 30000);

    // ---------- Reminders (app only) ----------
    let replan = null;
    const planReminder = () => {
        clearTimeout(replan);
        replan = setTimeout(() => { if(profile) updateJailReminder(profile); }, 1000);
    };
    function renderReminderSetting() {
        els.reminderSetting.style.display = remindersSupported() ? '' : 'none';
        els.reminderSetting.textContent = `Jail reminders: ${remindersEnabled() ? 'ON' : 'OFF'}`;
        els.reminderSetting.className = remindersEnabled() ? '' : 'off';
    }
    els.reminderYes.addEventListener('click', async () => {
        els.reminder.style.display = 'none';
        say((await enableReminders()) ? 'Reminders on. Change it any time in Settings.' : 'Reminders are off in your phone settings.');
        renderReminderSetting();
        planReminder();
    });
    els.reminderNo.addEventListener('click', async () => {
        els.reminder.style.display = 'none';
        await disableReminders();
        renderReminderSetting();
    });
    els.reminderSetting.addEventListener('click', async () => {
        if(remindersEnabled()) await disableReminders();
        else await enableReminders();
        renderReminderSetting();
        planReminder();
    });
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && profile) updateJailReminder(profile); });
    renderReminderSetting();

    return {
        setProfile(next) {
            profile = next;
            render();
            planReminder();
        },
        // Called by the home-screen loop every frame (src/gameLoop.js): while the town is open it is drawn
        // instead of the desert.
        isActive() {
            const open = isOpen() && !!town3d;
            document.body.classList.toggle('town-open', open);
            return open;
        },
        frame(renderer, dt) {
            town3d.update(dt);
            renderer.render(town3d.scene, town3d.camera);
            const w = window.innerWidth;
            const h = window.innerHeight;
            for(const [id, p] of Object.entries(town3d.labelPositions())) {
                const label = labelEls.get(id);
                label.style.left = `${Math.round(p.x * w)}px`;
                label.style.top = `${Math.round(p.y * h)}px`;
                label.style.visibility = p.visible ? '' : 'hidden';
            }
        }
    };
}
