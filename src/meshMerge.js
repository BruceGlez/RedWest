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

// Enemies that animate (swinging legs and arms) cannot be merged into a static mesh, but they can be baked
// into ONE skinned mesh plus ONE skinned outline: every part is weighted to the bone it hung from. The nodes
// named in `boneNames` become bones with the same name and transform, so animateCharacter (which looks them up
// with getObjectByName and rotates or moves them) keeps working unchanged. A bandit goes from 11 body meshes
// and 5 outlines to 2 draw calls. Colours move into vertex colours, so `material` must have vertexColors on.
// Parts under userData.noOutline (hp bar, aim laser) stay ordinary meshes. Everything is baked in `container`'s
// own space, so a parent's scale or turn (the boss's 1.5x) keeps applying on top as before.
export function bakeSkinned(container, { boneNames, material, outlineMaterial, outlineWidth, minOutline = 0.25 }) {
    const names = new Set(boneNames);
    container.updateMatrixWorld(true);
    const toContainer = new THREE.Matrix4().copy(container.matrixWorld).invert();
    const parts = [];
    const boneNodes = [];
    (function collect(node, owner) {
        if(node.userData.noOutline || node.userData.isOutline) return;
        if(names.has(node.name)) { owner = node; boneNodes.push(node); }
        if(node.isMesh && !Array.isArray(node.material)) {
            parts.push({ mesh: node, owner, matrix: new THREE.Matrix4().multiplyMatrices(toContainer, node.matrixWorld) });
        }
        for(const child of node.children) collect(child, owner);
    })(container, null);

    // The static parts hang from a root bone that never moves; each named node becomes a bone of its own.
    const rootBone = new THREE.Bone();
    rootBone.name = 'root';
    const bones = [rootBone];
    const boneOf = new Map();
    for(const node of boneNodes) {
        const bone = new THREE.Bone();
        bone.name = node.name;
        bone.position.copy(node.position);
        bone.quaternion.copy(node.quaternion);
        bone.scale.copy(node.scale);
        for(const child of [...node.children]) bone.add(child);
        node.parent.add(bone);
        node.parent.remove(node);
        boneOf.set(node, bone);
        bones.push(bone);
    }

    const bodyGeometries = [];
    const outlineGeometries = [];
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    const skinned = (geometry, matrix, boneIndex, keep) => {
        const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        for(const name of Object.keys(baked.attributes)) if(!keep.includes(name)) baked.deleteAttribute(name);
        baked.morphAttributes = {};
        baked.clearGroups();
        baked.applyMatrix4(matrix);
        const count = baked.attributes.position.count;
        const indices = new Uint16Array(count * 4);
        const weights = new Float32Array(count * 4);
        for(let i = 0; i < count; i++) { indices[i * 4] = boneIndex; weights[i * 4] = 1; }
        baked.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
        baked.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
        return baked;
    };
    for(const { mesh, owner, matrix } of parts) {
        const boneIndex = owner ? bones.indexOf(boneOf.get(owner)) : 0;
        const source = mesh.material;
        const color = new THREE.Color().copy(source.color);
        if(source.emissive) color.add(source.emissive); // metals and ghosts glow a little: brighten their colour instead
        const body = skinned(mesh.geometry, matrix, boneIndex, ['position', 'normal']);
        const colors = new Float32Array(body.attributes.position.count * 3);
        for(let i = 0; i < colors.length; i += 3) { colors[i] = Math.min(1, color.r); colors[i + 1] = Math.min(1, color.g); colors[i + 2] = Math.min(1, color.b); }
        body.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        bodyGeometries.push(body);

        // Same outline rule as the code-built characters: a slightly larger back-face copy, skipping tiny parts.
        const geometry = mesh.geometry;
        if(!geometry.boundingBox) geometry.computeBoundingBox();
        geometry.boundingBox.getSize(size);
        if(Math.max(size.x, size.y, size.z) < minOutline) continue;
        geometry.boundingBox.getCenter(center);
        const scale = new THREE.Vector3(
            1 + (2 * outlineWidth / Math.max(size.x, 0.05)),
            1 + (2 * outlineWidth / Math.max(size.y, 0.05)),
            1 + (2 * outlineWidth / Math.max(size.z, 0.05))
        );
        const offset = new THREE.Vector3(center.x * (1 - scale.x), center.y * (1 - scale.y), center.z * (1 - scale.z));
        const grow = new THREE.Matrix4().compose(offset, new THREE.Quaternion(), scale);
        outlineGeometries.push(skinned(geometry, new THREE.Matrix4().multiplyMatrices(matrix, grow), boneIndex, ['position']));
    }

    // The baked parts go; a part that carried children (a hand holding a gun with its muzzle) leaves an empty
    // group in its place so the children keep their places.
    for(const { mesh } of parts) {
        if(boneOf.has(mesh) || !mesh.parent) continue;
        if(mesh.children.length) {
            const holder = new THREE.Group();
            holder.position.copy(mesh.position);
            holder.quaternion.copy(mesh.quaternion);
            holder.scale.copy(mesh.scale);
            for(const child of [...mesh.children]) holder.add(child);
            mesh.parent.add(holder);
        }
        mesh.parent.remove(mesh);
    }

    const bodyGeometry = mergeGeometries(bodyGeometries, false);
    const outlineGeometry = mergeGeometries(outlineGeometries, false);
    for(const g of [...bodyGeometries, ...outlineGeometries]) g.dispose();
    container.add(rootBone);
    container.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    const body = new THREE.SkinnedMesh(bodyGeometry, material);
    body.castShadow = true;
    body.userData.ownGeometry = true;
    container.add(body);
    body.bind(skeleton);
    const outline = new THREE.SkinnedMesh(outlineGeometry, outlineMaterial);
    outline.userData.isOutline = true;
    outline.userData.ownGeometry = true;
    outline.raycast = () => {};
    container.add(outline);
    outline.bind(skeleton, body.bindMatrix);
    return { body, outline, skeleton };
}

// Frees what bakeSkinned made when the enemy leaves the scene: geometry and the skeleton's bone texture.
// Materials are shared, and imported models share their geometry, so only baked meshes are touched.
export function disposeBaked(root) {
    root.traverse(object => {
        if(!object.isSkinnedMesh || !object.userData.ownGeometry) return;
        object.geometry.dispose();
        object.skeleton.dispose();
    });
}
