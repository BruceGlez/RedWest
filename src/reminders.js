import { jailStored, jailCapacity, hoursUntilFull } from './town.js';

// "Your jail is full" reminders (GROWTH_PLAN.md, Phase 1.3). iPhone/Android app only, scheduled on the
// device (no push server). Asked for after the player's first jail collect, never at launch.
// At most one a day, never at night, never about offers or purchases (App Store guideline 4.5.4).

const KEY = 'redWestReminders.v1';
const REMINDER_ID = 1;
const MIN_GAP_HOURS = 20; // at most one a day
const QUIET_FROM = 21; // no reminders from 9 pm...
const QUIET_UNTIL = 9; // ...until 9 am, local time
const HOUR = 3600000;

// When to remind: when the jail is full, but not within a day of the last reminder and not at night.
export function reminderTime({ fullAt, lastAt = null, now }) {
    let at = Math.max(fullAt.getTime(), now.getTime() + 60000);
    if(lastAt && lastAt.getTime() <= now.getTime()) at = Math.max(at, lastAt.getTime() + MIN_GAP_HOURS * HOUR);
    const time = new Date(at);
    if(time.getHours() >= QUIET_FROM) {
        time.setDate(time.getDate() + 1);
        time.setHours(QUIET_UNTIL, 0, 0, 0);
    } else if(time.getHours() < QUIET_UNTIL) {
        time.setHours(QUIET_UNTIL, 0, 0, 0);
    }
    return time;
}

// The native plugin, only inside the app. (Browser tests can provide a stand-in as
// window.__redWestNotifications.)
function plugin() {
    if(typeof window === 'undefined') return null;
    if(window.__redWestNotifications) return window.__redWestNotifications;
    return window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.LocalNotifications ?? null : null;
}

function load() {
    try {
        return { asked: false, enabled: false, lastAt: null, ...JSON.parse(localStorage.getItem(KEY)) };
    } catch {
        return { asked: false, enabled: false, lastAt: null };
    }
}

function save(state) {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // Storage blocked: reminders just stay off.
    }
}

export const remindersSupported = () => !!plugin();
export const remindersEnabled = () => remindersSupported() && load().enabled;
export const remindersAsked = () => load().asked;

// Asks the system for permission. Returns whether reminders are now on.
export async function enableReminders() {
    const notifications = plugin();
    if(!notifications) return false;
    const state = load();
    state.asked = true;
    try {
        const result = await notifications.requestPermissions();
        state.enabled = result?.display === 'granted';
    } catch {
        state.enabled = false;
    }
    save(state);
    return state.enabled;
}

export async function disableReminders(markAsked = true) {
    const state = load();
    state.enabled = false;
    if(markAsked) state.asked = true;
    save(state);
    try {
        await plugin()?.cancel({ notifications: [{ id: REMINDER_ID }] });
    } catch {
        // Nothing scheduled.
    }
}

// Re-plans the reminder for this profile (called whenever the jail changes or the app is left).
export async function updateJailReminder(profile, now = new Date()) {
    const notifications = plugin();
    const state = load();
    if(!notifications || !state.enabled || !profile?.town) return null;
    try {
        await notifications.cancel({ notifications: [{ id: REMINDER_ID }] });
        const capacity = jailCapacity(profile);
        if(!capacity) return null;
        // Already full while the player is here: remind a few hours later rather than at once.
        const full = jailStored(profile, now) >= capacity;
        const fullAt = new Date(now.getTime() + (full ? 3 : hoursUntilFull(profile, now)) * HOUR);
        const at = reminderTime({ fullAt, lastAt: state.lastAt ? new Date(state.lastAt) : null, now });
        await notifications.schedule({
            notifications: [{
                id: REMINDER_ID,
                title: 'Your jail is full',
                body: `$${capacity.toLocaleString()} in bounties is waiting to be collected in Frontier Town.`,
                schedule: { at, allowWhileIdle: true }
            }]
        });
        state.lastAt = at.toISOString();
        save(state);
        return at;
    } catch {
        return null; // reminders are a convenience; never let them break the game
    }
}
