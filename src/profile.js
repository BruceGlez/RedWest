import { COSMETICS, SLOTS, getCosmetic, defaultLoadout } from './cosmetics.js';
import { jobsForDay, getJob, dayKey, ALL_JOBS_BONUS_NUGGETS } from './jobs.js';

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
    profile.owned = [...new Set((raw.owned || []).filter(id => getCosmetic(id)))];
    for(const slot of SLOTS) {
        const id = raw.loadout?.[slot];
        const item = getCosmetic(id);
        if(item && item.slot === slot && ownsItem(profile, id)) profile.loadout[slot] = id;
    }
    if(raw.jobs?.day === profile.jobs.day && Array.isArray(raw.jobs.list)) {
        profile.jobs.list = raw.jobs.list.filter(j => getJob(j.id)).map(j => ({ id: j.id, progress: Math.max(0, Number(j.progress) || 0), done: !!j.done }));
        profile.jobs.bonusPaid = !!raw.jobs.bonusPaid;
    }
    profile.processed = (raw.processed || []).filter(id => typeof id === 'string').slice(-500);
    return profile;
}

export function ownsItem(profile, id) {
    const item = getCosmetic(id);
    return !!item && (item.price === 0 || profile.owned.includes(id));
}

// New day: fresh jobs.
export function refreshJobs(profile, now = new Date()) {
    const today = dayKey(now);
    if(profile.jobs.day !== today) profile.jobs = { day: today, list: jobsForDay(today), bonusPaid: false };
}

export class EconomyError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

export function buyItem(profile, id) {
    const item = getCosmetic(id);
    if(!item) throw new EconomyError('unknown_item', 'That item does not exist.');
    if(ownsItem(profile, id)) throw new EconomyError('owned', 'You already own this.');
    if(profile.balances[item.currency] < item.price) throw new EconomyError('funds', `Not enough ${CURRENCIES[item.currency].name.toLowerCase()}.`);
    profile.balances[item.currency] -= item.price;
    profile.owned.push(id);
    return item;
}

export function equipItem(profile, id) {
    const item = getCosmetic(id);
    if(!item) throw new EconomyError('unknown_item', 'That item does not exist.');
    if(!ownsItem(profile, id)) throw new EconomyError('not_owned', 'Buy it first.');
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
            lines.push({ label: `Job: ${job.text}`, dollars: job.reward });
        }
    }
    let nuggets = 0;
    if(!profile.jobs.bonusPaid && profile.jobs.list.every(j => j.done)) {
        profile.jobs.bonusPaid = true;
        nuggets = ALL_JOBS_BONUS_NUGGETS;
        lines.push({ label: 'All daily jobs', nuggets });
    }
    const dollars = Math.min(MAX_DOLLARS_PER_RUN, lines.reduce((sum, line) => sum + (line.dollars || 0), 0));
    profile.balances.dollars += dollars;
    profile.balances.nuggets += nuggets;
    return { dollars, nuggets, lines, jobsCompleted };
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
