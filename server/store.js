import { readFileSync, writeFileSync, renameSync, mkdirSync, accessSync, constants } from 'node:fs';
import { dirname } from 'node:path';

// Minimal persistence: one JSON document of users. Fine for a playtest-scale launch; swap for a
// real database (Postgres, Firestore, ...) before large numbers of players.
export function createMemoryStore(initial = {}) {
    const data = { users: {}, ...initial };
    // Purchase transaction ids from deleted accounts, kept without any player data for tax and refunds.
    data.retainedPurchases ??= [];
    return {
        getUser: id => data.users[id] ?? null,
        putUser: (id, user) => { data.users[id] = user; },
        deleteUser: id => { delete data.users[id]; },
        retainPurchases: records => { data.retainedPurchases.push(...records); },
        retainedPurchases: () => data.retainedPurchases,
        findUserByTokenHash: hash => Object.entries(data.users).find(([, user]) => user.tokenHash === hash || user.tokenHashes?.includes(hash))?.[0] ?? null,
        listUsers: () => Object.entries(data.users).map(([id, user]) => ({ id, user })),
        // Is the store usable right now? Cheap, no data read; /healthz asks it. Throws or returns false when not.
        ping: () => true,
        save: () => {}
    };
}

export function createFileStore(path) {
    let data = { users: {} };
    try {
        data = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        mkdirSync(dirname(path), { recursive: true });
    }
    const store = createMemoryStore(data);
    store.save = () => {
        const temp = `${path}.tmp`;
        writeFileSync(temp, JSON.stringify(data));
        renameSync(temp, path); // atomic replace so a crash never leaves half a file
    };
    store.ping = () => { accessSync(dirname(path), constants.W_OK); return true; }; // the data folder is there and writable
    // createMemoryStore copied the users object reference, so mutations land in `data`.
    return store;
}
