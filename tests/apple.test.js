import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync, sign, verify, createPublicKey } from 'node:crypto';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/store.js';

// A stand-in for Apple: its own RSA signing key (served as a JWKS), and an EC key standing in for the
// developer's "Sign in with Apple" .p8 key. Nothing here talks to the real Apple.
const appleKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const devKey = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const JWKS = { keys: [{ ...appleKey.publicKey.export({ format: 'jwk' }), kid: 'apple-1', alg: 'RS256', use: 'sig' }] };
const BUNDLE = 'com.bruceglez.redwest';
const ENV = {
    APPLE_CLIENT_IDS: `${BUNDLE}, com.bruceglez.redwest.web`,
    APPLE_TEAM_ID: 'TEAM123456',
    APPLE_KEY_ID: 'KEY1234567',
    APPLE_PRIVATE_KEY: devKey.privateKey.export({ format: 'pem', type: 'pkcs8' }).replace(/\n/g, '\\n')
};

const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
function identityToken(claims, { key = appleKey.privateKey, kid = 'apple-1' } = {}) {
    const head = b64({ alg: 'RS256', kid });
    const body = b64({ iss: 'https://appleid.apple.com', aud: BUNDLE, exp: Math.floor(Date.UTC(2026, 8, 29, 13) / 1000), sub: '001234.apple.user', ...claims });
    return `${head}.${body}.${sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url')}`;
}

async function startServer(env = ENV) {
    const clock = Date.UTC(2026, 8, 29, 12);
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
        calls.push({ url, body: options.body ? Object.fromEntries(new URLSearchParams(options.body)) : null });
        if(url.endsWith('/auth/keys')) return new Response(JSON.stringify(JWKS));
        if(url.endsWith('/auth/token')) return new Response(JSON.stringify({ refresh_token: 'apple-refresh-1', id_token: 'x' }));
        if(url.endsWith('/auth/revoke')) return new Response('', { status: 200 });
        return new Response('{}', { status: 404 });
    };
    const store = createMemoryStore();
    const server = createServer(createApp({ store, env, fetchImpl, now: () => new Date(clock) }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, { token, body } = {}) => {
        const response = await fetch(base + path, {
            method: body !== undefined || path === '/api/account' || path === '/api/apple/nonce' ? 'POST' : 'GET',
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        return { status: response.status, data: await response.json() };
    };
    const nonce = async () => (await call('/api/apple/nonce')).data.nonce;
    return { store, calls, call, nonce, close: () => new Promise(r => server.close(r)) };
}

test('Sign in with Apple is off unless APPLE_CLIENT_IDS is set', async () => {
    const s = await startServer({});
    try {
        const response = await s.call('/api/apple/nonce');
        assert.equal(response.status, 404);
        assert.equal(response.data.code, 'apple_off');
    } finally {
        await s.close();
    }
});

test('linking keeps progress, a new device gets the same account, and one Apple ID is one account', async () => {
    const s = await startServer();
    try {
        // A guest account with progress links its Apple ID.
        const { data: guest } = await s.call('/api/account');
        await s.call('/api/run', { token: guest.token, body: { score: 800, bounty: 'banked', newStars: 1, kills: {} } });
        const dollars = (await s.call('/api/profile', { token: guest.token })).data.profile.balances.dollars;
        let nonce = await s.nonce();
        const linked = await s.call('/api/apple/signin', { token: guest.token, body: { identityToken: identityToken({ nonce }), nonce, authorizationCode: 'code-1' } });
        assert.equal(linked.status, 200);
        assert.deepEqual({ ...linked.data }, { userId: guest.userId, token: null, linked: true, switched: false });
        assert.equal(s.store.getUser(guest.userId).apple.refreshToken, 'apple-refresh-1', 'kept for revoking later');
        const exchange = s.calls.find(c => c.url.endsWith('/auth/token'));
        assert.equal(exchange.body.client_id, BUNDLE);
        assert.equal(exchange.body.grant_type, 'authorization_code');
        // The client secret is an ES256 token signed with the developer key.
        const [head, body, sig] = exchange.body.client_secret.split('.');
        assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url')), { alg: 'ES256', kid: 'KEY1234567' });
        assert.equal(JSON.parse(Buffer.from(body, 'base64url')).iss, 'TEAM123456');
        assert.ok(verify('sha256', Buffer.from(`${head}.${body}`), { key: createPublicKey(devKey.privateKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
        const profile = await s.call('/api/profile', { token: guest.token });
        assert.equal(profile.data.apple, true);
        assert.equal(profile.data.profile.balances.dollars, dollars, 'linking changes nothing in the save');
        assert.equal(JSON.stringify(profile.data).includes('apple-refresh-1'), false, 'the refresh token never goes to the game');

        // A new phone, no account yet: it gets a token for the same account, and the first phone stays signed in.
        nonce = await s.nonce();
        const second = await s.call('/api/apple/signin', { body: { identityToken: identityToken({ nonce }), nonce } });
        assert.equal(second.data.userId, guest.userId);
        assert.equal(second.data.switched, false);
        assert.equal((await s.call('/api/profile', { token: second.data.token })).data.profile.balances.dollars, dollars);
        assert.equal((await s.call('/api/profile', { token: guest.token })).status, 200);

        // Another guest signing in with the same Apple ID switches to the linked account instead of linking twice.
        const { data: other } = await s.call('/api/account');
        nonce = await s.nonce();
        const switched = await s.call('/api/apple/signin', { token: other.token, body: { identityToken: identityToken({ nonce }), nonce } });
        assert.equal(switched.data.userId, guest.userId);
        assert.equal(switched.data.switched, true);
        assert.equal(s.store.getUser(other.userId).apple, undefined);

        // No account on the device and a new Apple ID: a fresh linked account.
        nonce = await s.nonce();
        const fresh = await s.call('/api/apple/signin', { body: { identityToken: identityToken({ nonce, sub: '009999.new.user', aud: 'com.bruceglez.redwest.web' }), nonce, web: true } });
        assert.match(fresh.data.userId, /^rw_/);
        assert.notEqual(fresh.data.userId, guest.userId);
        assert.equal(s.store.getUser(fresh.data.userId).apple.clientId, 'com.bruceglez.redwest.web');
    } finally {
        await s.close();
    }
});

test('bad Apple tokens are refused: forged, wrong app, wrong issuer, expired, replayed or unknown nonce', async () => {
    const s = await startServer();
    try {
        const refused = async (claims, options, expectedCode, nonceOverride) => {
            const nonce = await s.nonce();
            const response = await s.call('/api/apple/signin', { body: { identityToken: identityToken({ nonce, ...claims }, options), nonce: nonceOverride ?? nonce } });
            assert.equal(response.status, 400, JSON.stringify({ claims, response }));
            assert.equal(response.data.code, expectedCode);
        };
        await refused({}, { key: otherKey.privateKey }, 'bad_token');
        await refused({}, { kid: 'unknown' }, 'bad_token');
        await refused({ aud: 'com.someone.else' }, {}, 'bad_token');
        await refused({ iss: 'https://evil.example' }, {}, 'bad_token');
        await refused({ exp: Math.floor(Date.UTC(2026, 8, 29, 11) / 1000) }, {}, 'expired');
        await refused({}, {}, 'bad_nonce', 'made-up-nonce');
        const garbage = await s.call('/api/apple/signin', { body: { identityToken: 'not.a.jwt', nonce: await s.nonce() } });
        assert.equal(garbage.data.code, 'bad_token');

        const nonce = await s.nonce();
        const token = identityToken({ nonce });
        assert.equal((await s.call('/api/apple/signin', { body: { identityToken: token, nonce } })).status, 200);
        const replay = await s.call('/api/apple/signin', { body: { identityToken: token, nonce } });
        assert.equal(replay.data.code, 'bad_nonce', 'each nonce works once');
        assert.equal(s.store.listUsers().length, 1, 'refused sign-ins create nothing');
    } finally {
        await s.close();
    }
});

test('deleting an Apple-linked account revokes its Apple token', async () => {
    const s = await startServer();
    try {
        const nonce = await s.nonce();
        const { data } = await s.call('/api/apple/signin', { body: { identityToken: identityToken({ nonce }), nonce, authorizationCode: 'code-1' } });
        const deleted = await s.call('/api/account/delete', { token: data.token, body: {} });
        assert.deepEqual(deleted.data, { deleted: true, appleRevoked: true });
        const revoke = s.calls.find(c => c.url.endsWith('/auth/revoke'));
        assert.equal(revoke.body.token, 'apple-refresh-1');
        assert.equal(revoke.body.token_type_hint, 'refresh_token');
        assert.equal(revoke.body.client_id, BUNDLE);
        assert.equal(s.store.getUser(data.userId), null);
    } finally {
        await s.close();
    }
});
