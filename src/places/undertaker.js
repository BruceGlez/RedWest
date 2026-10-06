// Mr. Grimsby's parlour as a place you step into: the cellar stairs behind his coffins lead to the Hollow Claim (MINE_PLAN.md).
// The map and what he says are src/undertakerLayout.js, the scene is src/placeUndertaker.js. Built once per town screen by src/places/index.js.
import { createUndertakerScene } from '../placeUndertaker.js';
import { createTownWalk } from '../townWalk.js';
import { parlourLabel, grimsbyLine, PARLOUR_START } from '../undertakerLayout.js';
import { startFloors, normalizeMineProgress } from '../mineProgress.js';

const PARLOUR_SKY = { top: '#0c0807', middle: '#150e0b', horizon: '#241912' };

export function createUndertakerPlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null;

    // The stairs: with no checkpoint yet they go straight down to floor 1. Once he has reached one, a card offers the floors he may begin on.
    function stairsCard() {
        const record = normalizeMineProgress(host.profile()?.mine);
        const buttons = startFloors(record).map(floor => `<button type="button" class="shop-action collect farm-crop" data-descend="${floor}">${floor === 1 ? 'FLOOR 1' : `FLOOR ${floor}`}<small>${floor === 1 ? 'from the top' : 'checkpoint'}</small></button>`).join('');
        return `<div class="town-card" data-building="cellar"><div class="town-sign"><span>THE HOLLOW CLAIM</span></div>`
            + `<p class="town-blurb">Your deepest floor is ${record.deepest}. Begin where you like: the lift always brings you back, and nothing down there gives stars or money.</p>`
            + `<div class="town-actions farm-actions">${buttons}</div></div>`;
    }
    function card(id) {
        if(id === 'cellar') return stairsCard();
        if(id !== 'grimsby') return '';
        const progress = host.progress();
        const beaten = progress ? progress.stars.filter(mask => (mask & 1) !== 0).length : 0;
        return `<div class="town-card" data-building="grimsby"><div class="town-sign"><span>MR. GRIMSBY</span></div>`
            + `<p class="town-blurb">&ldquo;${grimsbyLine(beaten)}&rdquo;</p>`
            + `<p class="town-stat">The cellar stairs are behind the coffins: the Hollow Claim, a mine with no bottom: every floor is bigger than the last, and stranger. The way down is always open and the lift always brings you back. Your deepest floor and the ore you ride up with are kept.</p></div>`;
    }
    // Walking up to something in the parlour (src/townWalk.js, the parlour's own instance).
    function use(id) {
        if(id === 'leave') return host.leave();
        if(id === 'cellar') return startFloors(normalizeMineProgress(host.profile()?.mine)).length > 1 ? host.openBuilding('cellar') : host.onDescend(1); // the stairs (src/mine.js)
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
        click(button) { // a floor on the stairs card
            if(!button.dataset.descend) return false;
            host.closeCard();
            host.onDescend(Number(button.dataset.descend));
            return true;
        }
    };
}
