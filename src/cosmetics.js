import { WEAPONS, WEAPON_SLOTS } from './weapons.js';
import { OUTLAWS } from './outlaws.js';
import { OUTLAW_PERKS, HIRED_PERKS } from './perks.js';
import { EVENT_COSMETICS } from './events.js';
import { PASS_COSMETICS } from './pass.js';

// Shop catalog: guns (src/weapons.js) plus cosmetics. Cosmetics never change gameplay; guns do,
// so they are sold for earned Bounty Dollars only (no pay-to-win). Price 0 = owned by default.

export const LOOK_SLOTS = ['hat', 'coat', 'pants', 'bullets'];
export const SLOTS = ['character', ...WEAPON_SLOTS, ...LOOK_SLOTS];
export const SLOT_LABELS = { character: 'CHARACTERS', primary: 'SIDEARMS', secondary: 'LONG GUNS', hat: 'HATS', coat: 'COATS', pants: 'PANTS', bullets: 'BULLETS' };

// Who you play as. `model` is an animated GLB (src/characterModels.js); the Drifter is the original
// box-built cowboy, the only one the hat / coat / pants colours apply to. First free one = default.
export const CHARACTERS = [
    { id: 'char-marshal', slot: 'character', name: 'Marshal Flint Reed', model: 'models/marshal.glb', price: 0, currency: 'dollars',
        blurb: 'Fully animated lawman.' },
    { id: 'char-drifter', slot: 'character', name: 'The Drifter', model: null, price: 0, currency: 'dollars',
        blurb: 'A legend of the Wanted Road, some say an immortal one. Wears your shop hat, coat and pants colours.' },
    // Hired hands: bought with earned Bounty Dollars only, each with a side-grade perk (src/perks.js).
    ...[
        ['june-holloway', 'Deputy June Holloway', 1500],
        ['ezra-stone', 'Ezra Stone', 2500]
    ].map(([id, name, price]) => {
        const perk = HIRED_PERKS[id];
        return { id: `char-${id}`, slot: 'character', name, model: `models/${id}.glb`, price, currency: 'dollars',
            perk, blurb: `${perk.name}: ${perk.perk} ${perk.drawback}` };
    }),
    // Beaten outlaws: unlocked by earning all three of that outlaw's stars, never bought (src/perks.js).
    ...OUTLAWS.map((outlaw, index) => {
        const perk = OUTLAW_PERKS[outlaw.id];
        return { id: `char-${outlaw.id}`, slot: 'character', name: outlaw.name, model: outlaw.model, price: 0, currency: 'dollars',
            unlock: { outlaw: index }, perk, blurb: `${perk.name}: ${perk.perk} ${perk.drawback}` };
    })
];

export const COSMETICS = [
    { id: 'hat-trail', slot: 'hat', name: 'Trail Hat', color: 0x7a4520, price: 0, currency: 'dollars' },
    { id: 'hat-black', slot: 'hat', name: 'Outlaw Black', color: 0x1f1f1f, price: 150, currency: 'dollars' },
    { id: 'hat-white', slot: 'hat', name: 'Sheriff White', color: 0xeeeeee, price: 300, currency: 'dollars' },
    { id: 'hat-rose', slot: 'hat', name: 'Desert Rose', color: 0xb71c1c, price: 450, currency: 'dollars' },
    { id: 'hat-gold', slot: 'hat', name: 'Gold Rush', color: 0xffc107, price: 100, currency: 'nuggets' },
    { id: 'coat-saddle', slot: 'coat', name: 'Saddle Brown', color: 0xb8662a, price: 0, currency: 'dollars' },
    { id: 'coat-navy', slot: 'coat', name: 'Cavalry Navy', color: 0x283593, price: 200, currency: 'dollars' },
    { id: 'coat-sage', slot: 'coat', name: 'Sagebrush', color: 0x558b2f, price: 250, currency: 'dollars' },
    { id: 'coat-duster', slot: 'coat', name: 'Pale Duster', color: 0xd7ccc8, price: 400, currency: 'dollars' },
    { id: 'coat-midnight', slot: 'coat', name: 'Midnight Velvet', color: 0x4a148c, price: 100, currency: 'nuggets' },
    { id: 'pants-denim', slot: 'pants', name: 'Denim', color: 0x3f5a8a, price: 0, currency: 'dollars' },
    { id: 'pants-black', slot: 'pants', name: 'Black Jeans', color: 0x212121, price: 100, currency: 'dollars' },
    { id: 'pants-chaps', slot: 'pants', name: 'Leather Chaps', color: 0x8d6e63, price: 180, currency: 'dollars' },
    { id: 'bullets-brass', slot: 'bullets', name: 'Brass', color: 0xffff00, price: 0, currency: 'dollars' },
    { id: 'bullets-ice', slot: 'bullets', name: 'Ice Blue', color: 0x00e5ff, price: 250, currency: 'dollars' },
    { id: 'bullets-rose', slot: 'bullets', name: 'Hot Pink', color: 0xff4081, price: 250, currency: 'dollars' },
    { id: 'bullets-venom', slot: 'bullets', name: 'Venom Green', color: 0x76ff03, price: 350, currency: 'dollars' },
    { id: 'bullets-ember', slot: 'bullets', name: 'Ember', color: 0xff6d00, price: 50, currency: 'nuggets' },
    // The Deputy's Kit (starter pack, src/products.js): only from that purchase.
    { id: 'hat-deputy', slot: 'hat', name: 'Deputy Grey', color: 0x5f6368, price: 0, currency: 'dollars', earned: 'purchase' },
    { id: 'coat-deputy', slot: 'coat', name: 'Deputy Long Coat', color: 0x37474f, price: 0, currency: 'dollars', earned: 'purchase' },
    { id: 'bullets-deputy', slot: 'bullets', name: 'Tin Star', color: 0xcfd8dc, price: 0, currency: 'dollars', earned: 'purchase' },
    // Weekly event prizes and season pass looks: earned only (src/events.js, src/pass.js)
    ...EVENT_COSMETICS,
    ...PASS_COSMETICS
];

export const SHOP_ITEMS = [...CHARACTERS, ...WEAPONS, ...COSMETICS];
const BY_ID = new Map(SHOP_ITEMS.map(item => [item.id, item]));

export function getShopItem(id) {
    return BY_ID.get(id) ?? null;
}

export function defaultLoadout() {
    const loadout = {};
    for(const slot of SLOTS) loadout[slot] = SHOP_ITEMS.find(item => item.slot === slot && item.price === 0).id;
    return loadout;
}

// Resolve a loadout to colours, falling back to defaults for anything unknown.
export function loadoutColors(loadout) {
    const colors = {};
    const defaults = defaultLoadout();
    for(const slot of LOOK_SLOTS) {
        const item = getShopItem(loadout?.[slot]);
        colors[slot] = (item && item.slot === slot ? item : getShopItem(defaults[slot])).color;
    }
    return colors;
}
