// Store configuration, injected at build time through Vite env variables (see MONETIZATION.md).
// With nothing set, the game runs a local playtest wallet and real-money packs show "coming soon".
const env = import.meta.env || {};

export const CONFIG = {
    // The Red West server (server/) that owns wallets and credits purchases.
    apiBase: (env.VITE_API_BASE || '').replace(/\/$/, ''),
    // RevenueCat public SDK keys (safe to ship in the app; secret keys stay on the server).
    revenueCatAppleKey: env.VITE_REVENUECAT_APPLE_KEY || '',
    revenueCatGoogleKey: env.VITE_REVENUECAT_GOOGLE_KEY || '',
    // Stripe Payment Links for web purchases, one per product id.
    stripeLinks: {
        nuggets_100: env.VITE_STRIPE_LINK_NUGGETS_100 || '',
        nuggets_550: env.VITE_STRIPE_LINK_NUGGETS_550 || '',
        nuggets_1200: env.VITE_STRIPE_LINK_NUGGETS_1200 || ''
    }
};
