// Copper Bit as a place you step into (PLACES.md, section 8): Dusty Pete's saloon. The rules are src/saloon.js, the map src/saloonLayout.js, the
// 3D scene src/placeSaloon.js. This piece is the place and the bar's card, which shows the nights, the menu and the paid shifts left. The shift
// itself (the serve-the-customers game) and the call that settles it come next, once the server route and the wallet method exist.
// Built once per town screen by src/places/index.js.
import { createSaloonScene } from '../placeSaloon.js';
import { DAY_SKY } from '../townLook.js';
import { createTownWalk } from '../townWalk.js';
import { farmOpen } from '../farm.js';
import { NIGHTS, PAID_SHIFTS_PER_DAY, saloonOpen, menu, nightsOpen, paidShiftsLeft } from '../saloon.js';
import { SALOON_START, saloonLabel } from '../saloonLayout.js';
import { getDistrict } from '../townDistricts.js';
import { OUTLAWS } from '../outlaws.js';

const PETE = OUTLAWS.find(o => o.id === 'dusty-pete').name;

export function createSaloonPlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null;

    const card = (id, title, body) => `<div class="town-card" data-building="${id}"><div class="town-sign"><span>${title}</span></div>${body}</div>`;
    function barCard(profile) {
        if(!saloonOpen(profile)) return card('bar', "DUSTY PETE'S BAR", `<p class="town-blurb">The saloon is shut until ${PETE} is beaten.</p>`);
        const now = new Date();
        const night = nightsOpen(profile);
        const stars = profile.town.saloon.nights;
        const dishes = menu(night, farmOpen(profile)).map(d => `<span class="farm-chip">${d.name} <b>$${d.price}</b></span>`).join('');
        const nights = stars.slice(0, night).map((s, i) => `<span class="farm-chip">NIGHT ${i + 1} <b>${'*'.repeat(s) || '-'}</b></span>`).join('');
        const left = paidShiftsLeft(profile, now);
        const note = left ? `${left} of ${PAID_SHIFTS_PER_DAY} paid shifts left today. After that a shift is free practice for stars.` : 'Today\'s paid shifts are done. A shift now is free practice for stars; the wages start again tomorrow.';
        return card('bar', "DUSTY PETE'S BAR", `<p class="town-blurb">Pete wipes the bar. &ldquo;Busy night ahead. Mind the tips.&rdquo;</p><p class="town-stat">Tonight is night ${night} of ${NIGHTS}. ${note}</p>`
            + `<div class="farm-chips">${nights}</div><p class="town-stat">On the menu</p><div class="farm-chips">${dishes}</div>`
            + `<p class="town-stat">The shift itself is coming soon: Pete is still hiring.</p>`);
    }
    function saloonCard(id) {
        const profile = host.profile();
        if(!profile) return '';
        switch(id) {
            case 'bar': return barCard(profile);
            case 'piano': return card('piano', 'THE BROKEN PIANO', "<p class=\"town-blurb\">Dusty Pete runs the bar, and the broken piano stays broken: he says the sour notes keep the tune honest. The first drink of the day is on the house.</p>");
            default: return '';
        }
    }
    function use(id) {
        if(id === 'leave') return host.leave();
        host.openBuilding(id);
    }

    return {
        id: 'copper',
        sky: DAY_SKY,
        get scene3d() { return scene3d; },
        get walk() { return walk; },
        title: () => getDistrict('copper').name,
        // The gate in the town, once Dusty Pete has been beaten (until then it is a shut gate that names him: src/townDistricts.js).
        entrance: spotId => spotId === 'enter-copper',
        canEnter: () => !!getDistrict('copper')?.interior && !!host.profile() && saloonOpen(host.profile()),
        ensure() {
            if(scene3d) return;
            scene3d = createSaloonScene();
            walk = createTownWalk({ town3d: scene3d, host: host.screen, onOpen: use, blocked: () => host.isCardOpen(), start: SALOON_START, describe: door => saloonLabel(door, host.profile(), new Date()) });
        },
        arrive() { walk.place(SALOON_START[0], SALOON_START[1]); },
        entered() { host.markVisited('copper'); },
        resize: (w, h) => scene3d?.resize(w, h),
        card: saloonCard,
        click: () => false
    };
}
