// Real-money products (Gold Nugget packs). Product ids must match App Store Connect, Google Play,
// RevenueCat and the Stripe Payment Link mapping on the server (see MONETIZATION.md).
export const PRODUCTS = [
    { id: 'nuggets_100', nuggets: 100, price: '$0.99', label: 'Pouch of Nuggets' },
    { id: 'nuggets_550', nuggets: 550, price: '$4.99', label: 'Sack of Nuggets', badge: '+10%' },
    { id: 'nuggets_1200', nuggets: 1200, price: '$9.99', label: 'Strongbox of Nuggets', badge: '+20%' }
];

export function getProduct(id) {
    return PRODUCTS.find(product => product.id === id) ?? null;
}
