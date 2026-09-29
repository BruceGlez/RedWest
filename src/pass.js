// The Wanted Poster Pass (GROWTH_PLAN.md, Phase 3.2), sold in the Frontier Town saloon.
// - 30-day seasons with 30 tiers, earned by playing: finishing runs, daily jobs, weekly event targets.
// - Free track: Bounty Dollars, a few nuggets and one season look.
// - Paid track ($4.99, product `season_pass`): the season's looks and nuggets. Cosmetics and nuggets only,
//   never anything that changes a fight. A one-time purchase for that season that never renews (no
//   subscription), and buying late pays every tier already reached.
// Rewards are paid automatically as tiers are reached (nothing to forget to claim).

export const SEASON_EPOCH = Date.UTC(2026, 8, 29); // season 1 starts Tuesday 29 September 2026, 00:00 UTC
export const SEASON_DAYS = 30;
export const TIERS = 30;
export const POINTS_PER_TIER = 250;
export const POINTS = { run: 20, collected: 10, job: 30, eventTarget: 50 };
const DAY = 86400000;

// Each season has a themed set of looks; themes take turns.
const THEMES = [
    {
        name: 'GASLIGHT',
        free: { id: 'bullets-smoke', slot: 'bullets', name: 'Coal Smoke', color: 0x9e9e9e },
        premium: [
            { id: 'hat-gaslight', slot: 'hat', name: 'Gaslight Bowler', color: 0x1c1c1c },
            { id: 'coat-soot', slot: 'coat', name: 'Soot Overcoat', color: 0x3b3b3b },
            { id: 'pants-pinstripe', slot: 'pants', name: 'Pinstripe', color: 0x4e4e5a },
            { id: 'bullets-amber', slot: 'bullets', name: 'Gaslight Amber', color: 0xffb347 }
        ]
    },
    {
        name: 'RAIL BARON',
        free: { id: 'bullets-steam', slot: 'bullets', name: 'Steam White', color: 0xf5f5f5 },
        premium: [
            { id: 'hat-rail-baron', slot: 'hat', name: 'Rail Baron', color: 0x5d4037 },
            { id: 'coat-conductor', slot: 'coat', name: 'Conductor Blue', color: 0x1a237e },
            { id: 'pants-coal', slot: 'pants', name: 'Coal Black', color: 0x161616 },
            { id: 'bullets-rivet', slot: 'bullets', name: 'Brass Rivet', color: 0xb8860b }
        ]
    }
];

// The pass looks for the shop catalog: earned only, never sold (tests/pass.test.js).
export const PASS_COSMETICS = THEMES.flatMap(theme => [theme.free, ...theme.premium])
    .map(item => ({ ...item, price: 0, currency: 'dollars', earned: 'pass' }));

export function seasonFor(now = new Date()) {
    return Math.max(1, Math.floor((now.getTime() - SEASON_EPOCH) / (SEASON_DAYS * DAY)) + 1);
}

export function seasonEndsAt(season) {
    return new Date(SEASON_EPOCH + season * SEASON_DAYS * DAY);
}

export function themeFor(season) {
    return THEMES[(season - 1) % THEMES.length];
}

const PREMIUM_ITEM_TIERS = [1, 10, 20, 30];
const FREE_ITEM_TIER = 12;

// The reward on each track at a tier (1..30).
export function tierReward(season, tier, track) {
    const theme = themeFor(season);
    if(track === 'free') {
        if(tier === FREE_ITEM_TIER) return { item: theme.free.id };
        if(tier % 10 === 0) return { nuggets: 10 };
        return { dollars: 40 + (tier * 2) };
    }
    // Never Bounty Dollars on the paid track: dollars buy guns, and money must not buy combat power.
    const itemIndex = PREMIUM_ITEM_TIERS.indexOf(tier);
    if(itemIndex >= 0) return { item: theme.premium[itemIndex].id };
    if(tier % 3 === 0) return { nuggets: 25 };
    return { nuggets: 5 };
}

export function createPass(now = new Date()) {
    return { season: seasonFor(now), points: 0, premium: false, freeClaimed: 0, premiumClaimed: 0 };
}

// A new season starts fresh (rewards were already paid as they were reached).
export function normalizePass(raw, now = new Date()) {
    const pass = createPass(now);
    if(!raw || raw.season !== pass.season) return pass;
    const count = value => Math.max(0, Math.min(TIERS, Math.floor(Number(value)) || 0));
    pass.points = Math.max(0, Math.floor(Number(raw.points)) || 0);
    pass.premium = raw.premium === true;
    pass.freeClaimed = count(raw.freeClaimed);
    pass.premiumClaimed = count(raw.premiumClaimed);
    return pass;
}

export const tierFor = points => Math.min(TIERS, Math.floor(points / POINTS_PER_TIER));

// Pays every reached, unpaid tier on both tracks (the paid one only with the pass).
// Returns [{ tier, track, dollars?, nuggets?, item? }].
export function payPassRewards(profile) {
    const pass = profile.pass;
    const reached = tierFor(pass.points);
    const paid = [];
    const pay = (tier, track) => {
        const reward = tierReward(pass.season, tier, track);
        if(reward.dollars) profile.balances.dollars += reward.dollars;
        if(reward.nuggets) profile.balances.nuggets += reward.nuggets;
        if(reward.item && !profile.owned.includes(reward.item)) profile.owned.push(reward.item);
        paid.push({ tier, track, ...reward });
    };
    for(; pass.freeClaimed < reached; pass.freeClaimed++) pay(pass.freeClaimed + 1, 'free');
    if(pass.premium) for(; pass.premiumClaimed < reached; pass.premiumClaimed++) pay(pass.premiumClaimed + 1, 'premium');
    return paid;
}

// Points for a finished run: always something for playing, more for a collected bounty, each daily
// job finished, and each weekly event target reached.
export function pointsForRun({ bounty, jobsCompleted = 0, eventTargets = 0 }) {
    return POINTS.run + (bounty === 'banked' || bounty === 'escaped' ? POINTS.collected : 0)
        + (jobsCompleted * POINTS.job) + (eventTargets * POINTS.eventTarget);
}
