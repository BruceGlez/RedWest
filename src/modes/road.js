// The Wanted Road: the default mode, and the source of every default hook (see src/modes/registry.js).
import { FINAL_PURSUIT } from '../bounty.js';
import { getOutlaw } from '../outlaws.js';

export const road = {
    id: 'road',
    isActive: () => true,
    practice: null,
    usesEvent: true,
    lengthensPursuit: true,
    hud: {
        waveLabel: 'PURSUIT:',
        wave: gameState => (gameState.waveNumber > FINAL_PURSUIT ? 'BONUS' : gameState.waveNumber),
        timer: () => null,
        status: () => null
    },
    previewOutlaw: progress => progress.selected,
    runOutlaw: ({ event, progress }) => (event ? event.outlaw : progress.selected),
    atmosphereId: outlawIndex => getOutlaw(outlawIndex).id,
    previewScene: () => {},
    begin: ctx => ctx.beginWave(1),
    update: (ctx, dt) => ctx.updateWaveFlow(dt),
    updateScene: () => {},
    reinforcements: () => true,
    invincible: () => false,
    afterOutlawDown: ctx => ctx.openBountyChoice(),
    resultText: () => null,
    reset: () => {}
};
