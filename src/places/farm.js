// Calloway Farm as a place you step into (PLACES.md): the rules are src/farm.js, the map src/farmLayout.js, the 3D scene src/placeFarm.js.
// Everything the farm needs from the town screen comes through `host` (src/places/registry.js lists it), so a place never reaches into
// src/townPanel.js. Built once per town screen by src/places/index.js.
import { createFarmScene } from '../placeFarm.js';
import { DAY_SKY } from '../townLook.js';
import { createTownWalk } from '../townWalk.js';
import { farmWatered, CROPS, GOODS, EGG, getCrop, plotStates, eggsReady, minutesToNextEgg, minutesText, farmLevel, farmLevelInfo } from '../farm.js';
import { FARM_START, farmLabel, plotIndex } from '../farmLayout.js';
import { growMinutes } from '../farmWater.js';
import { unlockedDistricts, getDistrict } from '../townDistricts.js';

export function createFarmPlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null; // walking on the farm: the same walking code, on the farm's map

    const crate = (label, value) => `<span class="farm-chip">${label} <b>${value}</b></span>`;
    function storeLine(store) {
        const have = GOODS.filter(g => store[g.id] > 0);
        return have.length ? have.map(g => crate(g.name, store[g.id])).join('') : '<span class="farm-chip">THE BARN IS EMPTY</span>';
    }
    function farmCard(id) {
        const farm = host.profile().town.farm;
        const now = new Date();
        const index = plotIndex(id);
        const card = (title, body, actions = '') => `<div class="town-card" data-building="${id}"><div class="town-sign"><span>${title}</span></div>${body}${actions ? `<div class="town-actions farm-actions">${actions}</div>` : ''}</div>`;
        if(index >= 0) {
            const plot = plotStates(farm, now, farmWatered(host.profile()))[index];
            if(plot.state === 'empty') {
                const buttons = CROPS.map(c => `<button type="button" class="shop-action collect farm-crop" data-plant="${c.id}" data-plot="${index}">${c.name}<small>${minutesText(growMinutes(c, farmWatered(host.profile())))} · ${c.yield} x $${c.price}</small></button>`).join('');
                return card(`PLOT ${index + 1}`, '<p class="town-blurb">Pick a crop. It grows while you are away and waits for you, however long that is.</p>', buttons);
            }
            return card(`PLOT ${index + 1}`, `<p class="town-blurb">${plot.crop.name}: ${minutesText(plot.minutesLeft)} to go.</p>`
                + `<div class="farm-bar"><i style="width:${Math.round(plot.fraction * 100)}%"></i></div><p class="town-stat">${plot.crop.blurb}</p>`);
        }
        switch(id) {
            case 'coop': {
                const level = Math.max(1, farmLevel(host.profile()));
                const cap = farmLevelInfo(level).eggCap;
                const eggs = eggsReady(farm, now, level);
                const text = eggs >= cap ? 'The basket is full.' : `The next egg is ${minutesText(minutesToNextEgg(farm, now, level))} away.`;
                return card('THE COOP', `<p class="town-blurb">The hens lay an egg every ${EGG.minutes} minutes, up to ${cap}. ${text}</p><p class="town-stat">${eggs} ${eggs === 1 ? 'egg' : 'eggs'} waiting</p>`,
                    `<button type="button" class="shop-action collect" data-farm-eggs${eggs ? '' : ' disabled'}>COLLECT ${eggs || ''} EGGS</button>`);
            }
            case 'stand': {
                const bonus = farmLevelInfo(Math.max(1, farmLevel(host.profile()))).standBonus; // what the stand pays at this level
                const pays = (g, count) => Math.round(count * g.price * bonus);
                const rows = GOODS.filter(g => farm.store[g.id] > 0).map(g => `<div class="farm-row"><span>${g.name} x ${farm.store[g.id]}</span><span>$${pays(g, farm.store[g.id])}</span><button type="button" class="shop-action upgrade" data-sell="${g.id}">SELL</button></div>`).join('');
                const total = Math.round(GOODS.reduce((sum, g) => sum + farm.store[g.id] * g.price, 0) * bonus);
                const over = bonus > 1 ? ` The stand pays ${Math.round((bonus - 1) * 100)}% over.` : '';
                return card('THE FARM STAND', `<p class="town-blurb">${total ? `Fair prices, the same every day.${over}` : 'Nothing to sell yet. Harvest a plot or collect the eggs, then come back.'}</p>${rows}`,
                    total ? `<button type="button" class="shop-action collect" data-sell="all">SELL ALL FOR $${total}</button>` : '');
            }
            case 'barn': {
                const level = Math.max(1, farmLevel(host.profile()));
                return card(`THE BARN: LEVEL ${level}`, `<p class="town-blurb">${getDistrict('ranch').card.text}</p><p class="town-stat">${farmLevelInfo(level).note}${level < 3 ? ' More stars on the Calloways raise the farm another level.' : ''}</p><div class="farm-chips">${storeLine(farm.store)}</div>`);
            }
            case 'kennel': {
                const label = !host.companion().adopted ? 'TAKE THE DOG' : host.companion().following ? 'SEND THE DOG HOME' : 'CALL THE DOG';
                return card('THE KENNEL', '<p class="town-blurb">The Calloways keep one dog more than they can feed. It would rather be out working.</p>', `<button type="button" class="shop-action collect" data-companion>${label}</button>`);
            }
            default: return '';
        }
    }
    // Something the farm does for real: the wallet runs the rules (src/farm.js), here or on the server.
    function farmDo(body, wording) {
        host.closeCard();
        return host.act(async () => {
            const result = await host.wallet.farm(body);
            host.onProfile(result.profile);
            host.track(`farm_${body.action}`);
            host.toast(wording(result.result));
        }, text => host.toast(text, true));
    }
    // Walking up to something on the farm (src/townWalk.js, the farm's own instance).
    function useFarm(id) {
        if(id === 'leave') return host.leave();
        const farm = host.profile()?.town.farm;
        const index = plotIndex(id);
        if(farm && index >= 0 && plotStates(farm, new Date(), farmWatered(host.profile()))[index].state === 'ready') {
            return farmDo({ action: 'harvest', plot: index }, r => `Harvested ${r.amount} ${GOODS.find(g => g.id === r.good).name.toLowerCase()}.`);
        }
        if(farm && id === 'coop' && eggsReady(farm, new Date(), Math.max(1, farmLevel(host.profile()))) > 0) return farmDo({ action: 'eggs' }, r => `Collected ${r.amount} ${r.amount === 1 ? 'egg' : 'eggs'}.`);
        host.openBuilding(id);
    }

    const place = {
        id: 'ranch',
        sky: DAY_SKY,
        get scene3d() { return scene3d; },
        get walk() { return walk; },
        title: () => getDistrict('ranch').name,
        // The gate in the town's overview and in the walk: the district's own "enter" spot, once its outlaw has been beaten.
        entrance: spotId => spotId === 'enter-ranch',
        canEnter: () => !!getDistrict('ranch')?.interior && !!host.profile() && unlockedDistricts(host.profile().stats.stageStars).includes('ranch'),
        ensure() {
            if(scene3d) return;
            scene3d = createFarmScene();
            walk = createTownWalk({
                town3d: scene3d, host: host.screen, onOpen: useFarm, blocked: () => host.isCardOpen(), start: FARM_START,
                describe: door => farmLabel(door, host.profile()?.town.farm, new Date(), host.profile() ? Math.max(1, farmLevel(host.profile())) : 1, !!host.profile() && farmWatered(host.profile()))
            });
        },
        sync() { scene3d?.setFarm(host.profile().town.farm, new Date(), Math.max(1, farmLevel(host.profile())), farmWatered(host.profile())); },
        prepare() { this.sync(); },
        entered() { host.markVisited('ranch'); },
        resize: (w, h) => scene3d?.resize(w, h),
        card: farmCard,
        // The buttons on a farm card: plant, sell, collect eggs. Returns true when the click was the farm's.
        click(button) {
            if(button.dataset.plant) {
                const crop = getCrop(button.dataset.plant);
                farmDo({ action: 'plant', plot: Number(button.dataset.plot), crop: crop.id }, () => `Planted ${crop.name.toLowerCase()}.`);
            } else if(button.dataset.sell) {
                farmDo({ action: 'sell', good: button.dataset.sell }, r => `Sold for $${r.dollars}.`);
            } else if(button.hasAttribute('data-farm-eggs')) {
                farmDo({ action: 'eggs' }, r => `Collected ${r.amount} ${r.amount === 1 ? 'egg' : 'eggs'}.`);
            } else return false;
            return true;
        }
    };
    return place;
}
