import { FINAL_PURSUIT } from './bounty.js';

// Playtest run log (REFACTOR_PLAN.md Stage 1 gate). One record per finished run, kept in this
// browser so an observer can copy the rows into a sheet after each tester.
const RUN_LOG_KEY = 'redWestRunLog.v1';
const MAX_RUNS = 200;

export const RUN_LOG_COLUMNS = [
    'endedAt', 'sessionRun', 'result', 'pursuitReached', 'peakHeat', 'bountyChoice', 'heatAtOutlaw',
    'bountyAmount', 'score', 'seconds', 'shotsFired', 'accuracy', 'kills', 'damageTaken'
];

const CHOICE_BY_STATUS = { none: '', offered: '', banked: 'bank', riding: 'ride on', escaped: 'ride on', forfeited: 'ride on' };

export function buildRunRecord(gameState, result, sessionRun, endedAt = new Date()) {
    const s = gameState.runStats;
    const bounty = gameState.bounty;
    const outlawFell = bounty.status !== 'none';
    return {
        endedAt: endedAt.toISOString(),
        sessionRun,
        result,
        pursuitReached: s.waveReached > FINAL_PURSUIT ? 'bonus' : s.waveReached,
        peakHeat: gameState.heat.peak,
        bountyChoice: CHOICE_BY_STATUS[bounty.status] ?? '',
        heatAtOutlaw: outlawFell ? bounty.heatAtOffer : '',
        bountyAmount: outlawFell ? bounty.amount : '',
        score: gameState.score,
        seconds: Math.round(gameState.runTime),
        shotsFired: s.shotsFired,
        accuracy: s.shotsFired > 0 ? Math.round((s.shotsHit / s.shotsFired) * 100) : 0,
        kills: s.enemiesKilled,
        damageTaken: s.damageTaken
    };
}

// Tab-separated so the rows paste straight into a spreadsheet.
export function formatRunLog(records) {
    const rows = records.map(record => RUN_LOG_COLUMNS.map(column => record[column] ?? '').join('\t'));
    return [RUN_LOG_COLUMNS.join('\t'), ...rows].join('\n');
}

export function loadRunLog(storage = globalThis.localStorage) {
    try {
        const parsed = JSON.parse(storage.getItem(RUN_LOG_KEY));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function appendRunRecord(record, storage = globalThis.localStorage) {
    const records = [...loadRunLog(storage), record].slice(-MAX_RUNS);
    try {
        storage.setItem(RUN_LOG_KEY, JSON.stringify(records));
    } catch {
        // Storage full or blocked: keep playing; the log is a playtest aid only.
    }
    return records;
}

export function clearRunLog(storage = globalThis.localStorage) {
    try {
        storage.removeItem(RUN_LOG_KEY);
    } catch {
        // Nothing to clear.
    }
}
