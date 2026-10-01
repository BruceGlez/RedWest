import { DISTRICTS, placeName, edgeOf } from './townDistricts.js';

// A town that reacts (TOWN_PLAN.md): when a district opens the player is told once, and until the marshal has actually
// walked into it the townsfolk talk about it. What has been announced and what has been visited is kept on the device
// (it is only about what the screen says, so it is not in the account). Pure rules, so they can be unit tested.

const KEY = 'redWestDistrictNews.v1';

// { seen: ids already announced, visited: ids the marshal has walked into }
export function loadNews(storage = globalThis.localStorage) {
    try {
        const raw = JSON.parse(storage.getItem(KEY));
        const known = id => DISTRICTS.some(d => d.id === id);
        return {
            seen: Array.isArray(raw?.seen) ? raw.seen.filter(known) : [],
            visited: Array.isArray(raw?.visited) ? raw.visited.filter(known) : []
        };
    } catch {
        return { seen: [], visited: [] };
    }
}

export function saveNews(news, storage = globalThis.localStorage) {
    try { storage.setItem(KEY, JSON.stringify({ seen: news.seen, visited: news.visited })); } catch { /* private mode */ }
}

// The open districts the player has not been told about yet, in the order the districts are listed.
export function newlyOpened(unlockedIds, news) {
    return DISTRICTS.filter(d => unlockedIds.includes(d.id) && !news.seen.includes(d.id)).map(d => d.id);
}

// The banner for one district that has just opened.
export function bannerFor(district) {
    return { title: `NEW: ${district.name} IS OPEN`, text: `A gate has opened at the ${edgeOf(district)} edge of town. Walk through and take a look.` };
}

export function markSeen(news, ids) {
    return { ...news, seen: [...new Set([...news.seen, ...ids])] };
}

export function markVisited(news, id) {
    return news.visited.includes(id) ? news : { ...news, visited: [...news.visited, id] };
}

// What the townsfolk are talking about: the display name of the most recently opened district the marshal has not
// been into yet, or null. `unlockedIds` is in the districts' own order, so the last one listed is the newest.
export function talkOfTheTown(unlockedIds, news) {
    const waiting = DISTRICTS.filter(d => unlockedIds.includes(d.id) && !news.visited.includes(d.id));
    return waiting.length ? placeName(waiting[waiting.length - 1]) : null;
}
