import { COSMETICS, SLOTS, getShopItem, defaultLoadout } from './cosmetics.js';
import { jobsForDay, getJob, dayKey, ALL_JOBS_BONUS_NUGGETS } from './jobs.js';
import { validateName } from './names.js';
import { OUTLAWS } from './outlaws.js';
import { starsForRun, starCount } from './progress.js';
import { EconomyError } from './economyError.js';
import { createTown, normalizeTown, buildingEffects } from './town.js';
import { eventForWeek, createEventProgress, normalizeEventProgress, recordEventScore, eventTitle } from './events.js';
import { createPass, normalizePass, payPassRewards, pointsForRun, tierReward } from './pass.js';
import { createMineProgress, normalizeMineProgress } from './mineProgress.js';

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
        event: createEventProgress(weekKey(now)), // this week's Most Wanted event (src/events.js)
        pass: createPass(now), // this season's Wanted Poster Pass (src/pass.js)
        mine: createMineProgress(), // the Hollow Claim: deepest floor, checkpoint and ore (src/mineProgress.js)
        // Account records, also the source for online leaderboards.
        // stageChar and weekly.character: who the player was playing as for that best run (shown on the boards).
        stats: {
            runs: 0, bestScore: 0, stageBest: OUTLAWS.map(() => 0), stageStars: OUTLAWS.map(() => 0), stageChar: OUTLAWS.map(() => ''),
            weekly: { week: weekKey(now), score: 0, character: '' }, kills: 0
        },
        processed: [], // ids of already-credited purchases (idempotency)
        bought: [], // one-time products already bought (the starter pack)
        purchases: [], // what each purchase gave, so a refund can take exactly that back
        refunded: [], // transaction ids already reversed
        nuggetDebt: 0 // refunded nuggets that had already been spent; paid from the next nuggets earned
    };
}

// A character id from the shop, or '' (older saves and anything unknown).
export function characterId(id) {
    return getShopItem(id)?.slot === 'character' ? id : '';
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
    profile.bought = [...new Set((raw.bought || []).filter(id => typeof id === 'string'))];
    profile.purchases = (Array.isArray(raw.purchases) ? raw.purchases : []).filter(p => p && typeof p.tx === 'string').slice(-200);
    profile.refunded = (raw.refunded || []).filter(id => typeof id === 'string').slice(-200);
    profile.nuggetDebt = Math.max(0, Math.floor(Number(raw.nuggetDebt)) || 0);
    profile.town = normalizeTown(raw.town, now);
    profile.event = normalizeEventProgress(raw.event, weekKey(now));
    profile.pass = normalizePass(raw.pass, now);
    profile.mine = normalizeMineProgress(raw.mine);
    if(raw.name && validateName(raw.name).ok) profile.name = validateName(raw.name).name;
    const s = raw.stats || {};
    const num = v => Math.max(0, Math.floor(Number(v)) || 0);
    profile.stats.runs = num(s.runs);
    profile.stats.bestScore = num(s.bestScore);
    profile.stats.kills = num(s.kills);
    OUTLAWS.forEach((_, i) => {
        profile.stats.stageBest[i] = num(s.stageBest?.[i]);
        profile.stats.stageStars[i] = num(s.stageStars?.[i]) & 7;
        profile.stats.stageChar[i] = characterId(s.stageChar?.[i]);
    });
    if(s.weekly?.week === profile.stats.weekly.week) {
        profile.stats.weekly.score = num(s.weekly.score);
        profile.stats.weekly.character = characterId(s.weekly.character);
    }
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
    if(item.earned) return profile.owned.includes(id); // event prizes
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
    if(item.earned === 'purchase') throw new EconomyError('earned', "Comes with the Deputy's Kit.");
    if(item.earned) throw new EconomyError('earned', 'Win this in the weekly Most Wanted event.');
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
    // A Most Wanted event run: this week's event outlaw, reported during this week. It counts for the
    // event (and jobs), not for the Wanted Road records or the other leaderboards.
    const event = eventForWeek(week);
    const eventRun = summary.event === week && stage === event.outlaw;
    const eventLines = [];
    const character = profile.loadout.character; // the server's record of who played, not the client's word
    if(ranked && eventRun) {
        profile.event = normalizeEventProgress(profile.event, week);
        if(score > profile.event.best) profile.event.character = character;
        for(const reward of recordEventScore(profile, event, score)) {
            eventLines.push({ label: `Most Wanted target ${reward.tier}: ${reward.target.toLocaleString()}`, dollars: reward.dollars });
            if(reward.item) eventLines.push({ label: `Prize: ${reward.item.name} ${reward.item.slot}`, item: reward.item.id });
        }
    }
    if(ranked && !eventRun) {
        stats.bestScore = Math.max(stats.bestScore, score);
        if(score > stats.weekly.score) {
            stats.weekly.score = score;
            stats.weekly.character = character;
        }
        // Stages unlock in order: a record needs the previous outlaw beaten on this account.
        if(stage >= 0 && stage < OUTLAWS.length && (stage === 0 || stats.stageStars[stage - 1] & 1)) {
            if(score > stats.stageBest[stage]) {
                stats.stageBest[stage] = score;
                stats.stageChar[stage] = character;
            }
            stats.stageStars[stage] |= starsForRun({ status: run.bounty === 'none' ? 'none' : run.bounty, heatAtOffer: Number(summary.heatAtOutlaw) || 0 });
        }
    }

    // Run and event dollars (event prizes come on top of the per-run cap, so reaching targets never crowds
    // out run earnings).
    // The bank's level sets the most one run can pay (src/town.js); MAX_DOLLARS_PER_RUN at level 1.
    const runCap = buildingEffects(profile.town, 'bank').runCap || MAX_DOLLARS_PER_RUN;
    const runDollars = Math.min(runCap, lines.reduce((sum, line) => sum + (line.dollars || 0), 0))
        + eventLines.reduce((sum, line) => sum + (line.dollars || 0), 0);
    profile.balances.dollars += runDollars;
    profile.balances.nuggets += nuggets;
    lines.push(...eventLines);

    // Season pass: points for this run; newly reached tiers pay straight into the wallet (src/pass.js).
    profile.pass = normalizePass(profile.pass, now);
    profile.pass.points += pointsForRun({ bounty: run.bounty, jobsCompleted: jobsCompleted.length, eventTargets: eventLines.filter(line => line.dollars).length });
    let dollars = runDollars;
    for(const reward of payPassRewards(profile)) {
        const label = `Pass tier ${reward.tier}${reward.track === 'premium' ? ' (pass)' : ''}`;
        if(reward.item) lines.push({ label, item: reward.item });
        else if(reward.nuggets) { lines.push({ label, nuggets: reward.nuggets }); nuggets += reward.nuggets; }
        else { lines.push({ label, dollars: reward.dollars }); dollars += reward.dollars; }
    }
    settleNuggetDebt(profile);
    return { dollars, nuggets, lines, jobsCompleted, ranked };
}

// A verified store purchase (src/products.js): nuggets and any items. `transactionId` makes repeated webhook
// deliveries safe; a one-time product pays its nuggets only the first time.
// extra: { paymentIntent } for Stripe, to match a later refund.
export function grantProduct(profile, product, transactionId, now = new Date(), extra = {}) {
    if(transactionId && profile.processed.includes(transactionId)) return false;
    const record = { tx: transactionId || '', product: product.id, nuggets: 0, items: [], at: now.toISOString(), ...extra };
    const nuggetsBefore = profile.balances.nuggets;
    if(product.kind === 'pass') {
        // This season's pass: the paid track opens and every tier already reached pays at once.
        profile.pass = normalizePass(profile.pass, now);
        profile.pass.premium = true;
        record.season = profile.pass.season;
        for(const reward of payPassRewards(profile)) if(reward.item) record.items.push(reward.item);
    }
    const firstTime = !profile.bought.includes(product.id);
    if(!product.oneTime || firstTime) profile.balances.nuggets += Math.max(0, Math.floor(product.nuggets || 0));
    for(const id of product.items || []) {
        if(!profile.owned.includes(id)) {
            profile.owned.push(id);
            record.items.push(id);
        }
    }
    if(product.oneTime && firstTime) {
        profile.bought.push(product.id);
        record.firstTime = true;
    }
    record.nuggets = profile.balances.nuggets - nuggetsBefore;
    if(transactionId) profile.processed.push(transactionId);
    profile.processed = profile.processed.slice(-500);
    profile.purchases = [...profile.purchases, record].slice(-200);
    settleNuggetDebt(profile);
    return true;
}

// Nuggets taken back by a refund after they were spent are owed, and paid from the next nuggets credited.
export function settleNuggetDebt(profile) {
    const pay = Math.min(profile.nuggetDebt || 0, profile.balances.nuggets);
    profile.balances.nuggets -= pay;
    profile.nuggetDebt = (profile.nuggetDebt || 0) - pay;
}

// A refund (store or Stripe): take back what that purchase gave. Nuggets already spent become a debt instead
// of a negative balance; looks are removed (and unequipped); a refunded pass closes this season's paid track
// and takes back what it paid. Returns false if the transaction is unknown or already reversed.
export function revokePurchase(profile, transactionId, now = new Date()) {
    if(!transactionId || profile.refunded.includes(transactionId)) return false;
    const record = profile.purchases.find(p => p.tx === transactionId);
    if(!record) return false;
    let nuggets = record.nuggets;
    const items = [...record.items];
    if(record.season) {
        profile.pass = normalizePass(profile.pass, now);
        if(profile.pass.season === record.season && profile.pass.premium) {
            // Everything the paid track paid this season, including tiers reached after buying.
            for(let tier = 1; tier <= profile.pass.premiumClaimed; tier++) {
                const reward = tierReward(record.season, tier, 'premium');
                if(reward.item && !items.includes(reward.item)) items.push(reward.item);
            }
            nuggets = 0;
            for(let tier = 1; tier <= profile.pass.premiumClaimed; tier++) nuggets += tierReward(record.season, tier, 'premium').nuggets || 0;
            profile.pass.premium = false;
            profile.pass.premiumClaimed = 0;
        }
    }
    const left = profile.balances.nuggets - nuggets;
    profile.balances.nuggets = Math.max(0, left);
    if(left < 0) profile.nuggetDebt = (profile.nuggetDebt || 0) - left;
    profile.owned = profile.owned.filter(id => !items.includes(id));
    const fallback = defaultLoadout();
    for(const [slot, id] of Object.entries(profile.loadout)) if(items.includes(id)) profile.loadout[slot] = fallback[slot];
    if(record.firstTime) profile.bought = profile.bought.filter(id => id !== record.product);
    profile.refunded = [...profile.refunded, transactionId].slice(-200);
    return true;
}

// Restoring a one-time purchase on a new device (after the store confirms it): its items, not its nuggets.
export function restoreProduct(profile, product) {
    for(const id of product.items || []) if(!profile.owned.includes(id)) profile.owned.push(id);
    if(!profile.bought.includes(product.id)) profile.bought.push(product.id);
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
    event: { label: 'MOST WANTED (EVENT)', detail: 'Best score in this week\'s Most Wanted event' },
    ...Object.fromEntries(OUTLAWS.map((outlaw, i) => [`stage-${i}`, { label: outlaw.name, detail: `Best run against ${outlaw.name}` }]))
};

export function boardValue(profile, board, now = new Date()) {
    const s = profile.stats;
    if(board === 'weekly') return s.weekly.week === weekKey(now) ? s.weekly.score : 0;
    if(board === 'stars') return s.stageStars.reduce((sum, mask) => sum + starCount(mask), 0);
    if(board === 'event') return profile.event?.week === weekKey(now) ? profile.event.best : 0;
    const stage = /^stage-(\d+)$/.exec(board)?.[1];
    return stage !== undefined ? (s.stageBest[Number(stage)] || 0) : 0;
}

// Who played the run behind a board value ('' for the stars board and older records).
export function boardCharacter(profile, board, now = new Date()) {
    if(board === 'weekly') return profile.stats.weekly.week === weekKey(now) ? profile.stats.weekly.character || '' : '';
    if(board === 'event') return profile.event?.week === weekKey(now) ? profile.event.character || '' : '';
    const stage = /^stage-(\d+)$/.exec(board)?.[1];
    return stage !== undefined ? profile.stats.stageChar[Number(stage)] || '' : '';
}

// accounts: [{ id, profile }]. Named accounts with a score only; ties go to the earlier row.
export function rankBoard(accounts, board, meId = null, limit = 50, now = new Date()) {
    if(!BOARDS[board]) throw new EconomyError('bad_board', 'Unknown leaderboard.');
    const rows = accounts
        .map(({ id, profile }) => ({ id, name: profile.name, value: boardValue(profile, board, now), character: boardCharacter(profile, board, now) }))
        .filter(row => row.name && row.value > 0)
        .sort((a, b) => b.value - a.value);
    rows.forEach((row, i) => { row.rank = i + 1; });
    const me = meId ? rows.find(row => row.id === meId) ?? null : null;
    const strip = row => ({
        rank: row.rank, name: row.name, value: row.value, me: row.id === meId, character: row.character,
        ...(board === 'event' && eventTitle(row.rank) ? { title: eventTitle(row.rank) } : {})
    });
    return { board, entries: rows.slice(0, limit).map(strip), me: me ? strip(me) : null, total: rows.length };
}
