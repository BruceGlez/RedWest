import { COSMETICS, SLOTS, getShopItem, defaultLoadout } from './cosmetics.js';
import { jobsForDay, getJob, dayKey, ALL_JOBS_BONUS_NUGGETS } from './jobs.js';
import { validateName } from './names.js';
import { OUTLAWS } from './outlaws.js';
import { starsForRun, starCount } from './progress.js';
import { EconomyError } from './economyError.js';
import { createTown, normalizeTown, buildingEffects } from './town.js';

// The player's economy profile: balances, owned cosmetics, loadout and daily jobs. These pure
// functions are shared by the in-browser playtest wallet and the server (server/), so both apply
// exactly the same rules. On a server they are authoritative; in the browser they are not.

export const CURRENCIES = {
    dollars: { name: 'BOUNTY DOLLARS', symbol: '$' },
    nuggets: { name: 'GOLD NUGGETS', symbol: '◆' }
};

// Caps keep a tampered run summary from minting unlimited currency on the server.
export const MAX_DOLLARS_PER_RUN = 600;

export function createProfile(now = new Date()) {
    return {
        version: 1,
        balances: { dollars: 0, nuggets: 0 },
        owned: [],
        loadout: defaultLoadout(),
        jobs: { day: dayKey(now), list: jobsForDay(dayKey(now)), bonusPaid: false },
        name: '',
        town: createTown(now), // Frontier Town buildings and the Jail's last collection (src/town.js)
        // Account records, also the source for online leaderboards.
        stats: { runs: 0, bestScore: 0, stageBest: OUTLAWS.map(() => 0), stageStars: OUTLAWS.map(() => 0), weekly: { week: weekKey(now), score: 0 }, kills: 0 },
        processed: [] // ids of already-credited purchases (idempotency)
    };
}

export function normalizeProfile(raw, now = new Date()) {
    const profile = createProfile(now);
    if(!raw || typeof raw !== 'object') return profile;
    for(const currency of Object.keys(CURRENCIES)) {
        const value = Math.floor(Number(raw.balances?.[currency]));
        if(value > 0) profile.balances[currency] = value;
    }
    profile.owned = [...new Set((raw.owned || []).filter(id => getShopItem(id)))];
    if(raw.jobs?.day === profile.jobs.day && Array.isArray(raw.jobs.list)) {
        profile.jobs.list = raw.jobs.list.filter(j => getJob(j.id)).map(j => ({ id: j.id, progress: Math.max(0, Number(j.progress) || 0), done: !!j.done }));
        profile.jobs.bonusPaid = !!raw.jobs.bonusPaid;
    }
    profile.processed = (raw.processed || []).filter(id => typeof id === 'string').slice(-500);
    profile.town = normalizeTown(raw.town, now);
    if(raw.name && validateName(raw.name).ok) profile.name = validateName(raw.name).name;
    const s = raw.stats || {};
    const num = v => Math.max(0, Math.floor(Number(v)) || 0);
    profile.stats.runs = num(s.runs);
    profile.stats.bestScore = num(s.bestScore);
    profile.stats.kills = num(s.kills);
    OUTLAWS.forEach((_, i) => {
        profile.stats.stageBest[i] = num(s.stageBest?.[i]);
        profile.stats.stageStars[i] = num(s.stageStars?.[i]) & 7;
    });
    if(s.weekly?.week === profile.stats.weekly.week) profile.stats.weekly.score = num(s.weekly.score);
    // After the stats: an outlaw character counts as owned only with that outlaw's three stars.
    for(const slot of SLOTS) {
        const id = raw.loadout?.[slot];
        const item = getShopItem(id);
        if(item && item.slot === slot && ownsItem(profile, id)) profile.loadout[slot] = id;
    }
    return profile;
}

// ISO-style week key (weeks start Monday, UTC) for the weekly leaderboard.
export function weekKey(date = new Date()) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Is a reported score believable for a run of this length? (Kills pay at most ~10 x 3 per kill,
// a few kills per second, plus the largest bounty.) Implausible runs still pay capped earnings but
// never reach the leaderboards.
export function plausibleScore(score, seconds) {
    const s = Math.max(0, Number(score) || 0);
    const t = Math.max(0, Number(seconds) || 0);
    return t >= 20 && s <= (t * 90) + 1200;
}

export function setName(profile, raw) {
    const result = validateName(raw);
    if(!result.ok) throw new EconomyError('bad_name', result.error);
    profile.name = result.name;
    return profile.name;
}

// Outlaw characters are owned once all three of that outlaw's stars are earned on the account.
export function ownsItem(profile, id) {
    const item = getShopItem(id);
    if(!item) return false;
    if(item.unlock) return profile.stats.stageStars[item.unlock.outlaw] === 7;
    return item.price === 0 || profile.owned.includes(id);
}

// New day: fresh jobs.
export function refreshJobs(profile, now = new Date()) {
    const today = dayKey(now);
    if(profile.jobs.day !== today) profile.jobs = { day: today, list: jobsForDay(today), bonusPaid: false };
}

export { EconomyError };

export function buyItem(profile, id) {
    const item = getShopItem(id);
    if(!item) throw new EconomyError('unknown_item', 'That item does not exist.');
    if(ownsItem(profile, id)) throw new EconomyError('owned', 'You already own this.');
    if(item.unlock) throw new EconomyError('earned', 'Earn all three of this outlaw\'s stars to play as them.');
    if(profile.balances[item.currency] < item.price) throw new EconomyError('funds', `Not enough ${CURRENCIES[item.currency].name.toLowerCase()}.`);
    profile.balances[item.currency] -= item.price;
    profile.owned.push(id);
    return item;
}

export function equipItem(profile, id) {
    const item = getShopItem(id);
    if(!item) throw new EconomyError('unknown_item', 'That item does not exist.');
    if(!ownsItem(profile, id)) throw new EconomyError('not_owned', item.unlock ? 'Earn all three of this outlaw\'s stars first.' : 'Buy it first.');
    profile.loadout[item.slot] = id;
    return item;
}

// A finished run: summary = { score, bounty: 'none'|'banked'|'escaped'|'forfeited', newStars, peakHeat,
// kills: {type: n}, shotsHit, loot }. Returns the breakdown the result screen shows.
export function applyRun(profile, summary, now = new Date()) {
    refreshJobs(profile, now);
    const lines = [];
    const scoreDollars = Math.max(0, Math.floor((Number(summary.score) || 0) / 4));
    if(scoreDollars) lines.push({ label: 'Run score', dollars: scoreDollars });
    if(summary.bounty === 'banked' || summary.bounty === 'escaped') lines.push({ label: 'Bounty collected', dollars: 25 });
    const newStars = Math.max(0, Math.min(3, Math.floor(Number(summary.newStars) || 0)));
    if(newStars) lines.push({ label: `New star${newStars > 1 ? 's' : ''}`, dollars: newStars * 40 });

    const run = { kills: summary.kills || {}, peakHeat: summary.peakHeat || 0, bounty: summary.bounty || 'none', shotsHit: summary.shotsHit || 0, loot: summary.loot || 0 };
    const jobsCompleted = [];
    for(const entry of profile.jobs.list) {
        if(entry.done) continue;
        const job = getJob(entry.id);
        entry.progress = Math.min(job.goal, entry.progress + Math.max(0, Number(job.measure(run)) || 0));
        if(entry.progress >= job.goal) {
            entry.done = true;
            jobsCompleted.push(job.id);
            lines.push({ label: `Job: ${job.text}`, dollars: Math.round(job.reward * buildingEffects(profile.town, 'sheriff').jobRewards) });
        }
    }
    let nuggets = 0;
    if(!profile.jobs.bonusPaid && profile.jobs.list.every(j => j.done)) {
        profile.jobs.bonusPaid = true;
        nuggets = ALL_JOBS_BONUS_NUGGETS;
        lines.push({ label: 'All daily jobs', nuggets });
    }
    // Account records and leaderboard entries.
    const stats = profile.stats;
    const score = Math.max(0, Math.floor(Number(summary.score) || 0));
    const ranked = plausibleScore(score, summary.seconds);
    stats.runs++;
    stats.kills += Object.values(run.kills).reduce((a, b) => a + (Number(b) || 0), 0);
    const week = weekKey(now);
    if(stats.weekly.week !== week) stats.weekly = { week, score: 0 };
    const stage = Math.floor(Number(summary.outlawIndex));
    if(ranked) {
        stats.bestScore = Math.max(stats.bestScore, score);
        stats.weekly.score = Math.max(stats.weekly.score, score);
        // Stages unlock in order: a record needs the previous outlaw beaten on this account.
        if(stage >= 0 && stage < OUTLAWS.length && (stage === 0 || stats.stageStars[stage - 1] & 1)) {
            stats.stageBest[stage] = Math.max(stats.stageBest[stage], score);
            stats.stageStars[stage] |= starsForRun({ status: run.bounty === 'none' ? 'none' : run.bounty, heatAtOffer: Number(summary.heatAtOutlaw) || 0 });
        }
    }

    const dollars = Math.min(MAX_DOLLARS_PER_RUN, lines.reduce((sum, line) => sum + (line.dollars || 0), 0));
    profile.balances.dollars += dollars;
    profile.balances.nuggets += nuggets;
    return { dollars, nuggets, lines, jobsCompleted, ranked };
}

// Paid currency. `transactionId` makes repeated webhook deliveries safe.
export function creditNuggets(profile, amount, transactionId) {
    if(transactionId && profile.processed.includes(transactionId)) return false;
    profile.balances.nuggets += Math.max(0, Math.floor(amount));
    if(transactionId) profile.processed.push(transactionId);
    profile.processed = profile.processed.slice(-500);
    return true;
}

export { COSMETICS, SLOTS };

// ---------- Leaderboards (computed from account records) ----------
// Seed a device-only profile's records from the Wanted Road progress saved before accounts had
// records. Local wallet only: the server never trusts client-held progress.
export function importProgress(profile, progress) {
    const stats = profile.stats;
    OUTLAWS.forEach((_, i) => {
        stats.stageStars[i] |= Math.max(0, Math.floor(Number(progress?.stars?.[i]) || 0)) & 7;
        stats.stageBest[i] = Math.max(stats.stageBest[i], Math.max(0, Math.floor(Number(progress?.best?.[i]) || 0)));
    });
    stats.bestScore = Math.max(stats.bestScore, ...stats.stageBest);
    return profile;
}

export const BOARDS = {
    weekly: { label: 'THIS WEEK', detail: 'Best single run this week (resets Monday, UTC)' },
    stars: { label: 'WANTED STARS', detail: 'Stars earned across the whole Wanted Road' },
    ...Object.fromEntries(OUTLAWS.map((outlaw, i) => [`stage-${i}`, { label: outlaw.name, detail: `Best run against ${outlaw.name}` }]))
};

export function boardValue(profile, board, now = new Date()) {
    const s = profile.stats;
    if(board === 'weekly') return s.weekly.week === weekKey(now) ? s.weekly.score : 0;
    if(board === 'stars') return s.stageStars.reduce((sum, mask) => sum + starCount(mask), 0);
    const stage = /^stage-(\d+)$/.exec(board)?.[1];
    return stage !== undefined ? (s.stageBest[Number(stage)] || 0) : 0;
}

// accounts: [{ id, profile }]. Named accounts with a score only; ties go to the earlier row.
export function rankBoard(accounts, board, meId = null, limit = 50, now = new Date()) {
    if(!BOARDS[board]) throw new EconomyError('bad_board', 'Unknown leaderboard.');
    const rows = accounts
        .map(({ id, profile }) => ({ id, name: profile.name, value: boardValue(profile, board, now) }))
        .filter(row => row.name && row.value > 0)
        .sort((a, b) => b.value - a.value);
    rows.forEach((row, i) => { row.rank = i + 1; });
    const me = meId ? rows.find(row => row.id === meId) ?? null : null;
    const strip = row => ({ rank: row.rank, name: row.name, value: row.value, me: row.id === meId });
    return { board, entries: rows.slice(0, limit).map(strip), me: me ? strip(me) : null, total: rows.length };
}
