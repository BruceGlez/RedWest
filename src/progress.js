import { OUTLAWS } from './outlaws.js';

// Wanted Road progress, saved on this device. Stars per outlaw are a bitmask of the three
// STAR_GOALS in outlaws.js, so each goal can be earned on a different run.
const PROGRESS_KEY = 'redWestProgress.v1';
export const STAR_DEFEATED = 1;
export const STAR_HOT_BOUNTY = 2;
export const STAR_ESCAPED = 4;

export function createProgress() {
    return { selected: 0, stars: OUTLAWS.map(() => 0), best: OUTLAWS.map(() => 0) };
}

export function starCount(mask) {
    return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

export function totalStars(progress) {
    return progress.stars.reduce((sum, mask) => sum + starCount(mask), 0);
}

export function isUnlocked(progress, index) {
    return index === 0 || (index < OUTLAWS.length && (progress.stars[index - 1] & STAR_DEFEATED) !== 0);
}

// bounty: the run's bounty state from bounty.js
export function starsForRun(bounty) {
    let mask = 0;
    if(bounty.status !== 'none') mask |= STAR_DEFEATED;
    if((bounty.status === 'banked' || bounty.status === 'escaped') && bounty.heatAtOffer >= 2) mask |= STAR_HOT_BOUNTY;
    if(bounty.status === 'escaped') mask |= STAR_ESCAPED;
    return mask;
}

// Merge a finished run into progress. Returns what changed so the result screen can celebrate it.
export function recordRun(progress, index, bounty, score) {
    const earned = starsForRun(bounty);
    const before = progress.stars[index];
    const wasNextUnlocked = isUnlocked(progress, index + 1);
    progress.stars[index] = before | earned;
    progress.best[index] = Math.max(progress.best[index], score);
    const unlockedNext = !wasNextUnlocked && isUnlocked(progress, index + 1);
    if(unlockedNext) progress.selected = index + 1;
    return { earned, newStars: progress.stars[index] & ~before, unlockedNext };
}

export function loadProgress(storage = globalThis.localStorage) {
    const progress = createProgress();
    try {
        const saved = JSON.parse(storage.getItem(PROGRESS_KEY));
        if(saved && Array.isArray(saved.stars)) {
            saved.stars.slice(0, OUTLAWS.length).forEach((mask, i) => { progress.stars[i] = Number(mask) & 7; });
            (saved.best || []).slice(0, OUTLAWS.length).forEach((score, i) => { progress.best[i] = Number(score) || 0; });
            if(isUnlocked(progress, saved.selected)) progress.selected = saved.selected;
        }
    } catch {
        // Missing or corrupt progress starts a fresh road.
    }
    return progress;
}

export function saveProgress(progress, storage = globalThis.localStorage) {
    try {
        storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
        // Storage full or blocked: progress lasts for this session only.
    }
}
