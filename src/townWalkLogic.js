// The rules of walking around Frontier Town, with no rendering in them so they can be unit tested.
// The town is flat: everything is on the x / z plane. A "map" is what townScene.walkMap() hands over:
//   { areas: [{ minX, maxX, minZ, maxZ }], boxes: [{ minX, maxX, minZ, maxZ }], doors: [{ id, label, x, z }] }
// `areas` is the ground you may stand on: the town plus each open district (src/townDistricts.js). Areas overlap by
// more than a marshal's width where they meet. A map with a single `bounds` rectangle still works.

export const WALK_SPEED = 7.5; // town units a second (a street is about 9 wide, the whole town about 70)
export const PLAYER_RADIUS = 0.6;
export const DOOR_REACH = 2.8; // how close to a door the prompt shows
export const STEP_LIMIT = 0.25; // never move further than this in one go, so a long frame cannot skip a wall

// Push a circle out of one box (the shallowest way out). Returns the corrected [x, z].
export function pushOutOfBox(x, z, radius, box) {
    const nearX = Math.max(box.minX, Math.min(x, box.maxX));
    const nearZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - nearX;
    const dz = z - nearZ;
    const distance = Math.hypot(dx, dz);
    if(distance >= radius) return [x, z];
    if(distance > 1e-6) {
        const push = (radius - distance) / distance;
        return [x + dx * push, z + dz * push];
    }
    // The centre is inside the box: leave by the nearest side.
    const left = x - box.minX, right = box.maxX - x, up = z - box.minZ, down = box.maxZ - z;
    const least = Math.min(left, right, up, down);
    if(least === left) return [box.minX - radius, z];
    if(least === right) return [box.maxX + radius, z];
    if(least === up) return [x, box.minZ - radius];
    return [x, box.maxZ + radius];
}

const areasOf = map => map.areas ?? [map.bounds];

// The nearest point to (x, z) that a circle of this radius can stand on inside the union of the areas.
export function clampToAreas(areas, x, z, radius) {
    let best = null;
    let bestDistance = Infinity;
    for(const a of areas) {
        const cx = Math.max(a.minX + radius, Math.min(x, a.maxX - radius));
        const cz = Math.max(a.minZ + radius, Math.min(z, a.maxZ - radius));
        const distance = Math.hypot(cx - x, cz - z);
        if(distance < bestDistance) {
            best = [cx, cz];
            bestDistance = distance;
            if(distance === 0) break;
        }
    }
    return best ?? [x, z];
}

// Where the player ends up after moving by (dx, dz): stays inside the town bounds and out of every box.
export function moveInTown(map, x, z, dx, dz, radius = PLAYER_RADIUS) {
    const length = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(length / STEP_LIMIT));
    let px = x, pz = z;
    for(let i = 0; i < steps; i++) {
        px += dx / steps;
        pz += dz / steps;
        // Two passes settle a corner where two boxes meet.
        for(let pass = 0; pass < 2; pass++) {
            for(const box of map.boxes) [px, pz] = pushOutOfBox(px, pz, radius, box);
        }
        [px, pz] = clampToAreas(areasOf(map), px, pz, radius);
    }
    return [px, pz];
}

// A stick or WASD input (x to the right, y up the screen, each -1..1) turned into a town-space step.
// `yaw` is the camera's heading, so "up the screen" is always into the town from where the player looks.
export function stepFromInput(inputX, inputY, yaw, dt, speed = WALK_SPEED) {
    const length = Math.hypot(inputX, inputY);
    if(length < 1e-3) return { dx: 0, dz: 0, moving: false, strength: 0 };
    const strength = Math.min(1, length);
    const ux = inputX / length, uy = inputY / length;
    // Right of the screen and up the screen, on the ground (the same basis the town's drag-to-pan uses).
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const upX = -Math.sin(yaw), upZ = -Math.cos(yaw);
    const dx = (ux * rightX + uy * upX) * speed * strength * dt;
    const dz = (ux * rightZ + uy * upZ) * speed * strength * dt;
    return { dx, dz, moving: true, strength };
}

// The door the player is close enough to use, nearest first, or null.
export function nearestDoor(map, x, z, reach = DOOR_REACH) {
    let best = null;
    let bestDistance = reach;
    for(const door of map.doors) {
        const distance = Math.hypot(door.x - x, door.z - z);
        // A door may ask for a closer reach than the rest (`reach`): a hidden one only shows its prompt when the marshal is right beside it.
        if(distance <= bestDistance && distance <= (door.reach ?? Infinity)) {
            best = door;
            bestDistance = distance;
        }
    }
    return best;
}

// Keep a facing angle turning the short way, eased (radians).
export function turnToward(current, target, amount) {
    const delta = ((target - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return current + delta * Math.min(1, amount);
}
