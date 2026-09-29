import { CONFIG } from './config.js';

// Sign in with Apple, only when it is set up (see MONETIZATION.md): in the iOS app through the
// @capacitor-community/apple-sign-in plugin, on the web through Apple's own sign-in popup.
// No name or email is asked for: Apple's stable user id is all the server keeps.

const APPLE_JS = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

// 'native', 'web' or null (no button).
export function appleSignInMode() {
    if(!CONFIG.apiBase) return null; // accounts live on the server
    const capacitor = window.Capacitor;
    if(capacitor?.isNativePlatform?.()) {
        return capacitor.getPlatform?.() === 'ios' && CONFIG.appleNative && capacitor.Plugins?.SignInWithApple ? 'native' : null;
    }
    return CONFIG.appleServiceId && CONFIG.appleRedirectUri ? 'web' : null;
}

let appleJs = null;
function loadAppleJs() {
    appleJs ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = APPLE_JS;
        script.onload = () => resolve(window.AppleID);
        script.onerror = () => { appleJs = null; reject(new Error('Could not reach Apple. Check your connection.')); };
        document.head.append(script);
    });
    return appleJs;
}

// Shows Apple's sheet or popup. Resolves to what the server needs, or rejects when the player cancels.
export async function authorizeWithApple(nonce) {
    if(appleSignInMode() === 'native') {
        const { response } = await window.Capacitor.Plugins.SignInWithApple.authorize({ clientId: '', redirectURI: '', scopes: '', nonce });
        return { identityToken: response.identityToken, authorizationCode: response.authorizationCode, web: false };
    }
    const AppleID = await loadAppleJs();
    AppleID.auth.init({ clientId: CONFIG.appleServiceId, redirectURI: CONFIG.appleRedirectUri, scope: '', nonce, usePopup: true });
    const { authorization } = await AppleID.auth.signIn();
    return { identityToken: authorization.id_token, authorizationCode: authorization.code, web: true };
}
