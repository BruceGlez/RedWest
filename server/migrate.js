import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

// Copy the players from the JSON file store into another store (Postgres). Read-only on the file: it is never changed, so it stays as the
// rollback. Safe to run again: a player already in the target is left alone (unless `overwrite`), so a second run after the game went
// live on Postgres cannot erase newer progress. Every copied player is read back from the target and compared with the file.

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = isDeepStrictEqual; // key order does not matter: Postgres' jsonb keeps its own

// Reads the file and says which entries can be copied. Nothing is written.
export function readJsonStore(path) {
    let data;
    try { data = JSON.parse(readFileSync(path, 'utf8')); } catch(error) {
        throw new Error(`Cannot read ${path} as the Red West JSON store: ${error.message}`);
    }
    if(!isPlainObject(data) || !isPlainObject(data.users)) throw new Error(`${path} has no "users" object, so it is not a Red West JSON store.`);
    const users = [];
    const invalid = [];
    for(const [id, user] of Object.entries(data.users)) {
        const hasToken = typeof user?.tokenHash === 'string' || (Array.isArray(user?.tokenHashes) && user.tokenHashes.length > 0);
        if(id && isPlainObject(user) && isPlainObject(user.profile) && hasToken) users.push([id, user]);
        else invalid.push(id);
    }
    const retained = (Array.isArray(data.retainedPurchases) ? data.retainedPurchases : []).filter(r => typeof r?.transactionId === 'string');
    return { users, invalid, retained };
}

// store: any store with the interface in store.js. Returns the counts; `ok` is false if anything failed or did not read back identical.
export async function migrateJsonToStore({ file, store, dryRun = false, overwrite = false, log = () => {} }) {
    const { users, invalid, retained } = readJsonStore(file);
    const report = { users: users.length, inserted: 0, replaced: 0, alreadyThere: 0, invalid: invalid.length, failed: [], mismatched: [], retained: retained.length, dryRun, ok: true };
    for(const id of invalid) log(`skipped ${id || '(no id)'}: not a player (no profile or no token)`);
    for(const [id, user] of users) {
        try {
            const existing = await store.getUser(id);
            if(existing && !overwrite) { report.alreadyThere++; continue; }
            if(dryRun) { report[existing ? 'replaced' : 'inserted']++; continue; }
            await store.putUser(id, user);
            const back = await store.getUser(id);
            if(!same(back, user)) { report.mismatched.push(id); log(`${id}: read back different from the file`); continue; }
            report[existing ? 'replaced' : 'inserted']++;
        } catch(error) {
            report.failed.push({ id, error: error.message });
            log(`${id}: ${error.message}`);
        }
    }
    if(!dryRun && retained.length) await store.retainPurchases(retained);
    await store.save();
    report.ok = report.failed.length === 0 && report.mismatched.length === 0;
    return report;
}
