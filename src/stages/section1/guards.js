// Guard awareness for Section 1 (docs/design/pete-section1-gameplay.md, M2). Pure rules, no THREE: the mode asks what each guard group does
// this frame and spawns its men when it says so.
//
// A group is IDLE until the marshal comes within its sense distance (a sleeper notices late, a sentry sees the whole group radius), then
// SUSPICIOUS (a tell: the banner and the men turn to look) and, after a moment, ALERTED (its men spawn and fight). Hiding while idle or
// suspicious keeps him unseen; a shot in earshot alerts at once; an alerted sentry group raises the ALARM and groups within ALARM_RADIUS
// become suspicious faster. A flanker group sends its second pair in FLANK_DELAY seconds after the first.

import { HIDE } from './hiding.js';

export const GUARD = {
    SUSPICIOUS_SECONDS: 1.4,       // from first sight to the fight
    ALARM_SUSPICIOUS_SECONDS: 0.5, // when the alarm has already been raised nearby
    FORGET_SECONDS: 2.0,           // a suspicious group that lost sight of him goes back to idle after this
    ALARM_RADIUS: 120,
    EARSHOT: 1.6,                  // a shot is heard at this many group radii
    FLANK_DELAY: 6,
    LOSE_TRACK: HIDE.LOSE_TRACK
};

// How each group of Section 1 behaves. `sense` is the share of its radius it notices him at.
export const ROLES = {
    'a1-claims-guards': { role: 'sentry', sense: 1, alarm: true },
    'a1-flume-ambush': { role: 'flanker', sense: 1, alarm: true, flankFrom: 2 }
};
const DEFAULT_ROLE = { role: 'sentry', sense: 1, alarm: false };
export const roleOf = id => ({ ...DEFAULT_ROLE, ...(ROLES[id] ?? {}) });

export function createAwareness(group) {
    const r = roleOf(group.id);
    return { id: group.id, role: r.role, state: 'idle', t: 0, sinceAlert: 0, flanked: false, alarm: false };
}

// One frame for one group. `dist`: the marshal's distance to the group's centre. `hidden`: he is in a hiding place.
// `shot`: he fired this frame. `alarmNear`: another group's alarm is ringing within ALARM_RADIUS. Returns 'alerted' on the frame it turns.
export function stepAwareness(a, group, dt, { dist, hidden = false, shot = false, alarmNear = false }) {
    const role = roleOf(group.id);
    let event = null;
    const sees = !hidden && dist <= group.radius * role.sense;
    const hears = shot && dist <= group.radius * GUARD.EARSHOT;
    if(a.state === 'idle') {
        if(hears) { a.state = 'alerted'; a.sinceAlert = 0; event = 'alerted'; }
        else if(sees) { a.state = 'suspicious'; a.t = 0; event = 'suspicious'; }
        else if(alarmNear && !hidden && dist <= group.radius * 2) { a.state = 'suspicious'; a.t = GUARD.SUSPICIOUS_SECONDS - GUARD.ALARM_SUSPICIOUS_SECONDS; event = 'suspicious'; }
    } else if(a.state === 'suspicious') {
        if(hears) { a.state = 'alerted'; a.sinceAlert = 0; event = 'alerted'; }
        else if(sees) {
            a.t += dt;
            if(a.t >= GUARD.SUSPICIOUS_SECONDS) { a.state = 'alerted'; a.sinceAlert = 0; event = 'alerted'; }
        } else {
            a.t -= dt * (GUARD.SUSPICIOUS_SECONDS / GUARD.FORGET_SECONDS);
            if(a.t <= 0) { a.state = 'idle'; a.t = 0; event = 'calmed'; }
        }
    } else if(a.state === 'alerted') {
        a.sinceAlert += dt;
    }
    if(event === 'alerted' && role.alarm) a.alarm = true;
    return event;
}

// Which of the group's men spawn now: all but the flank at first, the flank FLANK_DELAY seconds later. Returns indices not yet spawned.
export function dueMembers(a, group) {
    const role = roleOf(group.id);
    if(a.state !== 'alerted') return [];
    const all = group.enemies.map((_, i) => i);
    if(role.role !== 'flanker') return all;
    const first = all.filter(i => i < role.flankFrom);
    if(a.sinceAlert < GUARD.FLANK_DELAY) return first;
    return all;
}

// Groups whose alarm is ringing near (x, z).
export function alarmNear(awareness, groups, group) {
    return awareness.some(a => a.alarm && a.id !== group.id && (() => {
        const g = groups.find(x => x.id === a.id);
        return g && Math.hypot(g.x - group.x, g.z - group.z) <= GUARD.ALARM_RADIUS;
    })());
}

// Do alerted guards still follow him? Not once he has been hidden for LOSE_TRACK seconds.
export const losesTrack = hiddenFor => hiddenFor >= GUARD.LOSE_TRACK;
