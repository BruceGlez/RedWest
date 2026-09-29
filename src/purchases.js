import { CONFIG } from './config.js';
import { PRODUCTS } from './products.js';

// Real-money Gold Nugget packs.
// - iPhone/Android app: RevenueCat (App Store / Google Play billing). RevenueCat tells the server
//   about the purchase by webhook, and the server credits the nuggets.
// - Web: a Stripe Payment Link; Stripe's webhook tells the server, which credits the nuggets.
// Purchases always need the server: a browser-only wallet can never be trusted with paid currency.

function nativePurchases() {
    const capacitor = window.Capacitor;
    if(!capacitor?.isNativePlatform?.()) return null;
    return capacitor.Plugins?.Purchases ?? null;
}

function nativeKey() {
    const platform = window.Capacitor?.getPlatform?.();
    return platform === 'android' ? CONFIG.revenueCatGoogleKey : CONFIG.revenueCatAppleKey;
}

// { available, mode, reason } for a product, so the shop can explain what is missing.
export function purchaseSupport(productId) {
    if(!CONFIG.apiBase) return { available: false, mode: 'none', reason: 'Real-money packs open once the Red West server is live.' };
    if(nativePurchases()) {
        return nativeKey()
            ? { available: true, mode: 'native' }
            : { available: false, mode: 'none', reason: 'In-app purchases are not configured for this build.' };
    }
    if(CONFIG.stripeLinks[productId]) return { available: true, mode: 'web' };
    return { available: false, mode: 'none', reason: 'Web checkout is not configured yet.' };
}

let configuredFor = null;
async function ensureConfigured(plugin, userId) {
    if(configuredFor === userId) return;
    await plugin.configure({ apiKey: nativeKey(), appUserID: userId });
    configuredFor = userId;
}

// Starts a purchase. Resolves to { started: true } for web (the page leaves for checkout) or
// { purchased: true } when the store confirmed payment (credit arrives from the server shortly).
export async function buyProduct(productId, wallet) {
    const product = PRODUCTS.find(p => p.id === productId);
    const support = purchaseSupport(productId);
    if(!product || !support.available) throw new Error(support.reason || 'Unknown product.');
    await wallet.load(); // make sure the server account exists before paying
    if(support.mode === 'web') {
        const url = new URL(CONFIG.stripeLinks[productId]);
        url.searchParams.set('client_reference_id', wallet.userId);
        window.location.assign(url.toString());
        return { started: true };
    }
    const plugin = nativePurchases();
    await ensureConfigured(plugin, wallet.userId);
    const { products } = await plugin.getProducts({ productIdentifiers: [productId], type: 'NON_SUBSCRIPTION' });
    if(!products?.length) throw new Error('The store did not return this product. Check the product id setup.');
    await plugin.purchaseStoreProduct({ product: products[0] });
    return { purchased: true };
}

// App only: "Restore purchases" for the Deputy's Kit on a new device. The store links its purchases to this
// account, then the server checks with RevenueCat and gives back the kit's items.
export const canRestore = () => !!nativePurchases() && !!nativeKey() && !!CONFIG.apiBase;
export async function restorePurchases(wallet) {
    const plugin = nativePurchases();
    if(!plugin) throw new Error('Restoring purchases works in the app.');
    await wallet.load();
    await ensureConfigured(plugin, wallet.userId);
    await plugin.restorePurchases();
    return wallet.restorePurchases();
}

// A marker for "which purchases has the server credited so far": the last credited transaction id.
export const lastCredit = profile => profile?.processed?.at(-1) ?? '';

// After paying, poll the server until the webhook has credited the purchase (usually seconds). Works for
// every product, including the pass, which may add no nuggets at all.
export async function waitForCredit(wallet, previousCredit, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while(Date.now() < deadline) {
        const profile = await wallet.refresh();
        if(lastCredit(profile) !== previousCredit) return profile;
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    return null;
}
