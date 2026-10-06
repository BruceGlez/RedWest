// Hollow Hill as a place you step into (PLACES.md, section 10): the hill where the dusk vigil is played. The rules and the route replay are src/vigil.js (run for
// real by the wallet, here or on the server), the map src/hillLayout.js, the 3D scene src/placeHill.js. The player walks the hill and presses E at a lantern
// to light it and at the oil stand to fill the can; each step is checked with the rules' own `canStep`, and the steps are sent as the route. The bell's limit is
// a walking allowance (the seconds the route needs by the marshal's speed), not a clock, so nothing is rushed. Built once per town screen by src/places/index.js.
import { createHillScene } from '../placeHill.js';
import { createTownWalk } from '../townWalk.js';
import { HILL_ENTRY, hillLabel, chapelLines } from '../hillLayout.js';
import { PIECES, vigilOpen, tonight, canStep, runState, lightToNext, DOLLARS_PER_LANTERN, FULL_NIGHT_BONUS } from '../vigil.js';
import { getDistrict } from '../townDistricts.js';

const HILL_SKY = { top: '#0a0f1d', middle: '#16203a', horizon: '#3a2a3a' }; // dusk: the hill goes dark when the bell rings

export function createHillPlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null;
    let night = null; // tonight's hill, set when he comes in
    let order = []; // the steps so far: lantern ids and 'oil'
    let settling = false;

    const profile = () => host.profile();
    const setNight = () => { night = profile() ? tonight(profile(), new Date()) : null; order = []; sync(); };
    function sync() {
        if(!scene3d || !profile()) return;
        scene3d.setHill(night, runState(night ?? { lanterns: [], limit: 0 }, order).lit, profile().town.chapel.light, order.length > 0);
    }

    const card = (id, title, body, actions = '') => `<div class="town-card" data-building="${id}"><div class="town-sign"><span>${title}</span></div>${body}${actions ? `<div class="town-actions farm-actions">${actions}</div>` : ''}</div>`;
    function bellCard() {
        const p = profile();
        if(!p) return '';
        const chapel = p.town.chapel;
        const state = night ? runState(night, order) : { lit: [], left: 0 };
        const next = lightToNext(chapel.light);
        const pieces = chapelLines(chapel.light).map(l => `<span class="farm-chip${l.built ? '' : ' dim'}">${l.text}</span>`).join('');
        const counts = chapel.counted
            ? "Tonight's vigil has counted. Walking it again is practice: nothing is added and nothing is paid."
            : `The first vigil of the day counts: $${DOLLARS_PER_LANTERN} a lantern, $${FULL_NIGHT_BONUS} more for the whole hill, and each lantern is a little light for the chapel.`;
        const gated = night ? night.lanterns.filter(l => l.needs).length : 0;
        const dry = night ? night.lanterns.filter(l => l.dry).length : 0;
        const progress = order.length
            ? `<p class="town-stat">Lit ${state.lit.length} of ${night.lanterns.length}. The bell has ${Math.round(state.left)} seconds of walking left.</p>`
            : `<p class="town-stat">Tonight: ${night?.lanterns.length ?? 0} lanterns${gated ? `, ${gated} out of reach until another is lit` : ''}${dry ? `, ${dry} that need oil from the stand` : ''}. The bell gives ${Math.round(night?.limit ?? 0)} seconds of walking.</p>`;
        return card('bell', 'THE CHAPEL BELL',
            `<p class="town-blurb">The bell rings once at dusk for everyone the road took, and the hill goes dark. Light the lanterns before its echo fades. ${next ? `${next.name} needs ${next.need} more light.` : 'The chapel is built.'}</p>`
            + `<div class="farm-chips">${pieces}</div>${progress}<p class="town-stat">${counts}</p>`,
            order.length ? `<button type="button" class="shop-action collect" data-vigil-end>END THE VIGIL</button>` : '');
    }
    function hillCard(id) {
        if(!profile()) return '';
        if(id === 'bell') return bellCard();
        return '';
    }

    // Send the route to the wallet (it replays it, here or on the server) and say how it went.
    async function endVigil() {
        if(settling || !order.length) return false;
        settling = true;
        host.closeCard();
        const route = order.slice();
        try {
            const response = await host.wallet.vigil({ action: 'light', order: route });
            host.onProfile(response.profile);
            host.track('vigil_light');
            const r = response.result;
            const words = [`Lit ${r.lit} of ${r.of}.`];
            if(r.counted) words.push(`$${r.dollars} for the lamplighter.`);
            else if(r.lit) words.push('Practice: nothing counted today.');
            for(const piece of r.built) words.push(`${PIECES.find(p => p.id === piece).name} is built.`);
            host.toast(words.join(' '));
            order = [];
        } catch(error) {
            host.toast(error.message, true);
        } finally {
            settling = false;
            setNight();
        }
        return true;
    }

    // Walking up to something on the hill (src/townWalk.js, the hill's own instance).
    function use(id) {
        if(id === 'leave') {
            if(order.length) return endVigil().then(() => host.leave()); // a part of the night still counts: it is sent before he goes
            return host.leave();
        }
        if(id === 'bell') return host.openBuilding('bell');
        if(!night || settling) return;
        const state = runState(night, order);
        if(state.lit.includes(id)) return host.toast('That one is already lit.');
        const step = canStep(night, order, id);
        if(!step.ok) return host.toast(step.why, true);
        order.push(id);
        sync();
        const after = runState(night, order);
        if(id === 'oil') host.toast('The can is full.');
        else host.toast(`Lit. ${after.lit.length} of ${night.lanterns.length}.`);
        if(after.lit.length === night.lanterns.length) endVigil(); // the whole hill is lit: the vigil is over
    }

    return {
        id: 'chapel',
        sky: HILL_SKY,
        get scene3d() { return scene3d; },
        get walk() { return walk; },
        title: () => getDistrict('chapel').name,
        // The gate in the town, once Deacon Graves has been beaten (until then it is a shut gate that names him: src/townDistricts.js).
        entrance: spotId => spotId === 'enter-chapel',
        canEnter: () => !!getDistrict('chapel')?.interior && !!profile() && vigilOpen(profile()),
        ensure() {
            if(scene3d) return;
            scene3d = createHillScene();
            walk = createTownWalk({ town3d: scene3d, host: host.screen, onOpen: use, blocked: () => host.isCardOpen(), start: HILL_ENTRY, describe: door => hillLabel(door, night, order) });
        },
        use, // what the walk does at a door (also what the tests call)
        prepare() { setNight(); },
        sync,
        arrive() { setNight(); walk.place(HILL_ENTRY[0], HILL_ENTRY[1]); }, // every visit starts at the gate, with tonight's hill dark
        entered() { host.markVisited('chapel'); },
        resize: (w, h) => scene3d?.resize(w, h),
        card: hillCard,
        click(button) { // END THE VIGIL on the bell's card
            if(!button.hasAttribute('data-vigil-end')) return false;
            endVigil();
            return true;
        }
    };
}
