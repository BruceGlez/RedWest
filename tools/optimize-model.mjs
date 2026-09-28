// Shrink a character exported from the Meshy website for phones (see model-utils.mjs).
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp
//   node tools/optimize-model.mjs input.glb public/models/name.glb
import { optimizeCharacter } from './model-utils.mjs';

const [input, output] = process.argv.slice(2);
if(!input || !output) {
    console.error('Usage: node tools/optimize-model.mjs input.glb public/models/name.glb');
    process.exit(1);
}
const result = await optimizeCharacter(input, output);
console.log(`Wrote ${output}: animations ${result.animations.join(', ') || 'none'}${result.missing.length ? ` (missing: ${result.missing.join(', ')})` : ''}`);
