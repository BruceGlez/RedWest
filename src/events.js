import { OUTLAWS } from './outlaws.js';

// Weekly "Most Wanted" event (GROWTH_PLAN.md, Phase 2.1). Each week (Monday to Sunday, UTC, like the
// weekly leaderboard) one outlaw is Most Wanted with a twist. Anyone can ride out against them, as often
// as they like, for free. Prizes come from your own best score reaching three targets (never from rank),
// are in-game only and have no cash value.

// Twists reuse the outlaw modifiers in src/outlaws.js, plus faster Heat.
export const TWISTS = [
    { id: 'wolf-moon', name: 'WOLF MOON', detail: 'More wolves, and faster ones.', modifiers: ['FAST_WOLVES', 'SWARM'] },
    { id: 'deadeye', name: 'DEADEYE WEEK', detail: 'Riflemen everywhere, and they aim true.', modifiers: ['SHARPSHOOTERS'] },
    { id: 'iron-posse', name: 'IRON POSSE', detail: 'Tougher shooters with faster bullets.', modifiers: ['HEAVY_HITTERS'] },
    { id: 'hot-trail', name: 'HOT TRAIL', detail: 'Heat builds twice as fast.', modifiers: [], heatGain: 2 }
];

// Score targets against the first outlaw; later outlaws pay bigger bounties, so their targets rise
// 15% per stage.
const BASE_TARGETS = [500, 1200, 2200];
export const TIER_DOLLARS = [100, 200, 300];

// Collectibles for the top target, one per event, in order. After all are owned, the top target pays
// extra dollars instead. Earned only: they can never be bought (src/profile.js, tests/events.test.js).
export const EVENT_COSMETICS = [
    { id: 'hat-most-wanted', slot: 'hat', name: 'Most Wanted', color: 0x8b0000, price: 0, currency: 'dollars', earned: 'event' },
    { id: 'bullets-silver-star', slot: 'bullets', name: 'Silver Star', color: 0xe0e0e0, price: 0, currency: 'dollars', earned: 'event' },
    { id: 'coat-bounty-hunter', slot: 'coat', name: 'Bounty Hunter', color: 0x3e2723, price: 0, currency: 'dollars', earned: 'event' },
    { id: 'pants-desperado', slot: 'pants', name: 'Desperado', color: 0x6d1b1b, price: 0, currency: 'dollars', earned: 'event' }
];
export const ALL_COSMETICS_OWNED_DOLLARS = 300;

function hash(text) {
    let h = 2166136261;
    for(let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// The same event for everyone in a given week, worked out from the week alone (no server needed).
export function eventForWeek(week) {
    const h = hash(`most-wanted:${week}`);
    const outlaw = h % OUTLAWS.length;
    const twist = TWISTS[Math.floor(h / OUTLAWS.length) % TWISTS.length];
    const scale = 1 + (outlaw * 0.15);
    return { week, outlaw, twist, targets: BASE_TARGETS.map(t => Math.round((t * scale) / 50) * 50) };
}

// Start of the next week (Monday 00:00 UTC), for "ends in".
export function eventEndsAt(now = new Date()) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const daysToMonday = ((8 - (d.getUTCDay() || 7)) % 7) || 7;
    d.setUTCDate(d.getUTCDate() + daysToMonday);
    return d;
}

export function createEventProgress(week = '') {
    return { week, best: 0, tiers: 0 };
}

export function normalizeEventProgress(raw, week) {
    if(!raw || raw.week !== week) return createEventProgress(week);
    return {
        week,
        best: Math.max(0, Math.floor(Number(raw.best)) || 0),
        tiers: Math.max(0, Math.min(BASE_TARGETS.length, Math.floor(Number(raw.tiers)) || 0))
    };
}

// Records a score for this week's event and returns the newly reached targets' rewards.
// profile.event must already be this week's progress.
export function recordEventScore(profile, event, score) {
    const progress = profile.event;
    progress.best = Math.max(progress.best, score);
    const rewards = [];
    while(progress.tiers < event.targets.length && progress.best >= event.targets[progress.tiers]) {
        const tier = progress.tiers;
        const reward = { tier: tier + 1, target: event.targets[tier], dollars: TIER_DOLLARS[tier] };
        if(tier === event.targets.length - 1) {
            const next = EVENT_COSMETICS.find(item => !profile.owned.includes(item.id));
            if(next) {
                profile.owned.push(next.id);
                reward.item = next;
            } else {
                reward.dollars += ALL_COSMETICS_OWNED_DOLLARS;
            }
        }
        rewards.push(reward);
        progress.tiers++;
    }
    return rewards;
}
