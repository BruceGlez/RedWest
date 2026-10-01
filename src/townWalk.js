import * as THREE from 'three';
import { loadCharacterModel, createCharacterInstance } from './characterModels.js';
import { moveInTown, stepFromInput, nearestDoor, turnToward, PLAYER_RADIUS } from './townWalkLogic.js';
import { folkNear } from './townFolk.js';
import { createDog, followStep } from './townCompanion.js';

// The walkable Frontier Town: the marshal walks the streets (WASD or arrows, or the on-screen stick on a phone)
// and steps up to a building's door to open its card (E, Enter, or tap the prompt). Kept apart from how the
// town is drawn (src/townLook.js) and built (src/townScene.js): it only reads the scene's walkMap() and moves
// the scene camera with follow() / overview(), so it works with the art direction on or off.
//
// options:
//   town3d   the scene from createTownScene()
//   host     the town screen element (the stick and the door prompt are added to it)
//   onOpen   (buildingId) => void: a door was used
//   blocked  () => boolean: true while a card or dialog is open, so the marshal stands still
//   lineFor  (personId) => string: what a townsperson says when the marshal stands near (src/townFolk.js)
//   describe (door) => string: the prompt's wording for a door or spot (the train names the next outlaw, the cash box the money)
//   start    [x, z]: where the marshal first stands (the farm, a place of its own, starts at its gate)
// town3d can be any scene with the same few parts (scene, walkMap, follow, overview, project, folk, talkTo): the farm uses one.

const YAW = 0.52; // the town camera's heading (src/townScene.js)
const HEIGHT = 3.4; // the marshal's height in town units (townsfolk are about 3.2)
const START = [0, -3.2 * 1.5]; // main street (src/townSpace.js spreads the town by 1.5)
const MARSHAL_MODEL = 'models/marshal.glb';

// Stand-in while the model loads (or if it cannot): a coat, a head, a hat.
function placeholderFigure() {
    const g = new THREE.Group();
    const part = (geometry, color, y) => {
        const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
        mesh.position.y = y;
        g.add(mesh);
    };
    part(new THREE.BoxGeometry(1.0, 1.9, 0.7), 0x7b2a1f, 1.5);
    part(new THREE.SphereGeometry(0.42, 10, 8), 0xd9a27a, 2.8);
    part(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), 0x2a1d15, 3.15);
    part(new THREE.CylinderGeometry(0.36, 0.4, 0.3, 12), 0x2a1d15, 3.3);
    return g;
}

export function createTownWalk({ town3d, host, onOpen, blocked = () => false, describe = door => door.label, lineFor = () => '', start = START }) {
    const avatar = new THREE.Group();
    const figure = placeholderFigure();
    avatar.add(figure);
    let character = null; // the marshal model, once loaded
    let loading = false;

    let active = false;
    let map = null;
    const position = { x: start[0], z: start[1] };
    const camera = { x: start[0], z: start[1] };
    let facing = 0;
    let door = null;

    // ---------- Input: keyboard ----------
    const held = new Set();
    const MOVE_KEYS = {
        KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
        KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right'
    };
    const onKeyDown = event => {
        if(!active || event.target.tagName === 'INPUT') return;
        const move = MOVE_KEYS[event.code];
        if(move) held.add(move);
        else if((event.code === 'KeyE' || event.code === 'Enter') && door && !blocked()) use();
    };
    const onKeyUp = event => { const move = MOVE_KEYS[event.code]; if(move) held.delete(move); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => held.clear());

    // ---------- Input: the on-screen stick (phones) and the door prompt ----------
    // One stick, one prompt and one bubble are shared by every walk on this screen (the town's and a place's): only one
    // is active at a time, and each leaves them hidden when it stops.
    const shared = (tag, className, html = '') => {
        const found = host.querySelector(`:scope > .${className}`);
        if(found) return found;
        const el = document.createElement(tag);
        el.className = className;
        el.innerHTML = html;
        el.style.display = 'none';
        if(tag === 'button') el.type = 'button';
        host.append(el);
        return el;
    };
    const stickEl = shared('div', 'walk-stick', '<div class="walk-stick-knob"></div>');
    const promptEl = shared('button', 'walk-prompt');
    const bubbleEl = shared('div', 'walk-bubble');
    const stick = { x: 0, y: 0, id: null };
    const knob = stickEl.firstElementChild;
    const moveStick = event => {
        const rect = stickEl.getBoundingClientRect();
        const radius = rect.width / 2;
        let dx = (event.clientX - (rect.left + radius)) / radius;
        let dy = (event.clientY - (rect.top + radius)) / radius;
        const length = Math.hypot(dx, dy);
        if(length > 1) { dx /= length; dy /= length; }
        stick.x = dx;
        stick.y = -dy;
        knob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
    };
    const endStick = event => {
        if(event.pointerId !== stick.id) return;
        stick.id = null;
        stick.x = stick.y = 0;
        knob.style.transform = '';
    };
    stickEl.addEventListener('pointerdown', event => {
        stickEl.setPointerCapture(event.pointerId);
        stick.id = event.pointerId;
        moveStick(event);
        event.stopPropagation();
    });
    stickEl.addEventListener('pointermove', event => { if(event.pointerId === stick.id) moveStick(event); });
    stickEl.addEventListener('pointerup', endStick);
    stickEl.addEventListener('pointercancel', endStick);
    promptEl.addEventListener('click', () => { if(door && !blocked()) use(); });

    // ---------- The dog (src/townCompanion.js) ----------
    let dog = null;
    let companionOn = false;
    const dogAt = { x: 0, z: 0, heading: 0 };
    function showDog() {
        const should = companionOn && active;
        if(should && !dog) dog = createDog();
        if(!dog) return;
        if(should) {
            if(!dog.object.parent) {
                dogAt.x = position.x - 1.6;
                dogAt.z = position.z + 1.2;
                town3d.scene.add(dog.object);
            }
        } else {
            dog.object.parent?.remove(dog.object);
        }
    }

    // ---------- Talking to townsfolk ----------
    let talkingId = null;
    let talkClock = 0;
    const talkedOut = new Set(); // heard enough: they go on until the marshal has left and come back
    function updateTalk(dt) {
        const walkers = town3d.folk.map(f => f.walker);
        for(const entry of town3d.folk) {
            if(talkedOut.has(entry.id) && Math.hypot(entry.walker.x - position.x, entry.walker.z - position.z) > 5) talkedOut.delete(entry.id);
        }
        const near = folkNear(walkers.filter((w, i) => !talkedOut.has(town3d.folk[i].id)), position.x, position.z);
        const entry = near ? town3d.folk.find(f => f.walker === near) : null;
        if(entry?.id !== talkingId) {
            talkingId = entry?.id ?? null;
            talkClock = 0;
            town3d.talkTo(talkingId, position.x, position.z);
        } else if(entry) {
            talkClock += dt;
            town3d.talkTo(entry.id, position.x, position.z);
            if(talkClock > 7) {
                talkedOut.add(entry.id);
                talkingId = null;
                town3d.talkTo(null);
            }
        }
        const person = talkingId ? town3d.folk.find(f => f.id === talkingId) : null;
        if(!person) {
            bubbleEl.style.display = 'none';
            return;
        }
        const at = town3d.project(person.walker.x, 4.6, person.walker.z);
        const text = `<b>${person.name}</b> ${lineFor(person.id)}`;
        if(bubbleEl.innerHTML !== text) bubbleEl.innerHTML = text;
        bubbleEl.style.display = at.visible ? '' : 'none';
        bubbleEl.style.left = `${Math.round(at.x * window.innerWidth)}px`;
        bubbleEl.style.top = `${Math.round(at.y * window.innerHeight)}px`;
    }

    function use() {
        if(!door) return;
        const { id } = door;
        showPrompt(null); // gone at once, not a frame later
        onOpen(id);
    }

    function loadMarshal() {
        if(loading || character) return;
        loading = true;
        loadCharacterModel(MARSHAL_MODEL).then(gltf => {
            character = createCharacterInstance(gltf, HEIGHT);
            avatar.remove(figure);
            avatar.add(character.object);
        }).catch(() => { /* keeps the stand-in figure */ }).finally(() => { loading = false; });
    }

    function showPrompt(next) {
        door = next;
        promptEl.style.display = door ? '' : 'none';
        if(!door) return;
        // Worded every frame: the money in the cash box and the outlaw on the train change while you stand there.
        const text = `${describe(door)}  ·  ${'ontouchstart' in window ? 'TAP' : 'E'} TO ${door.verb || 'ENTER'}`;
        if(promptEl.textContent !== text) promptEl.textContent = text;
    }

    return {
        get active() { return active; },
        get hasDog() { return !!dog?.object.parent; },
        // The dog comes along (or goes home). It is only shown while walking.
        setCompanion(on) {
            companionOn = !!on;
            showDog();
        },
        // Start walking: the marshal stands on main street and the camera drops in behind.
        enter() {
            held.clear(); // a key let go while the town was closed must not keep walking
            stick.x = stick.y = 0;
            if(active) return;
            active = true;
            map = town3d.walkMap();
            [position.x, position.z] = moveInTown(map, position.x, position.z, 0, 0);
            camera.x = position.x;
            camera.z = position.z;
            town3d.scene.add(avatar);
            showDog();
            stickEl.style.display = matchMedia('(pointer: coarse)').matches ? '' : 'none';
            loadMarshal();
            this.update(0);
        },
        // Back to the overview.
        exit() {
            if(!active) return;
            active = false;
            held.clear();
            stick.x = stick.y = 0;
            town3d.scene.remove(avatar);
            showDog();
            talkingId = null;
            town3d.talkTo(null);
            bubbleEl.style.display = 'none';
            stickEl.style.display = 'none';
            showPrompt(null);
            town3d.overview();
        },
        // Every frame while the town is open.
        update(dt) {
            if(!active) return;
            // The town can change under us (upgrades rebuild buildings): refresh the map now and then.
            map = town3d.walkMap();
            let inputX = stick.x + (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
            let inputY = stick.y + (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
            if(blocked()) inputX = inputY = 0;
            const step = stepFromInput(inputX, inputY, YAW, Math.min(dt, 0.05));
            if(step.moving) {
                [position.x, position.z] = moveInTown(map, position.x, position.z, step.dx, step.dz);
                if(step.dx || step.dz) facing = turnToward(facing, Math.atan2(step.dx, step.dz), Math.min(1, dt * 14));
            }
            avatar.position.set(position.x, 0, position.z);
            avatar.rotation.y = facing;
            if(character) {
                character.play(step.moving ? 'run' : 'idle');
                character.mixer.update(dt * (step.moving ? 0.75 + step.strength * 0.5 : 1));
            }
            // The camera eases after the marshal.
            const follow = 1 - Math.exp(-dt * 6);
            camera.x += (position.x - camera.x) * follow;
            camera.z += (position.z - camera.z) * follow;
            town3d.follow(camera.x, camera.z);
            updateTalk(dt);
            if(dog && companionOn) {
                const trot = followStep(dogAt, position, Math.min(dt, 0.05));
                [dogAt.x, dogAt.z] = moveInTown(map, dogAt.x, dogAt.z, trot.x - dogAt.x, trot.z - dogAt.z, 0.4);
                dogAt.heading = turnToward(dogAt.heading, trot.heading, Math.min(1, dt * 12));
                dog.object.position.set(dogAt.x, 0, dogAt.z);
                dog.object.rotation.y = dogAt.heading;
                dog.update(dt, trot.moving);
            }
            showPrompt(blocked() ? null : nearestDoor(map, position.x, position.z));
        },
        // Put the marshal somewhere (tests, and a way to fast-travel later). Kept out of walls.
        place(x, z) {
            map = town3d.walkMap();
            [position.x, position.z] = moveInTown(map, x, z, 0, 0);
            camera.x = position.x;
            camera.z = position.z;
        },
        get position() { return { ...position }; },
        radius: PLAYER_RADIUS
    };
}
