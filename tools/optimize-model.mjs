// Shrink an AI-generated character (Meshy GLB export) for phones: keep only the colour texture
// (the game is cel-shaded), resize it to 1024px JPEG, keep the four animations the game uses.
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp
//   node tools/optimize-model.mjs input.glb public/models/name.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
// Toon look only needs the colour texture.
for(const m of root.listMaterials()) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setMetallicFactor(0); m.setRoughnessFactor(1); }
// Meshy animation names -> the names the game plays (idle, run, runShoot, dead). Others are dropped.
const KEEP = { Idle_02: 'idle', Idle: 'idle', Running: 'run', Run_and_Shoot: 'runShoot', Dead: 'dead' };
for(const a of root.listAnimations()) {
  if(KEEP[a.getName()]) a.setName(KEEP[a.getName()]); else a.dispose();
}
await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 82 }));
await io.write(out, doc);
