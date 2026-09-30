// Story panel pictures from their prompts (tools/story-prompts.mjs) through the OpenAI Images API, saved to
// art/story/<name>.png for approval, and shrunk into public/story/<name>.webp for the game.
//
//   export OPENAI_API_KEY=...   (in the environment's settings; never commit it)
//   npm i --no-save sharp
//   node tools/story-picture.mjs <name|all> [--quality medium] [--model gpt-image-1]
import { mkdir, writeFile } from 'node:fs/promises';
import { PANELS } from './story-prompts.mjs';

const args = process.argv.slice(2);
const which = args[0];
const option = (key, fallback) => { const i = args.indexOf(`--${key}`); return i >= 0 ? args[i + 1] : fallback; };
if(!which) throw new Error('Usage: node tools/story-picture.mjs <name|all> [--quality medium] [--model gpt-image-1]');
if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set (add it in the environment settings).');
const names = which === 'all' ? Object.keys(PANELS) : [which];
const { default: sharp } = await import('sharp');
await mkdir('art/story', { recursive: true });
await mkdir('public/story', { recursive: true });
for(const name of names) {
    if(!PANELS[name]) throw new Error(`Unknown panel ${name}`);
    const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: option('model', 'gpt-image-1'), prompt: PANELS[name], size: '1536x1024', quality: option('quality', 'medium'), n: 1 })
    });
    const data = await response.json().catch(() => ({}));
    if(!response.ok) throw new Error(`OpenAI image request failed for ${name} (${response.status}): ${data.error?.message || JSON.stringify(data)}`);
    const png = Buffer.from(data.data?.[0]?.b64_json ?? '', 'base64');
    if(!png.length) throw new Error(`No image for ${name}`);
    await writeFile(`art/story/${name}.png`, png);
    const webp = await sharp(png).resize({ width: 960 }).webp({ quality: 80 }).toBuffer();
    await writeFile(`public/story/${name}.webp`, webp);
    console.log(`${name}: art/story/${name}.png, public/story/${name}.webp (${Math.round(webp.length / 1024)} KB)`);
}
