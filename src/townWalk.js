import * as THREE from 'three';
import { loadCharacterModel, createCharacterInstance } from './characterModels.js';
import { moveInTown, stepFromInput, nearestDoor, turnToward, PLAYER_RADIUS } from './townWalkLogic.js';

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

const YAW = 0.52; // the town camera's heading (src/townScene.js)
const HEIGHT = 3.4; // the marshal's height in town units (townsfolk are about 3.2)
const START = [0, -3.2];
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

export function createTownWalk({ town3d, host, onOpen, blocked = () => false }) {
    const avatar = new THREE.Group();
    const figure = placeholderFigure();
    avatar.add(figure);
    let character = null; // the marshal model, once loaded
    let loading = false;

    let active = false;
    let map = null;
    const position = { x: START[0], z: START[1] };
    const camera = { x: START[0], z: START[1] };
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
    const stickEl = document.createElement('div');
    stickEl.className = 'walk-stick';
    stickEl.innerHTML = '<div class="walk-stick-knob"></div>';
    stickEl.style.display = 'none';
    const promptEl = document.createElement('button');
    promptEl.type = 'button';
    promptEl.className = 'walk-prompt';
    promptEl.style.display = 'none';
    host.append(stickEl, promptEl);
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
        if(next?.id === door?.id) return;
        door = next;
        promptEl.style.display = door ? '' : 'none';
        if(door) promptEl.textContent = `${door.label}  ·  ${'ontouchstart' in window ? 'TAP' : 'E'} TO ENTER`;
    }

    return {
        get active() { return active; },
        // Start walking: the marshal stands on main street and the camera drops in behind.
        enter() {
            if(active) return;
            active = true;
            map = town3d.walkMap();
            [position.x, position.z] = moveInTown(map, position.x, position.z, 0, 0);
            camera.x = position.x;
            camera.z = position.z;
            town3d.scene.add(avatar);
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
