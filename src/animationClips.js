// Clean-up for animations exported by AI character tools (Meshy / Mixamo).

export const LOCOMOTION = new Set(['run', 'runShoot']);
const cleaned = new WeakMap();

// Looping clips must stay in place: the game moves the character. Some exports (Meshy's Run and
// Shoot) carry root motion, walking the hips forward each loop and snapping back when it repeats.
// Pin the hips' horizontal position to the first frame; keep the vertical bob.
export function inPlace(clip) {
    if(cleaned.has(clip)) return cleaned.get(clip);
    const copy = clip.clone();
    for(const track of copy.tracks) {
        if(!/hips\.position$/i.test(track.name)) continue;
        const values = track.values;
        for(let i = 3; i < values.length; i += 3) {
            values[i] = values[0];
            values[i + 2] = values[2];
        }
    }
    cleaned.set(clip, copy);
    return copy;
}
