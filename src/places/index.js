// Every place, registered once. To add a place: write src/places/<name>.js exporting createXPlace(host) (the shape is in
// registry.js) and register it here.
import { registerPlace } from './registry.js';
import { createFarmPlace } from './farm.js';
import { createUndertakerPlace } from './undertaker.js';
import { createCellarPlace } from './cellar.js';
import { createStorePlace } from './store.js';
import { createVanePlace } from './vane.js';
import { createChannelPlace } from './channel.js';
import { createSaloonPlace } from './saloon.js';
import { createHillPlace } from './hill.js';

registerPlace(createFarmPlace);
registerPlace(createUndertakerPlace);
registerPlace(createCellarPlace);
registerPlace(createStorePlace);
registerPlace(createVanePlace);
registerPlace(createChannelPlace);
registerPlace(createSaloonPlace);
registerPlace(createHillPlace);

export { createPlaces } from './registry.js';
