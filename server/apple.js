import { createPublicKey, createPrivateKey, verify, sign, randomBytes } from 'node:crypto';

// Sign in with Apple, all optional: with APPLE_CLIENT_IDS unset, none of this runs and players stay on
// device-token accounts. Apple's docs: "Verifying a user" (identity token) and "Revoke tokens".
//
//   APPLE_CLIENT_IDS    comma-separated audiences we accept: the iOS bundle id, plus the Services ID for the web
//   APPLE_TEAM_ID       Apple developer team id                 \
//   APPLE_KEY_ID        id of a "Sign in with Apple" key          > needed to revoke on account deletion
//   APPLE_PRIVATE_KEY   that key's .p8 contents (\n allowed)    /
//   APPLE_REDIRECT_URI  the web Services ID's return URL (web sign-ins only)

const ISSUER = 'https://appleid.apple.com';
const KEYS_URL = `${ISSUER}/auth/keys`;
const TOKEN_URL = `${ISSUER}/auth/token`;
const REVOKE_URL = `${ISSUER}/auth/revoke`;
const KEY_CACHE_MS = 60 * 60 * 1000;
const NONCE_MS = 10 * 60 * 1000;
const CLOCK_SKEW_S = 60;

export class AppleError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const b64url = buffer => Buffer.from(buffer).toString('base64url');
const fromB64url = text => Buffer.from(text, 'base64url');

function decodeJwt(token) {
    const parts = String(token || '').split('.');
    if(parts.length !== 3) throw new AppleError('bad_token', 'That Apple sign-in could not be read.');
    try {
        return { header: JSON.parse(fromB64url(parts[0])), payload: JSON.parse(fromB64url(parts[1])), signed: `${parts[0]}.${parts[1]}`, signature: fromB64url(parts[2]) };
    } catch {
        throw new AppleError('bad_token', 'That Apple sign-in could not be read.');
    }
}

export function createApple({ env = {}, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
    const clientIds = String(env.APPLE_CLIENT_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    const canRevoke = !!(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
    let keys = null;
    let keysAt = 0;
    // Nonces we handed out and have not seen back yet. One use each, ten minutes to live.
    const nonces = new Map();

    async function appleKeys(force = false) {
        if(keys && !force && now() - keysAt < KEY_CACHE_MS) return keys;
        const response = await fetchImpl(KEYS_URL);
        if(!response.ok) throw new AppleError('apple_down', 'Apple did not answer. Try again in a moment.');
        keys = (await response.json()).keys || [];
        keysAt = now();
        return keys;
    }

    // A short-lived ES256 token that proves to Apple this server owns the app (for /auth/token and /auth/revoke).
    function clientSecret(clientId) {
        const header = b64url(JSON.stringify({ alg: 'ES256', kid: env.APPLE_KEY_ID }));
        const issued = Math.floor(now() / 1000);
        const payload = b64url(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat: issued, exp: issued + 300, aud: ISSUER, sub: clientId }));
        const key = createPrivateKey(String(env.APPLE_PRIVATE_KEY).replace(/\\n/g, '\n'));
        const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
        return `${header}.${payload}.${b64url(signature)}`;
    }

    async function post(url, fields) {
        return fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(fields).toString()
        });
    }

    return {
        enabled: clientIds.length > 0,
        canRevoke,

        issueNonce() {
            const t = now();
            for(const [nonce, expires] of nonces) if(expires < t) nonces.delete(nonce);
            if(nonces.size > 20000) nonces.clear();
            const nonce = randomBytes(16).toString('hex');
            nonces.set(nonce, t + NONCE_MS);
            return nonce;
        },

        // Checks the identity token's signature, issuer, audience, expiry and our nonce. Returns Apple's
        // stable user id (sub) and which of our client ids it was issued to.
        async verifyIdentityToken(token, nonce) {
            const { header, payload, signed, signature } = decodeJwt(token);
            if(header.alg !== 'RS256') throw new AppleError('bad_token', 'That Apple sign-in could not be checked.');
            let jwk = (await appleKeys()).find(k => k.kid === header.kid);
            if(!jwk) jwk = (await appleKeys(true)).find(k => k.kid === header.kid); // Apple rotated its keys
            if(!jwk) throw new AppleError('bad_token', 'That Apple sign-in could not be checked.');
            const key = createPublicKey({ key: jwk, format: 'jwk' });
            if(!verify('RSA-SHA256', Buffer.from(signed), key, signature)) throw new AppleError('bad_token', 'That Apple sign-in could not be checked.');
            const seconds = now() / 1000;
            if(payload.iss !== ISSUER) throw new AppleError('bad_token', 'That sign-in did not come from Apple.');
            if(!clientIds.includes(payload.aud)) throw new AppleError('bad_token', 'That Apple sign-in was for another app.');
            if(!(payload.exp > seconds - CLOCK_SKEW_S)) throw new AppleError('expired', 'That Apple sign-in expired. Try again.');
            if(typeof payload.sub !== 'string' || !payload.sub) throw new AppleError('bad_token', 'That Apple sign-in could not be read.');
            const expires = nonces.get(nonce);
            if(!nonce || payload.nonce !== nonce || !expires || expires < now()) {
                throw new AppleError('bad_nonce', 'That Apple sign-in was already used or too old. Try again.');
            }
            nonces.delete(nonce);
            return { sub: payload.sub, clientId: payload.aud };
        },

        // Swaps the one-time authorization code for a refresh token, kept only so the account's Apple link
        // can be revoked when the player deletes it. Best effort: sign-in works without it.
        async refreshTokenFor(code, clientId, web) {
            if(!canRevoke || !code) return null;
            try {
                const fields = { client_id: clientId, client_secret: clientSecret(clientId), code, grant_type: 'authorization_code' };
                if(web && env.APPLE_REDIRECT_URI) fields.redirect_uri = env.APPLE_REDIRECT_URI;
                const response = await post(TOKEN_URL, fields);
                if(!response.ok) return null;
                return (await response.json()).refresh_token || null;
            } catch {
                return null;
            }
        },

        // App Store rule 5.1.1(v): deleting an account that used Sign in with Apple revokes its tokens.
        async revoke(refreshToken, clientId) {
            if(!canRevoke || !refreshToken) return false;
            try {
                const response = await post(REVOKE_URL, {
                    client_id: clientId, client_secret: clientSecret(clientId), token: refreshToken, token_type_hint: 'refresh_token'
                });
                return response.ok;
            } catch {
                return false;
            }
        }
    };
}
