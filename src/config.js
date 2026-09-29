// Store configuration, injected at build time through Vite env variables (see MONETIZATION.md).
// With nothing set, the game runs a local playtest wallet and real-money packs show "coming soon".
const env = import.meta.env || {};

export const CONFIG = {
    // The Red West server (server/) that owns wallets and credits purchases.
    apiBase: (env.VITE_API_BASE || '').replace(/\/$/, ''),
    // RevenueCat public SDK keys (safe to ship in the app; secret keys stay on the server).
    revenueCatAppleKey: env.VITE_REVENUECAT_APPLE_KEY || '',
    revenueCatGoogleKey: env.VITE_REVENUECAT_GOOGLE_KEY || '',
    // Privacy policy, terms and support contact (see docs/POLICY_GENERATOR_ANSWERS.md). Shown in Settings
    // and on the first-launch screen once set.
    privacyUrl: env.VITE_PRIVACY_URL || '',
    termsUrl: env.VITE_TERMS_URL || '',
    supportEmail: env.VITE_SUPPORT_EMAIL || '',
    // Sign in with Apple (optional; the server also needs APPLE_CLIENT_IDS, see MONETIZATION.md).
    // iOS app: VITE_APPLE_SIGN_IN=1. Web: a Services ID and its return URL registered with Apple.
    appleNative: env.VITE_APPLE_SIGN_IN === '1',
    appleServiceId: env.VITE_APPLE_SERVICE_ID || '',
    appleRedirectUri: env.VITE_APPLE_REDIRECT_URI || '',
    // Stripe Payment Links for web purchases, one per product id.
    stripeLinks: {
        nuggets_100: env.VITE_STRIPE_LINK_NUGGETS_100 || '',
        nuggets_550: env.VITE_STRIPE_LINK_NUGGETS_550 || '',
        nuggets_1200: env.VITE_STRIPE_LINK_NUGGETS_1200 || '',
        starter_pack: env.VITE_STRIPE_LINK_STARTER_PACK || '',
        season_pass: env.VITE_STRIPE_LINK_SEASON_PASS || ''
    }
};
