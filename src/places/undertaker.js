// Mr. Grimsby's parlour as a place you step into: the cellar stairs behind his coffins lead to the Hollow Claim (MINE_PLAN.md).
// The map and what he says are src/undertakerLayout.js, the scene is src/placeUndertaker.js. Built once per town screen by src/places/index.js.
import { createUndertakerScene } from '../placeUndertaker.js';
import { createTownWalk } from '../townWalk.js';
import { parlourLabel, grimsbyLine, PARLOUR_START } from '../undertakerLayout.js';
import { lightShopHtml, lightBuyer } from '../lightShop.js';

const PARLOUR_SKY = { top: '#0c0807', middle: '#150e0b', horizon: '#241912' };

export function createUndertakerPlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null;

    function card(id) {
        if(id !== 'grimsby') return '';
        const progress = host.progress();
        const beaten = progress ? progress.stars.filter(mask => (mask & 1) !== 0).length : 0;
        return `<div class="town-card" data-building="grimsby"><div class="town-sign"><span>MR. GRIMSBY</span></div>`
            + `<p class="town-blurb">&ldquo;${grimsbyLine(beaten)}&rdquo;</p>`
            + `<p class="town-stat">The cellar stairs are behind the coffins: the Hollow Claim, a mine with no bottom: every floor is bigger than the last, and stranger. The way down is always open and the lift always brings you back. Your deepest floor and the ore you ride up with are kept.</p>${host.profile() ? lightShopHtml(host.profile(), 'grimsby') : ''}</div>`;
    }
    const buy = lightBuyer(host); // the BUY buttons on Mr. Grimsby's card (src/lightShop.js)
    // Walking up to something in the parlour (src/townWalk.js, the parlour's own instance).
    function use(id) {
        if(id === 'leave') return host.leave();
        if(id === 'cellar') return host.goTo('cellar'); // the stairs down to the cellar (src/places/cellar.js), where the way to the mine is a hidden door
        host.openBuilding(id);
    }

    return {
        id: 'undertaker',
        sky: PARLOUR_SKY,
        get scene3d() { return scene3d; },
        get walk() { return walk; },
        title: () => "MR. GRIMSBY'S PARLOUR",
        entrance: spotId => spotId === 'undertaker', // the undertaker's door in the town
        canEnter: () => !!host.profile(),
        ensure() {
            if(scene3d) return;
            scene3d = createUndertakerScene();
            walk = createTownWalk({ town3d: scene3d, host: host.screen, onOpen: use, blocked: () => host.isCardOpen(), start: PARLOUR_START, describe: parlourLabel });
        },
        arrive() { walk.place(PARLOUR_START[0], PARLOUR_START[1]); }, // every visit starts inside the door, not on the exit prompt
        resize: (w, h) => scene3d?.resize(w, h),
        card,
        click: buy // the BUY buttons of the light shop on Mr. Grimsby's card: true when the click was the shop's
    };
}
