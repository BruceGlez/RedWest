import test from 'node:test';
import assert from 'node:assert/strict';
import { BEDS, SURFACES, bedFor, footstepFor } from '../src/soundscape.js';
import { ATMOSPHERES, SOUND, soundFor } from '../src/atmosphere.js';
import { OUTLAWS } from '../src/outlaws.js';

test('every stage has a bed and a ground that sound exists for', () => {
    for(const outlaw of OUTLAWS) {
        const sound = soundFor(outlaw.id);
        assert.ok(BEDS[sound.bed], `${outlaw.id}: bed ${sound.bed}`);
        assert.ok(SURFACES[sound.surface], `${outlaw.id}: surface ${sound.surface}`);
    }
    for(const id of Object.keys(SOUND)) if(id !== 'default') assert.ok(ATMOSPHERES[id], `${id} is a stage`);
    assert.equal(soundFor('a-future-outlaw'), SOUND.default);
});

test('beds stay a quiet layer, and louder wind is louder', () => {
    for(const [name, bed] of Object.entries(BEDS)) {
        const calm = bedFor({ bed: name }, 0);
        const gale = bedFor({ bed: name }, 1);
        assert.ok(calm.level > 0 && gale.level <= 0.08, `${name}: quiet`);
        assert.ok(gale.level > calm.level, `${name}: wind raises the level`);
        assert.ok(bed.pitch >= 200 && bed.pitch <= 800);
    }
});

test('footsteps are short and soft, and the two feet differ', () => {
    for(const [name, spec] of Object.entries(SURFACES)) {
        assert.ok(spec.decay > 0 && spec.decay <= 0.15 && spec.gain > 0 && spec.gain <= 0.15, `${name}: short and soft`);
        const left = footstepFor(name, true);
        const right = footstepFor(name, false);
        assert.notEqual(left.freq, right.freq);
    }
    assert.deepEqual(footstepFor('nowhere', true).filter, SURFACES.sand.filter);
});
