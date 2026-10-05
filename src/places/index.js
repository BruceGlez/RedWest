// Every place, registered once. To add a place: write src/places/<name>.js exporting createXPlace(host) (the shape is in
// registry.js) and register it here.
import { registerPlace } from './registry.js';
import { createFarmPlace } from './farm.js';
import { createUndertakerPlace } from './undertaker.js';

registerPlace(createFarmPlace);
registerPlace(createUndertakerPlace);

export { createPlaces } from './registry.js';
