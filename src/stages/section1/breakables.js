// Barrels, fences and the dynamite stack of Section 1 (docs/design/pete-section1-gameplay.md, M5 and M6). Pure rules: a shot or a blast comes in,
// plain events go out ({ kind: 'break' | 'blast' | 'puddle' | 'give' }) for the mode to show and apply.
//
//   Barrel  a shot blows it: 1 damage in a 12 unit radius. A barrel within 14 units goes up 0.6 s later (a chain of at most 3). A whiskey barrel
//           also leaves a puddle and gives the marshal 1 Whiskey if he stands within reach.
//   Fence   one shot breaks it. No loot, no blast.
//   Stack   the dynamite crates: E takes 2 Dynamite once; a shot blows what is left for 2 damage in 24 units.

export const BREAK = { BARREL_RADIUS: 12, BARREL_DAMAGE: 1, CHAIN_RANGE: 14, CHAIN_DELAY: 0.6, CHAIN_MAX: 3, HIT: 2.5, TAKE_REACH: 14, STACK_RADIUS: 24, STACK_DAMAGE: 2, STACK_TAKES: 2 };

// Which barrels hold whiskey: the Headframe and Shack Row ones (the art's I23 and I23b).
const WHISKEY = new Set(['I23', 'I23b']);

export function buildBreakables(markers = []) {
    const items = [];
    for(const m of markers) {
        if(m.type === 'breakable' && /^I23/.test(m.id)) items.push({ id: m.id, kind: 'barrel', x: m.x, z: m.z, r: Math.max(m.radius || 0, 3), whiskey: WHISKEY.has(m.id), broken: false });
        else if(m.type === 'breakable' && /^I14/.test(m.id)) items.push({ id: m.id, kind: 'fence', x: m.x, z: m.z, r: Math.max(m.radius || 0, 3), broken: false });
        else if(m.id === 'DYNAMITE') items.push({ id: m.id, kind: 'stack', x: m.x, z: m.z, r: Math.max(m.radius || 0, 6), broken: false, taken: false });
    }
    return items;
}

export function createBreakables(markers) {
    return { items: buildBreakables(markers), pending: [] };
}

function hitBy(b, x, z) {
    return b.items.filter(i => !i.broken && Math.hypot(i.x - x, i.z - z) <= Math.min(i.r, BREAK.HIT + (i.kind === 'stack' ? 3 : 1)));
}

function blow(b, item, chain, playerAt, events) {
    if(item.broken) return;
    item.broken = true;
    events.push({ kind: 'break', id: item.id, what: item.kind });
    if(item.kind === 'barrel') {
        events.push({ kind: 'blast', x: item.x, z: item.z, radius: BREAK.BARREL_RADIUS, damage: BREAK.BARREL_DAMAGE, source: 'barrel' });
        if(item.whiskey) {
            events.push({ kind: 'puddle', x: item.x, z: item.z });
            if(playerAt && Math.hypot(playerAt.x - item.x, playerAt.z - item.z) <= BREAK.TAKE_REACH) events.push({ kind: 'give', element: 'whiskey', n: 1 });
        }
        if(chain < BREAK.CHAIN_MAX) {
            for(const other of b.items) {
                if(other.kind === 'barrel' && !other.broken && !b.pending.some(p => p.item === other) && Math.hypot(other.x - item.x, other.z - item.z) <= BREAK.CHAIN_RANGE) {
                    b.pending.push({ item: other, t: BREAK.CHAIN_DELAY, chain: chain + 1 });
                }
            }
        }
    } else if(item.kind === 'stack') {
        events.push({ kind: 'blast', x: item.x, z: item.z, radius: BREAK.STACK_RADIUS, damage: BREAK.STACK_DAMAGE, source: 'stack' });
    }
}

// A player's bullet is at (x, z). Returns events (empty when it hit nothing). A taken stack is empty and cannot blow.
export function shoot(b, x, z, playerAt = null) {
    const events = [];
    for(const item of hitBy(b, x, z)) {
        if(item.kind === 'stack' && item.taken) continue;
        blow(b, item, 0, playerAt, events);
        break;                                   // a bullet breaks one thing
    }
    return events;
}

// A blast at (x, z): barrels and the stack inside it go up (barrels after the chain delay, so a row goes off one by one).
export function blastAt(b, x, z, radius, source = null) {
    const events = [];
    for(const item of b.items) {
        if(item.broken || item.kind === 'fence') continue;
        if(item.kind === 'stack' && item.taken) continue;
        if(Math.hypot(item.x - x, item.z - z) > radius) continue;
        if(source === 'barrel' && item.kind === 'barrel') continue;     // barrels chain through step(), with the chain limit
        if(!b.pending.some(p => p.item === item)) b.pending.push({ item, t: item.kind === 'stack' ? 0.2 : BREAK.CHAIN_DELAY, chain: source === 'barrel' ? 1 : 0 });
    }
    return events;
}

export function step(b, dt, playerAt = null) {
    const events = [];
    for(let i = b.pending.length - 1; i >= 0; i--) {
        const p = b.pending[i];
        p.t -= dt;
        if(p.t > 0) continue;
        b.pending.splice(i, 1);
        blow(b, p.item, p.chain, playerAt, events);
    }
    return events;
}

// E at the stack takes Dynamite once. Returns the number taken (0 when there is nothing to take).
export function takeStack(b, id = 'DYNAMITE') {
    const stack = b.items.find(i => i.id === id && i.kind === 'stack');
    if(!stack || stack.taken || stack.broken) return 0;
    stack.taken = true;
    return BREAK.STACK_TAKES;
}

export const isBroken = (b, id) => !!b.items.find(i => i.id === id)?.broken;
