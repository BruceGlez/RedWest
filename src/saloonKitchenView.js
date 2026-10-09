import * as THREE from 'three';
import { createSaloonFloor } from './saloonFloor.js';
import { SPOTS, SEAT_SPOTS } from './saloonKitchenLayout.js';
import { crowd } from './saloon.js';
import { HARD_STOP } from './saloonShift.js';

// A self-contained 3D shift overlay. All gameplay and payouts remain in saloonFloor/saloon.
export function openKitchenShift(host, { night, farm, upgrades, seed = Date.now() % 100000, finish, onClose, onAgain }) {
    const game = createSaloonFloor({ night, farm, upgrades, seed });
    const layer = document.createElement('div');
    layer.className = 'saloon-shift';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', `Copper Bit walking kitchen, night ${night}`);
    layer.style.cssText = 'position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;background:#21170f;color:#fff;';
    layer.innerHTML = `<div class="saloon-head" style="display:flex;gap:12px;align-items:center;justify-content:space-around;flex-wrap:wrap"><b>NIGHT ${night} · WALKING KITCHEN</b><span data-clock></span><span data-score></span><button type="button" class="shop-action" data-quit>CLOSE UP</button></div><div data-stage class="saloon-kitchen-stage"><div data-controls class="saloon-kitchen-controls">${['STOVE', 'BARREL', 'OVEN'].map(id => `<button type="button" class="saloon-kitchen-target station" data-station="${id}" aria-label="Walk to ${id.toLowerCase()}">${id}</button>`).join('')}${SEAT_SPOTS.map((_, i) => `<button type="button" class="saloon-kitchen-target customer" data-seat="${i}" aria-label="Customer at seat ${i + 1}" hidden></button>`).join('')}</div><div data-hands class="saloon-kitchen-hands">HANDS EMPTY</div></div><p class="saloon-kitchen-help">Tap a station to cook or collect. Tap a customer to deliver. The marshal walks there automatically.</p><div class="saloon-result" data-result style="display:none"></div>`;
    host.appendChild(layer);
    const stage = layer.querySelector('[data-stage]');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    stage.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x35291e);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
    camera.position.set(0, 29, 24);
    camera.lookAt(0, 0, -1);
    scene.add(new THREE.HemisphereLight(0xffe6bc, 0x5b3d25, 2.4));
    const light = new THREE.DirectionalLight(0xffdb9c, 2.1);
    light.position.set(-8, 20, 12);
    scene.add(light);
    const clickable = [];
    const dynamic = [];
    const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    function block(x, y, z, w, h, d, color, target) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
        mesh.position.set(x, y, z);
        scene.add(mesh);
        if(target) { mesh.userData.target = target; clickable.push(mesh); }
        return mesh;
    }
    block(0, -0.18, 0, 27, 0.3, 23, 0x79533a);
    for(let x = -12; x <= 12; x += 2) block(x, 0.005, 0, 0.06, 0.01, 22, 0x533c2c);
    block(0, 1.05, -1.5, 11, 2.1, 1.1, 0x5c3927);
    block(-10, 1.05, -1.5, 4, 2.1, 1.1, 0x5c3927);
    block(10, 1.05, -1.5, 4, 2.1, 1.1, 0x5c3927);
    for(const [id, color] of [['STOVE', 0x9b4434], ['BARREL', 0x6b462a], ['OVEN', 0xa78352]]) {
        const p = SPOTS[id];
        block(p.x, 0.8, p.z, 3, 1.6, 2.5, color, id);
        block(p.x, 1.7, p.z, 2.7, 0.18, 2.1, 0x30241e, id);
    }
    const seatMeshes = SEAT_SPOTS.map((p, i) => {
        block(p.x, 0.45, p.z + 1, 1.5, 0.9, 1.2, 0x553723, `SEAT_${i + 1}`);
        const mesh = block(p.x, 1.4, p.z, 1.0, 1.6, 0.85, 0xb49a7d, `SEAT_${i + 1}`);
        dynamic.push(mesh);
        return mesh;
    });
    const marshal = block(0, 1.05, -1.5, 1.1, 2.1, 0.9, 0x304d67);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let closed = false, ended = false, settling = false, frame = 0, last = performance.now();
    function resize() {
        const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    function point(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(clickable, false);
        if(hits.length) game.moveTo(hits[0].object.userData.target);
        else {
            const pos = new THREE.Vector3();
            if(raycaster.ray.intersectPlane(ground, pos)) game.moveTo({ x: Math.max(-12, Math.min(12, pos.x)), z: Math.max(-10, Math.min(10, pos.z)) });
        }
    }
    renderer.domElement.addEventListener('pointerdown', point);
    const stationButtons = [...layer.querySelectorAll('[data-station]')];
    const seatButtons = [...layer.querySelectorAll('[data-seat]')];
    const hands = layer.querySelector('[data-hands]');
    const projected = new THREE.Vector3();
    function placeButton(button, spot, y) {
        projected.set(spot.x, y, spot.z).project(camera);
        button.style.left = `${(projected.x + 1) * 50}%`;
        button.style.top = `${(1 - projected.y) * 50}%`;
    }
    function drawControls() {
        stationButtons.forEach(button => {
            const id = button.dataset.station;
            const station = id.toLowerCase();
            const jobs = game.state.jobs[station];
            const ready = game.state.readyPlates[station];
            placeButton(button, SPOTS[id], 2.8);
            button.dataset.state = ready.length ? 'ready' : jobs.length ? 'cooking' : 'idle';
            const status = ready.length ? `READY ${ready.length}` : jobs.length ? `${Math.max(1, Math.ceil(Math.min(...jobs.map(job => job.left))))}s` : '';
            button.textContent = `${id}${status ? ` · ${status}` : ''}`;
            button.setAttribute('aria-label', `${id.toLowerCase()}, ${status || 'idle'}`);
        });
        seatButtons.forEach((button, i) => {
            const seat = game.state.seats[i];
            button.hidden = !seat;
            if(!seat) return;
            placeButton(button, SEAT_SPOTS[i], 3.2);
            const dish = seat.dish?.toUpperCase() || 'COMING IN';
            const patience = seat.fullPatience ? Math.max(0, Math.ceil(seat.left)) : '';
            button.dataset.state = seat.state;
            button.dataset.dish = seat.dish || '';
            button.textContent = `${dish}${patience !== '' ? ` · ${patience}s` : ''}`;
            button.setAttribute('aria-label', `Customer at seat ${i + 1}, ${dish.toLowerCase()}${patience !== '' ? `, ${patience} seconds left` : ''}`);
        });
        hands.textContent = game.state.marshal.held.length ? `CARRYING: ${game.state.marshal.held.map(plate => plate.dish.toUpperCase()).join(' · ')}` : 'HANDS EMPTY';
    }
    function result(message, buttons) {
        const el = layer.querySelector('[data-result]');
        stage.style.display = 'none';
        layer.querySelector('.saloon-kitchen-help').style.display = 'none';
        el.style.display = '';
        el.innerHTML = `<div class="town-card"><div class="town-sign"><span>NIGHT ${night}</span></div><p class="town-blurb">${message}</p><div class="town-actions farm-actions">${buttons}</div></div>`;
    }
    function close() {
        if(closed) return;
        closed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        renderer.domElement.removeEventListener('pointerdown', point);
        scene.traverse(obj => {
            if(obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); }
        });
        renderer.dispose();
        renderer.forceContextLoss();
        layer.remove();
        onClose?.();
    }
    async function settle() {
        if(settling) return;
        settling = true;
        result('Counting the till...', '');
        try {
            const r = await finish(game.summary());
            if(closed) return;
            const pay = r.paid ? `$${r.dollars} earned. ${r.paidLeft} paid shifts left.` : 'Free practice; stars still count.';
            result(`Served ${r.served} of ${crowd(night)}. ${'*'.repeat(r.stars) || 'No stars'}. ${pay}`, '<button class="shop-action collect" data-again>ANOTHER SHIFT</button><button class="shop-action" data-done>DONE</button>');
        } catch(error) {
            if(!closed) { settling = false; result(`Could not count the till: ${error.message}`, '<button class="shop-action collect" data-retry>TRY AGAIN</button><button class="shop-action" data-done>LEAVE IT</button>'); }
        }
    }
    function end() {
        if(ended) return;
        ended = true;
        if(!game.state.served.length) result('Nobody was served; no paid shift was used.', '<button class="shop-action collect" data-again>ANOTHER SHIFT</button><button class="shop-action" data-done>DONE</button>');
        else settle();
    }
    layer.addEventListener('click', event => {
        const button = event.target.closest('button');
        if(!button) return;
        if(button.dataset.station) game.moveTo(button.dataset.station);
        else if(button.dataset.seat != null) game.moveTo(`SEAT_${Number(button.dataset.seat) + 1}`);
        else if(button.hasAttribute('data-quit')) { if(!ended) { game.state.over = true; end(); } }
        else if(button.hasAttribute('data-again')) { close(); onAgain?.(night); }
        else if(button.hasAttribute('data-done')) close();
        else if(button.hasAttribute('data-retry')) settle();
    });
    function tick(now) {
        if(closed) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if(!ended) game.update(dt);
        marshal.position.x = game.state.marshal.x;
        marshal.position.z = game.state.marshal.z;
        seatMeshes.forEach((mesh, i) => {
            const seat = game.state.seats[i];
            mesh.visible = !!seat;
            mesh.material.color.setHex(seat?.state === 'ordering' ? 0xd4ad72 : 0xb49a7d);
        });
        drawControls();
        const p = game.progress();
        layer.querySelector('[data-clock]').textContent = `${Math.max(0, Math.ceil(HARD_STOP - game.state.time))}s`;
        layer.querySelector('[data-score]').textContent = `${p.served}/${p.crowd} served · ${p.missed} missed`;
        renderer.render(scene, camera);
        if(game.over && !ended) end();
        if(!ended) frame = requestAnimationFrame(tick);
    }
    drawControls();
    if(import.meta.env?.DEV) layer.__redWestKitchen = { game, renderer };
    frame = requestAnimationFrame(tick);
    return { close, shift: game, get active() { return !closed; } };
}
