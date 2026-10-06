import test from 'node:test';
import assert from 'node:assert/strict';
import { createLightEaterMesh } from '../src/assets.js';

test('the light eater is a small quadruped bug with a glow of its own', () => {
    const bug = createLightEaterMesh();
    assert.equal(bug.userData.type, 'lighteater');
    assert.equal(bug.userData.quadruped, true, 'it runs on the quadruped bones, like the crawler');
    assert.ok(bug.userData.ember, 'the abdomen glows (an unlit child the rules can dim)');
    assert.equal(bug.userData.ember.material.isMeshBasicMaterial, true);
});
