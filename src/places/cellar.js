// The cellar under Mr. Grimsby's parlour as a place you step into (MINE_PLAN.md, slice 5): a small room with a hidden door in the wall that leads
// down to the Hollow Claim. The map is src/cellarLayout.js, the scene src/placeCellar.js. The stairs card that used to be on the parlour moved here.
// Built once per town screen by src/places/index.js.
import { createCellarScene } from '../placeCellar.js';
import { createTownWalk } from '../townWalk.js';
import { CELLAR_START, hiddenDoorOpen, cellarLabel } from '../cellarLayout.js';
import { startFloors, normalizeMineProgress } from '../mineProgress.js';
import { OUTLAWS } from '../outlaws.js';

const CELLAR_SKY = { top: '#070504', middle: '#0d0907', horizon: '#18110c' };
const DEACON = OUTLAWS.find(o => o.id === 'deacon-graves').name;

export function createCellarPlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null;

    const card = (title, body) => `<div class="town-card" data-building="wall"><div class="town-sign"><span>${title}</span></div>${body}</div>`;
    // The wall: shut until Deacon Graves has a star, then the way down (floor 1, or any checkpoint he has reached).
    function wallCard(profile) {
        if(!hiddenDoorOpen(profile)) {
            return card('A HOLLOW SEAM', `<p class="town-blurb">You run a hand along the cold stone. One seam rings hollow, but it will not give. Whatever is behind it is waiting for ${DEACON} to be put right first.</p>`);
        }
        const record = normalizeMineProgress(profile.mine);
        const buttons = startFloors(record).map(floor => `<button type="button" class="shop-action collect farm-crop" data-descend="${floor}">${floor === 1 ? 'FLOOR 1' : `FLOOR ${floor}`}<small>${floor === 1 ? 'from the top' : 'checkpoint'}</small></button>`).join('');
        return card('THE HIDDEN DOOR', `<p class="town-blurb">The seam gives. Behind it the old claim goes down into the dark. Your deepest floor is ${record.deepest}. Begin where you like: the lift always brings you back, and nothing down there gives stars or money.</p>`
            + `<div class="town-actions farm-actions">${buttons}</div>`);
    }
    function use(id) {
        if(id === 'up') return host.goTo('undertaker'); // back up the stairs into the parlour
        host.openBuilding(id);
    }

    return {
        id: 'cellar',
        sky: CELLAR_SKY,
        get scene3d() { return scene3d; },
        get walk() { return walk; },
        title: () => "MR. GRIMSBY'S CELLAR",
        entrance: () => false, // reached from the parlour's stairs (host.goTo), not from the town
        canEnter: () => !!host.profile(),
        ensure() {
            if(scene3d) return;
            scene3d = createCellarScene();
            walk = createTownWalk({ town3d: scene3d, host: host.screen, onOpen: use, blocked: () => host.isCardOpen(), start: CELLAR_START, describe: door => cellarLabel(door, host.profile()) });
        },
        arrive() { walk.place(CELLAR_START[0], CELLAR_START[1]); }, // every visit starts at the foot of the stairs
        resize: (w, h) => scene3d?.resize(w, h),
        card: id => (id === 'wall' && host.profile() ? wallCard(host.profile()) : ''),
        click(button) { // a floor on the hidden door's card
            if(!button.dataset.descend) return false;
            if(!host.profile() || !hiddenDoorOpen(host.profile())) return true; // a stale button can never open a shut door
            host.closeCard();
            host.onDescend(Number(button.dataset.descend));
            return true;
        }
    };
}
