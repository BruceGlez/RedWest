// The general store as a place you step into (MINE_PLAN.md, slice 5): the second shop that sells light, at a little more than Mr. Grimsby's, in Bounty Dollars
// only. The map is src/storeLayout.js, the scene src/placeStore.js, the shop card src/lightShop.js (shared with Mr. Grimsby's). The door is a spot on the
// town's street (src/townSpots.js). Built once per town screen by src/places/index.js.
import { createStoreScene } from '../placeStore.js';
import { createTownWalk } from '../townWalk.js';
import { STORE_START, KEEPER_NAME, KEEPER_LINE, storeLabel } from '../storeLayout.js';
import { lightShopHtml, lightBuyer } from '../lightShop.js';

const STORE_SKY = { top: '#1a1410', middle: '#2b2118', horizon: '#3a2d20' };

export function createStorePlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null;
    const buy = lightBuyer(host);

    function card(id) {
        if(id !== 'counter' || !host.profile()) return '';
        return `<div class="town-card" data-building="counter"><div class="town-sign"><span>THE GENERAL STORE</span></div>`
            + `<p class="town-blurb">${KEEPER_NAME}: &ldquo;${KEEPER_LINE}&rdquo;</p>${lightShopHtml(host.profile(), 'store')}</div>`;
    }
    function use(id) {
        if(id === 'leave') return host.leave();
        host.openBuilding(id);
    }

    return {
        id: 'store',
        sky: STORE_SKY,
        get scene3d() { return scene3d; },
        get walk() { return walk; },
        title: () => 'THE GENERAL STORE',
        entrance: spotId => spotId === 'store', // the store's door in the town (src/townSpots.js)
        canEnter: () => !!host.profile(),
        ensure() {
            if(scene3d) return;
            scene3d = createStoreScene();
            walk = createTownWalk({ town3d: scene3d, host: host.screen, onOpen: use, blocked: () => host.isCardOpen(), start: STORE_START, describe: storeLabel });
        },
        arrive() { walk.place(STORE_START[0], STORE_START[1]); }, // every visit starts inside the door, not on the exit prompt
        resize: (w, h) => scene3d?.resize(w, h),
        card,
        click: buy // the BUY buttons on the counter's card: true when the click was the shop's
    };
}
