// The two found powers of Section 1 and their combo (docs/design/pete-section1-gameplay.md, section 6). Pure rules, no THREE: every call
// returns plain events ({ kind: 'blast' | 'burn' | 'puddle' | 'fire' | 'fire-end' | 'puddle-end' | 'combo', ... }) that the mode turns into
// damage and effects. Money never buys any of this (AGENTS.md rule 6): elements are found, they are finite, and nothing refills them.
//
//   Dynamite  found at the Headframe stack (take 2). Thrown: a 1.4 s fuse, then 2 damage in a 24 unit blast.
//   Whiskey   found in whiskey barrels (take 1) and the Stash (take 2). Thrown: a 20 unit puddle for 12 s that slows enemies 40 percent and burns.
//   Fire pool Dynamite that lands in a whiskey puddle: the puddle becomes a 28 unit fire for 6 s, 1 damage a second.

export const ELEMENTS = {
    dynamite: { label: 'DYNAMITE', max: 2, fuse: 1.4, radius: 24, damage: 2 },
    whiskey: { label: 'WHISKEY', max: 2, radius: 20, seconds: 12, slow: 0.4 },
    fire: { radius: 28, seconds: 6, tick: 1, damage: 1 },
    THROW_RANGE: 22,
    THROW_COOLDOWN: 0.5
};
export const ORDER = ['dynamite', 'whiskey'];

export function createElements() {
    return { slots: { dynamite: 0, whiskey: 0 }, selected: 'dynamite', cooldown: 0, fuses: [], puddles: [], pools: [], told: false };
}

// Add `n` of an element, up to its limit. Returns how many were added.
export function give(el, type, n = 1) {
    const def = ELEMENTS[type];
    if(!def || !(type in el.slots)) return 0;
    const added = Math.max(0, Math.min(n, def.max - el.slots[type]));
    el.slots[type] += added;
    if(added && !el.selected) el.selected = type;
    if(el.slots[el.selected] === 0 && el.slots[type] > 0) el.selected = type;
    return added;
}

export const holding = el => ORDER.filter(t => el.slots[t] > 0);

// Pick the next element you hold.
export function cycle(el) {
    const have = holding(el);
    if(!have.length) return el.selected;
    el.selected = have[(have.indexOf(el.selected) + 1) % have.length];
    return el.selected;
}

// Throw the selected element from (x, z) toward (dx, dz). Returns { ok, type, x, z } or { ok: false }.
export function throwSelected(el, x, z, dx, dz, range = ELEMENTS.THROW_RANGE) {
    const type = el.selected;
    if(el.cooldown > 0 || !type || el.slots[type] <= 0) return { ok: false };
    const len = Math.hypot(dx, dz) || 1;
    const tx = x + (dx / len) * range, tz = z + (dz / len) * range;
    el.slots[type]--;
    el.cooldown = ELEMENTS.THROW_COOLDOWN;
    if(el.slots[type] === 0) { const next = holding(el)[0]; if(next) el.selected = next; }
    if(type === 'dynamite') light(el, tx, tz);
    else addPuddle(el, tx, tz);
    return { ok: true, type, x: tx, z: tz };
}

export function light(el, x, z, fuse = ELEMENTS.dynamite.fuse) { el.fuses.push({ x, z, t: fuse }); }
export function addPuddle(el, x, z) { el.puddles.push({ x, z, t: ELEMENTS.whiskey.seconds, r: ELEMENTS.whiskey.radius }); }

// The movement multiplier for something standing at (x, z): slowed in a puddle, not in a fire.
export function slowAt(el, x, z) {
    for(const p of el.puddles) if(Math.hypot(p.x - x, p.z - z) <= p.r) return 1 - ELEMENTS.whiskey.slow;
    return 1;
}

export const inFire = (el, x, z) => el.pools.some(f => Math.hypot(f.x - x, f.z - z) <= f.r);

export function step(el, dt) {
    const events = [];
    if(el.cooldown > 0) el.cooldown = Math.max(0, el.cooldown - dt);
    for(let i = el.fuses.length - 1; i >= 0; i--) {
        const f = el.fuses[i];
        f.t -= dt;
        if(f.t > 0) continue;
        el.fuses.splice(i, 1);
        events.push({ kind: 'blast', x: f.x, z: f.z, radius: ELEMENTS.dynamite.radius, damage: ELEMENTS.dynamite.damage, source: 'dynamite' });
        // Dynamite that lands in a whiskey puddle lights it: the puddle becomes a fire pool.
        const pi = el.puddles.findIndex(p => Math.hypot(p.x - f.x, p.z - f.z) <= p.r);
        if(pi >= 0) {
            const p = el.puddles.splice(pi, 1)[0];
            el.pools.push({ x: p.x, z: p.z, t: ELEMENTS.fire.seconds, r: ELEMENTS.fire.radius, tick: ELEMENTS.fire.tick });
            events.push({ kind: 'combo', x: p.x, z: p.z }, { kind: 'fire', x: p.x, z: p.z, radius: ELEMENTS.fire.radius });
        }
    }
    for(let i = el.puddles.length - 1; i >= 0; i--) {
        el.puddles[i].t -= dt;
        if(el.puddles[i].t <= 0) { events.push({ kind: 'puddle-end', x: el.puddles[i].x, z: el.puddles[i].z }); el.puddles.splice(i, 1); }
    }
    for(let i = el.pools.length - 1; i >= 0; i--) {
        const f = el.pools[i];
        f.t -= dt;
        f.tick -= dt;
        if(f.tick <= 0) { f.tick += ELEMENTS.fire.tick; events.push({ kind: 'burn', x: f.x, z: f.z, radius: f.r, damage: ELEMENTS.fire.damage }); }
        if(f.t <= 0) { events.push({ kind: 'fire-end', x: f.x, z: f.z }); el.pools.splice(i, 1); }
    }
    return events;
}

// The one-time hint when the marshal first holds both.
export function comboHint(el) {
    if(el.told || el.slots.dynamite === 0 || el.slots.whiskey === 0) return null;
    el.told = true;
    return 'WHISKEY AND DYNAMITE MAKE A FIRE POOL';
}

export function summary(el) {
    const parts = ORDER.filter(t => el.slots[t] > 0).map(t => `${t === el.selected ? '>' : ''}${ELEMENTS[t].label} ${el.slots[t]}`);
    return parts.length ? `${parts.join(' ')} [F THROW, V SWAP]` : '';
}

export function resetElements(el) { Object.assign(el, createElements()); return el; }
