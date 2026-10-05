// Vane's Crossing as a place you step into (PLACES.md, section 4): the Township order board. The rules are src/farmOrders.js (also run by
// the server through wallet.orders), the map src/vaneLayout.js, the 3D scene src/placeVane.js. Everything it needs from the town screen
// comes through `host` (src/places/registry.js lists it). Built once per town screen by src/places/index.js.
import { createVaneScene } from '../placeVane.js';
import { DAY_SKY } from '../townLook.js';
import { createTownWalk } from '../townWalk.js';
import { GOODS } from '../farm.js';
import { openOrders, ordersWaiting, crossingOpen, orderGoods, ORDER_OUTLAW } from '../farmOrders.js';
import { VANE_START, vaneLabel } from '../vaneLayout.js';
import { getDistrict } from '../townDistricts.js';
import { OUTLAWS } from '../outlaws.js';

const goodName = id => GOODS.find(g => g.id === id)?.name ?? id;

export function createVanePlace(host) {
    let scene3d = null; // built the first time you go in
    let walk = null;

    const card = (id, title, body, actions = '') => `<div class="town-card" data-building="${id}"><div class="town-sign"><span>${title}</span></div>${body}${actions ? `<div class="town-actions farm-actions">${actions}</div>` : ''}</div>`;
    function boardCard(profile) {
        if(!crossingOpen(profile)) return card('board', 'THE ORDER BOARD', `<p class="town-blurb">The Crossing is shut until ${OUTLAWS.find(o => o.id === ORDER_OUTLAW).name} is beaten.</p>`);
        const store = profile.town.farm.store;
        const orders = openOrders(profile);
        if(!orders.length) {
            const why = orderGoods(profile).length ? 'Today\'s orders are all filled. The wagon train brings three more tomorrow.' : 'The wagons carry nothing yet: orders ask only for goods from places that are open.';
            return card('board', 'THE ORDER BOARD', `<p class="town-blurb">${why}</p>`);
        }
        const rows = orders.map(o => {
            const can = o.wants.every(w => (store[w.good] | 0) >= w.count);
            const wants = o.wants.map(w => `${goodName(w.good)} x ${w.count}${(store[w.good] | 0) < w.count ? ` <small>(barn: ${store[w.good] | 0})</small>` : ''}`).join(', ');
            return `<div class="farm-row"><span>${wants}${o.waiting ? ' <small>(from yesterday)</small>' : ''}</span><span>$${o.pays}</span>`
                + `<button type="button" class="shop-action upgrade" data-order="${o.id}"${can ? '' : ' disabled'}>FILL</button></div>`;
        }).join('');
        return card('board', 'THE ORDER BOARD', `<p class="town-blurb">The wagon train brings three orders a day. Fill them from the barn. An order left unfilled waits one more day, then is replaced.</p>${rows}`);
    }
    function vaneCard(id) {
        const profile = host.profile();
        if(!profile) return '';
        switch(id) {
            case 'board': return boardCard(profile);
            case 'wagon': return card('wagon', 'THE WAGON TRAIN', `<p class="town-blurb">The Crossing is open again, and wagons use it. Each day the wagon train leaves three orders on the board.</p><p class="town-stat">${ordersWaiting(profile)} waiting for you.</p>`);
            case 'clock': return card('clock', 'THE STOPPED CLOCK', `<p class="town-blurb">Silas Vane left the clock on the tower stopped at the hour the Company paid him to close the road. He says it should stay stopped, so that nobody forgets what the road cost.</p>`);
            default: return '';
        }
    }
    // Something the board does for real: the wallet runs the rules (src/farmOrders.js), here or on the server.
    function ordersDo(body, wording) {
        host.closeCard();
        return host.act(async () => {
            const result = await host.wallet.orders(body);
            host.onProfile(result.profile);
            host.track(`orders_${body.action}`);
            if(wording) host.toast(wording(result.result));
        }, text => host.toast(text, true));
    }
    function use(id) {
        if(id === 'leave') return host.leave();
        host.openBuilding(id);
    }

    return {
        id: 'crossing',
        sky: DAY_SKY,
        get scene3d() { return scene3d; },
        get walk() { return walk; },
        title: () => getDistrict('crossing').name,
        // The gate in the town, once Silas Vane has been beaten (until then it is a shut gate that names him: src/townDistricts.js).
        entrance: spotId => spotId === 'enter-crossing',
        canEnter: () => !!getDistrict('crossing')?.interior && !!host.profile() && crossingOpen(host.profile()),
        ensure() {
            if(scene3d) return;
            scene3d = createVaneScene();
            walk = createTownWalk({ town3d: scene3d, host: host.screen, onOpen: use, blocked: () => host.isCardOpen(), start: VANE_START, describe: door => vaneLabel(door, host.profile(), new Date()) });
        },
        sync() { scene3d?.setOrders(ordersWaiting(host.profile(), new Date())); },
        prepare() { this.sync(); },
        arrive() { walk.place(VANE_START[0], VANE_START[1]); }, // every visit starts inside the gate, not on the exit prompt
        // The first visit starts the player's days (src/farmOrders.js, visitBoard); after that it changes nothing.
        entered() {
            host.markVisited('crossing');
            if(host.profile()?.town.orders?.since == null) ordersDo({ action: 'visit' });
        },
        resize: (w, h) => scene3d?.resize(w, h),
        card: vaneCard,
        // The FILL buttons on the board. Returns true when the click was the Crossing's.
        click(button) {
            if(!button.dataset.order) return false;
            ordersDo({ action: 'fill', order: button.dataset.order }, r => `Order filled for $${r.dollars}.`);
            return true;
        }
    };
}
