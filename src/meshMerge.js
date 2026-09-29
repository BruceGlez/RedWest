import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Phones pay per draw call. Scenery built from many small boxes that never move on their own can be baked
// into one mesh per material: same look, a fraction of the draw calls.

// Everything under `root` becomes one mesh per material, in root's own space (root's position, rotation
// and scale stay on the returned group). `userData` is copied onto every merged mesh. Only for meshes
// that never move relative to root.
export function mergeByMaterial(root, userData = {}) {
    root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const byMaterial = new Map();
    root.traverse(object => {
        if(!object.isMesh || Array.isArray(object.material)) return;
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        for(const name of Object.keys(geometry.attributes)) {
            if(!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
        }
        geometry.morphAttributes = {};
        geometry.clearGroups();
        geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, object.matrixWorld));
        if(!byMaterial.has(object.material)) byMaterial.set(object.material, []);
        byMaterial.get(object.material).push(geometry);
    });
    const merged = new THREE.Group();
    merged.position.copy(root.position);
    merged.quaternion.copy(root.quaternion);
    merged.scale.copy(root.scale);
    merged.userData = { ...root.userData };
    for(const [material, geometries] of byMaterial) {
        // Every part needs the same attributes to merge; parts without uv lose theirs only if some lack it.
        if(geometries.some(g => !g.attributes.uv)) for(const g of geometries) g.deleteAttribute('uv');
        const geometry = mergeGeometries(geometries, false);
        for(const g of geometries) g.dispose();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { ...userData };
        merged.add(mesh);
    }
    return merged;
}
