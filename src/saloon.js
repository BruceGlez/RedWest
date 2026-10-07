import { EconomyError } from './economyError.js';
import { OUTLAWS } from './outlaws.js';
import { farmOpen } from './farm.js';
import { dayNumber } from './farmOrders.js';

// Copper Bit, Dusty Pete's saloon (PLACES.md, section 8). The rules and the saved state are here with no rendering, like src/farm.js, so
// the server and the offline wallet can run the same code and tests/saloon.test.js can check them. This is the data contract: the shift
// itself is played on the client, and the player's own summary of it is settled here.
//
// - A shift is about two minutes behind Pete's bar. The client reports who it served and how well ("tip": 0 plain, 1 quick, 2 quick
//   and without a miss). The server never trusts more than a night's crowd can ask for, nor a dish that is not on that night's menu.
// - The first PAID_SHIFTS_PER_DAY shifts of a day pay their prices and tips. Later shifts are free practice: they still earn stars for
//   the night but no dollars (the same once-or-twice-a-day check-in as the jail and the farm). No shift is sold, sped up or bought back.
// - Nights are the levels. A night opens with a star on the one before it. Stars come from how much of the crowd was served.
// - The farm is a bonus and never a need: with it open Pete cooks with farm goods (more dishes, bigger tips); with it shut the menu is
//   smaller and the saloon works on its own.
// - Nothing here touches combat. It opens with the first star on Dusty Pete and reads nothing else about him.

export const SALOON_OUTLAW = 'dusty-pete';
export const PAID_SHIFTS_PER_DAY = 3;
export const NIGHTS = 10;
export const MAX_NIGHT_STARS = 3;

// price: what the dish sells for. from: the first night it is on the menu. farm: only while the farm is open.
export const DISHES = [
    { id: 'sarsaparilla', name: 'SARSAPARILLA', station: 'barrel', price: 2, from: 1, farm: false },
    { id: 'beans', name: 'BEANS', station: 'stove', price: 3, from: 1, farm: false },
    { id: 'cornbread', name: 'CORNBREAD', station: 'oven', price: 4, from: 2, farm: false },
    { id: 'eggs', name: 'EGG PLATE', station: 'stove', price: 5, from: 3, farm: true },
    { id: 'pie', name: 'PUMPKIN PIE', station: 'oven', price: 8, from: 5, farm: true },
    // The farm-free dish of night 5 (owner decision 4): "STEW" is a placeholder name until the story lane gives it one. Its price stays under the pie's, so the
    // priciest dish, and with it the pay ceiling's reasoning, does not move.
    { id: 'stew', name: 'STEW', station: 'stove', price: 6, from: 5, farm: false }
];
// How much of a dish's price a tip adds, by tip tier: none, a quick serve, a quick serve that is the third (or later) quick serve in a row (P8).
export const TIP_RATES = [0, 0.25, 0.5];
// With the farm open the tips are a fifth bigger.
export const FARM_TIP_BONUS = 1.2;

// The most one shift may pay (docs/design/copper-bit-shift.md, P15). Three paid shifts then bank at most 3 x 130 = 390 a day, under the farm's
// 400 a check-in and a small part of the jail's top day, whatever the shift later learns to do (more customers, regulars, upgrades).
export const SHIFT_PAY_CEILING = 130;

// The shelf's upgrades (P6), bought one level at a time with earned Bounty Dollars and nothing else. `levels` are the prices of level 1, 2, ...
// They change how a shift plays (src/saloonShift.js reads them), never a dish's price, a tip rate or the ceiling above, and nothing outside the
// saloon. In the order the shelf shows them.
export const UPGRADES = [
    { id: 'stove', name: 'HOTTER STOVE', blurb: 'The stove cooks faster.', levels: [30, 90] },
    { id: 'stool', name: 'EXTRA STOOL', blurb: 'A fifth seat at the bar.', levels: [60] },
    { id: 'oven', name: 'BIGGER OVEN', blurb: 'The oven cooks faster.', levels: [40, 120] },
    { id: 'taps', name: 'TWO TAPS', blurb: 'The barrel pours two at once.', levels: [30] },
    { id: 'cushions', name: 'CUSHIONED STOOLS', blurb: 'Customers wait a little longer.', levels: [70] }
];
const BY_UPGRADE = new Map(UPGRADES.map(u => [u.id, u]));
export const getUpgrade = id => (typeof id === 'string' ? BY_UPGRADE.get(id) ?? null : null);
// Regulars (P10) are named by the story lane; here only a visit count per id is kept, up to this many visits, for this many people.
export const MAX_REGULAR_VISITS = 3;
export const MAX_REGULARS = 12;

const SALOON_INDEX = OUTLAWS.findIndex(o => o.id === SALOON_OUTLAW);
const BY_DISH = new Map(DISHES.map(d => [d.id, d]));
export const getDish = id => BY_DISH.get(id) ?? null;

export function saloonOpen(profile) {
    return ((profile.stats?.stageStars?.[SALOON_INDEX]) & 1) !== 0;
}

// How many customers a night brings: 5 on night 1, 14 from night 10 (docs/design/copper-bit-shift.md, P1).
export const crowd = night => Math.min(14, 4 + Math.max(1, night));

// What Pete can cook on a night. `farm`: whether the farm is open.
export const menu = (night, farm) => DISHES.filter(d => d.from <= night && (farm || !d.farm));

// Saved state: the newest day seen (a clock moved back never gives a day's paid shifts again), how many paid shifts today, and the
// stars earned on each night.
// `upgrades` is the level bought of each upgrade, `regulars` the visits of each regular.
export const createSaloon = (now = new Date()) => ({
    day: dayNumber(now), paid: 0, nights: Array(NIGHTS).fill(0), upgrades: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), regulars: {}
});

export function normalizeSaloon(raw, now = new Date()) {
    const saloon = createSaloon(now);
    if(!raw || typeof raw !== 'object') return saloon;
    const day = Math.floor(Number(raw.day));
    if(Number.isFinite(day) && day > saloon.day) saloon.day = day;
    if(saloon.day === Math.floor(Number(raw.day))) saloon.paid = Math.min(PAID_SHIFTS_PER_DAY, Math.max(0, Math.floor(Number(raw.paid)) || 0));
    for(let i = 0; i < NIGHTS; i++) saloon.nights[i] = Math.min(MAX_NIGHT_STARS, Math.max(0, Math.floor(Number(raw.nights?.[i])) || 0));
    for(const u of UPGRADES) saloon.upgrades[u.id] = Math.min(u.levels.length, Math.max(0, Math.floor(Number(raw.upgrades?.[u.id])) || 0));
    if(raw.regulars && typeof raw.regulars === 'object') {
        for(const [id, visits] of Object.entries(raw.regulars)) {
            if(Object.keys(saloon.regulars).length >= MAX_REGULARS) break;
            const n = Math.min(MAX_REGULAR_VISITS, Math.max(0, Math.floor(Number(visits)) || 0));
            if(/^[a-z0-9-]{1,24}$/.test(id) && n > 0) saloon.regulars[id] = n;
        }
    }
    return saloon;
}

// The highest night the player may start: one past the last night with a star (night 1 always).
export function nightsOpen(profile) {
    const stars = profile.town.saloon?.nights ?? [];
    let open = 1;
    while(open < NIGHTS && stars[open - 1] > 0) open++;
    return open;
}

const today = (profile, now) => Math.max(dayNumber(now), profile.town.saloon?.day | 0);

// Paid shifts left today (a new day, by the server clock, starts at the full number).
export function paidShiftsLeft(profile, now = new Date()) {
    const saloon = profile.town.saloon;
    if(!saloon || saloon.day < today(profile, now)) return PAID_SHIFTS_PER_DAY;
    return Math.max(0, PAID_SHIFTS_PER_DAY - saloon.paid);
}

// The stars a night earns from how much of the crowd was served: half, three quarters, all.
export function starsFor(night, served) {
    const share = served / crowd(night);
    return share >= 1 ? 3 : share >= 0.75 ? 2 : share >= 0.5 ? 1 : 0;
}

// The served counts that earn one, two and three stars on a night (what the star bar shows).
export const starNeeds = night => {
    const total = crowd(night);
    return [Math.ceil(total / 2), Math.ceil(total * 0.75), total];
};

// What a list of served customers pays on a night: [{ dish, tip }] with the dishes on the menu and no more than the crowd.
export function shiftPay(night, served, farm) {
    const list = menu(night, farm);
    const ok = (Array.isArray(served) ? served : []).slice(0, crowd(night)).filter(s => list.some(d => d.id === s?.dish));
    const bonus = farm ? FARM_TIP_BONUS : 1;
    const dollars = Math.round(ok.reduce((sum, s) => {
        const dish = getDish(s.dish);
        const tip = TIP_RATES[Math.min(TIP_RATES.length - 1, Math.max(0, Math.floor(Number(s.tip)) || 0))];
        return sum + dish.price * (1 + tip * bonus);
    }, 0));
    return { served: ok.length, dollars: Math.min(SHIFT_PAY_CEILING, dollars) };
}

// Settle one shift: { night, served: [{ dish, tip }] }. Returns { served, stars, dollars, paid, paidLeft }.
export function settleShift(profile, body, now = new Date()) {
    if(!saloonOpen(profile)) throw new EconomyError('locked', "Copper Bit is shut until Dusty Pete is beaten.");
    const night = Number(body?.night);
    if(!Number.isInteger(night) || night < 1 || night > NIGHTS) throw new EconomyError('no_night', 'There is no such night.');
    if(night > nightsOpen(profile)) throw new EconomyError('night_shut', 'That night opens with a star on the one before it.');
    const day = today(profile, now);
    const saloon = profile.town.saloon = normalizeSaloon({ ...profile.town.saloon, ...(profile.town.saloon?.day < day ? { day, paid: 0 } : {}) }, now);
    const farm = farmOpen(profile);
    const { served, dollars } = shiftPay(night, body?.served, farm);
    const stars = starsFor(night, served);
    saloon.nights[night - 1] = Math.max(saloon.nights[night - 1], stars);
    const paid = saloon.paid < PAID_SHIFTS_PER_DAY;
    if(paid) {
        saloon.paid++;
        profile.balances.dollars += dollars;
    }
    return { served, stars, dollars: paid ? dollars : 0, paid, paidLeft: PAID_SHIFTS_PER_DAY - saloon.paid };
}

// Buy the next level of an upgrade: { id }. Earned dollars only, one level at a time, never mid-shift (a shift is settled when it ends).
// Returns { id, level, price }. The profile is unchanged when it throws.
export function buyUpgrade(profile, body, now = new Date()) {
    if(!saloonOpen(profile)) throw new EconomyError('locked', "Copper Bit is shut until Dusty Pete is beaten.");
    const upgrade = getUpgrade(body?.id);
    if(!upgrade) throw new EconomyError('unknown_upgrade', 'The shelf has no such thing.');
    const saloon = normalizeSaloon(profile.town.saloon, now);
    const level = saloon.upgrades[upgrade.id];
    if(level >= upgrade.levels.length) throw new EconomyError('owned', 'You already have the best of that.');
    const price = upgrade.levels[level];
    if(!(profile.balances.dollars >= price)) throw new EconomyError('funds', 'Not enough bounty dollars.');
    profile.balances.dollars -= price;
    saloon.upgrades[upgrade.id] = level + 1;
    profile.town.saloon = saloon;
    return { id: upgrade.id, level: level + 1, price };
}

// One entry point for the wallets and the server: { action: 'shift', night, served } or { action: 'upgrade', id }.
export function saloonAction(profile, body, now = new Date()) {
    switch(body?.action) {
        case 'shift': return settleShift(profile, body, now);
        case 'upgrade': return buyUpgrade(profile, body, now);
        default: throw new EconomyError('bad_action', 'That is not something the saloon does.');
    }
}
