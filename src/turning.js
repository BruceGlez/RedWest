// How the marshal turns to face the way he walks on a touch screen (the aim stick turns him at once; this is for the
// move stick and for a tap that fires where he faces). Aim help is off on purpose, so he never turns to an enemy: only to
// where the thumb points. The turn is quick, so a tap fires the way you are pointing, but a thumb that wobbles a few degrees
// does not make the body twitch. Pure maths, so it can be unit tested.

export const TURN = {
    rate: 40,       // eases quickly at first: 95% of a turn in about 0.075 s
    minSpeed: 14,   // radians a second at least, so the end of a turn does not crawl (a half turn takes under 0.25 s)
    wobble: 0.12    // radians (about 7 degrees): the wanted heading must move more than this to count as a new direction
};

// The shortest signed angle from `from` to `to`, in (-PI, PI].
export function angleDelta(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function createTurner() {
    return { target: null };
}

// A new facing angle, after `dt` seconds, for a body at `current` that wants to face `wanted` (radians, 0 along +z).
// `turner` remembers the heading last accepted: forget it with reset() when the thumb lifts or the aim stick takes over.
export function snapTurn(turner, current, wanted, dt, cfg = TURN) {
    if(turner.target === null || Math.abs(angleDelta(turner.target, wanted)) > cfg.wobble) turner.target = wanted;
    const delta = angleDelta(current, turner.target);
    const distance = Math.abs(delta);
    const eased = distance * (1 - Math.exp(-cfg.rate * dt));
    const step = Math.min(distance, Math.max(eased, cfg.minSpeed * dt));
    return current + Math.sign(delta) * step;
}

export function resetTurner(turner) {
    turner.target = null;
}
