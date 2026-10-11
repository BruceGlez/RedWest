// How much sand lies under the stage. A big area (src/stages/) asks for more than the usual 300; src/world.js owns the ground and registers
// how to resize it. Kept apart so run modes can ask without loading the whole renderer (and so node tests can import them).
let resize = null;
export function registerGround(fn) { resize = fn; }
export function setGroundSize(size = 300) { resize?.(size); }
