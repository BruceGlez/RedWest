import { UPGRADES, getUpgrade } from './saloon.js';
import { COOK_FACTOR, EXTRA_PATIENCE, SEATS, cookSeconds } from './saloonShift.js';

// The upgrade shelf at Copper Bit (docs/design/copper-bit-shift.md, P6 and P7): what each upgrade does, what it costs next and why it cannot be
// bought right now. The rules and the prices are src/saloon.js (`UPGRADES`, `buyUpgrade`), run for real by the wallet (here or on the server); this only
// lays out the numbers for the shelf's card (where you buy) and the bar's card (where the numbers are), with exactly the same refusals, so a button never
// offers what would be refused. Upgrades cost earned Bounty Dollars and nothing else; there is no timer, no limited stock and no discount.

const seconds = n => `${Math.round(n * 100) / 100} s`;
const dishName = id => id.toUpperCase();

// What the next level of an upgrade changes, in words ("BEANS 3 s to 2.25 s").
export function changeText(id, level) {
    const next = level + 1;
    switch(id) {
        case 'stove': return `BEANS ${seconds(cookSeconds('beans', 'stove', { stove: level }))} to ${seconds(cookSeconds('beans', 'stove', { stove: next }))}`;
        case 'oven': return `${dishName('cornbread')} ${seconds(cookSeconds('cornbread', 'oven', { oven: level }))} to ${seconds(cookSeconds('cornbread', 'oven', { oven: next }))}`;
        case 'stool': return `${SEATS} seats to ${SEATS + 1}`;
        case 'taps': return 'THE BARREL POURS 2 AT ONCE';
        case 'cushions': return `CUSTOMERS WAIT ${EXTRA_PATIENCE} s LONGER`;
        case 'boots': return level === 0 ? 'SPEED 5.5 to 6.5' : 'SPEED 6.5 to 7.5';
        case 'tray': return level === 0 ? '1 PLATE to 2' : '2 PLATES to 3';
        case 'burner': return 'COOK 2 STOVE DISHES AT ONCE';
        default: return '';
    }
}

// One row per upgrade, in the shelf's order: { id, name, blurb, level, max, price, can, why, change }. `price` is the next level's (null when it is the best).
export function upgradeRows(profile) {
    const owned = profile?.town?.saloon?.upgrades ?? {};
    const dollars = Math.max(0, Math.floor(Number(profile?.balances?.dollars)) || 0);
    return UPGRADES.map(u => {
        const level = Math.min(u.levels.length, Math.max(0, Math.floor(Number(Object.hasOwn(owned, u.id) ? owned[u.id] : 0)) || 0));
        const max = u.levels.length;
        const price = level < max ? u.levels[level] : null;
        let why = '';
        if(price === null) why = 'BEST';
        else if(dollars < price) why = 'NOT ENOUGH DOLLARS';
        return { id: u.id, name: u.name, blurb: u.blurb, level, max, price, can: !why, why, change: price === null ? '' : changeText(u.id, level) };
    });
}

// The shelf's part of a card: every piece with its level, what the next one changes, its price and a BUY button (data-buy-upgrade).
export function shelfHtml(profile) {
    const dollars = Math.max(0, Math.floor(Number(profile?.balances?.dollars)) || 0);
    const rows = upgradeRows(profile).map(r => `<div class="farm-row"><span>${r.name}<small> ${r.level >= r.max ? 'THE BEST' : r.change}${r.max > 1 ? ` &middot; ${r.level} of ${r.max}` : ''}</small></span>`
        + `<span>${r.price === null ? '' : `$${r.price}`}</span>`
        + `<button type="button" class="shop-action upgrade" data-buy-upgrade="${r.id}"${r.can ? '' : ' disabled'}>${r.can ? 'BUY' : r.why}</button></div>`).join('');
    return `<p class="town-stat">PIECES FOR THE BAR. Bounty Dollars only; you have $${dollars}. They make a shift smoother, never pay more per dish.</p>${rows}`;
}

// The bar card's numbers: the same rows without buttons, and where the shelf is.
export function shelfNumbersHtml(profile) {
    const chips = upgradeRows(profile).map(r => `<span class="farm-chip">${r.name} <b>${r.max > 1 ? `${r.level}/${r.max}` : r.level ? 'YES' : '-'}</b>${r.price === null ? '' : ` ${r.change}, $${r.price}`}</span>`).join('');
    return `<p class="town-stat">The upgrade shelf is by the door. Pieces bought stay bought.</p><div class="farm-chips">${chips}</div>`;
}

// The BUY buttons of the shelf, for a place: `shelfBuyer(host)` returns `buy(button)`, which is true when the click was the shelf's. A sale goes to
// `wallet.saloon({ action: 'upgrade', id })` (src/saloon.js `buyUpgrade` runs for real there) and the card is drawn again from the new profile.
export function shelfBuyer(host) {
    return button => {
        const id = button.dataset.buyUpgrade;
        if(!id) return false;
        if(!getUpgrade(id)) return true; // not something the shelf sells (own names only)
        host.act(async () => {
            const response = await host.wallet.saloon({ action: 'upgrade', id });
            host.onProfile(response.profile);
            host.track('saloon_upgrade');
            host.toast(`Bought ${getUpgrade(response.result.id).name.toLowerCase()} for $${response.result.price}.`);
        }, text => host.toast(text, true));
        return true;
    };
}
