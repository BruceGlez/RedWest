// Run modes (the Wanted Road, the Arena, the Hollow Claim, and whatever comes next). A mode is one object that says how a run
// differs from the Wanted Road: its HUD words, its look, how it starts, what it does each frame and how it ends. src/gameLoop.js and
// src/uiManager.js ask `activeMode()` instead of testing `arena.enabled` or `mine.enabled`, so a new mode is one new file in src/modes/
// plus a line in src/modes/index.js, with no edits to the shared files. See docs/lanes/ and AGENTS.md.
//
// Every hook is optional except `id` and `isActive`; the Wanted Road (src/modes/road.js) supplies the default for anything left out.
//
//   id                      'road', 'arena', 'mine', ...
//   isActive()              is the run being started or played one of these?
//   practice                null, or { note } for a mode that records nothing (stars, run log, earnings): the result screen says so
//   usesEvent               true when the weekly Most Wanted event may apply to a run in this mode
//   lengthensPursuit        true when a hot streak adds to the pursuit's budget
//   hud                     { waveLabel, wave(gameState), timer(gameState) -> text | null, status() -> text | null }
//   previewOutlaw(progress) which outlaw's look the desert behind the start screen wears
//   runOutlaw({ event, progress })  the outlaw index a run starts against
//   atmosphereId(outlawIndex)       the look (src/atmosphere.js) a run wears
//   previewScene(ctx)       draw this mode's scene behind the start screen (the mine's cave)
//   begin(ctx)              the run starts
//   update(ctx, dt)         the mode's flow, once a frame while fighting
//   updateScene(ctx, t)     the mode's own scenery, once a frame while fighting
//   reinforcements()        false to stop the director sending anyone but what the mode spawns itself
//   invincible()            true to refill the hearts every frame
//   afterOutlawDown(ctx)    the outlaw has fallen and the slow-motion beat is over
//   resultText(result)      [title, detail] for the result screen, or null for the default wording
//   reset()                 the run is over and the home screen is back: forget this mode's run state
//
// `ctx` is the small set of things src/gameLoop.js lends a mode: { scene, camera, playerSystem, ui, cameraOffset, spawn, finishRun,
// beginWave, updateWaveFlow, openBountyChoice }.
import { road } from './road.js';

const modes = [];

// Later registrations win ties, and the Wanted Road is the fallback, so a special mode never needs to know about the others.
export function registerMode(mode) {
    if(!mode || typeof mode.id !== 'string' || typeof mode.isActive !== 'function') throw new Error('A mode needs an id and isActive()');
    if(modes.some(existing => existing.id === mode.id)) throw new Error(`Mode "${mode.id}" is already registered`);
    modes.unshift(mode);
}

// The mode of the run being started or played, with every missing hook filled in from the Wanted Road.
export function activeMode() {
    const mode = modes.find(candidate => candidate.isActive());
    return mode ? { ...road, ...mode, hud: { ...road.hud, ...mode.hud } } : road;
}

export function registeredModes() { return [road, ...modes.slice().reverse()]; }

export function resetModes() { for(const mode of modes) mode.reset?.(); }

// For tests: forget every registered mode.
export function clearModes() { modes.length = 0; }
