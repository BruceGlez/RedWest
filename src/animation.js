import * as THREE from 'three';

export function animateCharacter(mesh, time, isMoving) {
    const type = mesh.userData.type || 'bandit';
    
    // BAT: the wings flap, and it bobs in the air
    if(type === 'bat') {
        const flap = Math.sin(time * 24 + (mesh.userData.phase ?? 0)) * 0.8;
        const left = mesh.getObjectByName('wingL'), right = mesh.getObjectByName('wingR');
        if(left) left.rotation.z = flap;
        if(right) right.rotation.z = -flap;
        return;
    }

    // FOUR-LEGGED ANIMATION (wolves, horses)
    if(type === 'wolf' || mesh.userData.quadruped) {
        const fl = mesh.getObjectByName('fl'); const fr = mesh.getObjectByName('fr');
        const bl = mesh.getObjectByName('bl'); const br = mesh.getObjectByName('br');
        if(fl && fr && bl && br && isMoving) {
            fl.rotation.x = Math.sin(time * 15) * 0.4; fr.rotation.x = Math.cos(time * 15) * 0.4;
            bl.rotation.x = Math.cos(time * 15) * 0.4; br.rotation.x = Math.sin(time * 15) * 0.4;
        }
        return;
    }

    // SNAKE: segments sway side to side
    if(mesh.userData.segments) {
        mesh.userData.segments.forEach((seg, i) => { seg.position.x = Math.sin((time * 10) - (i * 0.9)) * 0.35; });
        return;
    }

    // HUMANOID ANIMATION
    const leftLeg = mesh.getObjectByName('leftLeg'); const rightLeg = mesh.getObjectByName('rightLeg');
    const leftArm = mesh.getObjectByName('leftArm'); const rightArm = mesh.getObjectByName('rightArm');
    
    // Arm Aiming Logic
    const targetArmAngle = (mesh.userData.isAiming) ? 1.57 : 2.8;
    if (mesh.userData.armAngle === undefined) mesh.userData.armAngle = 2.8;
    mesh.userData.armAngle = THREE.MathUtils.lerp(mesh.userData.armAngle, targetArmAngle, 0.15);

    if(isMoving) {
        if(leftLeg) leftLeg.rotation.x = Math.sin(time * 12) * 0.6;
        if(rightLeg) rightLeg.rotation.x = Math.sin(time * 12 + Math.PI) * 0.6;
        if(leftArm) leftArm.rotation.x = Math.sin(time * 12 + Math.PI) * 0.6;
        if(rightArm) {
            if(type === 'gunslinger' || type === 'player' || type === 'boss' || mesh.userData.shooter) {
                rightArm.rotation.x = mesh.userData.armAngle + Math.sin(time * 14) * 0.1; 
                rightArm.rotation.z = Math.sin(time * 7) * 0.05; 
            } else { 
                rightArm.rotation.x = Math.sin(time * 12) * 0.6; 
            }
        }
    } else {
        if(leftLeg) leftLeg.rotation.x = 0; if(rightLeg) rightLeg.rotation.x = 0; if(leftArm) leftArm.rotation.x = 0;
        if(rightArm) {
            if(type === 'gunslinger' || type === 'player' || type === 'boss' || mesh.userData.shooter) {
                rightArm.rotation.x = mesh.userData.armAngle + Math.sin(time * 3) * 0.03; 
                rightArm.rotation.z = 0;
            } else { 
                rightArm.rotation.x = 0; 
            }
        }
    }
}