import { StoreConflictError, createKeyedLock } from './store.js';

// The Postgres store (docs/lanes/scale.md, "Design: the Postgres store seam"). Same interface as the JSON store in store.js.
//
// A player is one row. `data` holds the whole user object exactly as the JSON store keeps it (profile, token hashes, reports, ...), so the
// game rules in src/ own its shape and a new profile field never needs a migration. Only what the server looks up has its own column and
// index: the token hashes, the Apple id and the name.
//
// Every read gives back the row's `version`; putUser writes only if the row still has it (optimistic check), so two server instances can
// never silently overwrite each other. Within one instance, lock(id) already serialises the requests for a player.
//
// `pg` is loaded here and nowhere else, so the JSON store (the default) needs no dependency installed.

const SCHEMA = `
create table if not exists users (
    id text primary key,
    token_hash text,
    token_hashes text[] not null default '{}',
    apple_sub text,
    name text,
    data jsonb not null,
    version integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists users_token_hash on users (token_hash);
create index if not exists users_token_hashes on users using gin (token_hashes);
create unique index if not exists users_apple_sub on users (apple_sub) where apple_sub is not null;
create index if not exists users_name on users (name) where name is not null and name <> '';
create index if not exists users_purchases on users using gin ((data -> 'profile' -> 'purchases') jsonb_path_ops);
create table if not exists retained_purchases (
    transaction_id text primary key,
    deleted_at text
);
`;

export async function createPgStore({ connectionString, max = 10, pool: given } = {}) {
    let pool = given;
    if(!pool) {
        if(!connectionString) throw new Error('STORE=postgres needs DATABASE_URL.');
        const { default: pg } = await import('pg');
        pool = new pg.Pool({ connectionString, max });
    }
    pool.on?.('error', error => console.error('Postgres pool error:', error.message)); // an idle client dropping must not crash the server
    await pool.query(SCHEMA);

    const versions = new WeakMap(); // user object -> the version it was read at
    const lock = createKeyedLock();
    const remember = (id, row) => { versions.set(row.data, row.version); return { id, user: row.data }; };
    const rows = async (text, values) => (await pool.query(text, values)).rows;

    return {
        pool, // for tests and tools
        lock,
        async getUser(id) {
            const [row] = await rows('select data, version from users where id = $1', [id]);
            return row ? remember(id, row).user : null;
        },
        async putUser(id, user) {
            const known = versions.get(user);
            const columns = [user.tokenHash ?? null, user.tokenHashes ?? [], user.apple?.sub ?? null, user.profile?.name ?? null, JSON.stringify(user)];
            if(known !== undefined) {
                const done = await pool.query(
                    `update users set token_hash = $2, token_hashes = $3, apple_sub = $4, name = $5, data = $6, version = version + 1, updated_at = now()
                     where id = $1 and version = $7`, [id, ...columns, known]);
                if(done.rowCount === 0) throw new StoreConflictError();
                versions.set(user, known + 1);
                return;
            }
            // Not read from the store first (a new account): insert, or replace.
            const [row] = await rows(
                `insert into users (id, token_hash, token_hashes, apple_sub, name, data) values ($1, $2, $3, $4, $5, $6)
                 on conflict (id) do update set token_hash = $2, token_hashes = $3, apple_sub = $4, name = $5, data = $6, version = users.version + 1, updated_at = now()
                 returning version`, [id, ...columns]);
            versions.set(user, row.version);
        },
        async deleteUser(id) { await pool.query('delete from users where id = $1', [id]); },
        async retainPurchases(records) {
            for(const record of records) {
                await pool.query('insert into retained_purchases (transaction_id, deleted_at) values ($1, $2) on conflict do nothing', [record.transactionId, record.deletedAt ?? null]);
            }
        },
        async retainedPurchases() {
            return (await rows('select transaction_id, deleted_at from retained_purchases order by transaction_id')).map(r => ({ transactionId: r.transaction_id, deletedAt: r.deleted_at }));
        },
        async findUserByTokenHash(hash) {
            const [row] = await rows('select id from users where token_hash = $1 or token_hashes @> array[$1]::text[] limit 1', [hash]);
            return row?.id ?? null;
        },
        async findUserByAppleSub(sub) {
            const [row] = await rows('select id, data, version from users where apple_sub = $1', [sub]);
            return row ? remember(row.id, row) : null;
        },
        async findUserByPaymentIntent(intent) {
            const [row] = await rows(`select id, data, version from users where (data -> 'profile' -> 'purchases') @> $1::jsonb limit 1`, [JSON.stringify([{ paymentIntent: intent }])]);
            return row ? remember(row.id, row) : null;
        },
        async findUserByName(name, exceptId) {
            const [row] = await rows('select id, data, version from users where name = $1 and id <> $2 limit 1', [name, exceptId ?? '']);
            return row ? remember(row.id, row) : null;
        },
        async listReportedUsers() {
            return (await rows(`select id, data, version from users where jsonb_array_length(coalesce(data -> 'reportedBy', '[]'::jsonb)) > 0 order by created_at, id`)).map(r => remember(r.id, r));
        },
        // Everyone whose name is not hidden. A full read for now; the leaderboards become a query of their own in a later PR.
        async listBoardUsers() {
            return (await rows(`select id, data, version from users where coalesce((data ->> 'nameHidden')::boolean, false) = false order by created_at, id`)).map(r => remember(r.id, r));
        },
        // One account is being deleted: take it out of everyone's reports (done inside the database, so no other player's row is read back).
        async removeReporter(id) {
            await pool.query(
                `update users set version = version + 1, updated_at = now(),
                     data = jsonb_set(data, '{reportedBy}', coalesce((select jsonb_agg(r) from jsonb_array_elements(data -> 'reportedBy') r where r <> to_jsonb($1::text)), '[]'::jsonb))
                 where data -> 'reportedBy' ? $1`, [id]);
        },
        async ping() { await pool.query('select 1'); return true; },
        save() {}, // every write is already a write
        async close() { await pool.end(); }
    };
}
