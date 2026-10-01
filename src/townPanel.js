import { barkFor } from './barks.js';
import { OUTLAWS } from './outlaws.js';
import { eventForWeek, eventEndsAt, TIER_DOLLARS, EVENT_COSMETICS, ALL_COSMETICS_OWNED_DOLLARS } from './events.js';
import { weekKey } from './profile.js';
import { BUILDINGS, buildingEffects, jailedOutlaws, jailRate, jailCapacity, jailStored, hoursUntilFull, upgradeCost, JAIL_BOUNTY_SHARE } from './town.js';
import { track } from './analytics.js';
import { remindersSupported, remindersEnabled, remindersAsked, enableReminders, disableReminders, updateJailReminder } from './reminders.js';
import { createTownScene, TOWN_LAYOUT } from './townScene.js';
import { createTownLook, DAY_SKY } from './townLook.js';
import { createFarmScene } from './placeFarm.js';
import { CROPS, GOODS, EGG, getCrop, plotStates, eggsReady, minutesToNextEgg, minutesText, farmLevel, farmLevelInfo } from './farm.js';
import { FARM_START, farmLabel, plotIndex } from './farmLayout.js';
import { createTownWalk } from './townWalk.js';
import { spotLabel, getSpot, jobsLeft } from './townSpots.js';
import { unlockedDistricts, doorLabel, districtOf, lockedHint, districtAt, getDistrict } from './townDistricts.js';
import { stops, stopById, TRAVEL_FADE_MS } from './townTravel.js';
import { loadNews, saveNews, newlyOpened, bannerFor, markSeen, markVisited, talkOfTheTown } from './townNews.js';
import { getFolk, folkLine } from './townFolk.js';
import { arena, ARENA_MODES, arenaRoster } from './arena.js';
import { loadCompanion, saveCompanion } from './townCompanion.js';
import { getJob, ALL_JOBS_BONUS_NUGGETS } from './jobs.js';
import { featureOn, rememberFeature, qualityParam } from './townFeatures.js';
import { loadQuality, saveQuality, nextChoice, startLevel } from './townQuality.js';
import { normalizePass, seasonEndsAt, themeFor, tierFor, tierReward, TIERS, POINTS_PER_TIER, POINTS } from './pass.js';
import { getShopItem } from './cosmetics.js';
import { purchaseSupport } from './purchases.js';

// The Frontier Town screen (src/town.js has the rules): a 3D town at dusk (src/townScene.js) with a label over
// each building; tapping a building or its label opens its card in a sheet. Also the TOWN button's badge.
export function createTownPanel({ wallet, onProfile, ui, onRideOut, onBoardTrain = () => {}, onArenaFight = () => {}, portrait = () => '', onBuyPass, isChild = () => false, getProgress = () => null }) {
    const $ = id => document.getElementById(id);
    const els = {
        button: $('town-btn'),
        badge: $('town-badge'),
        screen: $('town-screen'),
        grid: $('town-grid'),
        sheet: $('town-sheet'),
        sheetClose: $('town-sheet-close'),
        touch: $('town-touch'),
        walkButton: $('town-walk-btn'),
        title: $('town-title'),
        placeBack: $('town-place-back'),
        fade: $('town-fade'),
        toast: $('town-toast'),
        lookButton: $('town-look-btn'),
        qualityButton: $('town-quality-btn'),
        hint: $('town-hint'),
        news: $('town-news'),
        newsTitle: $('town-news-title'),
        newsText: $('town-news-text'),
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
    let look = null; // the art direction pass (src/townLook.js), an independent switch
    let walk = null; // the walkable town (src/townWalk.js), an independent switch
    let farm3d = null; // Calloway Farm, a place of its own (src/placeFarm.js), built the first time you go in
    let farmWalk = null; // walking on the farm: the same walking code, on the farm's map
    let place = null; // the district you are inside (its id), or null while you are in the town
    let quality = loadQuality(); // what the player chose for LOOK's quality, and the best level the device managed
    let qualityChoice = startLevel(quality, qualityParam()).choice; // for this visit (the URL may override the saved choice)
    let news = loadNews(); // which districts the player has been told about and has walked into, kept on this device
    let newsTimer = null;
    let companion = loadCompanion(); // the dog from the Calloway farm: { adopted, following }, kept on this device
    let openId = null; // the building whose card is showing
    let headerBottom = 0; // measured once the town is on screen (reset on resize)
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
            const base = jailedOutlaws(profile).reduce((sum, outlaw) => sum + outlaw.bounty, 0) * JAIL_BOUNTY_SHARE;
            return `Next level: ${money(base * next.jailRate)} an hour (+${Math.round((next.jailRate - 1) * 100)}%), holds ${next.jailHours} hours.`;
        }
        if(building.id === 'sheriff') return `Next level: daily jobs pay +${Math.round((next.jobRewards - 1) * 100)}%.`;
        if(building.id === 'bank') return `Next level: one run can pay up to $${next.runCap}.`;
        return '';
    }

    // One quiet line from whoever runs the building, chosen from the marshal's progress (src/barks.js).
    function barkHtml(id) {
        const progress = getProgress();
        const bark = progress ? barkFor(id, progress) : null;
        return bark ? `<p class="town-bark">&ldquo;${bark.text}&rdquo; <span>${bark.speaker}</span></p>` : '';
    }

    function card(building) {
        const level = profile.town.levels[building.id];
        const cost = upgradeCost(profile, building.id);
        const armed = confirmUpgrade === building.id;
        let body = '';
        const actions = [];
        if(building.id === 'jail') body = jailBody();
        if(building.id === 'bank') {
            body = `<p class="town-stat">One run can pay up to $${buildingEffects(profile.town, 'bank').runCap} (before event and pass prizes).</p>`;
        }
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
            + `<p class="town-blurb">${building.blurb}</p>${barkHtml(building.id)}${body}`
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
            + barkHtml('depot')
            + `<ol class="event-targets">${targets}</ol>`
            + '<div class="town-actions"><button type="button" class="shop-action collect" data-ride>RIDE OUT</button></div>'
            + '</div>';
    }

    // Buildings that are only scenery for now.
    function soonCard(spot) {
        return `<div class="town-card" data-building="${spot.id}"><div class="town-sign"><span>${spot.label}</span></div>`
            + `<p class="town-blurb">${spot.soon}.</p></div>`;
    }

    // The Wanted Poster Pass, in the saloon (rules in src/pass.js).
    function rewardText(reward) {
        if(reward.item) return getShopItem(reward.item)?.name ?? 'Look';
        if(reward.nuggets) return `&#9670;${reward.nuggets}`;
        return `$${reward.dollars}`;
    }
    function passCard() {
        const now = new Date();
        const pass = normalizePass(profile.pass, now);
        const tier = tierFor(pass.points);
        const intoTier = pass.points - (tier * POINTS_PER_TIER);
        const theme = themeFor(pass.season);
        const armed = confirmUpgrade === 'pass';
        const support = purchaseSupport('season_pass');
        const tiers = Array.from({ length: TIERS }, (_, i) => {
            const t = i + 1;
            const reached = t <= tier;
            return `<li class="pass-tier${reached ? ' reached' : ''}"><b>${t}</b>`
                + `<span class="pass-free">${rewardText(tierReward(pass.season, t, 'free'))}</span>`
                + `<span class="pass-premium${pass.premium ? '' : ' locked'}">${rewardText(tierReward(pass.season, t, 'premium'))}</span></li>`;
        }).join('');
        let buy;
        if(isChild()) buy = '<p class="town-blurb">The pass is not sold to players under 13. The free track is all yours.</p>';
        else if(pass.premium) buy = '<p class="town-stat">&#10003; Pass owned for this season.</p>';
        else {
            buy = `<div class="town-actions"><button type="button" class="shop-action upgrade${armed ? ' confirm' : ''}" data-buy-pass${support.available ? '' : ' disabled'}>`
                + `${armed ? 'CONFIRM $4.99' : support.available ? 'GET THE PASS $4.99' : 'PASS: SOON'}</button></div>`;
        }
        return `<div class="town-card pass-card" data-building="saloon">`
            + `<div class="town-sign"><span>WANTED POSTER PASS</span><span class="town-level">ENDS IN ${endsIn((seasonEndsAt(pass.season) - now) / 3600000)}</span></div>`
            + `<p class="town-stat">Season ${pass.season}: ${theme.name} · Tier ${tier} / ${TIERS}${tier < TIERS ? ` · ${POINTS_PER_TIER - intoTier} points to the next` : ''}</p>`
            + `<div class="job-bar"><div class="job-fill" style="width:${tier >= TIERS ? 100 : Math.round((intoTier / POINTS_PER_TIER) * 100)}%"></div></div>`
            + barkHtml('saloon')
            + `<p class="town-blurb">Points: finish a run +${POINTS.run}, collect a bounty +${POINTS.collected}, each daily job +${POINTS.job}, `
            + `each Most Wanted target +${POINTS.eventTarget}. Rewards are paid as soon as a tier is reached. Top row free, bottom row with the pass.</p>`
            + `<ol class="pass-track">${tiers}</ol>${buy}`
            + '<p class="town-next">The pass holds looks and Gold Nuggets only, never anything that changes a fight. '
            + 'One-time purchase for this season; it never renews. Buying later still pays every tier already reached.</p>'
            + '</div>';
    }

    // The Arena: practice fights that save nothing. Boss fights are one of its options; a boss opens once you have beaten them
    // on the Wanted Road (src/arena.js).
    function arenaCard() {
        const roster = arenaRoster(getProgress(), OUTLAWS, { unlockAll: arena.unlockAll });
        const open = roster.filter(r => r.unlocked).length;
        const modes = ARENA_MODES.map(mode => `<button type="button" class="shop-tab${mode.id === arena.mode ? ' active' : ''}" data-arena-mode="${mode.id}">${mode.name}</button>`).join('');
        const toggles = `<button type="button" class="shop-tab${arena.invincible ? ' active' : ''}" data-arena-toggle="invincible">CAN'T DIE: ${arena.invincible ? 'ON' : 'OFF'}</button>`
            + `<button type="button" class="shop-tab${arena.gang ? ' active' : ''}" data-arena-toggle="gang">GANG: ${arena.gang ? 'ON' : 'OFF'}</button>`;
        const rows = roster.map(({ index, outlaw, unlocked }) => {
            const picture = portrait(outlaw.id);
            return `<div class="arena-row${unlocked ? '' : ' locked'}">${picture ? `<img src="${picture}" alt="">` : '<span class="arena-pic"></span>'}`
                + `<div class="arena-who"><b>${outlaw.name}</b><small>${unlocked ? `Stage ${index + 1} &middot; ${outlaw.title}` : 'Beat them on the Wanted Road to open'}</small></div>`
                + `<button type="button" class="shop-action" data-arena-fight="${index}"${unlocked ? '' : ' disabled'}>${unlocked ? 'FIGHT' : 'LOCKED'}</button></div>`;
        }).join('');
        return `<div class="town-card arena-town" data-building="arena"><div class="town-sign"><span>ARENA</span><span class="town-level">${open} / ${roster.length} OPEN</span></div>`
            + `<p class="town-blurb">Practice fights. Nothing here is saved.</p>`
            + `<div class="arena-modes">${modes}</div><div class="arena-toggles">${toggles}</div>`
            + `<div class="arena-list-town">${rows}</div></div>`;
    }

    // The bounty board in the square: the day's three jobs and how far along each is.
    function boardCard() {
        const list = profile.jobs?.list ?? [];
        const rows = list.map(entry => {
            const job = getJob(entry.id);
            if(!job) return '';
            const pct = Math.min(100, Math.round((entry.progress / job.goal) * 100));
            return `<div class="job-card${entry.done ? ' done' : ''}"><div class="job-text">${job.text}</div>`
                + `<div class="job-bar"><div class="job-fill" style="width:${pct}%"></div></div>`
                + `<div class="job-meta"><span>${Math.min(entry.progress, job.goal)} / ${job.goal}</span><span class="job-reward">${entry.done ? 'PAID' : `+$${job.reward}`}</span></div></div>`;
        }).join('');
        const bonus = profile.jobs?.bonusPaid
            ? `All jobs done today: <b>+&#9670;${ALL_JOBS_BONUS_NUGGETS} paid</b>.`
            : `Finish all three for <b>&#9670;${ALL_JOBS_BONUS_NUGGETS} Gold Nuggets</b>.`;
        return `<div class="town-card" data-building="board"><div class="town-sign"><span>BOUNTY BOARD</span></div>`
            + `<p class="town-blurb">Today's jobs, pinned by the Sheriff. They reset at midnight.</p>${rows}`
            + `<p class="town-stat">${bonus}</p>`
            + `<div class="town-actions"><button type="button" class="shop-action" data-jobs>DAILY JOBS</button></div></div>`;
    }

    // A district's place (plaque or kennel) or its shut gate.
    function districtCard(id) {
        const d = districtOf(id);
        if(!d) return '';
        const open = profile && unlockedDistricts(profile.stats.stageStars).includes(d.id);
        if(!open) {
            return `<div class="town-card" data-building="${id}"><div class="town-sign"><span>${d.name}</span><span class="town-level">SHUT</span></div>`
                + `<p class="town-blurb">${lockedHint(d)}</p></div>`;
        }
        let action = '';
        if(id === 'kennel') {
            const label = !companion.adopted ? 'TAKE THE DOG' : companion.following ? 'SEND THE DOG HOME' : 'CALL THE DOG';
            action = `<div class="town-actions"><button type="button" class="shop-action collect" data-companion>${label}</button></div>`;
        }
        return `<div class="town-card" data-building="${id}"><div class="town-sign"><span>${d.card.title}</span></div>`
            + `<p class="town-blurb">${d.card.text}</p>${action}</div>`;
    }

    // The town train (src/townTravel.js): Main Street and every district that is open; a shut one names the outlaw to beat.
    function trainCard() {
        const open = profile ? unlockedDistricts(profile.stats.stageStars) : [];
        const rows = stops(open).map(stop => stop.open
            ? `<button type="button" class="shop-action collect farm-crop" data-travel="${stop.id}">${stop.name}</button>`
            : `<button type="button" class="shop-action farm-crop" disabled>${stop.name}<small>${stop.hint}</small></button>`).join('');
        return `<div class="town-card" data-building="platform"><div class="town-sign"><span>THE TOWN TRAIN</span></div>`
            + `<p class="town-blurb">The districts are a real walk apart. The train stops at Main Street and at every district that is open.</p><div class="town-actions farm-actions">${rows}</div></div>`;
    }
    function travelTo(id) {
        const stop = profile && stopById(id, unlockedDistricts(profile.stats.stageStars));
        if(!stop || !walk?.active || place) return;
        track('train_travel');
        openId = null;
        render();
        els.fade.classList.add('on'); // a short fade while the train runs
        setTimeout(() => {
            walk.place(stop.at[0], stop.at[1]);
            els.fade.classList.remove('on');
            toast(`Off the train at ${stop.name}.`);
        }, TRAVEL_FADE_MS);
    }

    function sheetHtml(id) {
        if(place) return farmCard(id);
        if(id === 'platform') return trainCard();
        if(districtOf(id)) return districtCard(id);
        if(id === 'arena') return arenaCard();
        if(id === 'board') return boardCard();
        if(id === 'depot') return eventCard();
        if(id === 'saloon') return passCard();
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
            if(spot.id === 'saloon') extra = `<small>PASS TIER ${tierFor(normalizePass(profile.pass).points)}</small>`;
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
        farm3d?.setFarm(profile.town.farm, new Date(), Math.max(1, farmLevel(profile)));
        town3d?.setLevels(profile.town.levels, {
            gunsmith: profile.owned.filter(id => id.startsWith('gun-')).length,
            tailor: profile.owned.filter(id => /^(hat|coat|pants|bullets)-/.test(id)).length
        });
        const unlocked = unlockedDistricts(profile.stats.stageStars);
        town3d?.setDistricts(unlocked);
        if(town3d) announce(unlocked);
        town3d?.setJailCash(jailStored(profile), jailCapacity(profile));
        town3d?.setBoardNotes(jobsLeft(profile));
        const progress = getProgress();
        if(progress) town3d?.setGuests(OUTLAWS.filter((outlaw, i) => (progress.stars[i] & 1) !== 0).map(outlaw => outlaw.id));
        els.sheet.style.display = openId ? '' : 'none';
        if(openId) els.grid.innerHTML = sheetHtml(openId);
    }

    async function act(work, onError = say) {
        if(busy) return;
        busy = true;
        try {
            await work();
        } catch(error) {
            onError(error.message, true);
        } finally {
            busy = false;
            render();
        }
    }

    function collectJail() {
        return act(async () => {
            const result = await wallet.collectJail();
            onProfile(result.profile);
            track('town_collect');
            say(result.collected ? `Collected ${money(result.collected)} in bounties.` : 'Nothing to collect yet.');
            // The first collect is the moment to offer reminders (never at launch).
            if(result.collected && remindersSupported() && !remindersAsked()) els.reminder.style.display = 'flex';
        });
    }


    // ---------- Calloway Farm: a place of its own (src/farm.js has the rules, src/farmLayout.js the map) ----------
    let toastTimer = null;
    function toast(text, error = false) {
        els.toast.textContent = text;
        els.toast.classList.toggle('error', error);
        els.toast.style.display = '';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { els.toast.style.display = 'none'; }, 2800);
    }
    const crate = (label, value) => `<span class="farm-chip">${label} <b>${value}</b></span>`;
    function storeLine(store) {
        const have = GOODS.filter(g => store[g.id] > 0);
        return have.length ? have.map(g => crate(g.name, store[g.id])).join('') : '<span class="farm-chip">THE BARN IS EMPTY</span>';
    }
    function farmCard(id) {
        const farm = profile.town.farm;
        const now = new Date();
        const index = plotIndex(id);
        const card = (title, body, actions = '') => `<div class="town-card" data-building="${id}"><div class="town-sign"><span>${title}</span></div>${body}${actions ? `<div class="town-actions farm-actions">${actions}</div>` : ''}</div>`;
        if(index >= 0) {
            const plot = plotStates(farm, now)[index];
            if(plot.state === 'empty') {
                const buttons = CROPS.map(c => `<button type="button" class="shop-action collect farm-crop" data-plant="${c.id}" data-plot="${index}">${c.name}<small>${minutesText(c.minutes)} · ${c.yield} x $${c.price}</small></button>`).join('');
                return card(`PLOT ${index + 1}`, '<p class="town-blurb">Pick a crop. It grows while you are away and waits for you, however long that is.</p>', buttons);
            }
            return card(`PLOT ${index + 1}`, `<p class="town-blurb">${plot.crop.name}: ${minutesText(plot.minutesLeft)} to go.</p>`
                + `<div class="farm-bar"><i style="width:${Math.round(plot.fraction * 100)}%"></i></div><p class="town-stat">${plot.crop.blurb}</p>`);
        }
        switch(id) {
            case 'coop': {
                const level = Math.max(1, farmLevel(profile));
                const cap = farmLevelInfo(level).eggCap;
                const eggs = eggsReady(farm, now, level);
                const text = eggs >= cap ? 'The basket is full.' : `The next egg is ${minutesText(minutesToNextEgg(farm, now, level))} away.`;
                return card('THE COOP', `<p class="town-blurb">The hens lay an egg every ${EGG.minutes} minutes, up to ${cap}. ${text}</p><p class="town-stat">${eggs} ${eggs === 1 ? 'egg' : 'eggs'} waiting</p>`,
                    `<button type="button" class="shop-action collect" data-farm-eggs${eggs ? '' : ' disabled'}>COLLECT ${eggs || ''} EGGS</button>`);
            }
            case 'stand': {
                const bonus = farmLevelInfo(Math.max(1, farmLevel(profile))).standBonus; // what the stand pays at this level
                const pays = (g, count) => Math.round(count * g.price * bonus);
                const rows = GOODS.filter(g => farm.store[g.id] > 0).map(g => `<div class="farm-row"><span>${g.name} x ${farm.store[g.id]}</span><span>$${pays(g, farm.store[g.id])}</span><button type="button" class="shop-action upgrade" data-sell="${g.id}">SELL</button></div>`).join('');
                const total = Math.round(GOODS.reduce((sum, g) => sum + farm.store[g.id] * g.price, 0) * bonus);
                const over = bonus > 1 ? ` The stand pays ${Math.round((bonus - 1) * 100)}% over.` : '';
                return card('THE FARM STAND', `<p class="town-blurb">${total ? `Fair prices, the same every day.${over}` : 'Nothing to sell yet. Harvest a plot or collect the eggs, then come back.'}</p>${rows}`,
                    total ? `<button type="button" class="shop-action collect" data-sell="all">SELL ALL FOR $${total}</button>` : '');
            }
            case 'barn': {
                const level = Math.max(1, farmLevel(profile));
                return card(`THE BARN: LEVEL ${level}`, `<p class="town-blurb">${getDistrict('ranch').card.text}</p><p class="town-stat">${farmLevelInfo(level).note}${level < 3 ? ' More stars on the Calloways raise the farm another level.' : ''}</p><div class="farm-chips">${storeLine(farm.store)}</div>`);
            }
            case 'kennel': {
                const label = !companion.adopted ? 'TAKE THE DOG' : companion.following ? 'SEND THE DOG HOME' : 'CALL THE DOG';
                return card('THE KENNEL', '<p class="town-blurb">The Calloways keep one dog more than they can feed. It would rather be out working.</p>', `<button type="button" class="shop-action collect" data-companion>${label}</button>`);
            }
            default: return '';
        }
    }
    // Something the farm does for real: the wallet runs the rules (src/farm.js), here or on the server.
    function farmDo(body, wording) {
        openId = null;
        return act(async () => {
            const result = await wallet.farm(body);
            onProfile(result.profile);
            track(`farm_${body.action}`);
            toast(wording(result.result));
        }, text => toast(text, true));
    }
    // Walking up to something on the farm (src/townWalk.js, the farm's own instance).
    function useFarm(id) {
        if(id === 'leave') return leavePlace();
        const farm = profile?.town.farm;
        const index = plotIndex(id);
        if(farm && index >= 0 && plotStates(farm)[index].state === 'ready') {
            return farmDo({ action: 'harvest', plot: index }, r => `Harvested ${r.amount} ${GOODS.find(g => g.id === r.good).name.toLowerCase()}.`);
        }
        if(farm && id === 'coop' && eggsReady(farm, new Date(), Math.max(1, farmLevel(profile))) > 0) return farmDo({ action: 'eggs' }, r => `Collected ${r.amount} ${r.amount === 1 ? 'egg' : 'eggs'}.`);
        openBuilding(id);
    }
    function enterPlace(id) {
        const district = getDistrict(id);
        if(!district?.interior || !profile || place || !unlockedDistricts(profile.stats.stageStars).includes(id)) return;
        if(!farm3d) {
            farm3d = createFarmScene();
            farmWalk = createTownWalk({
                town3d: farm3d, host: els.screen, onOpen: useFarm, blocked: () => !!openId, start: FARM_START,
                describe: door => farmLabel(door, profile?.town.farm, new Date(), profile ? Math.max(1, farmLevel(profile)) : 1)
            });
        }
        track('place_enter');
        walk?.exit(); // the town stops where the marshal stood, ready for when he comes back out
        place = id;
        farm3d.resize(window.innerWidth, window.innerHeight);
        farm3d.setFarm(profile.town.farm, new Date(), Math.max(1, farmLevel(profile)));
        look?.setScene(farm3d.scene, farm3d.camera, { sky: DAY_SKY });
        farmWalk.setCompanion(companion.following);
        farmWalk.enter();
        news = markVisited(news, id);
        saveNews(news);
        els.labels.style.display = 'none';
        els.title.textContent = district.name;
        openId = null;
        syncTools();
        render();
    }
    function leavePlace() {
        if(!place) return;
        farmWalk.exit();
        place = null;
        look?.setScene(town3d.scene, town3d.camera);
        els.labels.style.display = '';
        els.title.textContent = 'FRONTIER TOWN';
        els.toast.style.display = 'none';
        openId = null;
        if(featureOn('walk')) walk.enter();
        walk?.setCompanion(companion.following);
        syncTools();
        render();
    }
    els.placeBack.addEventListener('click', leavePlace);

    // Walking up to a door or a place (src/townWalk.js). The places of src/townSpots.js are not buildings:
    // the train starts the next hunt, the cash box pays the jail's money at once, the board shows the day's jobs.
    function useSpot(id) {
        if(id.startsWith('enter-')) {
            enterPlace(id.slice(6));
        } else if(id === 'train') {
            track('train_ride');
            onBoardTrain();
        } else if(id === 'cashbox') {
            track('town_collect_box');
            openBuilding('jail'); // the result shows on the jail's card
            collectJail();
        } else {
            openBuilding(id); // a building's door, or the board
        }
    }
    // Told once when a district has opened: a banner, and its gate rises. Tap it, or wait, to dismiss.
    function announce(unlocked) {
        const fresh = newlyOpened(unlocked, news);
        if(!fresh.length) return;
        news = markSeen(news, fresh);
        saveNews(news);
        const first = bannerFor(getDistrict(fresh[0]));
        els.newsTitle.textContent = first.title;
        els.newsText.textContent = fresh.length > 1 ? `${first.text} (${fresh.length - 1} more are open too.)` : first.text;
        els.news.style.display = '';
        clearTimeout(newsTimer);
        newsTimer = setTimeout(() => { els.news.style.display = 'none'; }, 9000);
        town3d?.celebrate(fresh);
        track('district_open');
    }
    els.news.addEventListener('click', () => { els.news.style.display = 'none'; clearTimeout(newsTimer); });

    // What a townsperson says: one line for how far the marshal has got (src/townFolk.js).
    function personLine(id) {
        const progress = getProgress();
        const beaten = progress ? progress.stars.filter(mask => (mask & 1) !== 0).length : 0;
        const person = getFolk(id);
        const talk = profile ? talkOfTheTown(unlockedDistricts(profile.stats.stageStars), news) : null;
        return person ? folkLine(person, beaten, talk) : '';
    }
    const describeSpot = door => {
        const named = doorLabel(door.id);
        if(named) return named;
        if(!getSpot(door.id)) return door.label;
        const selected = getProgress()?.selected ?? 0;
        return spotLabel(door.id, {
            outlawName: OUTLAWS[selected]?.name,
            stored: profile ? jailStored(profile) : 0,
            capacity: profile ? jailCapacity(profile) : 0,
            jobsLeft: jobsLeft(profile)
        });
    };

    els.grid.addEventListener('click', event => {
        const button = event.target.closest('button');
        if(!button || button.disabled) return;
        if(button.dataset.travel) {
            travelTo(button.dataset.travel);
        } else if(button.dataset.plant) {
            const crop = getCrop(button.dataset.plant);
            farmDo({ action: 'plant', plot: Number(button.dataset.plot), crop: crop.id }, () => `Planted ${crop.name.toLowerCase()}.`);
        } else if(button.dataset.sell) {
            farmDo({ action: 'sell', good: button.dataset.sell }, r => `Sold for $${r.dollars}.`);
        } else if(button.hasAttribute('data-farm-eggs')) {
            farmDo({ action: 'eggs' }, r => `Collected ${r.amount} ${r.amount === 1 ? 'egg' : 'eggs'}.`);
        } else if(button.hasAttribute('data-arena-fight')) {
            track('arena_fight');
            openId = null; // the card closes and the fight begins
            render();
            onArenaFight(Number(button.dataset.arenaFight));
        } else if(button.dataset.arenaToggle) {
            arena[button.dataset.arenaToggle] = !arena[button.dataset.arenaToggle];
            render();
        } else if(button.dataset.arenaMode) {
            arena.mode = button.dataset.arenaMode;
            render();
        } else if(button.hasAttribute('data-companion')) {
            companion = { adopted: true, following: !(companion.adopted && companion.following) };
            saveCompanion(companion);
            (place ? farmWalk : walk)?.setCompanion(companion.following);
            track(companion.following ? 'companion_on' : 'companion_off');
            render();
        } else if(button.hasAttribute('data-collect')) {
            confirmUpgrade = null;
            collectJail();
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
        } else if(button.hasAttribute('data-buy-pass')) {
            if(confirmUpgrade !== 'pass') {
                confirmUpgrade = 'pass'; // two taps to spend, like every purchase
                render();
                return;
            }
            confirmUpgrade = null;
            render();
            onBuyPass?.();
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
        if(confirmUpgrade && !event.target.closest?.('[data-upgrade], [data-buy-pass]')) {
            confirmUpgrade = null;
            render();
        }
    });
    els.button.addEventListener('click', () => {
        track('town_open');
        if(place) leavePlace(); // the town always opens on its streets
        confirmUpgrade = null;
        openId = null;
        say('');
        if(!town3d) {
            town3d = createTownScene({ time: featureOn('time') });
            walk = createTownWalk({ town3d, host: els.screen, onOpen: useSpot, blocked: () => !!openId, describe: describeSpot, lineFor: personLine });
            // Dev builds only: lets tests/town-smoke.mjs put the marshal at a door.
            if(import.meta.env?.DEV) window.__redWestTown = { walk, town3d, get companion() { return companion; }, get hasProfile() { return !!profile; }, get news() { return news; }, get look() { return look; }, get place() { return place; }, get farm3d() { return farm3d; }, get farmWalk() { return farmWalk; }, enterPlace, leavePlace };
        }
        town3d.resize(window.innerWidth, window.innerHeight);
        look?.resize(window.innerWidth, window.innerHeight);
        walk.setCompanion(companion.following);
        if(featureOn('walk')) walk.enter();
        syncTools();
        ui.showTown();
        render();
    });
    // LOOK's quality (src/townQuality.js): AUTO steps down by itself on a slow phone, and remembers where it ended up.
    const LEVEL_NAMES = { high: 'HIGH', medium: 'MED', low: 'LOW' };
    function onQualityChange(level, why) {
        if(why === 'auto' && qualityChoice === 'auto') {
            quality = { ...quality, floor: level };
            saveQuality(quality);
            track('look_quality_auto');
        }
        syncTools();
    }
    els.qualityButton.addEventListener('click', () => {
        if(!look) return;
        qualityChoice = nextChoice(qualityChoice);
        if(qualityChoice === 'auto') {
            quality = { choice: 'auto', floor: 'high' }; // back to auto gives the device another chance at the best look
            look.setQuality('high', true);
        } else {
            quality = { choice: qualityChoice, floor: quality.floor };
            look.setQuality(qualityChoice, false);
        }
        saveQuality(quality);
        syncTools();
    });
    // WALK and LOOK are separate switches: either can be on without the other.
    function syncTools() {
        const walking = !!walk?.active;
        els.walkButton.setAttribute('aria-pressed', String(walking));
        els.lookButton.setAttribute('aria-pressed', String(!!look?.enabled));
        els.qualityButton.style.display = (look ? look.enabled : featureOn('look')) ? '' : 'none';
        const shown = look?.quality ?? startLevel(quality, qualityParam()).level;
        els.qualityButton.textContent = qualityChoice === 'auto' ? `QUALITY: AUTO (${LEVEL_NAMES[shown]})` : `QUALITY: ${LEVEL_NAMES[qualityChoice]}`;
        els.walkButton.style.display = place ? 'none' : '';
        els.placeBack.style.display = place ? '' : 'none';
        els.hint.textContent = place
            ? ('ontouchstart' in window ? 'Stick to walk. Tap the prompt to use what you stand by.' : 'WASD to walk. E to use what you stand by.')
            : walking
                ? ('ontouchstart' in window ? 'Stick to walk. Tap a door to go in.' : 'WASD to walk. E at a door to go in.')
                : 'Drag to look around. Tap a building.';
    }
    els.walkButton.addEventListener('click', () => {
        if(!walk || place) return;
        if(walk.active) walk.exit(); else walk.enter();
        rememberFeature('walk', walk.active);
        syncTools();
    });
    els.lookButton.addEventListener('click', () => {
        if(!look) return;
        look.setEnabled(!look.enabled);
        rememberFeature('look', look.enabled);
        syncTools();
    });
    els.labels.addEventListener('click', event => {
        const label = event.target.closest('[data-open-building]');
        if(label) openBuilding(label.dataset.openBuilding);
    });
    els.sheetClose.addEventListener('click', () => {
        openId = null;
        render();
    });
    window.addEventListener('resize', () => {
        headerBottom = 0;
        town3d?.resize(window.innerWidth, window.innerHeight);
        farm3d?.resize(window.innerWidth, window.innerHeight);
        look?.resize(window.innerWidth, window.innerHeight);
    });

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
        if(!last || !town3d || walk?.active || place) return;
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
            const id = place ? null : town3d.pick((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
            if(id) openBuilding(id);
            else if(openId) { openId = null; render(); }
        }
    };
    els.touch.addEventListener('pointerup', release);
    els.touch.addEventListener('pointercancel', release);
    els.touch.addEventListener('wheel', event => {
        event.preventDefault();
        if(!walk?.active && !place) town3d?.zoom(event.deltaY > 0 ? 1.1 : 0.9);
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
            if(!look) { // needs the renderer, which only the loop hands over
                const start = startLevel(quality, qualityParam());
                look = createTownLook(renderer, town3d.scene, town3d.camera, { enabled: featureOn('look'), level: start.level, auto: start.auto, onQuality: onQualityChange });
                look.resize(window.innerWidth, window.innerHeight);
                if(place) look.setScene(farm3d.scene, farm3d.camera, { sky: DAY_SKY });
                syncTools();
            }
            if(place) { // inside a place: its own map is drawn and walked, and the town waits
                farm3d.update(dt);
                farmWalk.update(dt);
                look.render(dt);
                return;
            }
            town3d.update(dt);
            walk?.update(dt);
            if(walk?.active) { // walking into a district for the first time ends the talk about it
                const here = districtAt(walk.position.x, walk.position.z);
                if(here && !news.visited.includes(here.id)) {
                    news = markVisited(news, here.id);
                    saveNews(news);
                    track('district_visit');
                }
            }
            look.render(dt);
            const w = window.innerWidth;
            const h = window.innerHeight;
            // Signs never slide under the header, where they could not be tapped.
            const minTop = (headerBottom ||= els.screen.querySelector('.panel-header').getBoundingClientRect().bottom) + 48;
            // Place the signs top to bottom, nudging any that would overlap one already placed.
            const placed = [];
            const signs = Object.entries(town3d.labelPositions())
                .map(([id, p]) => ({ id, p, x: Math.round(p.x * w), y: Math.max(minTop, Math.round(p.y * h)) }))
                .sort((a, b) => a.y - b.y);
            for(const s of signs) {
                const label = labelEls.get(s.id);
                const width = label.offsetWidth;
                const height = label.offsetHeight;
                for(const other of placed) {
                    const overlapX = Math.abs(s.x - other.x) < (width + other.width) / 2 + 4;
                    if(overlapX && s.y - height < other.y && s.y > other.y - other.height) s.y = other.y + height + 4;
                }
                placed.push({ x: s.x, y: s.y, width, height });
                label.style.left = `${s.x}px`;
                label.style.top = `${s.y}px`;
                label.style.visibility = s.p.visible ? '' : 'hidden';
            }
        }
    };
}
