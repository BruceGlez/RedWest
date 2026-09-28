// Daily jobs: three goals a day, the same for everyone on a given date, reset at local midnight.

export const JOB_POOL = [
    { id: 'bag-bandits', text: 'Bag 25 bandits', goal: 25, reward: 60, measure: run => run.kills.bandit || 0 },
    { id: 'bag-any', text: 'Bag 60 enemies', goal: 60, reward: 80, measure: run => Object.values(run.kills).reduce((a, b) => a + b, 0) },
    { id: 'bag-wolves', text: 'Bag 10 wolves', goal: 10, reward: 60, measure: run => run.kills.wolf || 0 },
    { id: 'heat-3', text: 'Reach Heat 3 in one run', goal: 1, reward: 70, measure: run => (run.peakHeat >= 3 ? 1 : 0) },
    { id: 'bank', text: 'Bank a bounty', goal: 1, reward: 60, measure: run => (run.bounty === 'banked' ? 1 : 0) },
    { id: 'escape', text: 'Ride on and escape', goal: 1, reward: 100, measure: run => (run.bounty === 'escaped' ? 1 : 0) },
    { id: 'outlaws', text: 'Defeat 2 outlaws', goal: 2, reward: 90, measure: run => (run.bounty !== 'none' ? 1 : 0) },
    { id: 'hits', text: 'Land 150 hits', goal: 150, reward: 50, measure: run => run.shotsHit || 0 },
    { id: 'loot', text: 'Pick up 5 loot', goal: 5, reward: 50, measure: run => run.loot || 0 },
    { id: 'runs', text: 'Finish 3 runs', goal: 3, reward: 40, measure: () => 1 }
];
export const JOBS_PER_DAY = 3;
export const ALL_JOBS_BONUS_NUGGETS = 5;

const BY_ID = new Map(JOB_POOL.map(job => [job.id, job]));

export function getJob(id) {
    return BY_ID.get(id) ?? null;
}

export function dayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function hash(text) {
    let h = 2166136261;
    for(let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// Deterministic pick of distinct jobs for a day.
export function jobsForDay(day) {
    const pool = JOB_POOL.map(job => job.id);
    const picked = [];
    let seed = hash(day);
    while(picked.length < JOBS_PER_DAY) {
        seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0;
        const id = pool.splice(seed % pool.length, 1)[0];
        picked.push(id);
    }
    return picked.map(id => ({ id, progress: 0, done: false }));
}
