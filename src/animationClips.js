// Clean-up for animations exported by AI character tools (Meshy / Mixamo).

export const LOCOMOTION = new Set(['run', 'runShoot', 'runAim']);
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

// The gun arm (Meshy / Mixamo bone names).
export const GUN_ARM = ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
export const BOTH_ARMS = [...GUN_ARM, 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'];
// Running leans the body forward, which points a held gun at the ground: the upper body stays upright.
export const UPPER_BODY = [...BOTH_ARMS, 'Hips.quaternion', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head'];
const boneOf = track => track.name.slice(0, track.name.lastIndexOf('.'));

// A part of a clip, from `start` to `end` seconds, starting at 0.
export function clipPart(clip, name, start, end) {
    const part = clip.clone();
    part.name = name;
    part.tracks = part.tracks.map(track => {
        const times = [];
        const values = [];
        const size = track.getValueSize();
        const sample = track.createInterpolant();
        for(let t = start; t <= end + 1e-6; t += 1 / 30) {
            times.push(t - start);
            values.push(...sample.evaluate(t));
        }
        const copy = track.clone();
        copy.times = new Float32Array(times);
        copy.values = new Float32Array(values);
        if(copy.values.length !== times.length * size) throw new Error('bad track size');
        return copy;
    });
    part.duration = end - start;
    return part;
}

// `base` with the listed bones held in the pose `pose` has at `time`: running legs with a gun arm held
// forward, instead of a whole-body shooting animation.
export function withPose(base, pose, time, bones, name) {
    const clip = base.clone();
    clip.name = name;
    // Entries are bone names (every track of that bone) or exact track names like 'Hips.quaternion'.
    const listed = track => bones.includes(boneOf(track)) || bones.includes(track.name);
    const held = pose.tracks.filter(listed);
    clip.tracks = clip.tracks.filter(track => !listed(track));
    for(const track of held) {
        const value = track.createInterpolant().evaluate(time);
        const Track = track.constructor;
        clip.tracks.push(new Track(track.name, [0, clip.duration], [...value, ...value]));
    }
    return clip;
}
