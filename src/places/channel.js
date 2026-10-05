// Morgan's Channel as a place you step into (PLACES.md, section 3): the channel waters Calloway Farm. The rules are src/farmWater.js (run
// by the server too, through the farm's own actions), the map src/channelLayout.js, the 3D scene src/placeChannel.js. The Channel changes
// nothing in the profile, so it has no wallet call: it only reads. Built once per town screen by src/places/index.js.
import { createChannelScene } from '../placeChannel.js';
import { DAY_SKY } from '../townLook.js';
import { createTownWalk } from '../townWalk.js';
import { CROPS, farmOpen, farmWatered, minutesText } from '../farm.js';
import { channelOpen, growMinutes, WATER_FACTOR } from '../farmWater.js';
import { CHANNEL_START, channelLabel } from '../channelLayout.js';
import { getDistrict } from '../townDistricts.js';

export function createChannelPlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null;

    const card = (id, title, body) => `<div class="town-card" data-building="${id}"><div class="town-sign"><span>${title}</span></div>${body}</div>`;
    function sluiceCard(profile) {
        const percent = Math.round((1 - WATER_FACTOR) * 100);
        if(!farmOpen(profile)) return card('sluice', 'THE SLUICE', `<p class="town-blurb">The channel runs full and the sluice is open. The ditch it feeds belongs to Calloway Farm, which is still shut: beat the Calloways and the water has somewhere to go.</p>`);
        const times = CROPS.map(c => `<span class="farm-chip">${c.name} <b>${minutesText(growMinutes(c, true))}</b></span>`).join('');
        return card('sluice', 'THE SLUICE', `<p class="town-blurb">The sluice is open and the channel waters Calloway Farm. Crops grow ${percent}% sooner while both are open. Nothing else changes, and nothing is bought: the water is simply there.</p><div class="farm-chips">${times}</div>`);
    }
    function channelCard(id) {
        const profile = host.profile();
        if(!profile) return '';
        switch(id) {
            case 'sluice': return sluiceCard(profile);
            case 'log': return card('log', 'THE WAREHOUSE LOG', "<p class=\"town-blurb\">The dry channel from Redstone Mesa runs here now, with water in it, and a fire crew keeps its buckets by the bridge. The log at the warehouse door has one rule, in Morgan's hand: no blasting after dark.</p>");
            default: return '';
        }
    }
    function use(id) {
        if(id === 'leave') return host.leave();
        host.openBuilding(id);
    }

    return {
        id: 'canal',
        sky: DAY_SKY,
        get scene3d() { return scene3d; },
        get walk() { return walk; },
        title: () => getDistrict('canal').name,
        // The gate in the town, once Mad Mesa Morgan has been beaten (until then it is a shut gate that names him: src/townDistricts.js).
        entrance: spotId => spotId === 'enter-canal',
        canEnter: () => !!getDistrict('canal')?.interior && !!host.profile() && channelOpen(host.profile()),
        ensure() {
            if(scene3d) return;
            scene3d = createChannelScene();
            walk = createTownWalk({ town3d: scene3d, host: host.screen, onOpen: use, blocked: () => host.isCardOpen(), start: CHANNEL_START, describe: door => channelLabel(door, host.profile()) });
        },
        sync() { scene3d?.setWatering(farmWatered(host.profile())); },
        prepare() { this.sync(); },
        arrive() { walk.place(CHANNEL_START[0], CHANNEL_START[1]); },
        entered() { host.markVisited('canal'); },
        resize: (w, h) => scene3d?.resize(w, h),
        card: channelCard,
        click: () => false
    };
}
