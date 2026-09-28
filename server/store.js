import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Minimal persistence: one JSON document of users. Fine for a playtest-scale launch; swap for a
// real database (Postgres, Firestore, ...) before large numbers of players.
export function createMemoryStore(initial = {}) {
    const data = { users: {}, ...initial };
    return {
        getUser: id => data.users[id] ?? null,
        putUser: (id, user) => { data.users[id] = user; },
        findUserByTokenHash: hash => Object.entries(data.users).find(([, user]) => user.tokenHash === hash)?.[0] ?? null,
        listUsers: () => Object.entries(data.users).map(([id, user]) => ({ id, user })),
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
    // createMemoryStore copied the users object reference, so mutations land in `data`.
    return store;
}
