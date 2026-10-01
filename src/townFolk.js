// The people of Lantern Rock (TOWN_PLAN.md, step C): each keeps a short routine between two or four stops, waits at
// each, and has something to say when the marshal stands near. The routines and the lines are here with no
// rendering, so they can be unit tested; src/townScene.js moves and draws them, src/townWalk.js shows the line.
// Routes follow the streets and never cut through a building (tests/town-smoke.mjs walks every segment).
// Voice: serious, like src/barks.js. One line for each stage of the marshal's progress.

export const FOLK_BARK_MAX = 130;
export const FOLK_SPEED = 1.5; // units a second, a slow stroll
export const FOLK_TALK_RANGE = 3.4;

// route: points [x, z, wait in seconds] walked in order and round again. lines: [nothing beaten, a few, many].
export const FOLK = [
    { id: 'gil', name: 'Old Gil', route: [[-30, -6.5, 8], [-15, -7.2, 6], [-7, -6.5, 4]], lines: [
        'A rider came through at dawn asking for the marshal. Left no name.',
        'Word on the Road is somebody is paying them. Nobody will say who.',
        'The horses go quiet when the wind turns toward Slagtown. I listen to horses.'] },
    { id: 'grimsby', name: 'Mr. Grimsby', route: [[-27, 13, 9], [-7, 13, 2], [-7, 3.5, 5], [-7, 13, 0]], lines: [
        'Business is slow, Marshal. I would like it to stay that way.',
        'I have measured fewer men lately. Your doing, I think.',
        'I still keep a box with a name on it. I hope I never use it.'] },
    { id: 'pruitt', name: 'Mr. Pruitt', route: [[14, -7.9, 10], [7.5, -7, 0], [7.5, -1, 4], [7.5, -7, 0]], lines: [
        'Good day, Marshal. Your account is in order. I hope the road is kind.',
        'The ledgers from the Road do not add up. I intend to find out why.',
        'Every bounty leaves a paper trail. Somebody will read it one day.'] },
    { id: 'barkeep', name: 'The barkeep', route: [[-15, -7.2, 9], [-7, -6.5, 0], [-7, -1.5, 3], [-7, -6.5, 0]], lines: [
        'Quiet night. The man who ran the Tin Cup is still out there somewhere.',
        'Folk come in to hear who you brought down. Nobody asks what you drink.',
        'Half this room once wanted you dead. Now they tip well.'] },
    { id: 'miner', name: 'A miner', route: [[22, -1.5, 7], [10, -1.5, 3]], lines: [
        'The smelter at Slagtown still runs. Whatever it makes, it is not for us.',
        'This town is getting bigger. I can feel it in my boots.',
        'I dig for the Company no more. The work here is honest, and slower.'] },
    { id: 'station-master', name: 'The station master', route: [[36, -9.5, 9], [36, -2, 0], [27, -2, 6], [36, -2, 0]], lines: [
        'The train was late again. Somebody at the Company office wanted it that way.',
        'Every hunt starts here. Get on, Marshal, and get back.',
        'I have run this line for years. You are the first to make it feel safe.'] }
];

export const getFolk = id => FOLK.find(person => person.id === id) ?? null;

// How far the marshal has got: 0 nothing beaten, 1 some, 2 five or more.
export function folkTier(beaten) {
    return beaten >= 5 ? 2 : beaten >= 1 ? 1 : 0;
}

export function folkLine(person, beaten = 0) {
    return person.lines[folkTier(beaten)];
}

// ---------- Moving along a route ----------

// A walker starts at a route point, part of the way through its day (so the town is not in step).
export function createWalker(route, startAfter = 0) {
    const walker = { route, x: route[0][0], z: route[0][1], to: 1 % route.length, wait: 0, heading: 0, moving: false, talking: false };
    // Play the day forward in small steps to the starting moment.
    for(let t = 0; t < startAfter; t += 0.25) stepWalker(walker, 0.25);
    return walker;
}

// One step of the routine: walk to the next point, wait there, go on. While `talking` the walker stands still
// (the heading is set by the caller to face the marshal).
export function stepWalker(walker, dt, speed = FOLK_SPEED) {
    if(walker.talking) {
        walker.moving = false;
        return walker;
    }
    if(walker.wait > 0) {
        walker.wait = Math.max(0, walker.wait - dt);
        walker.moving = false;
        return walker;
    }
    const [tx, tz, pause] = walker.route[walker.to];
    const dx = tx - walker.x;
    const dz = tz - walker.z;
    const distance = Math.hypot(dx, dz);
    const travel = speed * dt;
    if(distance <= travel) {
        walker.x = tx;
        walker.z = tz;
        walker.wait = pause || 0;
        walker.to = (walker.to + 1) % walker.route.length;
        walker.moving = false;
    } else {
        walker.x += (dx / distance) * travel;
        walker.z += (dz / distance) * travel;
        walker.heading = Math.atan2(dx, dz);
        walker.moving = true;
    }
    return walker;
}

// The person within talking range of a point, nearest first, or null.
export function folkNear(walkers, x, z, range = FOLK_TALK_RANGE) {
    let best = null;
    let bestDistance = range;
    for(const walker of walkers) {
        const distance = Math.hypot(walker.x - x, walker.z - z);
        if(distance <= bestDistance) {
            best = walker;
            bestDistance = distance;
        }
    }
    return best;
}
