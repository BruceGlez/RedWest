// Real-money products (Gold Nugget packs). Product ids must match App Store Connect, Google Play,
// RevenueCat and the Stripe Payment Link mapping on the server (see MONETIZATION.md).
// kind: 'nuggets' (consumable packs), 'bundle' (the one-time starter pack: cosmetics + nuggets; on the
// App Store it is a non-consumable, so its items can be restored on a new device) or 'pass' (this season's
// Wanted Poster Pass, src/pass.js: a one-time purchase per season that never renews).
export const PRODUCTS = [
    { id: 'starter_pack', kind: 'bundle', nuggets: 200, items: ['hat-deputy', 'coat-deputy', 'bullets-deputy'], price: '$1.99',
        label: "Deputy's Kit", oneTime: true },
    { id: 'season_pass', kind: 'pass', price: '$4.99', label: 'Wanted Poster Pass' },
    { id: 'nuggets_100', kind: 'nuggets', nuggets: 100, price: '$0.99', label: 'Pouch of Nuggets' },
    { id: 'nuggets_550', kind: 'nuggets', nuggets: 550, price: '$4.99', label: 'Sack of Nuggets', badge: '+10%' },
    { id: 'nuggets_1200', kind: 'nuggets', nuggets: 1200, price: '$9.99', label: 'Strongbox of Nuggets', badge: '+20%' }
];

// What one Gold Nugget costs in the smallest pack, for the real-money estimate shown next to every
// nugget price (EU consumer principles on in-game currencies: always show the real cost).
export const DOLLARS_PER_NUGGET = 0.99 / 100;
export function nuggetsInMoney(nuggets) {
    const cents = Math.round(nuggets * DOLLARS_PER_NUGGET * 100 + 1e-9); // whole cents, halves rounded up
    return `$${(cents / 100).toFixed(2)}`;
}

export function getProduct(id) {
    return PRODUCTS.find(product => product.id === id) ?? null;
}
