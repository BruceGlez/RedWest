import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { inPlace } from '../src/animationClips.js';

test('looping clips lose root motion but keep the vertical bob', () => {
    // Hips walk forward 1.1 units over the loop (Meshy's Run and Shoot), bobbing up and down.
    const hips = new THREE.VectorKeyframeTrack('mixamorigHips.position', [0, 0.5, 1], [0, 0.66, 0, 0.1, 0.7, 0.55, 0, 0.66, 1.1]);
    const arm = new THREE.QuaternionKeyframeTrack('mixamorigRightArm.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.7, 0, 0.7]);
    const clip = new THREE.AnimationClip('runShoot', 1, [hips, arm]);
    const fixed = inPlace(clip);
    const values = [...fixed.tracks[0].values];
    assert.deepEqual(values.filter((_, i) => i % 3 !== 1), [0, 0, 0, 0, 0, 0], 'x and z pinned to the first frame');
    assert.deepEqual(values.filter((_, i) => i % 3 === 1).map(v => +v.toFixed(2)), [0.66, 0.7, 0.66], 'vertical bob kept');
    assert.deepEqual([...fixed.tracks[1].values], [...arm.values], 'other bones untouched');
    assert.equal(+clip.tracks[0].values[8].toFixed(2), 1.1, 'the original clip is not modified');
    assert.equal(inPlace(clip), fixed, 'cached');
});
