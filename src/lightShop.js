import { LIGHT_ITEMS, OIL_CAPACITY, CARRY_LIMIT, MATCH_LIMIT, priceOf, normalizeLightKit } from './mineLight.js';

// The light shops' cards (MINE_PLAN.md, slice 5, "buying light"): Mr. Grimsby's and, later, the general store. The rules and the prices are
// src/mineLight.js (`buyLight`, `priceOf`), run for real by the wallet (here or on the server); this only lays out what is for sale and why a thing
// cannot be bought right now, using exactly the same refusals, so a button never offers what would be refused.
// Light is only ever priced in earned Bounty Dollars: a row has a dollar price and nothing else (tests/lightShop.test.js).

const ORDER = ['lantern', 'oil', 'torches', 'matches'];

// One row per thing for sale: { id, name, blurb, price, can, why }. `why` is the reason it cannot be bought now ('' when it can).
export function shopRows(profile, shop = 'grimsby') {
    const kit = normalizeLightKit(profile?.mine?.light);
    const dollars = Math.max(0, Math.floor(Number(profile?.balances?.dollars)) || 0);
    return ORDER.map(id => {
        const item = LIGHT_ITEMS[id];
        const price = priceOf(id, shop, kit); // (oil: by what the lantern is missing, as the sale charges it)
        let why = '';
        if(id === 'lantern' && kit.lantern) why = 'YOU HAVE ONE';
        else if(id === 'oil' && !kit.lantern) why = 'NEEDS A LANTERN';
        else if(id === 'oil' && kit.oil >= OIL_CAPACITY) why = 'FULL';
        else if(id === 'torches' && kit.torches >= CARRY_LIMIT) why = 'CARRYING THE MOST';
        else if(id === 'matches' && kit.matches >= MATCH_LIMIT) why = 'CARRYING THE MOST';
        else if(dollars < price) why = 'NOT ENOUGH DOLLARS';
        return { id, name: item.name, blurb: item.blurb, price, can: !why, why };
    });
}

// What he has now, as one line ("LANTERN: LIT 15m of oil, 5 torches, 0 matches").
export function kitLine(profile) {
    const kit = normalizeLightKit(profile?.mine?.light);
    const minutes = Math.floor(kit.oil / 60);
    const lantern = kit.lantern ? `LANTERN: ${minutes}m OF OIL` : 'NO LANTERN';
    return `${lantern}, ${kit.torches} ${kit.torches === 1 ? 'TORCH' : 'TORCHES'}, ${kit.matches} ${kit.matches === 1 ? 'MATCH' : 'MATCHES'}`;
}

// The shop's part of a card. `shop` is the shop's id for the prices ('grimsby' or 'store'); buttons carry data-buy-light and data-shop.
export function lightShopHtml(profile, shop = 'grimsby') {
    const rows = shopRows(profile, shop).map(r => `<div class="farm-row"><span>${r.name}<small> ${r.blurb}</small></span><span>$${r.price}</span>`
        + `<button type="button" class="shop-action upgrade" data-buy-light="${r.id}" data-shop="${shop}"${r.can ? '' : ' disabled'}>${r.can ? 'BUY' : r.why}</button></div>`).join('');
    return `<p class="town-stat">LIGHT FOR THE HOLLOW CLAIM. Bounty Dollars only. ${kitLine(profile)}.</p>${rows}`;
}

// The BUY buttons of a light shop, for a place: `lightBuyer(host)` returns `buy(button)`, which is true when the click was a shop's button. A sale goes to
// `wallet.buyLight({ id, shop })` (src/mineLight.js `buyLight` runs for real there, here or on the server) and the card is drawn again from the new profile.
export function lightBuyer(host) {
    return button => {
        const item = button.dataset.buyLight;
        if(!item) return false;
        if(!Object.hasOwn(LIGHT_ITEMS, item)) return true; // not something the shops sell (own names only: "constructor" is not an item)
        const body = { id: item, shop: button.dataset.shop === 'store' ? 'store' : 'grimsby' }; // the wallet's body (src/wallet.js, POST /api/mine/buy)
        host.act(async () => {
            if(typeof host.wallet?.buyLight !== 'function') throw new Error('The shop is not open yet.');
            const response = await host.wallet.buyLight(body);
            host.onProfile(response.profile);
            host.track('light_buy');
            host.toast(`Bought ${LIGHT_ITEMS[response.result.id].name.toLowerCase()} for $${response.result.price}.`);
        }, text => host.toast(text, true));
        return true;
    };
}
