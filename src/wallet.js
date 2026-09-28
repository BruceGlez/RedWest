import { CONFIG } from './config.js';
import { createProfile, normalizeProfile, buyItem, equipItem, applyRun, refreshJobs } from './profile.js';

// Where the economy profile lives:
// - local: this browser only (playtesting; not secure, only earned currency, no real money).
// - remote: the Red West server (server/), the source of truth once real purchases are on.
// Both expose the same async API: load, buy, equip, reportRun, refresh.

const PROFILE_KEY = 'redWestProfile.v1';
const ACCOUNT_KEY = 'redWestAccount.v1';

function readJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
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
    let userId = readJson(ACCOUNT_KEY)?.userId;
    if(!userId) {
        userId = `local-${Math.random().toString(36).slice(2, 10)}`;
        writeJson(ACCOUNT_KEY, { userId });
    }
    const persist = () => writeJson(PROFILE_KEY, profile);
    const snapshot = () => structuredClone(profile);
    return {
        kind: 'local',
        get userId() { return userId; },
        async load() { refreshJobs(profile); persist(); return snapshot(); },
        async refresh() { return this.load(); },
        async buy(id) { buyItem(profile, id); persist(); return snapshot(); },
        async equip(id) { equipItem(profile, id); persist(); return snapshot(); },
        async reportRun(summary) {
            const result = applyRun(profile, summary);
            persist();
            return { ...result, profile: snapshot() };
        }
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
        get userId() { return account?.userId; },
        async load() {
            const data = await call('/api/profile');
            writeJson(PROFILE_KEY, data.profile); // offline display cache only
            return data.profile;
        },
        async refresh() { return this.load(); },
        async buy(id) { return (await call('/api/buy', { itemId: id })).profile; },
        async equip(id) { return (await call('/api/equip', { itemId: id })).profile; },
        async reportRun(summary) { return call('/api/run', summary); }
    };
}

export function createWallet() {
    return CONFIG.apiBase ? createRemoteWallet(CONFIG.apiBase) : createLocalWallet();
}

// Last known profile, for drawing the lobby before the server answers.
export function cachedProfile() {
    return normalizeProfile(readJson(PROFILE_KEY)) || createProfile();
}
