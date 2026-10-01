import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GUESTS, TOWN_LAYOUT } from '../src/townScene.js';
import { OUTLAWS } from '../src/outlaws.js';
import { TOWN_AREA } from '../src/townDistricts.js';

test('every outlaw puts something in town, inside the town and clear of the buildings', () => {
    for(const outlaw of OUTLAWS) assert.ok(GUESTS[outlaw.id], `${outlaw.id} has a guest prop`);
    for(const id of Object.keys(GUESTS)) assert.ok(OUTLAWS.some(o => o.id === id), `${id} is an outlaw`);
    for(const [id, guest] of Object.entries(GUESTS)) {
        const [x, z] = guest.at;
        assert.ok(x >= TOWN_AREA.minX && x <= TOWN_AREA.maxX && z >= TOWN_AREA.minZ && z <= TOWN_AREA.maxZ, `${id}: inside the town`);
        for(const spot of TOWN_LAYOUT) assert.ok(Math.hypot(x - spot.x, z - spot.z) >= 3.5, `${id}: not inside ${spot.id}`);
    }
});

test('each prop is a handful of parts of a sensible size', () => {
    for(const [id, guest] of Object.entries(GUESTS)) {
        const parts = guest.parts();
        assert.ok(parts.length >= 3 && parts.length <= 14, `${id}: ${parts.length} parts`);
        const group = new THREE.Group();
        parts.forEach(part => group.add(part));
        const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
        assert.ok(size.x <= 12 && size.y <= 10 && size.z <= 6, `${id}: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`);
    }
});
