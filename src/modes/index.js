// Every run mode, registered once. Import this file once (src/gameLoop.js does) and ask src/modes/registry.js for the active mode.
// To add a mode: write src/modes/<name>.js exporting a mode object (hooks are listed in registry.js) and register it here.
import { registerMode } from './registry.js';
import { arenaMode } from './arena.js';
import { mineMode } from './mine.js';

registerMode(arenaMode);
registerMode(mineMode);

export { activeMode, registeredModes, resetModes } from './registry.js';
