// Coming back to the floor the lift took him up from (MINE_PLAN.md, slice 7). The saved shape is profile.mine.resume (src/mineProgress.js); until the
// server keeps it, this module holds it in memory for the page's life, behind a tiny adapter (`store`) that can later be pointed at the endpoints
// without the mode noticing. Nothing here touches the wallet or any money.
import { normalizeResume } from './mineProgress.js';

let remembered = null;
export const store = {
    get: () => remembered,
    set: point => { remembered = point; },
    clear: () => { remembered = null; }
};

// The record the stairs and the run offer from: his saved record, with the resume point from this page when the server has none yet.
export function withResume(record) {
    const base = record ?? { deepest: 0, checkpoint: 0 };
    const point = base.resume ?? normalizeResume(store.get(), base.deepest || Infinity);
    return point ? { ...base, resume: point } : base;
}

// He rode the lift up from `floor`: remember where, with the torches he left standing and the seconds the run took.
export const rememberResume = (floor, torches, clock) => store.set(normalizeResume({ floor, torches, clock }));
// A run that begins anywhere else (or ends in a fall) forgets it.
export const forgetResume = () => store.clear();
