// Shared clean-up for AI-generated characters (Meshy GLB), used by optimize-model.mjs and meshy.mjs.
// Needs: npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp

// draw: a cowboy quick draw (the game plays its draw-and-fire part before a shot);
// walkShoot: walking forward aiming a pistol, used while shooting at walking pace or standing.
export const ROLES = ['idle', 'run', 'runShoot', 'dead', 'draw', 'walkShoot'];

// Which of the game's animations a clip name means, or null. Order matters: "Run and Shoot" is not "run".
export function roleForClip(name) {
    const n = String(name).toLowerCase().replace(/[^a-z]/g, '');
    if(/draw/.test(n)) return 'draw';
    if(/walk.*shoot|shoot.*walk/.test(n)) return 'walkShoot';
    if(/shoot|fire|gun/.test(n)) return 'runShoot';
    if(/dead|dying|death|die/.test(n)) return 'dead';
    if(/idle|stand|breath/.test(n)) return 'idle';
    if(/run|jog|sprint/.test(n)) return 'run';
    return null;
}

async function loadTools() {
    try {
        const [core, extensions, functions, sharp] = await Promise.all([
            import('@gltf-transform/core'), import('@gltf-transform/extensions'),
            import('@gltf-transform/functions'), import('sharp')
        ]);
        return { ...core, ...extensions, ...functions, sharp: sharp.default };
    } catch {
        throw new Error('Model tools missing. Run: npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp');
    }
}

// Reads a GLB, keeps one clip per game role (renamed idle / run / runShoot / dead), drops the
// normal and roughness maps (the game is cel-shaded), shrinks the colour texture to 1024px JPEG.
// `requested`: the roles in the order the clips were requested, used when a clip name says nothing.
export async function optimizeCharacter(input, output, { requested = [] } = {}) {
    const t = await loadTools();
    const io = new t.NodeIO().registerExtensions(t.ALL_EXTENSIONS);
    const doc = await io.read(input);
    const root = doc.getRoot();
    for(const material of root.listMaterials()) {
        material.setNormalTexture(null);
        material.setMetallicRoughnessTexture(null);
        material.setMetallicFactor(0);
        material.setRoughnessFactor(1);
    }
    const kept = new Set();
    root.listAnimations().forEach((animation, index) => {
        const role = roleForClip(animation.getName()) ?? requested[index] ?? null;
        if(role && !kept.has(role)) {
            animation.setName(role);
            kept.add(role);
        } else {
            animation.dispose();
        }
    });
    await doc.transform(t.prune(), t.dedup(), t.textureCompress({ encoder: t.sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 82 }));
    await io.write(output, doc);
    return { animations: [...kept], missing: ROLES.filter(role => !kept.has(role)) };
}
