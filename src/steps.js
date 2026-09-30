// Footsteps: a walker covers ground, and every STRIDE units a foot comes down, left then right. Pure, so it can
// be tested; playerSystem.js uses it for the footprints in the sand (decals.js) and for the footstep sound.
export const STRIDE = 1.7;

export function createStepper(stride = STRIDE) {
    return { travelled: 0, left: true, stride };
}

// Feeds in the distance covered this frame. Returns the steps that landed as [{ left: true|false }, ...]
// (usually none, sometimes one; several after a dash).
export function advanceStepper(stepper, distance) {
    const steps = [];
    stepper.travelled += distance;
    while(stepper.travelled >= stepper.stride) {
        stepper.travelled -= stepper.stride;
        steps.push({ left: stepper.left });
        stepper.left = !stepper.left;
    }
    return steps;
}
