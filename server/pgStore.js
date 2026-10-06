import { StoreConflictError, createKeyedLock, assertBoard } from './store.js';
import { boardValue, rankBoard, weekKey, normalizeProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { eventTitle } from '../src/events.js';

// The Postgres store (docs/lanes/scale.md, "Design: the Postgres store seam"). Same interface as the JSON store in store.js.
//
// A player is one row. `data` holds the whole user object exactly as the JSON store keeps it (profile, token hashes, reports, ...), so the
// game rules in src/ own its shape and a new profile field never needs a migration. Only what the server looks up has its own column and
// index: the token hashes, the Apple id and the name.
//
// Every read gives back the row's `version`; putUser writes only if the row still has it (optimistic check), so two server instances can
// never silently overwrite each other. Within one instance, lock(id) already serialises the requests for a player.
//
// The leaderboards are answered from the database, not by reading every player: each save also writes the player's score for every board into
// columns of the same row (`board_values`, below), indexed, so the top 50 of a board, the caller's own rank and the count are index queries.
// `weekly` and `event` boards reset each week, so their score is stored with its week and only this week's counts.
//
// `pg` is loaded here and nowhere else, so the JSON store (the default) needs no dependency installed.

const BOARD_VERSION = 1; // bump when the board columns change meaning: every row is recomputed at the next start
const STAGE_INDEXES = OUTLAWS.map((_, i) => `create index if not exists users_b_stage_${i} on users ((b_stage[${i + 1}]) desc) where b_stage[${i + 1}] > 0 and not hidden and name <> '';`).join('\n');
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
alter table users add column if not exists hidden boolean not null default false;
alter table users add column if not exists b_weekly integer not null default 0;
alter table users add column if not exists b_weekly_week text;
alter table users add column if not exists b_event integer not null default 0;
alter table users add column if not exists b_event_week text;
alter table users add column if not exists b_stars integer not null default 0;
alter table users add column if not exists b_stage integer[] not null default '{}';
alter table users add column if not exists board_version integer;
create index if not exists users_b_weekly on users (b_weekly_week, b_weekly desc) where b_weekly > 0 and not hidden and name <> '';
create index if not exists users_b_event on users (b_event_week, b_event desc) where b_event > 0 and not hidden and name <> '';
create index if not exists users_b_stars on users (b_stars desc) where b_stars > 0 and not hidden and name <> '';
${STAGE_INDEXES}
create table if not exists retained_purchases (
    transaction_id text primary key,
    deleted_at text
);
`;

// The board columns of one user object (the profile as the app keeps it, already normalised when it came from loadUser).
export function boardColumns(user) {
    const profile = user.profile ?? {};
    const num = v => Math.max(0, Math.floor(Number(v)) || 0);
    const stageBest = Array.isArray(profile.stats?.stageBest) ? profile.stats.stageBest : [];
    return {
        hidden: !!user.nameHidden,
        b_weekly: num(profile.stats?.weekly?.score), b_weekly_week: profile.stats?.weekly?.week ?? null,
        b_event: num(profile.event?.best), b_event_week: profile.event?.week ?? null,
        b_stars: profile.stats?.stageStars ? boardValue(profile, 'stars') : 0,
        b_stage: OUTLAWS.map((_, i) => num(stageBest[i]))
    };
}

// How a board is read: the SQL expression for its value and the extra condition that keeps stale weeks out.
function boardSql(board, now) {
    const week = weekKey(now);
    if(board === 'weekly') return { value: 'b_weekly', where: 'b_weekly_week = $1', params: [week] };
    if(board === 'event') return { value: 'b_event', where: 'b_event_week = $1', params: [week] };
    if(board === 'stars') return { value: 'b_stars', where: 'true', params: [] };
    const stage = Number(/^stage-(\d+)$/.exec(board)[1]);
    return { value: `b_stage[${stage + 1}]`, where: 'true', params: [] };
}

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

    // Rows written before the board columns existed (or under an older BOARD_VERSION) get them now, once, in batches.
    const stale = await rows('select count(*)::int as n from users where board_version is distinct from $1', [BOARD_VERSION]);
    if(stale[0].n > 0) {
        console.log(`Postgres store: filling the leaderboard columns for ${stale[0].n} players...`);
        for(;;) {
            const batch = await rows('select id, data from users where board_version is distinct from $1 limit 500', [BOARD_VERSION]);
            if(!batch.length) break;
            for(const row of batch) {
                const b = boardColumns(row.data);
                await pool.query('update users set hidden = $2, b_weekly = $3, b_weekly_week = $4, b_event = $5, b_event_week = $6, b_stars = $7, b_stage = $8, board_version = $9 where id = $1',
                    [row.id, b.hidden, b.b_weekly, b.b_weekly_week, b.b_event, b.b_event_week, b.b_stars, b.b_stage, BOARD_VERSION]);
            }
        }
    }

    return {
        pool, // for tools and tests
        lock,
        async getUser(id) {
            const [row] = await rows('select data, version from users where id = $1', [id]);
            return row ? remember(id, row).user : null;
        },
        async putUser(id, user) {
            const known = versions.get(user);
            const b = boardColumns(user);
            const columns = [user.tokenHash ?? null, user.tokenHashes ?? [], user.apple?.sub ?? null, user.profile?.name ?? null, JSON.stringify(user),
                b.hidden, b.b_weekly, b.b_weekly_week, b.b_event, b.b_event_week, b.b_stars, b.b_stage, BOARD_VERSION];
            const set = 'token_hash = $2, token_hashes = $3, apple_sub = $4, name = $5, data = $6, hidden = $7, b_weekly = $8, b_weekly_week = $9, b_event = $10, b_event_week = $11, b_stars = $12, b_stage = $13, board_version = $14';
            if(known !== undefined) {
                const done = await pool.query(
                    `update users set ${set}, version = version + 1, updated_at = now() where id = $1 and version = $15`, [id, ...columns, known]);
                if(done.rowCount === 0) throw new StoreConflictError();
                versions.set(user, known + 1);
                return;
            }
            // Not read from the store first (a new account): insert, or replace.
            const [row] = await rows(
                `insert into users (id, token_hash, token_hashes, apple_sub, name, data, hidden, b_weekly, b_weekly_week, b_event, b_event_week, b_stars, b_stage, board_version)
                 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 on conflict (id) do update set ${set}, version = users.version + 1, updated_at = now()
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
        // The leaderboard response ({ board, entries, me, total }), the same as the JSON store's, from the board columns: the top rows by index, the
        // caller's own rank by counting the rows ahead of them. Ties go to the earlier player, as in the JSON store.
        async leaderboard(board, meId, limit, now) {
            assertBoard(board);
            const sql = boardSql(board, now);
            const base = `${sql.where} and ${sql.value} > 0 and not hidden and name is not null and name <> ''`;
            const top = await rows(`select id, data, version from users where ${base} order by ${sql.value} desc, created_at asc, id asc limit ${Math.max(1, Math.floor(limit))}`, sql.params);
            const [{ n: total }] = await rows(`select count(*)::int as n from users where ${base}`, sql.params);
            const entries = top.map(r => ({ id: r.id, profile: normalizeProfile(r.data.profile, now) }));
            const response = rankBoard(entries, board, meId, limit, now);
            response.total = total;
            if(meId && !response.me) {
                // Not in the top rows: find where the caller stands among all of them.
                const [mine] = await rows(`select id, data, created_at, ${sql.value} as value from users where id = $${sql.params.length + 1} and ${base}`, [...sql.params, meId]);
                if(mine) {
                    const at = sql.params.length;
                    const [{ ahead }] = await rows(
                        `select count(*)::int as ahead from users where ${base} and (${sql.value} > $${at + 1} or (${sql.value} = $${at + 1} and (created_at, id) < ($${at + 2}, $${at + 3})))`,
                        [...sql.params, mine.value, mine.created_at, mine.id]);
                    const alone = rankBoard([{ id: mine.id, profile: normalizeProfile(mine.data.profile, now) }], board, meId, 1, now).me;
                    const me = { ...alone, rank: ahead + 1 };
                    if(board === 'event') { const title = eventTitle(me.rank); if(title) me.title = title; else delete me.title; } // the title follows the real rank
                    response.me = me;
                }
            }
            return response;
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
