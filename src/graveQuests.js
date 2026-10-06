import { MINE_LADDER, mineRoster, monsterDef } from './mineMonsters.js';
import { OUTLAWS } from './outlaws.js';

// Quests from the graves (MINE_PLAN.md, slice 6). The graves on Deacon Graves's hill are the quest givers: fallen souls who want revenge, or want
// the job they left unfinished finished. A quest is made when you open a grave, from a template, never kept in a list: the same seed, day,
// grave and deepest floor always give the same quest, so a test can replay it and two players on the same day see the same graves.
//
// This is the pure generator, with no rendering and no saving: the screens, the state in the profile and the server come after the owner has
// answered what a quest pays (the generator names no reward on purpose). The rules it keeps:
// - Templates are Fate's small ones: FIND (bring up ore), HUNT (kill one named creature), CLEAR (kill a number of one kind), MIX (a clear and a
//   find together). One grave a day is MAIN: one named creature, bigger and tougher, deep down, with a posse.
// - Everything asked is in the mine and is something the player can do from his deepest floor: a target kind lives on the floor that is asked
//   (`mineRoster`), and an ordinary quest is never deeper than two floors below the deepest he has reached. The main quest is the long goal: it
//   asks for floor 10 or three below his deepest, whichever is deeper.
// - No quest has a timer, and none gives stars, Gold Nuggets or anything that changes a fight. What a quest pays is `questReward`: earned Bounty Dollars,
//   ore and, for the main quest, a cosmetic title, all growing with how deep the quest goes (the owner's answer, 2026-10-06).
// - The graves are on Deacon Graves's own hill and only appear once he has a star (`gravesOpen`), the same unlock as the cellar's hidden door.
// - The mine lane counts what is killed and found (`profile.mine`); `questProgress` is how those counts are read against a quest.

export const TEMPLATES = ['find', 'hunt', 'clear', 'mix'];

// The graves open with Deacon Graves's first star, like the hidden door (src/cellarLayout.js). Nothing else is read.
const DEACON_INDEX = OUTLAWS.findIndex(o => o.id === 'deacon-graves');
export const gravesOpen = profile => ((profile?.stats?.stageStars?.[DEACON_INDEX]) & 1) !== 0;
export const GRAVE_COUNT = 6;

// Fallen souls. `mood`: 'revenge' wants something killed, 'unfinished' wants a job finished. Names and lives are our own.
export const SOULS = [
    { name: 'OLD MAGS TULLY', trade: 'a mule driver', mood: 'unfinished', line: 'I took the ore cart down one last time and the lamp went out. Finish the haul for me.' },
    { name: 'JEBEDIAH CRANE-HOLT', trade: 'a shaft boss', mood: 'revenge', line: 'Something in the dark took my crew one at a time. Make it pay for each of them.' },
    { name: 'SISTER ODELLE', trade: 'a camp nurse', mood: 'unfinished', line: 'There is a bundle of lamps I promised to the men on the lower floors. Bring up what they were owed.' },
    { name: 'TOBIAS WREN', trade: 'a boy who ran errands', mood: 'revenge', line: 'They chased me past the second timber and I never got out. I want them gone.' },
    { name: 'MARISOL VEGA', trade: 'an assayer', mood: 'unfinished', line: 'I had a sample to carry up to the office. It never got there. Please, take it up.' },
    { name: 'BIG HENRY OAKES', trade: 'a blaster', mood: 'revenge', line: 'I set one charge too many. What came for me out of the smoke is still down there.' }
];

// Words for the one named creature of the main quest: a first name and a nickname, in our own voice.
const NAMES = ['Cinder', 'Marrow', 'Gall', 'Hobb', 'Sable', 'Tallow', 'Brack', 'Nettle'];
const TITLES = ['the Unlit', 'Sixfold', 'the Patient', 'of the Long Gallery', 'the Hollow', 'Ironjaw', 'the Last Shift', 'No-Lamp'];

// A small repeatable random stream (mulberry32), so a quest depends only on its inputs.
function stream(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const pick = (next, list) => list[Math.floor(next() * list.length)];
const between = (next, least, most) => least + Math.floor(next() * (most - least + 1));

// What is asked can be done from where the player is: no deeper than two floors below his deepest, and never above floor 2 (floor 1 has only
// the three first enemies and almost nothing to hunt).
export const questFloor = (next, deepest) => {
    const top = Math.max(2, Math.floor(deepest) + 2);
    return between(next, Math.max(2, Math.min(top, Math.floor(deepest) - 2)), top);
};

// Kinds a floor can ask for: what lives on it, without the three that come everywhere (so a quest names something with a name worth knowing).
export function huntable(floor) {
    return mineRoster(floor).filter(id => MINE_LADDER.flat().includes(id));
}

// How many of a kind: smaller for tougher things, never more than a floor's own cap for it allows in one chamber many times over.
function countFor(next, id, floor) {
    const def = monsterDef(id);
    const hard = (def.hp ?? 1) + (def.heavy ? 3 : 0);
    const most = Math.max(3, Math.round(12 - hard * 0.8 + floor * 0.15));
    return between(next, Math.max(2, Math.ceil(most / 2)), most);
}
function oreFor(next, floor) {
    return between(next, 3 + Math.floor(floor / 2), 8 + floor);
}

// One quest: { id, day, grave, template, main, soul, goals: [{ type: 'kill', monster, count, floor, named?, posse? } | { type: 'ore', count, floor }] }.
// `deepest`: the deepest floor the player has reached (0 before the first run).
export function graveQuest({ seed = 0, day = 0, grave = 0, deepest = 0 } = {}) {
    const g = ((Math.floor(grave) % GRAVE_COUNT) + GRAVE_COUNT) % GRAVE_COUNT;
    const deep = Math.max(0, Math.floor(deepest));
    const next = stream(Math.floor(seed) * 104729 + Math.floor(day) * 7919 + g * 31 + 17);
    const soul = SOULS[g];
    const floor = questFloor(next, deep);
    // One grave a day is the main one, picked from the day alone, so it is the same grave whichever grave is asked about.
    const mainGrave = Math.floor(stream(Math.floor(seed) * 104729 + Math.floor(day) * 7919 + 99)() * GRAVE_COUNT);
    const base = { id: `${Math.floor(day)}:${g}`, day: Math.floor(day), grave: g, soul };
    if(g === mainGrave) {
        const mainFloor = Math.max(10, deep + 3);
        const pool = huntable(mainFloor).filter(id => monsterDef(id).heavy || (monsterDef(id).hp ?? 1) >= 3);
        const monster = pick(next, pool.length ? pool : huntable(mainFloor));
        const named = `${pick(next, NAMES)} ${pick(next, TITLES)}`.toUpperCase();
        const others = huntable(mainFloor).filter(id => id !== monster);
        return { ...base, template: 'hunt', main: true, goals: [{ type: 'kill', monster, count: 1, floor: mainFloor, named, posse: between(next, 2, 4), posseKind: pick(next, others) }] };
    }
    const template = pick(next, TEMPLATES);
    const goals = [];
    if(template === 'find' || template === 'mix') goals.push({ type: 'ore', count: oreFor(next, floor), floor });
    if(template === 'hunt' || template === 'clear' || template === 'mix') {
        const monster = pick(next, huntable(floor));
        goals.unshift({ type: 'kill', monster, count: template === 'hunt' ? 1 : countFor(next, monster, floor), floor, ...(template === 'hunt' ? { named: `${pick(next, NAMES)} ${pick(next, TITLES)}`.toUpperCase() } : {}) });
    }
    return { ...base, template, main: false, goals };
}

// The graves open today, one quest each.
export const graveQuests = ({ seed = 0, day = 0, deepest = 0 } = {}) => Array.from({ length: GRAVE_COUNT }, (_, grave) => graveQuest({ seed, day, grave, deepest }));

// Read what the mine has counted against a quest. `tally`: { kills: { monsterId: n }, ore: n } since the quest was taken. Returns each goal's
// progress ({ done, have, need }) and whether the quest is complete.
export function questProgress(quest, tally = {}) {
    const goals = quest.goals.map(goal => {
        const have = goal.type === 'ore' ? Math.max(0, Math.floor(Number(tally.ore)) || 0) : Math.max(0, Math.floor(Number(tally.kills?.[goal.monster])) || 0);
        return { ...goal, have: Math.min(have, goal.count), need: goal.count, done: have >= goal.count };
    });
    return { goals, complete: goals.every(g => g.done) };
}

// A kind's name in the plural ("CAVE BAT" -> "CAVE BATS", "RIFLEMAN" -> "RIFLEMEN").
export const plural = name => (name.endsWith('MAN') ? `${name.slice(0, -3)}MEN` : name.endsWith('S') ? name : `${name}S`);

// The words for one goal ("Kill 6 CAVE BATS on floor 2 or deeper.").
export function goalText(goal) {
    const floor = `floor ${goal.floor} or deeper`;
    if(goal.type === 'ore') return `Bring up ${goal.count} ore from ${floor}.`;
    const def = monsterDef(goal.monster);
    if(goal.posse) return `Kill ${goal.named}, a ${def.name} bigger and tougher than the rest, on ${floor}, with the ${goal.posse} ${plural(monsterDef(goal.posseKind).name)} that follow it.`;
    if(goal.named) return `Hunt down ${goal.named}, a ${def.name} the miners talk about, on ${floor}.`;
    return `Kill ${goal.count} ${goal.count === 1 ? def.name : plural(def.name)} on ${floor}.`;
}

// ---------- what a quest pays ----------
// Earned Bounty Dollars and ore, and for the main quest a cosmetic title, never Gold Nuggets and never anything that changes a fight. It grows with the
// deepest floor the quest asks for, so a deep quest pays clearly more than a shallow one, and it is capped well under what a Wanted Road run earns
// (a run can pay up to MAX_DOLLARS_PER_RUN, 600): one quest never pays more than REWARD_CAP_DOLLARS, and the six graves of a day together at most six caps.
//   dollars = (REWARD_BASE + REWARD_PER_FLOOR x floor) x the template's share, rounded, never more than the cap.
export const REWARD_BASE = 6;
export const REWARD_PER_FLOOR = 4;
export const REWARD_SHARE = { find: 0.8, hunt: 1.2, clear: 1, mix: 1.4, main: 1.8 };
export const REWARD_CAP_DOLLARS = 90;
export const RANK_TITLES = [{ from: 10, name: 'DELVER' }, { from: 15, name: 'DEEP DELVER' }, { from: 25, name: 'LAMPLESS' }, { from: 40, name: 'THE LONG DARK' }];

export function questReward(quest) {
    const floor = Math.max(1, ...quest.goals.map(g => g.floor));
    const share = quest.main ? REWARD_SHARE.main : REWARD_SHARE[quest.template] ?? 1;
    const dollars = Math.min(REWARD_CAP_DOLLARS, Math.round((REWARD_BASE + REWARD_PER_FLOOR * floor) * share));
    const ore = Math.max(1, Math.round(floor * (quest.main ? 1.5 : 0.5)));
    const title = quest.main ? [...RANK_TITLES].reverse().find(t => floor >= t.from)?.name ?? null : null;
    return { dollars, ore, title };
}
