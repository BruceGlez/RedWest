import { CONFIG } from './config.js';
import { createProfile, normalizeProfile, buyItem, equipItem, applyRun, refreshJobs, setName, importProgress } from './profile.js';
import { collectJail, upgradeBuilding } from './town.js';
import { applyMineRun } from './mineProgress.js';
import { farmAction } from './farm.js';
import { ordersAction } from './farmOrders.js';
import { saloonAction } from './saloon.js';
import { vigilAction } from './vigil.js';
import { buyLight } from './mineLight.js';
import { validateName } from './names.js';
import { loadProgress } from './progress.js';

// Where the economy profile lives:
// - local: this browser only (playtesting; not secure, only earned currency, no real money).
// - remote: the Red West server (server/), the source of truth once real purchases are on.
// Both expose the same async API: load, buy, equip, reportRun, refresh, setName, leaderboard,
// setPrivacy, reportName, deleteAccount, collectJail, upgradeBuilding, signInWithApple; `statsSender` is how statistics reach the server (null offline).
// Leaderboards rank accounts, so they only exist online; `online` says whether they are available.

const PROFILE_KEY = 'redWestProfile.v1';
const ACCOUNT_KEY = 'redWestAccount.v1';
const OLD_NAME_KEY = 'redWestPlayerName'; // the name typed after runs before accounts had names

// The name last typed on the old per-run records screen, if it is still a valid account name.
export function legacyName() {
    try {
        const result = validateName(localStorage.getItem(OLD_NAME_KEY));
        return result.ok ? result.name : '';
    } catch {
        return '';
    }
}

function readJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}

// Everything Red West keeps in this browser (all keys start with "redWest"): progress, wallet, account,
// settings, run log and the privacy answers. Used by "Delete my data".
export function clearDeviceData() {
    try {
        for(const key of Object.keys(localStorage)) {
            if(key.startsWith('redWest')) localStorage.removeItem(key);
        }
    } catch {
        // Storage blocked: nothing was saved.
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage blocked: the session still works.
    }
}

export function createLocalWallet() {
    let profile = normalizeProfile(readJson(PROFILE_KEY));
    // Records from before accounts kept them, and the old per-run name.
    importProgress(profile, loadProgress());
    if(!profile.name && legacyName()) profile.name = legacyName();
    let userId = readJson(ACCOUNT_KEY)?.userId;
    if(!userId) {
        userId = `local-${Math.random().toString(36).slice(2, 10)}`;
        writeJson(ACCOUNT_KEY, { userId });
    }
    const persist = () => writeJson(PROFILE_KEY, profile);
    const snapshot = () => structuredClone(profile);
    return {
        kind: 'local',
        online: false,
        get userId() { return userId; },
        async load() { refreshJobs(profile); persist(); return snapshot(); },
        async refresh() { return this.load(); },
        async buy(id) { buyItem(profile, id); persist(); return snapshot(); },
        async equip(id) { equipItem(profile, id); persist(); return snapshot(); },
        async setName(name) { setName(profile, name); persist(); return snapshot(); },
        async collectJail() { const collected = collectJail(profile); persist(); return { collected, profile: snapshot() }; },
        async upgradeBuilding(id) { upgradeBuilding(profile, id); persist(); return snapshot(); },
        async farm(body) { const result = farmAction(profile, body, new Date()); persist(); return { result, profile: snapshot() }; },
        async orders(body) { const result = ordersAction(profile, body, new Date()); persist(); return { result, profile: snapshot() }; },
        async saloon(body) { const result = saloonAction(profile, body, new Date()); persist(); return { result, profile: snapshot() }; },
        async vigil(body) { const result = vigilAction(profile, body, new Date()); persist(); return { result, profile: snapshot() }; },
        async buyLight(body) { const result = buyLight(profile, body?.id, body?.shop); persist(); return { result, profile: snapshot() }; },
        async leaderboard() { throw new Error('Leaderboards need the Red West server. Your records are saved on this device.'); },
        nameHidden: false,
        statsSender: null, // offline: statistics are never collected
        async setPrivacy() {},
        async reportName() {},
        async restorePurchases() { throw new Error('Restoring purchases needs the Red West server.'); },
        async deleteAccount() { clearDeviceData(); },
        apple: false,
        async signInWithApple() { throw new Error('Sign in with Apple needs the Red West server.'); },
        async reportRun(summary) {
            const result = applyRun(profile, summary);
            persist();
            return { ...result, profile: snapshot() };
        },
        async reportMineRun(summary) { const result = applyMineRun(profile.mine, summary); persist(); return { result, profile: snapshot() }; }
    };
}

export function createRemoteWallet(apiBase) {
    let account = readJson(ACCOUNT_KEY);
    if(account && !account.token) account = null; // a local id cannot authenticate

    async function call(path, body) {
        if(!account) {
            const response = await fetch(`${apiBase}/api/account`, { method: 'POST' });
            if(!response.ok) throw new Error('Could not reach the Red West server.');
            account = await response.json();
            writeJson(ACCOUNT_KEY, account);
        }
        const response = await fetch(`${apiBase}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if(!response.ok) {
            const error = new Error(data.message || 'The server refused that request.');
            error.code = data.code;
            throw error;
        }
        return data;
    }

    return {
        kind: 'remote',
        online: true,
        get userId() { return account?.userId; },
        nameHidden: false,
        apple: false, // whether this account is linked to an Apple ID
        async load() {
            const data = await call('/api/profile');
            this.nameHidden = !!data.nameHidden;
            this.apple = !!data.apple;
            writeJson(PROFILE_KEY, data.profile); // offline display cache only
            return data.profile;
        },
        async setPrivacy(privacy) { await call('/api/privacy', { ageBand: privacy.ageBand, statsConsent: privacy.statsConsent }); },
        statsSender: events => call('/api/events', { events }),
        async reportName(name) { await call('/api/report', { name }); },
        async restorePurchases() { return call('/api/restore', {}); },
        async deleteAccount() {
            if(account) await call('/api/account/delete', {});
            clearDeviceData();
        },
        // `authorize(nonce)` runs Apple's sheet and resolves to { identityToken, authorizationCode, web }.
        // The server links this account, or hands this device the account the Apple ID already has.
        async signInWithApple(authorize) {
            const nonceResponse = await fetch(`${apiBase}/api/apple/nonce`, { method: 'POST' });
            if(!nonceResponse.ok) throw new Error('Sign in with Apple is not available right now.');
            const { nonce } = await nonceResponse.json();
            const answer = await authorize(nonce);
            const response = await fetch(`${apiBase}/api/apple/signin`, {
                method: 'POST',
                headers: { ...(account ? { Authorization: `Bearer ${account.token}` } : {}), 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...answer, nonce })
            });
            const data = await response.json().catch(() => ({}));
            if(!response.ok) throw new Error(data.message || 'Apple sign-in did not work. Try again.');
            if(data.token) {
                account = { userId: data.userId, token: data.token };
                writeJson(ACCOUNT_KEY, account);
            }
            return data;
        },
        async refresh() { return this.load(); },
        async buy(id) { return (await call('/api/buy', { itemId: id })).profile; },
        async equip(id) { return (await call('/api/equip', { itemId: id })).profile; },
        async setName(name) { return (await call('/api/name', { name })).profile; },
        async collectJail() { return call('/api/town/collect', {}); },
        async upgradeBuilding(id) { return (await call('/api/town/upgrade', { building: id })).profile; },
        async farm(body) { return call('/api/town/farm', body); },
        async orders(body) { return call('/api/town/orders', body); },
        async saloon(body) { return call('/api/town/saloon', body); },
        async vigil(body) { return call('/api/town/vigil', body); },
        async buyLight(body) { return call('/api/mine/buy', body); },
        async leaderboard(board) { return call(`/api/leaderboard?board=${encodeURIComponent(board)}`); },
        async reportRun(summary) { return call('/api/run', summary); },
        async reportMineRun(summary) { return call('/api/mine/run', summary); }
    };
}

export function createWallet() {
    return CONFIG.apiBase ? createRemoteWallet(CONFIG.apiBase) : createLocalWallet();
}

// Last known profile, for drawing the lobby before the server answers.
export function cachedProfile() {
    return normalizeProfile(readJson(PROFILE_KEY)) || createProfile();
}
