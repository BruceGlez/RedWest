// The pile a dead marshal's ore lies in (MINE_PLAN.md, slice 7c): a small box-built sack with a glow, put where he fell. Cross-lane on purpose: a
// placeholder marker so the pile can be found at once; how it looks is the art lane's to change. One group, three meshes, nothing to merge.
import * as THREE from 'three';

export const PILE_REACH = 2.4; // how close he must be to pick it up, and how close a monster must be to take from it

let marker = null;
function build() {
    const group = new THREE.Group();
    const sack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }));
    sack.position.y = 0.45;
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x4a321c, roughness: 1 }));
    knot.position.y = 1.05;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc860 })); // shows in the dark
    glow.position.y = 1.7;
    group.add(sack, knot, glow);
    return group;
}

// Put the marker where the pile is, or take it away when the pile is not on this floor.
export function showPile(scene, pile, floor) {
    if(!pile || pile.floor !== floor) { hidePile(scene); return; }
    if(!marker) marker = build();
    marker.position.set(pile.x, 0, pile.z);
    if(marker.parent !== scene) scene.add(marker);
}
export function hidePile(scene) {
    if(marker?.parent) marker.parent.remove(marker);
    if(!scene) marker = null;
}
