// Cosmetic catalog. Cosmetics never change gameplay (no pay-to-win), which also keeps them in
// the lowest store fee tier on Google Play. Price 0 = owned by default.

export const SLOTS = ['hat', 'coat', 'pants', 'bullets'];
export const SLOT_LABELS = { hat: 'HATS', coat: 'COATS', pants: 'PANTS', bullets: 'BULLETS' };

export const COSMETICS = [
    { id: 'hat-trail', slot: 'hat', name: 'Trail Hat', color: 0x7a4520, price: 0, currency: 'dollars' },
    { id: 'hat-black', slot: 'hat', name: 'Outlaw Black', color: 0x1f1f1f, price: 150, currency: 'dollars' },
    { id: 'hat-white', slot: 'hat', name: 'Sheriff White', color: 0xeeeeee, price: 300, currency: 'dollars' },
    { id: 'hat-rose', slot: 'hat', name: 'Desert Rose', color: 0xb71c1c, price: 450, currency: 'dollars' },
    { id: 'hat-gold', slot: 'hat', name: 'Gold Rush', color: 0xffc107, price: 60, currency: 'nuggets' },
    { id: 'coat-saddle', slot: 'coat', name: 'Saddle Brown', color: 0xb8662a, price: 0, currency: 'dollars' },
    { id: 'coat-navy', slot: 'coat', name: 'Cavalry Navy', color: 0x283593, price: 200, currency: 'dollars' },
    { id: 'coat-sage', slot: 'coat', name: 'Sagebrush', color: 0x558b2f, price: 250, currency: 'dollars' },
    { id: 'coat-duster', slot: 'coat', name: 'Pale Duster', color: 0xd7ccc8, price: 400, currency: 'dollars' },
    { id: 'coat-midnight', slot: 'coat', name: 'Midnight Velvet', color: 0x4a148c, price: 80, currency: 'nuggets' },
    { id: 'pants-denim', slot: 'pants', name: 'Denim', color: 0x3f5a8a, price: 0, currency: 'dollars' },
    { id: 'pants-black', slot: 'pants', name: 'Black Jeans', color: 0x212121, price: 100, currency: 'dollars' },
    { id: 'pants-chaps', slot: 'pants', name: 'Leather Chaps', color: 0x8d6e63, price: 180, currency: 'dollars' },
    { id: 'bullets-brass', slot: 'bullets', name: 'Brass', color: 0xffff00, price: 0, currency: 'dollars' },
    { id: 'bullets-ice', slot: 'bullets', name: 'Ice Blue', color: 0x00e5ff, price: 250, currency: 'dollars' },
    { id: 'bullets-rose', slot: 'bullets', name: 'Hot Pink', color: 0xff4081, price: 250, currency: 'dollars' },
    { id: 'bullets-venom', slot: 'bullets', name: 'Venom Green', color: 0x76ff03, price: 350, currency: 'dollars' },
    { id: 'bullets-ember', slot: 'bullets', name: 'Ember', color: 0xff6d00, price: 40, currency: 'nuggets' }
];

const BY_ID = new Map(COSMETICS.map(item => [item.id, item]));

export function getCosmetic(id) {
    return BY_ID.get(id) ?? null;
}

export function defaultLoadout() {
    const loadout = {};
    for(const slot of SLOTS) loadout[slot] = COSMETICS.find(item => item.slot === slot && item.price === 0).id;
    return loadout;
}

// Resolve a loadout to colours, falling back to defaults for anything unknown.
export function loadoutColors(loadout) {
    const colors = {};
    const defaults = defaultLoadout();
    for(const slot of SLOTS) {
        const item = getCosmetic(loadout?.[slot]);
        colors[slot] = (item && item.slot === slot ? item : getCosmetic(defaults[slot])).color;
    }
    return colors;
}
