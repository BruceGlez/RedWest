import { readFileSync, writeFileSync, renameSync, mkdirSync, accessSync, constants } from 'node:fs';
import { dirname } from 'node:path';

// Minimal persistence: one JSON document of users. Fine for a playtest-scale launch; swap for a
// real database (Postgres, Firestore, ...) before large numbers of players.
//
// The store interface (docs/lanes/scale.md, "Design: the Postgres store seam"). Callers MUST `await` every method: this JSON store
// answers at once, a database store answers later. Lookups are named for the question the app asks, so a database can answer them
// from an index; here they scan, as the app used to.
//   getUser(id), putUser(id, user), deleteUser(id), save()
//   findUserByTokenHash(hash) -> id | null
//   findUserByAppleSub(sub), findUserByPaymentIntent(intent), findUserByName(name, exceptId) -> { id, user } | null
//   listReportedUsers() -> users with name reports; listBoardUsers() -> users whose name is not hidden (the leaderboards)
//   removeReporter(id) -> take one account out of everyone's reports (it is being deleted)
//   retainPurchases(records), retainedPurchases(), ping()
//   lock(id) -> release: one request at a time per player (read, change, write must not interleave with another request for the same
//     player). Always `release()` in a finally. A database store can also refuse a stale write: putUser throws StoreConflictError when
//     the player was changed by someone else since getUser (another server instance); the app answers 409 and the client retries.
// listUsers() is not part of the interface; it stays on this store for tools and tests.
// A write that lost a race: the player changed since the object was read.
export class StoreConflictError extends Error {
    constructor() { super('The account changed while this request ran. Try again.'); this.code = 'store_conflict'; }
}

// One holder at a time per key; waiters go in order. In this process only: several server instances need the database's version check
// (StoreConflictError) as well.
export function createKeyedLock() {
    const tails = new Map();
    return key => {
        const before = tails.get(key) ?? Promise.resolve();
        let release;
        const mine = new Promise(resolve => { release = resolve; });
        const tail = before.then(() => mine);
        tails.set(key, tail);
        tail.then(() => { if(tails.get(key) === tail) tails.delete(key); });
        return before.then(() => () => release());
    };
}

export function createMemoryStore(initial = {}) {
    const data = { users: {}, ...initial };
    // Purchase transaction ids from deleted accounts, kept without any player data for tax and refunds.
    data.retainedPurchases ??= [];
    const lock = createKeyedLock();
    const store = {
        lock,
        getUser: id => data.users[id] ?? null,
        putUser: (id, user) => { data.users[id] = user; },
        deleteUser: id => { delete data.users[id]; },
        // One record per transaction (the Postgres store's primary key says the same).
        retainPurchases: records => { for(const record of records) if(!data.retainedPurchases.some(r => r.transactionId === record.transactionId)) data.retainedPurchases.push(record); },
        retainedPurchases: () => data.retainedPurchases,
        findUserByTokenHash: hash => Object.entries(data.users).find(([, user]) => user.tokenHash === hash || user.tokenHashes?.includes(hash))?.[0] ?? null,
        listUsers: () => Object.entries(data.users).map(([id, user]) => ({ id, user })),
        findUserByAppleSub: sub => store.listUsers().find(entry => entry.user.apple?.sub === sub) ?? null,
        findUserByPaymentIntent: intent => store.listUsers().find(entry => entry.user.profile?.purchases?.some(p => p.paymentIntent === intent)) ?? null,
        findUserByName: (name, exceptId) => store.listUsers().find(entry => entry.id !== exceptId && entry.user.profile?.name === name) ?? null,
        listReportedUsers: () => store.listUsers().filter(entry => entry.user.reportedBy?.length),
        listBoardUsers: () => store.listUsers().filter(entry => !entry.user.nameHidden),
        removeReporter: id => {
            for(const entry of store.listUsers()) {
                if(!entry.user.reportedBy?.includes(id)) continue;
                entry.user.reportedBy = entry.user.reportedBy.filter(reporter => reporter !== id);
            }
        },
        // Is the store usable right now? Cheap, no data read; /healthz asks it. Throws or returns false when not.
        ping: () => true,
        save: () => {}
    };
    return store;
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
