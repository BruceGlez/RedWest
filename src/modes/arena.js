// The Boss Arena as a run mode (rules in src/arena.js; it is a place in Frontier Town, src/townPanel.js).
import { FINAL_PURSUIT } from '../bounty.js';
import { getOutlaw } from '../outlaws.js';
import { arena, endTownFight } from '../arena.js';

export const arenaMode = {
    id: 'arena',
    isActive: () => arena.enabled,
    practice: { note: undefined },
    usesEvent: false,
    previewOutlaw: () => arena.outlaw,
    runOutlaw: () => arena.outlaw,
    atmosphereId: outlawIndex => getOutlaw(outlawIndex).id,
    begin: ctx => ctx.beginWave(FINAL_PURSUIT), // straight to the outlaw
    reinforcements: () => arena.gang, // just the outlaw, and anyone they call in
    invincible: () => arena.invincible,
    afterOutlawDown: ctx => ctx.finishRun('arena-win'),
    reset: () => { endTownFight(); } // a fight started from the town's Arena is over
};
