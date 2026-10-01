import { EconomyError } from './economyError.js';
import { OUTLAWS } from './outlaws.js';

// Calloway Farm, the first place you step into (PLACES.md, TOWN_PLAN.md step H). The rules are here with no
// rendering, so the server and the offline wallet run the same code and tests/farm.test.js can check them.
//
// - Six plots. Plant a crop, come back when it has grown, harvest. A crop grows in real time and never spoils, so a
//   plot that has been ready for a day is still full: checking in once or twice a day gets everything (the jail's rule).
// - The coop lays an egg every half hour, up to a full basket.
// - Goods go into the barn. The farm stand pays a fixed price for them in Bounty Dollars.
// - No timer can be sped up and nothing is bought with real money. Nothing here touches combat.
// - It opens with the first star on the Calloways, like the district it belongs to.

export const FARM_OUTLAW = 'calloway-gang';
export const PLOT_COUNT = 6;

// minutes: how long it takes to grow. yield: goods per harvest. price: Bounty Dollars for one at the stand.
// The best a plot can earn (price x yield, an hour of a tended plot) stays below the jail's top rate: see tests/farm.test.js.
export const CROPS = [
    { id: 'wheat', name: 'WHEAT', minutes: 20, yield: 2, price: 2, blurb: 'Quick. Ready in 20 minutes.' },
    { id: 'corn', name: 'CORN', minutes: 90, yield: 3, price: 6, blurb: 'Ready in an hour and a half.' },
    { id: 'pumpkin', name: 'PUMPKIN', minutes: 480, yield: 4, price: 12, blurb: 'Slow. Plant it before bed.' }
];
export const EGG = { id: 'egg', name: 'EGGS', minutes: 30, cap: 8, price: 2 };
export const GOODS = [...CROPS.map(({ id, name, price }) => ({ id, name, price })), { id: EGG.id, name: EGG.name, price: EGG.price }];

const MINUTE = 60000;
const BY_CROP = new Map(CROPS.map(c => [c.id, c]));
export const getCrop = id => BY_CROP.get(id) ?? null;

export function createFarm(now = new Date()) {
    return {
        plots: Array.from({ length: PLOT_COUNT }, () => ({ crop: null, plantedAt: null })),
        store: Object.fromEntries(GOODS.map(g => [g.id, 0])),
        coopAt: now.toISOString()
    };
}

// Whatever the saved data looks like, a farm comes out of it: unknown crops are cleared, counts are whole numbers.
export function normalizeFarm(raw, now = new Date()) {
    const farm = createFarm(now);
    if(!raw || typeof raw !== 'object') return farm;
    for(let i = 0; i < PLOT_COUNT; i++) {
        const plot = raw.plots?.[i];
        const planted = Date.parse(plot?.plantedAt);
        if(getCrop(plot?.crop) && Number.isFinite(planted)) farm.plots[i] = { crop: plot.crop, plantedAt: new Date(planted).toISOString() };
    }
    for(const g of GOODS) farm.store[g.id] = Math.min(9999, Math.max(0, Math.floor(Number(raw.store?.[g.id])) || 0));
    const coop = Date.parse(raw.coopAt);
    if(Number.isFinite(coop)) farm.coopAt = new Date(coop).toISOString();
    return farm;
}

export function farmOpen(profile) {
    const index = OUTLAWS.findIndex(o => o.id === FARM_OUTLAW);
    return (((profile.stats?.stageStars?.[index]) | 0) & 1) !== 0;
}

// One plot: 'empty', 'growing' or 'ready'. A clock that moved backwards counts as no time passing (never more than
// the full growing time left), so moving the clock forward and back gains nothing.
export function plotState(farm, index, now = new Date()) {
    const plot = farm.plots[index];
    const crop = plot && getCrop(plot.crop);
    if(!crop) return { state: 'empty', crop: null, minutesLeft: 0, fraction: 0 };
    const elapsed = Math.max(0, (now.getTime() - Date.parse(plot.plantedAt)) / MINUTE);
    if(elapsed >= crop.minutes) return { state: 'ready', crop, minutesLeft: 0, fraction: 1 };
    return { state: 'growing', crop, minutesLeft: crop.minutes - elapsed, fraction: elapsed / crop.minutes };
}

export const plotStates = (farm, now = new Date()) => farm.plots.map((_, i) => plotState(farm, i, now));

// Eggs waiting in the coop now.
export function eggsReady(farm, now = new Date()) {
    const minutes = Math.max(0, (now.getTime() - Date.parse(farm.coopAt)) / MINUTE);
    return Math.min(EGG.cap, Math.floor(minutes / EGG.minutes));
}

// Minutes until the next egg (0 when the basket is full).
export function minutesToNextEgg(farm, now = new Date()) {
    if(eggsReady(farm, now) >= EGG.cap) return 0;
    const minutes = Math.max(0, (now.getTime() - Date.parse(farm.coopAt)) / MINUTE);
    return EGG.minutes - (minutes % EGG.minutes);
}

function requireOpen(profile) {
    if(!farmOpen(profile)) throw new EconomyError('locked', 'The farm is shut until the Calloways are beaten.');
    return profile.town.farm;
}

function requirePlot(farm, index) {
    const i = Number(index);
    if(!Number.isInteger(i) || i < 0 || i >= PLOT_COUNT) throw new EconomyError('no_plot', 'There is no such plot.');
    return i;
}

export function plant(profile, index, cropId, now = new Date()) {
    const farm = requireOpen(profile);
    const i = requirePlot(farm, index);
    const crop = getCrop(cropId);
    if(!crop) throw new EconomyError('no_crop', 'There is no such crop.');
    if(plotState(farm, i, now).state !== 'empty') throw new EconomyError('plot_busy', 'Something is already growing there.');
    farm.plots[i] = { crop: crop.id, plantedAt: now.toISOString() };
    return { crop: crop.id };
}

export function harvest(profile, index, now = new Date()) {
    const farm = requireOpen(profile);
    const i = requirePlot(farm, index);
    const { state, crop } = plotState(farm, i, now);
    if(state === 'empty') throw new EconomyError('plot_empty', 'Nothing is planted there.');
    if(state === 'growing') throw new EconomyError('not_ready', 'It is not ready yet.');
    farm.plots[i] = { crop: null, plantedAt: null };
    farm.store[crop.id] = Math.min(9999, farm.store[crop.id] + crop.yield);
    return { good: crop.id, amount: crop.yield };
}

export function collectEggs(profile, now = new Date()) {
    const farm = requireOpen(profile);
    const eggs = eggsReady(farm, now);
    if(!eggs) throw new EconomyError('no_eggs', 'No eggs yet.');
    farm.store.egg = Math.min(9999, farm.store.egg + eggs);
    // A full basket restarts the clock; otherwise the part of an egg already laid is kept.
    farm.coopAt = eggs >= EGG.cap ? now.toISOString() : new Date(Date.parse(farm.coopAt) + eggs * EGG.minutes * MINUTE).toISOString();
    return { good: 'egg', amount: eggs };
}

// Sell one kind of goods ('wheat', ...) or everything ('all') at the stand. Returns the dollars paid.
export function sell(profile, goodId) {
    const farm = requireOpen(profile);
    const kinds = goodId === 'all' ? GOODS : GOODS.filter(g => g.id === goodId);
    if(!kinds.length) throw new EconomyError('no_good', 'The stand does not buy that.');
    let dollars = 0;
    for(const g of kinds) {
        dollars += farm.store[g.id] * g.price;
        farm.store[g.id] = 0;
    }
    if(!dollars) throw new EconomyError('nothing_to_sell', 'You have nothing to sell.');
    profile.balances.dollars += dollars;
    return { dollars };
}

// One entry point for the wallets and the server: { action: 'plant' | 'harvest' | 'eggs' | 'sell', plot, crop, good }.
export function farmAction(profile, body, now = new Date()) {
    switch(body?.action) {
        case 'plant': return plant(profile, body.plot, body.crop, now);
        case 'harvest': return harvest(profile, body.plot, now);
        case 'eggs': return collectEggs(profile, now);
        case 'sell': return sell(profile, body.good);
        default: throw new EconomyError('bad_action', 'That is not something the farm does.');
    }
}

// A length of time as "12m" or "1h 30m".
export function minutesText(minutes) {
    const total = Math.max(1, Math.ceil(minutes));
    return total >= 60 ? `${Math.floor(total / 60)}h${total % 60 ? ` ${total % 60}m` : ''}` : `${total}m`;
}
